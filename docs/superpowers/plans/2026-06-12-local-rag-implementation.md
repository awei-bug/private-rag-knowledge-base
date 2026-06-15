# Local RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight local RAG knowledge base web app that keeps only knowledge supply and question answering flows.

**Architecture:** Keep the existing FastAPI ingestion and retrieval pipeline, add a local-mode auth bypass for the default path, and replace the frontend console with a single-page supply/ask UI. Reuse current API routes where possible and remove enterprise-only UI flows from the default experience.

**Tech Stack:** FastAPI, Pydantic Settings, SQLAlchemy, React, TypeScript, Vite, pytest

---

## File Map

- Modify: `app/core/config.py`
  - Add local-mode settings and app copy for the lightweight product shape.
- Modify: `app/auth.py`
  - Add a local-mode current-user path that bypasses bearer auth.
- Modify: `app/models/query.py`
  - Ensure citation payload exposes enough source content for the minimal UI.
- Modify: `app/retrieval/service.py`
  - Return richer citation content if tests show the current response is too thin for the new UI.
- Modify: `app/api/routes/query.py`
  - Keep only the lightweight answer path active in the frontend flow.
- Modify: `app/api/routes/documents.py`
  - Keep upload/list/sync/delete behavior compatible with local-mode access.
- Modify: `app/api/routes/system.py`
  - Expose the current runtime mode in `/config` for the frontend status chip.
- Modify: `frontend/src/api.ts`
  - Remove auth APIs and console-only types, add the minimal data contracts for supply/ask.
- Modify: `frontend/src/state.tsx`
  - Replace session-heavy state with lightweight app state for documents, mode, upload, sync, and ask flows.
- Modify: `frontend/src/App.tsx`
  - Replace login/router shell with the single-page layout.
- Modify: `frontend/src/styles.css`
  - Replace console styling with the new two-panel lightweight UI.
- Delete or stop using from entry flow: `frontend/src/pages/*.tsx`
  - Old console pages become unused after the single-page rewrite.
- Modify: `README.md`
  - Update positioning, startup steps, and local/API mode instructions.
- Modify: `tests/test_smoke.py`
  - Extend smoke coverage for local-mode no-login access and config mode reporting.
- Create: `tests/test_local_mode_api.py`
  - Add focused API tests for local-mode documents/query behavior without auth.

### Task 1: Add local-mode backend behavior

**Files:**
- Modify: `app/core/config.py`
- Modify: `app/auth.py`
- Modify: `app/api/routes/system.py`
- Test: `tests/test_local_mode_api.py`

- [ ] **Step 1: Write the failing test**

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_local_mode_allows_documents_without_auth():
    app = create_app()
    client = TestClient(app)

    response = client.get("/api/v1/documents")

    assert response.status_code == 200


def test_config_reports_local_mode():
    app = create_app()
    client = TestClient(app)

    response = client.get("/config")

    assert response.status_code == 200
    assert response.json()["runtime_mode"] == "local"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_local_mode_api.py -v`
Expected: FAIL because unauthenticated `/api/v1/documents` currently returns `401` and `/config` does not expose `runtime_mode`.

- [ ] **Step 3: Write minimal implementation**

```python
# app/core/config.py
local_mode_enabled: bool = True
local_mode_user: dict[str, Any] = Field(
    default_factory=lambda: {
        "username": "local-user",
        "password": "",
        "role": "admin",
        "allowed_acl": ["*"],
        "display_name": "Local User",
    }
)

def get_local_user(self) -> AuthenticatedUser:
    return AuthenticatedUser(**self.local_mode_user)
```

```python
# app/auth.py
def get_current_user(authorization: str | None = Header(default=None)) -> UserProfile:
    settings = get_settings()
    if settings.local_mode_enabled:
        user = settings.get_local_user()
        return UserProfile(
            username=user.username,
            role=user.role,
            allowed_acl=user.allowed_acl,
            display_name=user.display_name,
        )
    ...
```

```python
# app/api/routes/system.py
"runtime_mode": "local" if settings.local_mode_enabled else "authenticated",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_local_mode_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/core/config.py app/auth.py app/api/routes/system.py tests/test_local_mode_api.py
git commit -m "feat: add local mode backend access"
```

### Task 2: Expose answer citations for the minimal ask UI

**Files:**
- Modify: `app/models/query.py`
- Modify: `app/retrieval/service.py`
- Test: `tests/test_local_mode_api.py`

- [ ] **Step 1: Write the failing test**

```python
def test_query_returns_citation_preview(client: TestClient):
    response = client.post(
        "/api/v1/query",
        json={"question": "What is this project?", "filters": {}},
    )

    assert response.status_code == 200
    body = response.json()
    assert "citations" in body
    assert "content_preview" in body["citations"][0]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_local_mode_api.py::test_query_returns_citation_preview -v`
Expected: FAIL because citation items do not yet include `content_preview`.

- [ ] **Step 3: Write minimal implementation**

```python
# app/models/query.py
class QueryCitation(BaseModel):
    document_id: str
    document_title: str
    chunk_id: str
    score: float
    content_preview: str
