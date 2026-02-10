# Deployment & Architecture

## Live URLs
- **Frontend**: https://www.ojaifarmingco.com (custom domain)
- **Backend**: https://farm-management-tracker-production-9c7d.up.railway.app

---

## Architecture Overview

### Tech Stack
- **Backend**: Django 4.x + Django REST Framework, PostgreSQL, Redis, Celery
- **Frontend**: React 19 with Context API, React Router v7, Lucide icons, Tailwind CSS
- **AI**: Anthropic Claude API for PDF extraction (packout reports, settlement statements)
- **Hosting**: Railway (auto-deploy from GitHub `main` branch)
- **Storage**: Cloudflare R2 (S3-compatible) for media/uploads in production

### Backend Structure
```
backend/
  api/
    models/              # Modular model package (14 domain files)
      auth.py            # User, Company, CompanyMembership, Invitation
      base.py            # LocationMixin, utility functions
      compliance.py      # Licenses, WPS training, deadlines, incidents
      disease.py         # ExternalDetection, QuarantineZone, DiseaseAlert
      facility.py        # FacilityLocation, CleaningLog, VisitorLog
      farm.py            # Farm, Field, Crop, PesticideApplication
      fsma.py            # PHI checks, AuditBinder, FSMA assessments
      harvest.py         # Harvest, HarvestLoad, HarvestLabor, Buyer
      imagery.py         # SatelliteImage, TreeDetection, LiDAR models
      nutrients.py       # FertilizerProduct, NutrientApplication, WeatherCache
      packinghouse.py    # Pool, PackoutReport, Settlement, Delivery
      water.py           # WaterSource, WaterTest, IrrigationEvent, SGMA
      yield_forecast.py  # YieldForecast, SoilSurveyData, climate features
    services/            # Business logic layer
      pdf_extraction_service.py   # Claude AI PDF parsing
      season_service.py           # Season/commodity unit management
      yield_forecast_service.py   # ML yield predictions
      yield_feature_engine.py     # Feature computation for forecasting
      climate_features.py         # CIMIS weather data integration
      soil_survey_service.py      # SSURGO soil data sync
      alternate_bearing.py        # Alternate bearing analysis
    views.py             # Re-export hub (imports from 27 domain *_views.py files)
    serializers.py       # Re-export hub (imports from 20 domain *_serializers.py files)
    *_views.py           # Domain-specific views (farm, harvest, packinghouse, compliance, etc.)
    *_serializers.py     # Domain-specific serializers (crop, farm, water, etc.)
    view_helpers.py      # Shared helpers (get_user_company, require_company)
    authentication.py    # HttpOnly cookie JWT authentication
    pagination.py        # StandardPagination (100/page, max 1000)
    rls_middleware.py     # Row-Level Security middleware
    urls.py              # API routing
    tests/               # Test suite (6 test files)
      test_auth_endpoints.py
      test_auth_invitations.py
      test_pagination.py
      test_services/
        test_pdf_extraction.py
        test_pesticide_compliance.py
        test_water_compliance.py
  pesticide_tracker/
    settings.py          # Django settings (Celery, R2, JWT config)
    celery.py            # Celery app with Redis broker
    test_settings.py     # Test-specific settings
  management/commands/
    compute_climate_features.py
    generate_yield_forecasts.py
    sync_soil_data.py
  Procfile               # Railway process definitions (web + worker)
```

### Frontend Structure
```
frontend/src/
  index.js               # BrowserRouter + AuthProvider + Main
  Main.jsx               # Top-level routes (login, register, /dashboard/*)
  App.js                 # Dashboard layout with sidebar, handles /dashboard/* sub-routes
  routes.js              # Centralized VIEW_TO_PATH/PATH_TO_VIEW mappings
  contexts/
    AuthContext.js        # Auth state, JWT tokens, company switching, permissions
    DataContext.js        # Central data state (farms, fields, applications, etc.)
    ModalContext.js       # Global modal management (20+ modals)
    SeasonContext.js      # Season selection and date ranges
    ThemeContext.js       # Dark/light mode
  services/
    api.js               # Axios API client with cookie-based auth (~3,000 lines)
  hooks/
    useAppNavigate.js    # View ID -> URL path navigation hook
  components/
    compliance/          # Compliance dashboard, deadlines, licenses, WPS
    fsma/                # FSMA dashboard, water assessment wizard
    packinghouse/        # BatchUploadModal, pool management
    disease/             # Disease alerts, scouting, threat map
    imagery/             # Satellite imagery, tree detection, LiDAR
    yield-forecast/      # YieldForecastDashboard, forecasting charts
    dashboard/           # FarmStatusStrip, UnifiedTaskList
    navigation/          # Sidebar, breadcrumbs
    settings/            # Company and user settings
    ui/                  # ErrorBoundary, reusable UI components
    GlobalModals.js      # Shared modal management
```

### Security
- **Multi-tenancy**: PostgreSQL Row-Level Security (RLS) + Django middleware for dual-layer company isolation
- **Authentication**: JWT via HttpOnly secure cookies (XSS-protected), falls back to Authorization header
- **Cookie settings**: SameSite=Lax, Secure in production, refresh token scoped to `/api/auth/`

