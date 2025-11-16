# Quick Start - Croutons Merge Service

## Deploy in 5 Minutes

### 1. Push to GitHub

```bash
cd croutons-merge-service
git init
git add .
git commit -m "Initial deployment"
git remote add origin <your-repo-url>
git push origin main
```

### 2. Deploy on Railway

1. Go to https://railway.app/new
2. Click "Deploy from GitHub"
3. Select your repository
4. Railway auto-builds from Dockerfile

### 3. Add Redis

1. Railway → Your Project → "Add Plugin" → Redis
2. `REDIS_URL` is auto-injected
3. No configuration needed!

### 4. Verify

```bash
# Get your Railway URL
# Format: https://<app-name>.up.railway.app

curl https://<your-app>.up.railway.app/v1/health
```

**Expected:**
```json
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

### 5. Test Merge

```bash
curl -X POST https://<your-app>.up.railway.app/v1/merge/bkk_massage \
  -H "Content-Type: application/json" \
  -d '{
    "liveShops": [{
      "name": "Test Shop",
      "rating": 4.5,
      "review_count": 50
    }],
    "district": "Asok"
  }'
```

## That's It!

Your service is live and ready to merge Google Maps data with corpus files.

---

**Next:** Integrate with Precog worker to call this service.

