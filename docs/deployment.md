# Deployment

## Docker

```bash
docker build -t ashbound .
docker-compose up -d
```

## Rollback

```bash
docker pull ghcr.io/resheeruu/ashbound:v0.9.0
docker-compose up -d --force-recreate
```

## Health Check

```bash
curl http://localhost:9002/health
```

## Graceful Shutdown

Send SIGTERM or SIGINT to stop the application cleanly.
