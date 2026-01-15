# Debug: Corpus Loading Issue

## Problem
Merge service returns 0 shops even though corpus files exist.

## Possible Causes

1. **Corpus files not in Docker image**
   - Check Dockerfile copies corpus files
   - Verify files exist in deployed container

2. **Path resolution issue**
   - Corpus loader uses relative path `../../../corpus`
   - May not resolve correctly in deployed environment

3. **File loading error**
   - Errors might be silently caught
   - Need to check logs

## Fix Applied

1. Added debug logging to corpus loader
2. Added multiple path resolution attempts
3. Added file existence checks

## Check Railway Logs

After deployment, check logs for:
```
[corpus] Loading shops_verified.ndjson from ...
[corpus] CORPUS_DIR: ...
[corpus] File exists: true/false
```

## Manual Test

SSH into Railway container and check:
```bash
ls -la /app/corpus/
cat /app/corpus/shops_verified.ndjson | head -1
```

## Next Steps

1. Deploy with debug logging
2. Check Railway logs
3. Verify corpus files are in container
4. Fix path if needed

