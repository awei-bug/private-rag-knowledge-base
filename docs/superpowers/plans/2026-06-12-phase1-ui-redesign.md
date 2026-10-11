# Phase 1 UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the frontend into the target screenshot-style local knowledge base UI using real backend data and working interactions.

**Architecture:** Extend the existing local RAG backend just enough to support real retrieval-mode input and local-mode activity data, then rebuild the frontend state and page shell around real derived stats, categories, activities, and multi-turn chat history. Keep the current document and query APIs as the backbone.

**Tech Stack:** FastAPI, Pydantic, React, TypeScript, Vite, pytest

---

## File Map

- Modify: `app/models/query.py`
- Modify: `app/api/routes/query.py`
- Modify: `app/retrieval/pipeline.py`
- Modify: `app/retrieval/service.py`
- Modify: `app/models/audit.py`
- Modify: `app/auth.py`
- Create: `tests/test_phase1_ui_api.py`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/state.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Modify: `README.md`

### Task 1: Support retrieval mode and local activity access in the backend

**Files:**
- Modify: `app/models/query.py`
- Modify: `app/api/routes/query.py`
- Modify: `app/auth.py`
- Test: `tests/test_phase1_ui_api.py`

- [ ] **Step 1: Write the failing test**

```python
def test_query_accepts_retrieval_mode(client: TestClient):
    response = client.post(
        "/api/v1/query",
        json={"question": "What is RAG?", "filters": {}, "retrieval_mode": "semantic"},
    )
    assert response.status_code == 200


def test_local_mode_allows_log_read_access(client: TestClient):
    response = client.get("/api/v1/query/logs")
    assert response.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_phase1_ui_api.py -v`
Expected: FAIL because `retrieval_mode` is not in the request model and logs still require role-gated access in local mode.

- [ ] **Step 3: Write minimal implementation**

```python
# app/models/query.py
class QueryRequest(BaseModel):
    question: str = Field(min_length=1)
    filters: dict[str, str] = Field(default_factory=dict)
    retrieval_mode: Literal["precise", "semantic", "hybrid"] = "hybrid"
```

```python
# app/auth.py
def is_local_mode_request() -> bool:
    return get_settings().local_mode_enabled
```

```python
# app/api/routes/query.py
def list_query_logs(...):
    if not is_local_mode_request():
        require_roles("admin", "auditor")
    ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_phase1_ui_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/models/query.py app/api/routes/query.py app/auth.py tests/test_phase1_ui_api.py
git commit -m "feat: support retrieval mode and local activity access"
```

### Task 2: Carry retrieval mode through the query path

**Files:**
- Modify: `app/retrieval/pipeline.py`
- Modify: `app/retrieval/service.py`
- Test: `tests/test_phase1_ui_api.py`

- [ ] **Step 1: Write the failing test**

```python
def test_query_semantic_mode_returns_answer(client: TestClient):
    response = client.post(
        "/api/v1/query",
        json={"question": "How does retrieval work?", "filters": {}, "retrieval_mode": "semantic"},
    )
    assert response.status_code == 200
    assert "answer" in response.json()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_phase1_ui_api.py::test_query_semantic_mode_returns_answer -v`
Expected: FAIL before the retrieval request path accepts and forwards the mode safely.

- [ ] **Step 3: Write minimal implementation**

```python
# app/retrieval/pipeline.py
if request.retrieval_mode == "precise":
    score = lexical_score + 0.05 * meta_hits
elif request.retrieval_mode == "semantic":
    score = semantic_score + 0.05 * meta_hits
else:
    score = ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_phase1_ui_api.py::test_query_semantic_mode_returns_answer -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/retrieval/pipeline.py app/retrieval/service.py tests/test_phase1_ui_api.py
git commit -m "feat: handle retrieval modes in query pipeline"
```

### Task 3: Build frontend data contracts for stats, categories, activities, and chat history

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/state.tsx`

- [ ] **Step 1: Write the failing test**

Use the TypeScript build as the contract gate for the new state shape.

```ts
type ActivityItem = {
  id: string;
  kind: "upload" | "sync" | "delete" | "query";
  text: string;
  createdAt: string;
};
```

- [ ] **Step 2: Run build to verify it fails once old state assumptions are removed**

Run: `npm run build`
Expected: FAIL until `App.tsx` is updated to consume the new state shape.

- [ ] **Step 3: Write minimal implementation**

```ts
type RetrievalMode = "precise" | "semantic" | "hybrid";
type ChatMessage = { ... };
type CategoryStat = { label: string; count: number };
type ActivityItem = { ... };
```

- [ ] **Step 4: Run build to verify the state layer compiles**

Run: `npm run build`
Expected: FAIL next in the view layer only.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/state.tsx
git commit -m "refactor: add phase1 ui state contracts"
```

### Task 4: Rebuild the page shell to match the target layout with real data

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing test**

Use the build as the regression gate for the new page structure.

```tsx
<div className="app-frame">
  <header className="topbar" />
  <div className="content-shell">
    <aside className="sidebar" />
    <section className="chat-stage" />
  </div>
</div>
```

- [ ] **Step 2: Run build to verify it fails**

Run: `npm run build`
Expected: FAIL until the new component tree and styles are consistent.

- [ ] **Step 3: Write minimal implementation**

```tsx
// build topbar, sidebar stats/categories/activities, chat history, mode toggle, settings modal, footer bar
```

- [ ] **Step 4: Run build to verify it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/styles.css
git commit -m "feat: redesign frontend to screenshot-style local rag ui"
```

### Task 5: Update docs and run full verification

**Files:**
- Modify: `README.md`
- Modify: `tests/test_smoke.py`

- [ ] **Step 1: Write the failing test**

```python
def test_query_logs_accessible_in_local_mode(client: TestClient):
    response = client.get("/api/v1/query/logs")
    assert response.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails if the smoke suite is stale**

Run: `pytest tests/test_smoke.py -v`
Expected: FAIL before the updated assertion is added.

- [ ] **Step 3: Write minimal implementation**

```md
# README.md
- Screenshot-style layout
- Real categories from document metadata/source
- Real recent activities from logs and local actions
- Retrieval mode switching in the chat area
```

- [ ] **Step 4: Run verification**

Run: `pytest tests -v`
Expected: PASS

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md tests/test_smoke.py
git commit -m "docs: update phase1 ui behavior"
```

## Self-Review

- Spec coverage checked:
  - Screenshot-style layout is covered by Task 4.
  - Real categories, real stats, recent activities, and chat history are covered by Task 3 and Task 4.
  - Retrieval mode support is covered by Task 1 and Task 2.
  - Docs and verification are covered by Task 5.
- Placeholder scan checked:
  - No TODO/TBD markers remain.
- Type consistency checked:
  - `retrieval_mode`, `ActivityItem`, `CategoryStat`, `ChatMessage`, and `RetrievalMode` naming are consistent across tasks.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-12-phase1-ui-redesign.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Default for this run: Inline Execution, because the user explicitly requested direct execution without further suggestions.
