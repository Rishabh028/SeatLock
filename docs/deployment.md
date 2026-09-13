# Deployment

## Prerequisites
- Node.js 22+
- PostgreSQL 16+
- Redis 7+ (for background jobs)

## Production Deployment Options

### Frontend: Vercel
```bash
cd packages/frontend
npx vercel --prod
```

Environment variables:
```
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

### Backend: Render / Railway / Fly.io

#### Render
1. Create a new Web Service
2. Connect your repository
3. Build command: `cd packages/backend && npm install && npm run build`
4. Start command: `cd packages/backend && npm start`
5. Add environment variables from `.env.example`

#### Railway
1. Create new project from GitHub
2. Set root directory to `packages/backend`
3. Railway auto-detects Node.js
4. Add PostgreSQL addon
5. Add environment variables

#### Fly.io
```bash
cd packages/backend
fly launch
fly secrets set DATABASE_URL=... JWT_SECRET=... ...
```

### Database: Managed PostgreSQL

#### Neon (Recommended for serverless)
- Free tier available
- Auto-scaling
- Branching for development

#### Supabase
- Free tier with PostgreSQL
- Built-in connection pooling

#### Railway/Render
- Add PostgreSQL addon directly

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `JWT_SECRET` | ✅ | Min 16 chars, random string |
| `API_PORT` | ❌ | Default: 3001 |
| `API_URL` | ❌ | Backend URL |
| `APP_URL` | ❌ | Frontend URL (for CORS) |
| `HOLD_DURATION_SECONDS` | ❌ | Default: 300 |
| `PAYMENT_PROVIDER` | ❌ | Default: mock |
| `PAYMENT_WEBHOOK_SECRET` | ❌ | Webhook HMAC secret |
| `LOG_LEVEL` | ❌ | Default: info |

## Migration Procedure

```bash
# Run migrations on the production database
DATABASE_URL=postgresql://... npm run db:migrate

# Optionally seed with demo data
DATABASE_URL=postgresql://... npm run db:seed
```

## Health Check

```
GET /health
```

Use this endpoint for load balancer health checks.

## Security Checklist

- [ ] Use a strong, random JWT_SECRET (64+ characters)
- [ ] Use SSL/TLS for database connections
- [ ] Set CORS to only allow your frontend domain
- [ ] Use HTTPS for all endpoints
- [ ] Set rate limits appropriately for production traffic
- [ ] Rotate PAYMENT_WEBHOOK_SECRET periodically
- [ ] Monitor for unusual error rates
