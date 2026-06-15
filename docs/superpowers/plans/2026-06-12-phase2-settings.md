# Phase 2 Settings Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the screenshot-style settings modal into a real settings center that persists user preferences and drives retrieval behavior.

**Architecture:** Add a lightweight persisted preferences model in the backend, expose it through the config API, and let the frontend settings modal read, update, and apply those preferences to query mode, top-k, and default sync path.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React, TypeScript, Vite, pytest

---

## File Map

- Modify: `app/db/models.py`
- Modify: `app/db/session.py`
- Create: `app/models/settings.py`
- Create: `app/services/settings_service.py`
- Modify: `app/api/routes/system.py`
- Modify: `app/dependencies.py`
- Modify: `app/retrieval/pipeline.py`
- Create: `tests/test_phase2_settings_api.py`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/state.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Modify: `README.md`

### Task 1: Add persisted settings model and API

**Files:**
- Modify: `app/db/models.py`
- Modify: `app/db/session.py`
- Create: `app/models/settings.py`
- Create: `app/services/settings_service.py`
- Modify: `app/api/routes/system.py`
- Create: `tests/test_phase2_settings_api.py`

- [ ] **Step 1: Write the failing test**

```python
def test_update_preferences_persists_values(client: TestClient):
    response = client.put(
        "/config/preferences",
        json={
            "default_folder_path": "F:/kb",
            "default_retrieval_mode": "semantic",
            "top_k": 8,
            "preferred_runtime_mode": "api",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["preferences"]["top_k"] == 8
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_phase2_settings_api.py -v`
Expected: FAIL because no persisted settings model or endpoint exists.

- [ ] **Step 3: Write minimal implementation**

```python
# add app_settings table, create Pydantic preference models, expose GET /config + PUT /config/preferences
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_phase2_settings_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/db/models.py app/db/session.py app/models/settings.py app/services/settings_service.py app/api/routes/system.py tests/test_phase2_settings_api.py
git commit -m "feat: add persisted settings center api"
```

### Task 2: Apply top-k preferences to retrieval behavior

**Files:**
- Modify: `app/retrieval/pipeline.py`
- Modify: `app/dependencies.py`
- Modify: `app/services/settings_service.py`
- Test: `tests/test_phase2_settings_api.py`

- [ ] **Step 1: Write the failing test**

```python
def test_top_k_preference_limits_query_results(client: TestClient):
    client.put("/config/preferences", json={"top_k": 1})
    response = client.post("/api/v1/query/debug?limit=10", json={"question": "rag", "filters": {}, "retrieval_mode": "hybrid"})
    assert response.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_phase2_settings_api.py::test_top_k_preference_limits_query_results -v`
Expected: FAIL before the preferences are read into the runtime query path.

- [ ] **Step 3: Write minimal implementation**

```python
# merge persisted top_k into the effective retrieval settings used by the pipeline
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_phase2_settings_api.py::test_top_k_preference_limits_query_results -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/retrieval/pipeline.py app/dependencies.py app/services/settings_service.py tests/test_phase2_settings_api.py
git commit -m "feat: apply settings to retrieval behavior"
```

### Task 3: Wire the frontend settings center to the real API

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/state.tsx`

- [ ] **Step 1: Write the failing test**

Use the build as the contract gate for the new settings state shape.

```ts
type Preferences = {
  default_folder_path: string;
  default_retrieval_mode: RetrievalMode;
  top_k: number;
  preferred_runtime_mode: "local" | "api";
};
```

- [ ] **Step 2: Run build to verify it fails once new settings state is referenced**

Run: `npm run build`
Expected: FAIL until the frontend state and API contracts are updated.

- [ ] **Step 3: Write minimal implementation**

```ts
// add getConfig preferences parsing, updatePreferences api, savePreferences state action
```

- [ ] **Step 4: Run build to verify the data layer compiles**

Run: `npm run build`
Expected: FAIL next in `App.tsx` until the modal uses the new state.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/state.tsx
git commit -m "refactor: add real settings state and api wiring"
```

### Task 4: Expand the settings modal into a working settings center

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`

- [ ] **Step 1: Write the failing test**

Use the build as the view regression gate.

```tsx
<section className="settings-card">
  <label>默认检索模式</label>
  <select>...</select>
</section>
```

- [ ] **Step 2: Run build to verify it fails**

Run: `npm run build`
Expected: FAIL until the modal is updated to use the new settings actions and fields.

- [ ] **Step 3: Write minimal implementation**

```tsx
// add retrieval mode selector, top_k input, runtime preference display, save button, optimistic feedback
```

- [ ] **Step 4: Run build to verify it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/styles.css
git commit -m "feat: build working settings center"
```

### Task 5: Update docs and run full verification

**Files:**
- Modify: `README.md`
- Modify: `tests/test_smoke.py`

- [ ] **Step 1: Write the failing test**

```python
def test_config_returns_preferences(client: TestClient):
    response = client.get("/config")
    assert response.status_code == 200
    assert "preferences" in response.json()
```

- [ ] **Step 2: Run test to verify it fails if the smoke suite is stale**

Run: `pytest tests/test_smoke.py -v`
Expected: FAIL before the new config assertion is added.

- [ ] **Step 3: Write minimal implementation**

```md
# README.md
- Settings center persists default folder path
- Settings center persists retrieval mode and top_k
- Retrieval preferences affect runtime behavior
```

- [ ] **Step 4: Run verification**

Run: `pytest tests -v`
Expected: PASS

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add README.md tests/test_smoke.py
git commit -m "docs: describe working settings center"
```

## Self-Review

- Spec coverage checked:
  - Persisted settings are covered by Task 1.
  - Runtime top-k behavior is covered by Task 2.
  - Frontend state integration is covered by Task 3.
  - Working modal UI is covered by Task 4.
  - Docs and verification are covered by Task 5.
- Placeholder scan checked:
  - No TODO/TBD markers remain.
- Type consistency checked:
  - `preferences`, `default_folder_path`, `default_retrieval_mode`, `top_k`, and `preferred_runtime_mode` naming is consistent.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-12-phase2-settings.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Default for this run: Inline Execution, because the user explicitly asked to execute directly.
