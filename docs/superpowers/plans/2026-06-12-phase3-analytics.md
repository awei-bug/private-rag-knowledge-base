# Phase 3 Analytics View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real analytics workspace with a document relationship graph, query insights, and system monitoring.

**Architecture:** Build a focused analytics service on top of existing document and query log data, expose a small set of analytics endpoints, and add a dedicated frontend analytics view rendered with lightweight SVG/HTML visualizations.

**Tech Stack:** FastAPI, SQLAlchemy, React, TypeScript, Vite, pytest

---

## File Map

- Create: `app/models/analytics.py`
- Create: `app/services/analytics_service.py`
- Create: `app/api/routes/analytics.py`
- Modify: `app/main.py`
- Modify: `app/dependencies.py`
- Create: `tests/test_phase3_analytics_api.py`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/state.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Modify: `README.md`

### Task 1: Add analytics backend endpoints

**Files:**
- Create: `app/models/analytics.py`
- Create: `app/services/analytics_service.py`
- Create: `app/api/routes/analytics.py`
- Modify: `app/main.py`
- Modify: `app/dependencies.py`
- Create: `tests/test_phase3_analytics_api.py`

- [ ] **Step 1: Write the failing test**

```python
def test_analytics_overview_returns_real_metrics(client: TestClient):
    response = client.get("/analytics/overview")
    assert response.status_code == 200
    assert "document_count" in response.json()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_phase3_analytics_api.py -v`
Expected: FAIL because no analytics routes or service exist.

- [ ] **Step 3: Write minimal implementation**

```python
# add overview, document-graph, query-insights, system-metrics endpoints and analytics models
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_phase3_analytics_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/models/analytics.py app/services/analytics_service.py app/api/routes/analytics.py app/main.py app/dependencies.py tests/test_phase3_analytics_api.py
git commit -m "feat: add analytics backend endpoints"
```

### Task 2: Add meaningful graph and insights calculations

**Files:**
- Modify: `app/services/analytics_service.py`
- Test: `tests/test_phase3_analytics_api.py`

- [ ] **Step 1: Write the failing test**

```python
def test_document_graph_contains_explainable_edges(client: TestClient):
    response = client.get("/analytics/document-graph")
    assert response.status_code == 200
    assert "edges" in response.json()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_phase3_analytics_api.py::test_document_graph_contains_explainable_edges -v`
Expected: FAIL until graph construction includes explainable relationship reasons.

- [ ] **Step 3: Write minimal implementation**

```python
# create same_category/same_source/shared_keywords/semantic_similarity edges with reasons
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_phase3_analytics_api.py::test_document_graph_contains_explainable_edges -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/analytics_service.py tests/test_phase3_analytics_api.py
git commit -m "feat: calculate explainable analytics relationships"
```

### Task 3: Add frontend analytics data contracts and state

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/state.tsx`

- [ ] **Step 1: Write the failing test**

Use the build as the contract gate for analytics state.

```ts
type AnalyticsOverview = { document_count: number; chunk_count: number; ... };
```

- [ ] **Step 2: Run build to verify it fails once the new analytics view is referenced**

Run: `npm run build`
Expected: FAIL until analytics state and API types exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// add analytics API calls, analytics state, refreshAnalytics action, selected analytics view
```

- [ ] **Step 4: Run build to verify the data layer compiles**

Run: `npm run build`
Expected: FAIL next in `App.tsx` until the analytics UI is implemented.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/state.tsx
git commit -m "refactor: add analytics data layer"
```

### Task 4: Build the analytics workspace UI

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing test**

Use the build as the UI regression gate.

```tsx
<section className="analytics-shell">
  <div className="analytics-overview" />
  <div className="analytics-graph" />
  <div className="analytics-insights" />
  <div className="analytics-system" />
</section>
```

- [ ] **Step 2: Run build to verify it fails**

Run: `npm run build`
Expected: FAIL until the analytics UI and styles are added.

- [ ] **Step 3: Write minimal implementation**

```tsx
// add analytics tab toggle, graph canvas, topic bars, query frequency chart, system metric cards
```

- [ ] **Step 4: Run build to verify it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/styles.css
git commit -m "feat: add analytics workspace ui"
```

### Task 5: Update docs and run verification

**Files:**
- Modify: `README.md`
- Modify: `tests/test_smoke.py`

- [ ] **Step 1: Write the failing test**

```python
def test_analytics_endpoints_are_available(client: TestClient):
    response = client.get("/analytics/overview")
    assert response.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails if smoke coverage is stale**

Run: `pytest tests/test_smoke.py -v`
Expected: FAIL before the new analytics assertion is added.

- [ ] **Step 3: Write minimal implementation**

```md
# README.md
- analytics workspace with document graph
- query insights and popular topics
- system resource monitoring
```

- [ ] **Step 4: Run verification**

Run: `pytest tests -v`
Expected: PASS

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md tests/test_smoke.py
git commit -m "docs: describe analytics workspace"
```

## Self-Review

- Spec coverage checked:
  - Overview metrics are covered by Task 1.
  - Explainable relationship graph is covered by Task 2.
  - Frontend analytics data/state is covered by Task 3.
  - Analytics UI is covered by Task 4.
  - Docs and verification are covered by Task 5.
- Placeholder scan checked:
  - No TODO/TBD markers remain.
- Type consistency checked:
  - `document_count`, `chunk_count`, graph nodes/edges, query insights, and system metrics naming is consistent.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-12-phase3-analytics.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Default for this run: Inline Execution, because the user explicitly requested direct execution.
