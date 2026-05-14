# Procedural Deadlines Implementation Plan

> **For Hermes:** Implement this directly with strict TDD. This is a small alpha slice; no subagent needed unless it grows.

**Goal:** Add a mobile-first procedural/deadline intelligence slice to the PLT alpha so the demo shows more than factual timeline: court dates, brief due dates, internal start dates, target submission dates, and source-linked reminders.

**Architecture:** Extend the existing `CaseAnalysis` contract with a `procedural_deadlines` array. Keep it fixture-backed for now. Render deadlines in a new mobile tab and hero next-action card. Deadline items must distinguish confirmed vs candidate dates and include source refs.

**Tech Stack:** FastAPI + Pydantic backend fixture; React/Vite/TypeScript frontend; pytest backend tests; `npm run build` for frontend validation.

---

### Task 1: Backend contract test for procedural deadlines

**Objective:** Assert `/api/demo-case` exposes source-linked procedural deadlines with work-back scheduling.

**Files:**
- Modify: `backend/tests/test_demo_case.py`

**Steps:**
1. Add `test_demo_case_exposes_procedural_deadlines_and_workback_schedule`.
2. Run just that test and verify RED: missing `procedural_deadlines`.

### Task 2: Backend model + fixture

**Objective:** Add `ProceduralDeadline` Pydantic model and demo fixture items.

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/demo_data.py`

**Implementation notes:**
- Fields: `title`, `deadline_type`, `due_date`, `due_time`, `status`, `urgency`, `description`, `start_work_date`, `internal_target_date`, `source_refs`, `tasks`.
- Include at least:
  - confirmed `Udienza di convalida e misura`, due 2026-04-20 09:30;
  - candidate `Memoria difensiva / note per la misura`, due 2026-05-31, start 2026-05-15, internal target 2026-05-29.
3. Run targeted backend test and full backend suite.

### Task 3: Frontend type and tab rendering

**Objective:** Add a `Scadenze` tab with mobile deadline cards.

**Files:**
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/styles.css`

**Implementation notes:**
- Add `ProceduralDeadline` TypeScript type.
- Add `procedural_deadlines` to `CaseAnalysis`.
- Add tab id `deadlines`, label `Scadenze`.
- Render confirmed/candidate chips, due date/time, start-work date, internal target, tasks, and source badge.
- Hero next-action card should use the first procedural deadline, not infer from timeline title.

### Task 4: Verify and keep services alive

**Objective:** Ensure tests/build/browser are clean and ports still serve the alpha.

**Commands:**
- `backend/.venv/bin/python -m pytest backend/tests -q`
- `npm run build --prefix frontend`
- `curl http://127.0.0.1:8000/api/health`
- `curl http://127.0.0.1:5173/`
- Browser check for `Scadenze` text.

### Task 5: Commit if clean

**Objective:** Preserve the slice in git after verification.

**Commands:**
- `git status --short`
- `git add ...`
- `git commit -m "Add procedural deadline intelligence to alpha"`
