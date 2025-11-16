# Croutons Merge Service

Merge service for Bangkok Massage Intelligence - combines live Google Maps data with verified corpus data.

## Quick Start

### Local Development

```bash
npm install
npm start
```

### Railway Deployment

1. Push to GitHub
2. Connect to Railway
3. Add Redis add-on
4. Deploy!

## Endpoints

- `GET /v1/health` - Health check
- `POST /v1/merge/bkk_massage` - Merge live data with corpus
- `GET /v1/shops?district=Asok` - Get merged shops
- `GET /v1/districts` - Get district profiles
- `GET /v1/pricing?district=Asok` - Get pricing reference

## Environment Variables

- `REDIS_URL` - Redis connection string (optional)
- `PORT` - Server port (default: 8080)
- `NODE_ENV` - Environment (production/development)

## Architecture

- **Redis**: Primary cache (fast, ephemeral)
- **SQLite**: Persistent backup (survives restarts)
- **Corpus Files**: Source of truth (JSON/NDJSON)

## Testing

```bash
# Health check
curl http://localhost:8080/v1/health

# Merge shops
curl -X POST http://localhost:8080/v1/merge/bkk_massage \
  -H "Content-Type: application/json" \
  -d '{"liveShops": [{"name": "Test", "rating": 4.5}]}'
```

