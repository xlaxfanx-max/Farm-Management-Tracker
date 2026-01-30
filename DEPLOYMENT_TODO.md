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
**Why**: 22+ scheduled tasks won't run without a Celery worker:
- Compliance deadline reminders (daily at 6:00 AM)
- Disease alert digests (daily at 7:00 AM)
- FSMA daily reminders (daily at 7:15 AM)
- License expiration checks (daily at 6:05 AM)
- Monthly PUR report generation (1st of each month)
- REI checks (every 2 hours)
- CDFA disease sync (daily at 5:00 AM)
- And 15+ more scheduled tasks

**A `Procfile` has been created in `backend/Procfile`** that defines both the web and worker processes.

**Steps**:
1. In Railway dashboard, click "New" → "Service" → select the same GitHub repo
2. Name the new service `celery-worker`
3. In the service settings, set **Procfile process** to `worker`
4. Copy all env vars from the backend service (DATABASE_URL, REDIS_URL, SECRET_KEY, etc.)
   - The worker needs the same database and Redis connections as the backend
5. Deploy — the worker will start running `celery -A pesticide_tracker worker -l info -B`
6. The `-B` flag runs the beat scheduler in the same process (handles all periodic tasks)

**Verify it works**: Check Railway logs for the worker service. You should see Celery startup messages and periodic task registrations.

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

---

## Software Evaluation Findings (January 2026)

A comprehensive software evaluation was completed on January 29, 2026. Below is a summary of findings for tracking purposes. The full evaluation report is available in `.claude/plans/floating-stirring-raven.md`.

### Strengths
- Comprehensive feature coverage across all farm operations in one platform
- Enterprise-grade data security with dual-layer company isolation (RLS)
- Modern, open-source tech stack with large developer talent pool
- Smart integrations with California agricultural data sources (CIMIS, CDFA, weather)
- Clean user experience with onboarding wizard and dark mode

### Priority Improvements

| # | Item | Impact | Status |
|---|------|--------|--------|
| 1 | **Enable Celery worker** | Compliance reminders, disease alerts not running | Procfile created — needs Railway service setup |
| 2 | **Configure cloud storage (R2)** | File uploads lost on each deploy | Code ready — needs env vars in Railway |
| 3 | **Add automated tests** | Financial calculations (settlements, deductions) unverified | Not started |
| 4 | **Add error monitoring (Sentry)** | No visibility into production errors | Not started |
| 5 | **Break up large code files** | models.py (408KB), serializers.py (220KB), views.py (203KB) slow development | Not started |
| 6 | **Implement URL-based routing** | Users can't bookmark pages or use browser back button | React Router installed but unused for main views |

*Last updated: January 29, 2026*
