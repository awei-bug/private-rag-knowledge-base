# Deployment Runbook

## Scope

This runbook is for taking `private-rag-knowledge-base` from local development to a stable internal deployment.

It covers:

- local single-machine deployment
- Docker-based deployment
- environment preparation
- backup and restore operations
- post-deployment validation

It does not cover:

- multi-node clustering
- SSO integration
- enterprise secret management platforms

## Recommended Deployment Levels

### Level 1: Personal Local Use

Use this when:

- one person uses the system
- SQLite is acceptable
- local document storage is acceptable
- downtime is not critical

Recommended stack:

- backend: FastAPI
- frontend: Vite static build or dev server
- database: SQLite
- retrieval: local hashing embedding + template LLM or external API

### Level 2: Small Team Internal Use

Use this when:

- several users share one knowledge base
- document and query data must survive machine restarts reliably
- you need stronger backup discipline

Recommended stack:

- backend: FastAPI in Docker
- frontend: nginx container
- database: PostgreSQL with pgvector image
- retrieval: OpenSearch enabled
- storage: mounted persistent volume

### Level 3: Production-Like Internal Delivery

Use this when:

- the system is handed to a team
- change control matters
- recovery time matters

Additional requirements:

- external secret management
- HTTPS reverse proxy
- scheduled backups
- log rotation and host monitoring
- restore drills

## Environment Preparation

### Backend Requirements

- Python 3.11 or 3.12
- `pip`
- Windows PowerShell or Linux shell

### Frontend Requirements

- Node.js 18+
- `npm`

### Docker Deployment Requirements

- Docker Engine
- Docker Compose
- at least 4 CPU / 8 GB RAM recommended if OpenSearch is enabled

## Local Deployment

### 1. Install backend dependencies

```powershell
python -m pip install -e .
```

### 2. Install frontend dependencies

```powershell
cd frontend
npm install
```

### 3. Configure environment

Copy and edit:

```powershell
Copy-Item .env.example .env
```

Minimum local mode:

```env
RAG_LOCAL_MODE_ENABLED=true
RAG_DATABASE_URL=sqlite:///./rag.db
RAG_EMBEDDING_PROVIDER=hashing
RAG_LLM_PROVIDER=template
```

### 4. Start backend

```powershell
scripts\start_backend.bat
```

### 5. Start frontend

```powershell
scripts\start_frontend.bat
```

### 6. Validate

- frontend: `http://127.0.0.1:5173`
- backend docs: `http://127.0.0.1:8000/docs`
- backend health: `http://127.0.0.1:8000/health`

## No-Docker Local Production

Use this when:

- Docker is unavailable on the machine
- you still want a production-style local handoff
- you want static frontend assets instead of the Vite dev server

### 1. Prepare the production environment

```powershell
powershell -ExecutionPolicy Bypass -File scripts\prepare_production_env.ps1
```

Then review `.env.production` and confirm:

- `RAG_AUTH_SECRET_KEY` is not a placeholder
- provider settings match the intended deployment mode
- local file paths are valid on the target machine

### 2. Run the preflight check

```powershell
powershell -ExecutionPolicy Bypass -File scripts\preflight_local_production.ps1
```

This validates:

- backend test suite
- frontend production build
- required environment values

### 3. Start the stack

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start_local_production.ps1
```

Expected endpoints:

- frontend: `http://127.0.0.1:8080`
- backend docs: `http://127.0.0.1:8000/docs`
- backend health: `http://127.0.0.1:8000/health`

The start scripts automatically clear stale listeners on ports `8000` and `8080` before binding.

### 4. Stop the stack

```powershell
powershell -ExecutionPolicy Bypass -File scripts\stop_local_production.ps1
```

This stops listeners bound to:

- `127.0.0.1:8000`
- `127.0.0.1:8080`

## Docker Deployment

### 1. Prepare production environment file

Use `.env.production.example` as the starting point.

At minimum, review:

- `RAG_DATABASE_URL`
- `RAG_EMBEDDING_PROVIDER`
- `RAG_EMBEDDING_API_KEY`
- `RAG_LLM_PROVIDER`
- `RAG_LLM_API_KEY`
- `RAG_AUTH_SECRET_KEY`
- `RAG_STORAGE_LOCAL_ROOT`

Recommended file name:

```text
.env.production
```

### 2. Adjust compose file usage

Current `docker-compose.yml` reads `.env.production.example`.

For real delivery, replace that with `.env.production` before deployment or duplicate the file and update the compose reference.

### 3. Start services

```powershell
docker compose up -d --build
```

### 4. Validate containers

```powershell
docker compose ps
```

### 5. Validate services

- frontend: `http://127.0.0.1:8080`
- backend docs: `http://127.0.0.1:8000/docs`
- OpenSearch: `http://127.0.0.1:9200`

## Suggested Production Configuration

### Authentication

- replace `RAG_AUTH_SECRET_KEY`
- avoid demo credentials for shared environments
- rotate credentials after handoff

### Database

- prefer PostgreSQL over SQLite for shared use
- schedule database backups
- verify restore procedure monthly

### Storage

- mount `data/uploads` to persistent storage
- exclude uploads and backups from source control
- define a retention policy

### Retrieval

- local mode is acceptable for functional validation
- external embedding / LLM providers are recommended for answer quality

## Backup and Restore

### Manual backup

Backend UI and maintenance endpoints already support:

- export backup
- create backup version
- list backup versions
- verify backup version
- restore backup

### Scheduled backup

Available script:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\scheduled_backup.ps1
```

### Scheduled task installation

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install_scheduled_backup.ps1
```

### Operational expectation

After enabling scheduled backup, verify:

- backup file creation
- backup manifest visibility in UI
- restore success on a test copy

## Post-Deployment Validation

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\acceptance_check.ps1
```

Then verify manually:

- upload a test document
- ask a question that should hit that document
- verify citation links
- export query logs
- create and verify a backup version

## Known Delivery Gaps

These are the main remaining non-code gaps before strong production delivery:

- local template LLM and hashing embedding are functional but not high-quality production retrieval/generation
- no full RBAC hardening for enterprise use
- no built-in HTTPS reverse proxy
- no built-in alerting pipeline
- backup versioning is present, but restore drills still need operator discipline

## Handoff Notes

If this project is handed to another engineer, they need:

- `.env` or `.env.production`
- Python and Node runtime versions
- deployment target choice: local or Docker
- backup location policy
- API credential ownership if external models are used
