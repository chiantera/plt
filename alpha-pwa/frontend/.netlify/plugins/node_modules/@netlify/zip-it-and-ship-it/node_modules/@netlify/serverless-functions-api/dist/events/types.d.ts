export interface EventType<T = unknown> {
    validate(raw: unknown): string | null;
    parse(raw: unknown): T;
    buildResponse(result?: unknown): Response;
}
