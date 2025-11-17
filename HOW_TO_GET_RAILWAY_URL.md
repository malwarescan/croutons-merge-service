# How to Get Your Railway URL for BKK_MERGE_API_URL

## Step 1: Deploy croutons-merge-service on Railway

If you haven't deployed yet:

1. Go to https://railway.app/new
2. Click "Deploy from GitHub"
3. Select repository: `malwarescan/croutons-merge-service`
4. Railway will automatically build and deploy

## Step 2: Find Your Railway URL

### Option A: From Railway Dashboard

1. Go to https://railway.app
2. Click on your `croutons-merge-service` project
3. Click on the service (the deployed app)
4. Go to **Settings** tab
5. Scroll to **Networking** section
6. You'll see:
   - **Public Domain**: `https://<your-app-name>.up.railway.app`
   - Or a custom domain if you set one up

### Option B: From Railway Deployments

1. Go to your service in Railway
2. Click **Deployments** tab
3. Click on the latest deployment
4. Look at the logs - Railway shows the URL when it starts:
   ```
   [server] Croutons Merge Service listening on port 8080
   ```
5. The URL format is: `https://<service-name>.up.railway.app`

### Option C: Check Service Settings

1. Railway Dashboard → Your Project → Your Service
2. Settings → **Networking**
3. Look for **Public Domain** or **Generate Domain** button
4. Copy the domain (format: `xxxxx.up.railway.app`)

## Step 3: Construct the Full URL

Your `BKK_MERGE_API_URL` should be:

```
https://<your-service-name>.up.railway.app/v1/merge/bkk_massage
```

**Example:**
If your Railway service domain is `croutons-merge-production.up.railway.app`, then:

```
BKK_MERGE_API_URL=https://croutons-merge-production.up.railway.app/v1/merge/bkk_massage
```

## Step 4: Set Environment Variable

### In Railway (for Precogs API)

1. Go to your **Precogs API** project on Railway (not the merge service)
2. Click on the service
3. Go to **Variables** tab
4. Click **+ New Variable**
5. Add:
   - **Key**: `BKK_MERGE_API_URL`
   - **Value**: `https://<your-merge-service>.up.railway.app/v1/merge/bkk_massage`
6. Click **Add**

### Verify It Works

Test the health endpoint:

```bash
curl https://<your-merge-service>.up.railway.app/v1/merge/health
```

**Expected response:**
```json
{
  "status": "ok",
  "connected": true,
  "time": "2025-01-05T12:00:00.000Z",
  "service": "croutons-merge-service"
}
```

## Quick Reference

**Format:**
```
BKK_MERGE_API_URL=https://<service-name>.up.railway.app/v1/merge/bkk_massage
```

**Where to find service-name:**
- Railway Dashboard → Your Service → Settings → Networking → Public Domain

**Where to set:**
- Railway → Precogs API Service → Variables → Add `BKK_MERGE_API_URL`

---

**Need help?** Check Railway logs if the service isn't responding.

