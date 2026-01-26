# Deployment TODOs

## Completed
- [x] Railway deployment (backend + frontend)
- [x] PostgreSQL database
- [x] Redis service
- [x] Core data migration (farms, fields, products, applications, etc.)
- [x] Auto-deploy from GitHub

## Live URLs
- **Frontend**: https://frontend-production-4348.up.railway.app
- **Backend**: https://farm-management-tracker-production-9c7d.up.railway.app

---

## Remaining Tasks

### 1. Cloud Storage (Cloudflare R2)
**Why**: File uploads (satellite images, PDFs, photos) are lost on each deploy. Railway's filesystem is ephemeral.

**Steps**:
1. Create Cloudflare account at https://dash.cloudflare.com
2. Create R2 bucket named `farm-tracker-media`
3. Create API token with read/write access
4. Set these env vars in Railway (backend service):
   - `AWS_ACCESS_KEY_ID` = your R2 access key
   - `AWS_SECRET_ACCESS_KEY` = your R2 secret key
   - `AWS_STORAGE_BUCKET_NAME` = farm-tracker-media
   - `AWS_S3_ENDPOINT_URL` = https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
   - `AWS_S3_REGION_NAME` = auto

**Cost**: ~$0.015/GB/month, free egress

---

### 2. Celery Worker (Background Tasks)
**Why**: Scheduled tasks won't run without a Celery worker:
- Compliance deadline reminders
- Disease alert digests
- FSMA daily reminders
- License expiration checks
- Monthly PUR report generation

**Steps**:
1. In Railway dashboard, click "New" → "Empty Service"
2. Name it `celery-worker`
3. Set the same env vars as backend (DATABASE_URL, REDIS_URL, SECRET_KEY, etc.)
4. Set start command: `celery -A pesticide_tracker worker -l info -B`
5. Or create a Dockerfile for the worker

---

### 3. Custom Domain (Optional)
**Why**: Nicer URLs like `app.yourfarm.com` instead of `.up.railway.app`

**Steps**:
1. In Railway, click on frontend service → Settings → Domains
2. Click "Add Custom Domain"
3. Add your domain and configure DNS as instructed

---

### 4. Re-upload Data (If Needed)
**Not migrated** (can be regenerated):
- Tree detection results → Re-run detection on satellite images
- LiDAR processing results → Re-upload and process LiDAR files
- Quarantine zones → Auto-syncs from CDFA
- Satellite images / LiDAR datasets → Re-upload if needed

---

## Development Workflow
```
1. Make changes locally
2. Test at localhost:3000
3. git add . && git commit -m "message" && git push
4. Railway auto-deploys
```

---

*Last updated: January 25, 2026*
