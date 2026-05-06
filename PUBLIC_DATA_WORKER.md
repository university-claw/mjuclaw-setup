# Public Data Worker Profile

`mjuclaw-setup` can run the public-data worker as an optional Compose profile.
The default `agent` service remains unchanged when the profile is not enabled.

## Enable

```bash
docker compose --profile public-data up -d --build
```

Or set this before running `setup.sh`:

```bash
COMPOSE_PROFILES=public-data ./setup.sh
```

## Services

- `public-data-db`: PostgreSQL for public-data tables.
- `public-data-worker`: `mju-public-data-worker` image with Node.js, Python,
  PaddlePaddle CPU, PaddleOCR, and the scheduler loop.

## Important Environment

```env
PUBLIC_DATA_PGDATABASE=mjuclaw
PUBLIC_DATA_PGUSER=mjuclaw_app
PUBLIC_DATA_PGPASSWORD=change-me
PUBLIC_DATA_PGSCHEMA=public_data
CAFETERIA_OCR_COMMAND=python scripts/cafeteria_paddleocr_candidate.py {image}
PADDLE_OCR_REC_MODEL_NAME=korean_PP-OCRv5_mobile_rec
PUBLIC_DATA_WORKER_TICK_INTERVAL_SECONDS=600
```

For branch-to-branch local verification from the parent `uniclaw` workspace, set:

```env
PUBLIC_DATA_WORKER_CONTEXT=../mju-public-data-worker
```

In the normal standalone setup flow, `setup.sh` clones `mju-public-data-worker`
inside this directory and the default context `./mju-public-data-worker` is used.

## Volumes

- `public-data-db`: PostgreSQL data.
- `public-data-assets`: collected public assets and cafeteria images.
- `public-data-paddle-models`: PaddleOCR model cache.
