# Croutons Merge Service - Deployment Guide

## Quick Deploy to Railway

### Step 1: Push to GitHub

```bash
cd croutons-merge-service
git init
git add .
git commit -m "Initial Croutons Merge Service deployment"
git remote add origin <your_repo_url>
git push origin main
```

### Step 2: Connect Railway

1. Go to https://railway.app/new
2. Click "Deploy from GitHub"
3. Select your repository
4. Railway auto-detects Dockerfile and deploys

### Step 3: Add Redis Add-on

1. Inside Railway project → "Add Plugin" → Redis
2. Railway automatically injects `REDIS_URL` variable
3. Verify in Variables tab

### Step 4: Verify Deployment

```bash
# Health check
curl https://<your-app-name>.up.railway.app/v1/health

# Expected response:
{
  "ok": true,
  "service": "croutons-merge-service",
  "checks": {
    "redis": "connected",
    "sqlite": "connected",
    "corpus": "loaded (20 shops)"
  }
}
```

### Step 5: Test Merge Endpoint

```bash
curl -X POST https://<your-app-name>.up.railway.app/v1/merge/bkk_massage \
  -H "Content-Type: application/json" \
  -d '{
    "liveShops": [
      {
        "name": "Test Massage",
        "address": "123 Asok Road",
        "rating": 4.5,
        "review_count": 50
      }
    ],
    "district": "Asok"
  }'
```

## Environment Variables

Set in Railway → Variables:

| Key | Example Value | Notes |
|-----|---------------|-------|
| `REDIS_URL` | `redis://default:password@host:6379` | Auto-set by Redis add-on |
| `PORT` | `8080` | Required |
| `NODE_ENV` | `production` | Required |

## Monitoring

- **Logs**: Railway → Deployments → Logs
- **Health**: `GET /v1/health`
- **Metrics**: Check Redis/SQLite connection status

## Troubleshooting

### Health check fails
- Check Redis connection (if configured)
- Verify SQLite database created
- Check corpus files exist in `/corpus` directory

### Redis not connecting
- Verify `REDIS_URL` is set correctly
- Check Redis add-on is running
- Review Railway logs for connection errors

### SQLite errors
- Ensure `db/` directory is writable
- Check disk space
- Review file permissions

## Next Steps

1. ✅ Service deployed and healthy
2. ✅ Test merge endpoint with sample data
3. ✅ Integrate with Precog worker
4. ✅ Monitor cache hit rates
5. ✅ Set up alerts for health checks

---

**Service ready for production!** ✅

