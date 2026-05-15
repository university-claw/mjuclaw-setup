# MJUClaw 이미지 기반 배포

이 문서는 운영 Windows PC에서 GHCR 이미지를 pull해서 `mjuclaw-setup`을 배포하는 절차를 정리한다.

이 repo에는 두 가지 compose 경로가 있다.

- `docker-compose.yml`: 로컬 개발/초기 세팅용 build 기반 compose
- `docker-compose.prod.yml`: 운영 배포용 GHCR image 기반 compose

## 필요한 파일

운영 배포에는 로컬에만 존재하는 env 파일 두 개가 필요하다.

- `.env.production`: secrets와 런타임 설정. 절대 커밋하지 않는다.
- `release.env`: 배포할 image 이름과 tag 조합. `release.env.example`을 복사해서 만든다.

운영 배포에서는 각 서비스 repo에서 발행된 `sha-*` tag를 사용한다. `main` tag는 smoke test에는 쓸 수 있지만, 고정된 release manifest로 취급하지 않는다.

GHCR package가 private이면 image를 pull하기 전에 로그인한다.

```powershell
docker login ghcr.io -u <github-user>
```

## 배포 스크립트

먼저 `release.env`를 만든 뒤, 배포하려는 `sha-*` tag로 값을 채운다.

```powershell
Copy-Item release.env.example release.env
notepad release.env
```

그 다음 배포 스크립트를 실행한다.

```powershell
.\deploy.ps1
```

자주 쓰는 옵션은 다음과 같다.

```powershell
.\deploy.ps1 -Ngrok
.\deploy.ps1 -PullOnly
.\deploy.ps1 -NoPull
.\deploy.ps1 -EnvFile .env.production -ReleaseFile release.env
```

스크립트는 Docker와 필수 파일을 확인하고, compose config를 검증한 뒤 pinned image를 pull하고 서비스를 시작한다. 마지막에는 `docker compose ps` 결과와 수동 health check 명령을 출력한다.

- `-Ngrok`: `docker-compose.ngrok.yml`과 `ngrok` profile을 함께 사용한다.
- `-PullOnly`: image pull까지만 수행하고 서비스를 시작하지 않는다.
- `-NoPull`: 이미 pull된 image로 `up -d`만 수행한다.
- `-EnvFile`: 기본 `.env.production` 대신 다른 env 파일을 사용한다.
- `-ReleaseFile`: 기본 `release.env` 대신 다른 release manifest를 사용한다.

## 수동 배포

스크립트가 수행하는 기본 배포 명령은 아래와 같다.

```powershell
docker compose --env-file .env.production --env-file release.env -f docker-compose.prod.yml pull
docker compose --env-file .env.production --env-file release.env -f docker-compose.prod.yml up -d
```

ngrok까지 함께 띄울 때는 아래 명령을 사용한다.

```powershell
docker compose --env-file .env.production --env-file release.env -f docker-compose.prod.yml -f docker-compose.ngrok.yml --profile ngrok pull
docker compose --env-file .env.production --env-file release.env -f docker-compose.prod.yml -f docker-compose.ngrok.yml --profile ngrok up -d
```

## Health Check

배포 후 최소한 아래 상태를 확인한다.

```powershell
docker compose --env-file .env.production --env-file release.env -f docker-compose.prod.yml ps
docker exec mjuclaw-agent curl -sS http://localhost:3001/health
docker exec mjuclaw-router curl -sS http://localhost:3100/healthz
docker exec mjuclaw-classifier curl -sS http://localhost:3200/healthz
docker logs mjuclaw-worker --tail 20
```

이번 단계의 `deploy.ps1`은 자동 health gating과 rollback을 수행하지 않는다. health check 실패 시에는 이전 `release.env` tag 조합으로 되돌린 뒤 다시 실행한다. 자동 health check, 배포 기록, rollback 절차는 다음 PR에서 다룬다.
