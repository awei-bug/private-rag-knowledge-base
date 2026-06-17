# Delivery Checklist

## Release Identity

- Project name: `private-rag-knowledge-base`
- Repository: `awei-bug/private-rag-knowledge-base`
- Main screenshot: [docs/assets/frontend-overview.png](./assets/frontend-overview.png)

## Core Acceptance

- [ ] Backend starts successfully
- [ ] Frontend starts successfully
- [ ] `/health` returns `ok`
- [ ] Frontend homepage loads
- [ ] Document upload works
- [ ] Local directory sync works
- [ ] Retrieval modes switch correctly
- [ ] QA response shows citations
- [ ] Query debug works
- [ ] Query evaluation works
- [ ] Query log export works
- [ ] Backup export works
- [ ] Backup create/list/verify works
- [ ] Backup restore works
- [ ] Cleanup operations work

## Validation Commands

Backend tests:

```powershell
py -3 -m pytest tests -q
```

Frontend build:

```powershell
cd frontend
npm.cmd run build
```

Acceptance check:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\acceptance_check.ps1
```

## Required Configuration Before Handoff

- [ ] `.env` prepared for local deployment
- [ ] `.env.production` prepared for Docker or shared deployment
- [ ] API keys configured if external models are used
- [ ] auth secret replaced from example values
- [ ] storage path confirmed
- [ ] backup schedule confirmed

## Delivery Risks Still Present

- [ ] local model path is still validation-grade, not strong production-grade
- [ ] shared deployment still needs stricter auth and operational controls
- [ ] HTTPS / reverse proxy not bundled by default
- [ ] alerting and centralized observability are not bundled

## Recommended Final Handoff Package

- source code repository
- filled deployment env file template
- this checklist
- deployment runbook
- one verified backup file
- one sample knowledge-base directory
