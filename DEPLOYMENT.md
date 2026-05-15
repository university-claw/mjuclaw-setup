# MJUClaw Image-Based Deployment

This repo has two compose paths:

- `docker-compose.yml`: local build path for development and first-time setup.
- `docker-compose.prod.yml`: production path that pulls pinned GHCR images.

## Files

Production deploys need two local env files:

- `.env.production`: secrets and runtime settings. Do not commit this file.
- `release.env`: image names and pinned image tags. Start from `release.env.example`.

Use `sha-*` tags from the service repositories for production. The `main` tag is useful for smoke testing, but it is not a stable release manifest.

If the GHCR packages are private, log in before pulling images:

```powershell
docker login ghcr.io -u <github-user>
```

## Manual Deploy

```powershell
Copy-Item release.env.example release.env
notepad release.env
```

Set each `*_TAG` to the intended `sha-*` image tag, then deploy:

```powershell
docker compose --env-file .env.production --env-file release.env -f docker-compose.prod.yml pull
docker compose --env-file .env.production --env-file release.env -f docker-compose.prod.yml up -d
```

With ngrok:

```powershell
docker compose --env-file .env.production --env-file release.env -f docker-compose.prod.yml -f docker-compose.ngrok.yml --profile ngrok pull
docker compose --env-file .env.production --env-file release.env -f docker-compose.prod.yml -f docker-compose.ngrok.yml --profile ngrok up -d
```

## Health Checks

```powershell
docker compose --env-file .env.production --env-file release.env -f docker-compose.prod.yml ps
docker exec mjuclaw-agent curl -sS http://localhost:3001/health
docker exec mjuclaw-router curl -sS http://localhost:3100/healthz
docker exec mjuclaw-classifier curl -sS http://localhost:3200/healthz
docker logs mjuclaw-worker --tail 20
```

The deploy script and rollback automation are intentionally deferred to the next PR.
