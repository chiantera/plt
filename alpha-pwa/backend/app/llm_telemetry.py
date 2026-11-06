"""Content-free telemetry for LLM calls.

Each provider attempt produces one `LLMCallRecord`. Each failover decision
produces one `LLMFailoverEvent`. Sinks receive both; the default sink writes one
JSON object per log line on the `plt.llm` logger. A tracing backend plugs in with
`add_sink()` and needs no change to the call sites.

Case material is sensitive legal data, so these types have no field that can hold
it: only identifiers, enums, numbers and exception class names. Exception messages
are deliberately dropped because a provider error can echo request data.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Union

logger = logging.getLogger("plt.llm")


# ── Events ───────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class LLMCallRecord:
    """One attempt against one provider. `status`: ok | error | cancelled."""

    call_id: str  # shared by every attempt of one logical request
    endpoint: str
    attempt: int
    is_failover: bool
    provider: str
    model: str
    mode: str
    status: str
    latency_ms: int
    first_token_ms: int | None = None
    input_tokens: int | None = None  # None means the provider did not report it, not zero
    output_tokens: int | None = None
    cached_input_tokens: int | None = None
    estimated_cost_usd: float | None = None  # None means unknown model or missing usage
    finish_reason: str | None = None
    error_kind: str | None = None
    error_type: str | None = None
    http_status: int | None = None
    event: str = "llm_call"


@dataclass(frozen=True)
class LLMFailoverEvent:
    """A failover decision after a failed attempt. `outcome`: switched | skipped."""

    call_id: str
    endpoint: str
    mode: str
    outcome: str
    from_provider: str
    from_model: str
    reason: str | None
    http_status: int | None = None
    to_provider: str | None = None
    to_model: str | None = None
    skip_reason: str | None = None  # text_already_streamed | no_further_provider
    event: str = "llm_failover"


LLMEvent = Union[LLMCallRecord, LLMFailoverEvent]
LLMSink = Callable[[LLMEvent], None]


# ── Sinks ────────────────────────────────────────────────────────────────────


def log_sink(event: LLMEvent) -> None:
    healthy = event.event == "llm_call" and event.status == "ok"
    level = logging.INFO if healthy else logging.WARNING
    logger.log(level, "%s", json.dumps(asdict(event), separators=(",", ":")))


_sinks: list[LLMSink] = [log_sink]


def add_sink(sink: LLMSink) -> None:
    """Register a telemetry consumer, such as a Langfuse or OpenTelemetry adapter."""
    _sinks.append(sink)


def remove_sink(sink: LLMSink) -> None:
    _sinks.remove(sink)


def emit(event: LLMEvent) -> None:
    """Deliver an event to every sink. A failing sink never affects the LLM call."""
    for sink in tuple(_sinks):
        try:
            sink(event)
        except Exception as exc:  # noqa: BLE001 - telemetry must not break requests
            logger.warning("telemetry sink failed: %s", type(exc).__name__)


# ── Cost estimate ────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ModelPrice:
    """USD per 1M tokens."""

    input: float
    output: float
    cached_input: float | None = None
    peak_multiplier: float = 1.0


# Sources, checked 2026-11-06:
#   https://api-docs.deepseek.com/quick_start/pricing/ (off-peak rates listed here)
#   Anthropic first-party rates for Haiku 4.5 and Opus 4.7
# Unlisted models get estimated_cost_usd=None rather than a guessed figure.
_DEEPSEEK_FLASH = ModelPrice(input=0.15, cached_input=0.003, output=0.60, peak_multiplier=2.0)
_PRICES: dict[str, ModelPrice] = {
    "deepseek-flash": _DEEPSEEK_FLASH,
    "deepseek-v4-flash": _DEEPSEEK_FLASH,  # retired alias, billed at the Flash price
    "deepseek-v4-pro": ModelPrice(input=0.66, cached_input=0.022, output=1.98, peak_multiplier=2.0),
    "claude-haiku-4-5-20251001": ModelPrice(input=1.00, output=5.00),
    "claude-opus-4-7": ModelPrice(input=5.00, output=25.00),
}


def _is_deepseek_peak(at: datetime) -> bool:
    """Peak is 01-04 and 06-10 UTC, Mon-Fri. Chinese public holidays are not modelled,
    so estimates on those days read high."""
    at = at.astimezone(timezone.utc)
    return at.weekday() < 5 and (1 <= at.hour < 4 or 6 <= at.hour < 10)


def estimate_cost_usd(
    model: str,
    input_tokens: int | None,
    output_tokens: int | None,
    cached_input_tokens: int | None = None,
    at: datetime | None = None,
) -> float | None:
    if input_tokens is None or output_tokens is None:
        return None
    if model.endswith(":free"):
        return 0.0
    price = _PRICES.get(model)
    if price is None:
        return None
    cached = min(cached_input_tokens or 0, input_tokens)
    cached_rate = price.input if price.cached_input is None else price.cached_input
    cost = ((input_tokens - cached) * price.input + cached * cached_rate + output_tokens * price.output) / 1_000_000
    if price.peak_multiplier != 1.0 and _is_deepseek_peak(at or datetime.now(timezone.utc)):
        cost *= price.peak_multiplier
    return round(cost, 6)


# ── Error classification ─────────────────────────────────────────────────────


def classify_error(exc: BaseException) -> tuple[str, str, int | None]:
    """Return (kind, class name, HTTP status). Never reads the exception message.

    Matches on names and status rather than SDK classes so this module needs no
    provider SDK, and so raw transport errors raised mid-stream are covered too.
    """
    name = type(exc).__name__
    status = getattr(exc, "status_code", None)
    status = status if isinstance(status, int) else None
    if "Timeout" in name:
        kind = "timeout"
    elif status == 429 or "RateLimit" in name:
        kind = "rate_limit"
    elif status in (401, 403):
        kind = "auth"
    elif status == 402:
        kind = "billing"
    elif status is not None and status >= 500:
        kind = "server"
    elif status is not None and status >= 400:
        kind = "bad_request"
    elif "Connect" in name or "Protocol" in name or "Network" in name:
        kind = "connection"
    elif "Interrupted" in name:
        kind = "interrupted"
    else:
        kind = "other"
    return kind, name, status


# ── Per-attempt tracker ──────────────────────────────────────────────────────


def new_call_id() -> str:
    return uuid.uuid4().hex[:16]


class LLMCallTracker:
    """Times one provider attempt and emits its record when the block exits.

    A GeneratorExit (client disconnected mid-stream) is recorded as `cancelled`,
    not `error`, so a closed browser tab does not look like a provider outage.
    """

    def __init__(
        self,
        *,
        call_id: str,
        endpoint: str,
        attempt: int,
        provider: str,
        model: str,
        mode: str,
    ) -> None:
        self.call_id = call_id
        self.endpoint = endpoint
        self.attempt = attempt
        self.provider = provider
        self.model = model
        self.mode = mode
        self.input_tokens: int | None = None
        self.output_tokens: int | None = None
        self.cached_input_tokens: int | None = None
        self.finish_reason: str | None = None
        self.error_kind: str | None = None
        self.http_status: int | None = None
        self._started = 0.0
        self._started_at: datetime | None = None
        self._first_token_ms: int | None = None

    def __enter__(self) -> "LLMCallTracker":
        self._started = time.perf_counter()
        self._started_at = datetime.now(timezone.utc)
        return self

    def _elapsed_ms(self) -> int:
        return int((time.perf_counter() - self._started) * 1000)

    def mark_first_token(self) -> None:
        if self._first_token_ms is None:
            self._first_token_ms = self._elapsed_ms()

    def set_usage(
        self,
        input_tokens: int | None,
        output_tokens: int | None,
        cached_input_tokens: int | None = None,
    ) -> None:
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.cached_input_tokens = cached_input_tokens

    def __exit__(self, exc_type, exc, _tb) -> bool:
        status = "ok"
        error_type = None
        if exc_type is not None:
            if issubclass(exc_type, Exception):
                status = "error"
                self.error_kind, error_type, self.http_status = classify_error(exc)
            else:
                status = "cancelled"
        emit(
            LLMCallRecord(
                call_id=self.call_id,
                endpoint=self.endpoint,
                attempt=self.attempt,
                is_failover=self.attempt > 1,
                provider=self.provider,
                model=self.model,
                mode=self.mode,
                status=status,
                latency_ms=self._elapsed_ms(),
                first_token_ms=self._first_token_ms,
                input_tokens=self.input_tokens,
                output_tokens=self.output_tokens,
                cached_input_tokens=self.cached_input_tokens,
                estimated_cost_usd=estimate_cost_usd(
                    self.model,
                    self.input_tokens,
                    self.output_tokens,
                    self.cached_input_tokens,
                    self._started_at,
                ),
                finish_reason=self.finish_reason,
                error_kind=self.error_kind,
                error_type=error_type,
                http_status=self.http_status,
            )
        )
        return False