### Data Pipeline
- **Harvest flow**: Harvest -> HarvestLoad -> Delivery -> PackoutReport -> Settlement
- **Commodity-aware units**: Citrus tracked in bins, avocados in lbs (automatic)
- **PDF extraction**: Claude AI parses packout reports and settlement statements into structured data
- **Season management**: SeasonService handles citrus (Nov-Oct), subtropical (Jan-Dec), and custom seasons

### Database
- **57 migrations** (through 0057)
- **Composite indexes** added in migration 0056 for query performance
- **N+1 query fix**: Pool list views use annotated querysets (`_annotate_pool_aggregates`) to pre-compute `delivery_count`, `total_bins`, `total_weight` in a single SQL query

---

## Completed

- [x] Railway deployment (backend + frontend + celery-worker + Postgres + Redis — 5 services)
- [x] PostgreSQL database with persistent volume
- [x] Redis service with persistent volume
- [x] Core data migration (farms, fields, products, applications, etc.)
- [x] Auto-deploy from GitHub `main` branch
- [x] Cloud storage code (R2/S3 via django-storages, auto-switches local/cloud)
- [x] Celery worker deployed on Railway (22+ scheduled tasks running)
- [x] HttpOnly cookie JWT authentication
- [x] Models package refactor (monolithic models.py split into 14 domain files)
- [x] Views split into 27 domain-specific `*_views.py` files with re-export hub
- [x] Serializers split into 20 domain-specific `*_serializers.py` files with re-export hub
- [x] Shared view helpers centralized in `view_helpers.py`
- [x] Automated test suite (auth endpoints, invitations, pagination, PDF extraction, compliance)
- [x] Yield forecasting system (models, services, management commands, frontend dashboard)
- [x] ErrorBoundary component (app-level and section-level)
- [x] Pagination module (StandardPagination, 100/page default)
- [x] Composite database indexes for performance
- [x] N+1 query elimination on Pool list views
- [x] Batch statement upload with Claude AI extraction
- [x] URL-based routing with React Router v7 (routes.js, Main.jsx, App.js)
- [x] Custom domain (www.ojaifarmingco.com)

---

## Remaining Tasks

### 1. Configure Cloud Storage Env Vars
**Status**: Code complete, needs Railway env vars
**Why**: File uploads (satellite images, PDFs, photos) are lost on each deploy. The backend auto-switches to R2 when env vars are present.

**Steps**:
1. Create Cloudflare R2 bucket named `farm-tracker-media`
2. Create API token with read/write access
3. Set these env vars in Railway (backend service):
   - `AWS_ACCESS_KEY_ID` = your R2 access key
   - `AWS_SECRET_ACCESS_KEY` = your R2 secret key
   - `AWS_STORAGE_BUCKET_NAME` = farm-tracker-media
   - `AWS_S3_ENDPOINT_URL` = https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
   - `AWS_S3_REGION_NAME` = auto

**Cost**: ~$0.015/GB/month, free egress

---

### 2. Add Error Monitoring (Sentry)
**Status**: Not started
**Why**: No visibility into production errors. Users may encounter issues that go unnoticed.

**Steps**:
1. Create Sentry account and Django project
2. `pip install sentry-sdk`
3. Add Sentry DSN to settings.py and Railway env vars
4. Configure error sampling and alerting rules

---

### 3. Re-upload Data (If Needed)
**Not migrated** (can be regenerated):
- Tree detection results -> Re-run detection on satellite images
- LiDAR processing results -> Re-upload and process LiDAR files
- Quarantine zones -> Auto-syncs from CDFA
- Satellite images / LiDAR datasets -> Re-upload if needed

---

## Development Workflow
```
1. Make changes locally
2. Test at localhost:3000 (frontend) / localhost:8000 (backend)
3. git add <files> && git commit -m "message" && git push
4. Railway auto-deploys from main branch
```

---

## Software Evaluation Findings (January 2026)

A comprehensive software evaluation was completed on January 29, 2026.

### Strengths
- Comprehensive feature coverage across all farm operations in one platform
- Enterprise-grade data security with dual-layer company isolation (RLS)
- Modern, open-source tech stack with large developer talent pool
- Smart integrations with California agricultural data sources (CIMIS, CDFA, weather)
- Clean user experience with onboarding wizard and dark mode

### Priority Improvements

| # | Item | Impact | Status |
|---|------|--------|--------|
| 1 | ~~Enable Celery worker~~ | ~~Compliance reminders, disease alerts~~ | **Done** -- celery-worker service running on Railway |
| 2 | **Configure cloud storage (R2)** | File uploads lost on each deploy | Code complete -- needs Railway env vars |
| 3 | **Add automated tests** | Financial calculations (settlements, deductions) unverified | Partially done -- 6 test files covering auth, pagination, PDF extraction, compliance |
| 4 | **Add error monitoring (Sentry)** | No visibility into production errors | Not started |
| 5 | ~~Break up large code files~~ | ~~views.py/serializers.py too large~~ | **Done** -- 27 view files, 20 serializer files, shared view_helpers.py |
| 6 | ~~Implement URL-based routing~~ | ~~Can't bookmark or use back button~~ | **Done** -- React Router v7 with centralized route mappings |
| 7 | ~~Custom domain~~ | ~~Railway URLs not user-friendly~~ | **Done** -- www.ojaifarmingco.com |

*Last updated: February 10, 2026*