```

```python
# app/retrieval/service.py
content_preview=chunk.content[:240],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_local_mode_api.py::test_query_returns_citation_preview -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/models/query.py app/retrieval/service.py tests/test_local_mode_api.py
git commit -m "feat: include citation previews in query responses"
```

### Task 3: Replace the frontend console API/state layer

**Files:**
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/state.tsx`
- Test: `frontend/src/App.tsx`

- [ ] **Step 1: Write the failing test**

Use the frontend build as the regression gate after removing console-only contracts.

```ts
// target state API
type AppContextValue = {
  modeLabel: string;
  documents: DocumentItem[];
  answer: QueryResponse | null;
  refresh: () => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  syncDirectory: (rootPath: string) => Promise<void>;
  askQuestion: (question: string) => Promise<void>;
};
```

- [ ] **Step 2: Run build to verify it fails after removing old console assumptions**

Run: `npm run build`
Expected: FAIL once old auth/router state is removed and `App.tsx` still depends on it.

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/api.ts
export type ConfigResponse = {
  app_name: string;
  app_version: string;
  environment: string;
  top_k: number;
  chunk_size: number;
  chunk_overlap: number;
  database_backend: string;
  pgvector_enabled: string;
  runtime_mode: string;
};
```

```ts
// frontend/src/state.tsx
type AppContextValue = {
  busy: string;
  error: string;
  modeLabel: string;
  documents: DocumentItem[];
  answer: QueryResponse | null;
  notices: Notice[];
  refresh: () => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  syncDirectory: (rootPath: string) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  askQuestion: (question: string) => Promise<void>;
  clearAnswer: () => void;
};
```

- [ ] **Step 4: Run build to verify state/API layer is consistent**

Run: `npm run build`
Expected: FAIL next in `App.tsx` or old page imports, proving the new state layer is in place and the shell still needs replacement.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/state.tsx
git commit -m "refactor: add lightweight frontend app state"
```

### Task 4: Replace the frontend shell with a single-page supply/ask UI

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles.css`
- Stop using: `frontend/src/pages/DashboardPage.tsx`
- Stop using: `frontend/src/pages/DocumentsPage.tsx`
- Stop using: `frontend/src/pages/AskPage.tsx`
- Stop using: `frontend/src/pages/LogsPage.tsx`
- Test: `frontend/src/App.tsx`

- [ ] **Step 1: Write the failing test**

Use the build to enforce removal of router/login dependencies and validate the new entry shell.

```tsx
// target component shape
export function App() {
  return (
    <AppProvider>
      <HomePage />
    </AppProvider>
  );
}
```

- [ ] **Step 2: Run build to verify it fails**

Run: `npm run build`
Expected: FAIL until `App.tsx` no longer imports router/login/page modules.

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/App.tsx
function HomePage() {
  return (
    <div className="page-shell">
      <section className="hero-block">...</section>
      <section className="workspace-grid">
        <article className="panel supply-panel">...</article>
        <article className="panel ask-panel">...</article>
      </section>
    </div>
  );
}
```

```css
/* frontend/src/styles.css */
.workspace-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}
```

- [ ] **Step 4: Run build to verify it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/styles.css
git commit -m "feat: replace console UI with local rag homepage"
```

### Task 5: Update smoke coverage and docs

**Files:**
- Modify: `tests/test_smoke.py`
- Modify: `README.md`

- [ ] **Step 1: Write the failing test**

```python
def test_config_exposes_runtime_mode(client: TestClient):
    response = client.get("/config")
    assert response.status_code == 200
    assert response.json()["runtime_mode"] == "local"
```

- [ ] **Step 2: Run test to verify it fails if smoke suite is stale**

Run: `pytest tests/test_smoke.py -v`
Expected: FAIL before the new assertion is added and aligned.

- [ ] **Step 3: Write minimal implementation**

```md
# README.md
## Local RAG knowledge base web app

- Supply knowledge by uploading files or syncing a local folder.
- Ask questions on the same page and view source citations.
- Run fully local by default, or switch to OpenAI-compatible APIs through `.env`.
```

- [ ] **Step 4: Run verification**

Run: `pytest tests -v`
Expected: PASS

Run: `cd frontend && npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/test_smoke.py README.md
git commit -m "docs: update local rag usage and smoke checks"
```

## Self-Review

- Spec coverage checked:
  - Single-page “供 / 求” UI is covered by Task 3 and Task 4.
  - Local no-login mode is covered by Task 1.
  - Upload + local-dir sync are preserved through Task 3/4 API usage and Task 1 auth bypass.
  - Citation/source display is covered by Task 2.
  - README and verification are covered by Task 5.
- Placeholder scan checked:
  - No `TODO`, `TBD`, or deferred implementation markers remain.
- Type consistency checked:
  - `runtime_mode`, `content_preview`, `modeLabel`, `uploadFile`, `syncDirectory`, and `askQuestion` naming is used consistently across tasks.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-12-local-rag-implementation.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Default for this run: Inline Execution, because the user explicitly asked to start the implementation directly after planning.
