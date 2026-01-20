# Farm Management Tracker - System Architecture Guide
## Version 11.4 | January 19, 2026

---

## DOCUMENT PURPOSE

This document provides comprehensive architecture documentation for the **Farm Management Tracker** (also known as **Grove Master**) application. It is specifically designed to:

1. **Onboard AI assistants** (Claude, etc.) to understand the codebase quickly
2. **Guide developers** on project structure, patterns, and conventions
3. **Document all models, APIs, and integrations** for reference
4. **Track the current state** of features and roadmap

**For Claude/AI Assistants:** When working on this codebase, reference this document first to understand the architecture, naming conventions, and existing patterns before making changes.

---

## OVERVIEW

The **Farm Management Tracker** is a comprehensive full-stack web application designed for California citrus and specialty crop farms. It provides end-to-end management of agricultural operations with a focus on regulatory compliance.

### Key Capabilities

| Module | Description |
|--------|-------------|
| **Multi-Tenant Platform** | Multiple companies with isolated data, role-based access, database-level Row-Level Security (RLS) |
| **Onboarding Wizard** | 5-step guided setup for new companies |
| **Farm & Field Management** | GPS mapping, boundary drawing, PLSS lookup, acreage calculation, multi-APN support |
| **Crop & Rootstock Database** | Reference data for crops with agronomic characteristics, compatible rootstocks |
| **Pesticide Tracking** | Application records, product database, PUR export, PHI/REI compliance |
| **Water Management** | Unified water sources with integrated SGMA well tracking |
| **Irrigation Scheduling** | CIMIS integration, crop coefficients, soil moisture, recommendations |
| **Weather Integration** | Real-time weather, spray condition recommendations |
| **Satellite Imagery** | Tree detection from satellite imagery with async processing |
| **Nutrient Management** | Fertilizer tracking, nitrogen calculations, ILRP reporting |
| **Harvest Operations** | Yield tracking, revenue, labor costs, PHI compliance |
| **Quarantine Compliance** | Plant quarantine status checking |
| **Analytics Dashboard** | Farm performance metrics and visualizations |
| **Compliance Reporting** | PUR exports, SGMA semi-annual reports, Nitrogen/ILRP reports |
| **Audit Logging** | Comprehensive activity tracking for compliance |

### What's New in v11.4

| Feature | Description |
|---------|-------------|
| **Compliance Management System** | Comprehensive regulatory compliance tracking with proactive notifications |
| **Compliance Dashboard** | Central hub showing compliance score, deadlines, alerts, and quick actions |
| **Deadline Calendar** | Calendar and list views for tracking regulatory deadlines with auto-generation |
| **License Management** | Track applicator licenses, PCA licenses, organic certifications with expiration alerts |
| **WPS Compliance** | Worker Protection Standard tracking with training records, central posting, and REI tracker |
| **Compliance Reports** | Auto-generated PUR, SGMA, ILRP, and WPS reports with validation and submission tracking |
| **Compliance Settings** | Configure state requirements, certifications, and notification preferences |
| **Compliance Alerts** | Proactive notifications for upcoming deadlines, expiring licenses, and training due |
| **10 New Backend Models** | ComplianceProfile, ComplianceDeadline, ComplianceAlert, License, WPSTrainingRecord, CentralPostingLocation, REIPostingRecord, ComplianceReport, IncidentReport, NotificationPreference |
| **Celery Compliance Tasks** | Automated deadline checking, alert generation, and email reminders |

### What's New in v11.3

| Feature | Description |
|---------|-------------|
| **Farms Page Redesign** | Refactored monolithic Farms.js into modular components with search, filtering, and insights |
| **FarmCard Component** | Extracted farm card UI with mobile-responsive action menus |
| **FieldCard Component** | Extracted field card UI with mobile-responsive action menus |
| **FarmToolbar Component** | Consolidated search, filter, view mode controls, and expand/collapse actions |
| **FarmInsightsPanel Component** | Aggregated insights showing total acreage, field coverage, crop distribution |
| **GPS Coordinate Update Endpoint** | Dedicated `POST /api/farms/{id}/update-coordinates/` endpoint for geocode adjustments |
| **GeocodePreviewModal** | Interactive map preview for geocoded coordinates with drag-to-adjust functionality |
| **QuarantineStatusBadge** | Now gracefully hides when CDFA quarantine API is unavailable (instead of showing "Unknown") |

### What's New in v11.2

| Feature | Description |
|---------|-------------|
| **Satellite Kc Adjustment** | Integrates satellite canopy/NDVI data into irrigation scheduling for better ETc calculations |
| **Crop Maturation Curves** | Crop-specific, age-appropriate reference coverage for 15+ crop types |
| **NDVI Health Modifiers** | Stressed vegetation (low NDVI) automatically receives more water |
| **Zone-Level Configuration** | User-adjustable thresholds for satellite adjustment per irrigation zone |
| **Satellite UI in Zone Card** | Collapsible satellite data display in IrrigationZoneCard component |

### What's New in v11.0

| Feature | Description |
|---------|-------------|
| **Weather Integration** | OpenWeatherMap + CIMIS for real-time weather and spray conditions |
| **Irrigation Scheduling** | Crop coefficient-based irrigation recommendations with CIMIS ETo data |
| **Satellite Imagery & Tree Detection** | ML-based tree detection from satellite imagery with async Celery processing |
| **Crop & Rootstock Models** | Reference database for crops with agronomic data, rootstock compatibility |
| **Enhanced Field Model** | Expanded with crop/rootstock FKs, spacing, orientation, organic status, satellite data |
| **Analytics Dashboard** | Farm performance metrics and summary views |
| **Quarantine Status** | Plant quarantine compliance checking |
| **Password Reset Flow** | Complete forgot password / reset password implementation |
| **Company Management** | Dedicated company settings and stats endpoints |
| **Async Task Processing** | Celery + Redis for long-running tasks (tree detection) |

---

## HIGH-LEVEL ARCHITECTURE

```
+-------------------------------------------------------------------------+
|                         USER'S WEB BROWSER                              |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |              FRONTEND (React 19 + Tailwind CSS 4)                 |  |
|  |              http://localhost:3000                                |  |
|  |                                                                   |  |
|  |  Authentication         Core Modules           Water/Irrigation   |  |
|  |  - Login/Register       - Dashboard            - WaterManagement  |  |
|  |  - AuthContext          - Farms                - IrrigationDash   |  |
|  |  - ForgotPassword       - Fields               - WeatherForecast  |  |
|  |  - ResetPassword        - FarmMap              - WeatherWidget    |  |
|  |  - AcceptInvitation     - Applications                            |  |
|  |  - TeamManagement       - Reports              Harvest/Nutrient   |  |
|  |                                                - Harvests         |  |
|  |  Onboarding             Analytics              - HarvestAnalytics |  |
|  |  - OnboardingWizard     - Analytics            - NutrientMgmt     |  |
|  |                         - AuditLogViewer                          |  |
|  |  Modals (20+)           - CompanySettings      Product Mgmt       |  |
|  |  - FarmModal            - Profile              - ProductMgmt      |  |
|  |  - FieldModal                                  - Quarantine       |  |
|  |  - ApplicationModal                                               |  |
|  |  - HarvestModal, etc.                                             |  |
|  +-------------------------------------------------------------------+  |
|                              |                                          |
|                    HTTP/REST (axios + JWT)                              |
+-------------------------------------------------------------------------+
                               |
+-------------------------------------------------------------------------+
|                  BACKEND (Django 4.2 + REST Framework)                  |
|                  http://localhost:8000                                  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                    AUTHENTICATION LAYER                           |  |
|  |  JWT Tokens (SimpleJWT) - Custom User Model - Email-based Auth    |  |
|  |  /api/auth/* endpoints (login, register, refresh, password reset) |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |              MIDDLEWARE STACK (order matters)                     |  |
|  |  1. SecurityMiddleware                                            |  |
|  |  2. SessionMiddleware                                             |  |
|  |  3. CorsMiddleware                                                |  |
|  |  4. CommonMiddleware                                              |  |
|  |  5. CsrfViewMiddleware                                            |  |
|  |  6. AuthenticationMiddleware                                      |  |
|  |  7. RowLevelSecurityMiddleware  <- Sets RLS context               |  |
|  |  8. MessageMiddleware                                             |  |
|  |  9. XFrameOptionsMiddleware                                       |  |
|  | 10. CompanyMiddleware           <- Additional company context     |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                      REST API ENDPOINTS                           |  |
|  |                                                                   |  |
|  |  Core Resources         Water/SGMA            Irrigation          |  |
|  |  /api/farms/            /api/water-sources/   /api/irrigation-    |  |
|  |  /api/fields/           /api/water-tests/       zones/            |  |
|  |  /api/farm-parcels/     /api/wells/           /api/irrigation-    |  |
|  |  /api/applications/     /api/well-readings/     recommendations/  |  |
|  |  /api/products/         /api/water-            /api/kc-profiles/  |  |
|  |  /api/crops/              allocations/        /api/soil-moisture- |  |
|  |  /api/rootstocks/       /api/extraction-        readings/         |  |
|  |                           reports/                                |  |
|  |  Nutrients              Harvest               Satellite/Trees     |  |
|  |  /api/fertilizer-       /api/harvests/        /api/satellite-     |  |
|  |    products/            /api/harvest-loads/     images/           |  |
|  |  /api/nutrient-         /api/harvest-labor/   /api/detection-     |  |
|  |    applications/        /api/buyers/            runs/             |  |
|  |  /api/nutrient-plans/   /api/labor-           /api/detected-      |  |
|  |                           contractors/          trees/            |  |
|  |                                                                   |  |
|  |  Weather                Analytics              Reports            |  |
|  |  /api/weather/          /api/analytics/       /api/reports/       |  |
|  |    current/             /api/audit-logs/        statistics/       |  |
|  |    forecast/                                    pur-export/       |  |
|  |    spray-conditions/    Quarantine              nitrogen-summary/ |  |
|  |                         /api/quarantine/                          |  |
|  +-------------------------------------------------------------------+  |
|                              |                                          |
|  +-------------------------------------------------------------------+  |
|  |                DATABASE (PostgreSQL 18)                           |  |
|  |                Database: farm_tracker                             |  |
|  |                                                                   |  |
|  |  50+ Tables organized by domain:                                  |  |
|  |  - Auth: Company, User, Role, Permission, CompanyMembership       |  |
|  |  - Core: Farm, FarmParcel, Field, Crop, Rootstock                 |  |
|  |  - Pesticide: PesticideProduct, PesticideApplication              |  |
|  |  - Water: WaterSource, WaterTest, WellReading, WaterAllocation    |  |
|  |  - Irrigation: IrrigationZone, IrrigationEvent, CropCoefficient   |  |
|  |  - Harvest: Harvest, HarvestLoad, HarvestLabor, Buyer, Contractor |  |
|  |  - Nutrients: FertilizerProduct, NutrientApplication, NutrientPlan|  |
|  |  - Satellite: SatelliteImage, TreeDetectionRun, DetectedTree      |  |
|  |  - Compliance: ComplianceProfile, License, WPSTrainingRecord,     |  |
|  |               ComplianceDeadline, ComplianceReport, IncidentReport|  |
|  |  - System: AuditLog, Invitation, WeatherCache, QuarantineStatus   |  |
|  |                                                                   |  |
|  |  ROW-LEVEL SECURITY POLICIES:                                     |  |
|  |  - Enforced on all tenant-scoped tables                           |  |
|  |  - Filters by app.current_company_id session variable             |  |
|  |  - Defense-in-depth: protects data even if app code has bugs      |  |
|  +-------------------------------------------------------------------+  |
|                              |                                          |
|  +-------------------------------------------------------------------+  |
|  |                  ASYNC TASK PROCESSING                            |  |
|  |  Celery Workers + Redis Broker (localhost:6379)                   |  |
|  |  - Tree detection from satellite imagery                          |  |
|  |  - Long-running report generation                                 |  |
|  |  - Compliance deadline checking & alert generation                |  |
|  |  - License expiration monitoring & email reminders                |  |
|  |  - WPS training expiration tracking                               |  |
|  +-------------------------------------------------------------------+  |
|                              |                                          |
|  +-------------------------------------------------------------------+  |
|  |                    EXTERNAL SERVICES                              |  |
|  |  - OpenWeatherMap API - Current weather & forecasts               |  |
|  |  - CIMIS API - California ETo/weather data for irrigation         |  |
|  |  - BLM PLSS Service - Section/Township/Range lookup               |  |
|  |  - Nominatim (OpenStreetMap) - Address geocoding                  |  |
|  |  - (Planned) GSA Portals - Direct SGMA submission                 |  |
|  |  - (Planned) QuickBooks - Financial integration                   |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## TECHNOLOGY STACK

### Backend (Python/Django)

| Package | Version | Purpose |
|---------|---------|---------|
| Django | 4.2 | Web framework, ORM, admin |
| Django REST Framework | 3.14 | API endpoints |
| djangorestframework-simplejwt | 5.3+ | JWT authentication |
| django-cors-headers | 4.3 | CORS for frontend |
| psycopg2-binary | 2.9.9 | PostgreSQL adapter |
| python-dotenv | 1.0.0 | Environment variable management |
| python-decouple | 3.8 | Additional config management |
| Pillow | 10.1 | Image processing |
| **Celery** | 5.3+ | **Async task processing (NEW)** |
| **Redis** | 4.5+ | **Message broker & caching (NEW)** |
| **rasterio** | 1.3+ | **Satellite imagery processing (NEW)** |
| **numpy** | 1.24+ | **Numerical operations (NEW)** |
| **scipy** | 1.10+ | **Scientific computing (NEW)** |
| **scikit-image** | 0.21+ | **Image analysis (NEW)** |
| **shapely** | 2.0+ | **Geometric operations (NEW)** |

### Database

| Component | Details |
|-----------|---------|
| PostgreSQL | Version 18 |
| Database Name | `farm_tracker` |
| User | `farm_tracker_user` |
| Row-Level Security | Enabled on all tenant tables |

### Frontend (JavaScript/React)

| Package | Version | Purpose |
|---------|---------|---------|
| React | 19.2.1 | UI framework |
| React Router DOM | 7.10.1 | Client-side routing |
| axios | 1.13.2 | HTTP client with interceptors |
| Tailwind CSS | 4.1.18 | Utility-first styling |
| Leaflet | 1.9.4 | Interactive maps |
| react-leaflet | 5.0.0 | React map components |
| leaflet-draw | 1.0.4 | Boundary drawing |
| lucide-react | 0.556.0 | Icons |

---

## PROJECT STRUCTURE

```
Farm Pesticide Tracker/
|
+-- backend/                              # Django Backend
|   +-- manage.py
|   +-- .env                              # Database credentials (git-ignored)
|   +-- requirements.txt                  # Python dependencies
|   |
|   +-- pesticide_tracker/                # Django Project Config
|   |   +-- settings.py                   # PostgreSQL + RLS + Celery config
|   |   +-- urls.py                       # Root URL routing
|   |   +-- wsgi.py
|   |   +-- asgi.py
|   |   +-- celery.py                     # Celery configuration (NEW)
|   |
|   +-- api/                              # Main Application
|       +-- models.py                     # 50+ database models (6,500+ lines)
|       +-- views.py                      # ViewSets + utility views (4,400+ lines)
|       +-- serializers.py                # DRF serializers (1,900+ lines)
|       +-- urls.py                       # API routing (200+ lines)
|       |
|       +-- auth_views.py                 # Authentication endpoints
|       +-- team_views.py                 # Team management endpoints
|       +-- onboarding_views.py           # Onboarding endpoints
|       +-- company_views.py              # Company management (NEW)
|       +-- weather_views.py              # Weather API endpoints (NEW)
|       +-- analytics_views.py            # Analytics dashboard (NEW)
|       +-- audit_views.py                # Audit log endpoints
|       +-- imagery_views.py              # Satellite/tree detection (NEW)
|       +-- compliance_views.py           # Compliance management endpoints (v11.4)
|       |
|       +-- rls_middleware.py             # RLS context middleware
|       +-- permissions.py                # Permission utilities + CompanyMiddleware
|       +-- audit_utils.py                # Audit logging mixin
|       |
|       +-- services/                     # Business Logic Services (NEW)
|       |   +-- cimis_service.py          # California CIMIS weather API
|       |   +-- irrigation_scheduler.py   # Irrigation scheduling logic
|       |   +-- satellite_kc_adjuster.py  # Satellite-based Kc adjustment (v11.2)
|       |   +-- quarantine_service.py     # Plant quarantine status
|       |   +-- tree_detection.py         # ML tree detection
|       |
|       +-- tasks/                        # Celery Tasks (NEW)
|       |   +-- __init__.py
|       |   +-- imagery_tasks.py          # Async tree detection
|       |   +-- compliance_tasks.py       # Compliance deadline/alert tasks (v11.4)
|       |
|       +-- pur_reporting.py              # PUR report generator
|       +-- product_import_tool.py        # EPA product importer
|       +-- weather_service.py            # Weather API client
|       +-- email_service.py              # Email configuration
|       |
|       +-- migrations/                   # 25 migration files
|       |   +-- 0001_initial.py
|       |   +-- ...
|       |   +-- 0015_satellite_imagery_tree_detection.py
|       |   +-- 0016_fix_satellite_rls_policy.py
|       |   +-- 0017_rename_indexes.py
|       |   +-- ...
|       |   +-- 0022_tree_feedback.py
|       |   +-- 0023_satellite_kc_adjustment.py  # v11.2
|       |   +-- 0024_wps_posting_field.py
|       |   +-- 0025_compliance_models.py        # v11.4 - All compliance models
|       |
|       +-- templates/                    # Email templates
|       |   +-- emails/
|       |       +-- compliance_deadline_reminder.html  # (v11.4)
|       |       +-- license_expiration_warning.html    # (v11.4)
|       |       +-- training_due_reminder.html         # (v11.4)
|       |       +-- compliance_digest.html             # (v11.4)
|
+-- frontend/                             # React Frontend
    +-- src/
    |   +-- components/                   # 60+ UI components
    |   |   +-- Dashboard.js
    |   |   +-- Farms.js                  # Refactored - uses FarmCard, FarmToolbar
    |   |   +-- FarmCard.js               # (NEW v11.3) Extracted farm card component
    |   |   +-- FieldCard.js              # (NEW v11.3) Extracted field card component
    |   |   +-- FarmToolbar.js            # (NEW v11.3) Search, filter, view controls
    |   |   +-- FarmInsightsPanel.js      # (NEW v11.3) Aggregated farm insights
    |   |   +-- GeocodePreviewModal.js    # (NEW v11.3) GPS preview with adjustable marker
    |   |   +-- Fields.js
    |   |   +-- FarmMap.js
    |   |   +-- Analytics.js              # (NEW)
    |   |   +-- Reports.js, PURReports.js
    |   |   +-- Harvests.js, HarvestAnalytics.js
    |   |   +-- NutrientManagement.js
    |   |   +-- WaterManagement.js
    |   |   +-- IrrigationDashboard.js    # (NEW)
    |   |   +-- IrrigationZoneCard.js     # Zone card with satellite data (v11.2)
    |   |   +-- WeatherForecast.js        # (NEW)
    |   |   +-- WeatherWidget.js          # (NEW)
    |   |   +-- TeamManagement.js
    |   |   +-- AuditLogViewer.js
    |   |   +-- CompanySettings.js
    |   |   +-- Profile.js
    |   |   +-- Login.js
    |   |   +-- ForgotPassword.js         # (NEW)
    |   |   +-- ResetPassword.js          # (NEW)
    |   |   +-- AcceptInvitation.js
    |   |   +-- OnboardingWizard.js
    |   |   +-- GlobalModals.js
    |   |   +-- ProductManagement.js
    |   |   +-- QuarantineStatusBadge.js  # (NEW)
    |   |   +-- FarmParcelManager.js
    |   |   +-- *Modal.js (20+ modal components)
    |   |   +-- imagery/                  # Satellite imagery components
    |   |   +-- compliance/               # Compliance management components (v11.4)
    |   |   |   +-- ComplianceDashboard.js       # Main compliance hub
    |   |   |   +-- DeadlineCalendar.js          # Calendar/list view of deadlines
    |   |   |   +-- LicenseManagement.js         # License tracking
    |   |   |   +-- WPSCompliance.js             # WPS training, posting, REI tracker
    |   |   |   +-- ComplianceReports.js         # Report generation & management
    |   |   |   +-- ComplianceSettings.js        # Profile & notification settings
    |   |   +-- dashboard/
    |   |   |   +-- OperationalAlertsBanner.js   # Enhanced with compliance alerts
    |   |   +-- navigation/
    |   |       +-- Breadcrumbs.js               # Updated with compliance sub-views
    |   |
    |   +-- contexts/                     # React Context (State Management)
    |   |   +-- AuthContext.js            # Auth + multi-company
    |   |   +-- DataContext.js            # Farms, fields, apps data
    |   |   +-- ModalContext.js           # Global modal state
    |   |
    |   +-- pages/
    |   |   +-- LandingPage.jsx
    |   |   +-- Login.js
    |   |
    |   +-- services/
    |   |   +-- api.js                    # Axios config + all API endpoints
    |   |
    |   +-- App.js                        # Main app routing & sidebar
    |   +-- Main.jsx                      # Router wrapper
    |   +-- index.js, index.css
    |
    +-- public/
    +-- package.json
    +-- tailwind.config.js
```

---

## DATABASE MODELS

### Model Count: 40+ Models

Organized by domain:

### Authentication & Multi-Tenancy (7 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Company` | Tenant organization | name, county, operator_id, subscription_tier, onboarding_* |
| `User` | Custom user (email-based) | email, current_company, applicator_license, pca_license |
| `Role` | Permission roles | name, codename, is_system_role, permissions (M2M) |
| `Permission` | Granular permissions | name, codename, category |
| `CompanyMembership` | User <-> Company link | user, company, role, allowed_farms (M2M) |
| `Invitation` | Pending invitations | email, company, role, token, status, expires_at |
| `AuditLog` | Activity tracking | user, company, action, model_name, changes (JSON) |

### Farm & Field Management (5 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Farm` | Farm/ranch info | name, company, county, address, gps_*, plss_* (via LocationMixin) |
| `FarmParcel` | Assessor parcels | farm, apn, acreage, ownership_type |
| `Field` | Field/block info | farm, name, total_acres, crop (FK), rootstock (FK), boundary_geojson, satellite_* fields |
| `Crop` | Crop reference data | name, category, crop_type, kc_mature, kc_young, typical_* |
| `Rootstock` | Rootstock varieties | name, compatible_crops (M2M), vigor, drought_tolerance |

### Pesticide Application (2 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `PesticideProduct` | Product database | epa_registration_number, product_name, restricted_use, phi_days, rei_hours, signal_word |
| `PesticideApplication` | Application records | field, product, application_date, acres_treated, applicator_* |

### Water Management (7 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `WaterSource` | Unified water sources | farm, source_type, well_*, gsa, basin, has_flowmeter |
| `WaterTest` | Quality tests | water_source, test_date, ecoli_result, ph_level, status |
| `Well` | Well infrastructure | (merged into WaterSource) |
| `WellReading` | Meter readings | water_source, reading_date, meter_reading, extraction_acre_feet |
| `WaterAllocation` | SGMA allocations | water_source, water_year, allocated_acre_feet |
| `MeterCalibration` | Calibration records | water_source, calibration_date, performed_by |
| `ExtractionReport` | Groundwater extraction | water_source, report_period, total_extraction_af |

### Irrigation Management (6 models) - NEW

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `IrrigationZone` | Management zones | farm, name, fields (M2M), water_source, **satellite_kc_config** |
| `IrrigationEvent` | Irrigation applications | field, date, duration_hours, water_applied_af |
| `CropCoefficientProfile` | Kc values by growth stage | crop, growth_stage, kc_value |
| `CIMISDataCache` | Weather/ETo cache | station_id, date, eto, temperature |
| `IrrigationRecommendation` | Scheduling recs | zone, date, recommended_hours, based_on_eto |
| `SoilMoistureReading` | Soil monitoring | field, date, depth_inches, moisture_percent |

**IrrigationZone Satellite Kc Adjustment Fields (v11.2):**

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `use_satellite_kc_adjustment` | Boolean | True | Enable satellite canopy-based Kc adjustment |
| `reference_canopy_coverage` | Decimal | null | Override expected mature canopy coverage (%) |
| `ndvi_stress_modifier_enabled` | Boolean | True | Increase water for stressed vegetation based on NDVI |
| `ndvi_healthy_threshold` | Decimal | 0.75 | NDVI above this = healthy (no adjustment) |
| `ndvi_stress_multiplier` | Decimal | 1.10 | Multiply Kc by this when vegetation is stressed |

### Harvest Operations (5 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Harvest` | Harvest events | field, harvest_date, total_bins, price_per_bin |
| `HarvestLoad` | Load tracking | harvest, load_number, bins, weight_lbs, buyer |
| `HarvestLabor` | Labor records | harvest, contractor, workers, hours, cost |
| `Buyer` | Buyer companies | name, contact_*, payment_terms |
| `LaborContractor` | Contractors | name, license_number, contact_* |

### Nutrient Management (3 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `FertilizerProduct` | Nutrient products | name, n_percent, p_percent, k_percent, company |
| `NutrientApplication` | Fertilizer applications | field, product, application_date, amount, method |
| `NutrientPlan` | Nutrient plans | field, year, target_n_lbs_per_acre |

### Satellite & Tree Detection (3 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `SatelliteImage` | GeoTIFF imagery storage | company, farm, file, capture_date, resolution_m, bands, has_nir, source, bounds_*, crs, metadata_json |
| `TreeDetectionRun` | Processing jobs | satellite_image, field, status, algorithm_version, vegetation_index, parameters (JSON), tree_count, trees_per_acre, avg_canopy_diameter_m, canopy_coverage_percent, is_approved |
| `DetectedTree` | Individual trees | detection_run, field, latitude, longitude, pixel_x, pixel_y, canopy_diameter_m, ndvi_value, confidence_score, status, is_verified |

**SatelliteImage Model Details:**
- `file`: GeoTIFF upload to `imagery/%Y/%m/`
- `source`: Provider (SkyWatch, NAIP, Planet, Maxar)
- `bands`: 3 for RGB, 4 for BGRN (NIR enabled)
- `bounds_west/east/south/north`: WGS84 coverage bounds
- Methods: `bounds_geojson`, `center_coordinates`, `covers_field(field)`

**TreeDetectionRun Parameters (JSON):**
```python
{
    "min_canopy_diameter_m": 3.0,    # Minimum canopy size
    "max_canopy_diameter_m": 8.0,    # Maximum canopy size
    "min_tree_spacing_m": 4.0,       # De-duplication spacing
    "tile_size_px": 2048,            # Processing tile size
    "tile_overlap_px": 128,          # Tile overlap
    "gaussian_sigma_px": 1.0,        # Smoothing sigma
    "blob_threshold": 0.05,          # Detection threshold
    "blob_overlap": 0.5              # Blob overlap tolerance
}
```

**DetectedTree Status Values:** `active`, `dead`, `uncertain`, `false_positive`

**Field Model Extensions for Satellite Data:**
- `latest_satellite_tree_count` - Tree count from latest approved run
- `latest_satellite_trees_per_acre` - Density from satellite
- `satellite_canopy_coverage_percent` - Canopy coverage %
- `latest_detection_date` - Date of imagery used
- `latest_detection_run` (FK) - Most recent approved run

### Compliance Management (10 models) - NEW v11.4

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `ComplianceProfile` | Company compliance configuration | company (OneToOne), primary_state, additional_states (JSON), requires_pur_reporting, requires_wps_compliance, requires_fsma_compliance, organic_certified, globalgap_certified, buyer_requirements (JSON) |
| `ComplianceDeadline` | Regulatory deadlines | company, name, description, category (reporting/training/testing/renewal), due_date, frequency (once/monthly/quarterly/annual), warning_days, status (upcoming/due_soon/overdue/completed), auto_generated, related_farm, related_field |
| `ComplianceAlert` | Proactive notifications | company, alert_type, priority (critical/high/medium/low), title, message, related_deadline (FK), related_object_type, related_object_id, is_active, is_acknowledged, action_url, action_label |
| `License` | Applicator/PCA licenses | company, user (optional), license_type (applicator/pca/organic_handler/food_safety/wps_trainer), license_number, issuing_authority, issue_date, expiration_date, status, categories (JSON), endorsements (JSON), renewal_reminder_days, document (FileField) |
| `WPSTrainingRecord` | Worker training records | company, trainee_name, trainee_employee_id, trainee_user (FK), training_type (pesticide_safety/handler/early_entry/respirator), training_date, expiration_date, trainer_name, trainer_certification, verified, certificate_document |
| `CentralPostingLocation` | WPS posting locations | company, farm, location_name, location_description, has_wps_poster, has_emergency_info, has_sds_available, has_application_info, last_verified_date, last_verified_by |
| `REIPostingRecord` | REI posting tracking | application (OneToOne), posted_at, posted_by, rei_end_datetime, removed_at, removed_by, posting_compliant, removal_compliant |
| `ComplianceReport` | Generated reports | company, report_type (pur_monthly/sgma_semi_annual/ilrp_annual/wps_annual), reporting_period_start, reporting_period_end, status (draft/pending_review/ready/submitted/accepted), report_data (JSON), report_file, validation_errors (JSON), validation_warnings (JSON), submitted_at, submitted_by, submission_reference |
| `IncidentReport` | Safety incidents | company, incident_type (exposure/spill/equipment/injury/near_miss), severity (minor/moderate/serious/critical), incident_date, farm, field, reported_by, affected_persons (JSON), description, immediate_actions, related_application, status (reported/investigating/resolved), root_cause, corrective_actions, reported_to_authorities |
| `NotificationPreference` | User notification settings | user (OneToOne), email_enabled, email_digest (instant/daily/weekly), notify_deadlines, notify_licenses, notify_training, notify_reports, deadline_reminder_days (JSON: [30, 14, 7, 1]), quiet_hours_enabled, quiet_hours_start, quiet_hours_end |

**ComplianceDeadline Category Values:**
- `reporting` - PUR, SGMA, ILRP reports
- `training` - WPS, Handler training
- `testing` - Water quality, soil tests
- `renewal` - License renewals

**ComplianceDeadline Status Values:**
- `upcoming` - More than warning_days away
- `due_soon` - Within warning_days
- `overdue` - Past due_date
- `completed` - Marked complete

**ComplianceAlert Priority Levels:**
- `critical` - License expired, major compliance violation
- `high` - License expiring soon, deadline overdue
- `medium` - Training due, deadline approaching
- `low` - Informational reminders

**License Type Values:**
- `applicator` - Qualified Applicator License (QAL)
- `pca` - Pest Control Advisor
- `organic_handler` - Organic certification
- `food_safety` - Food safety certification
- `wps_trainer` - WPS trainer certification

**WPS Training Type Values:**
- `pesticide_safety` - Annual worker safety training
- `handler` - Pesticide handler training
- `early_entry` - Early entry worker training
- `respirator` - Respirator fit testing

### System & Caching (3 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `WeatherCache` | Weather data cache | farm, date, temperature, humidity, cached_at |
| `QuarantineStatus` | Quarantine compliance | field, status, pest_name, check_date |

---

## API ENDPOINTS REFERENCE

### Authentication (`/api/auth/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/register/` | POST | User registration |
| `/api/auth/login/` | POST | Login (returns JWT) |
| `/api/auth/logout/` | POST | Logout (blacklist token) |
| `/api/auth/refresh/` | POST | Refresh JWT token |
| `/api/auth/me/` | GET | Current user info |
| `/api/auth/profile/` | PUT | Update profile |
| `/api/auth/change-password/` | POST | Change password |
| `/api/auth/switch-company/` | POST | Switch company context |
| `/api/auth/invite/` | POST | Invite user to company |
| `/api/auth/accept-invitation/` | POST | Accept invitation |
| `/api/auth/invitation/<token>/` | GET | Validate invitation token |
| `/api/auth/forgot-password/` | POST | Request password reset |
| `/api/auth/reset-password/` | POST | Reset password with token |
| `/api/auth/reset-password/<token>/` | GET | Validate reset token |

### Core Resources (ViewSets - full CRUD)

| Resource | Endpoint | Notes |
|----------|----------|-------|
| Farms | `/api/farms/` | Company-scoped |
| Fields | `/api/fields/` | Farm-scoped |
| Farm Parcels | `/api/farm-parcels/` | APNs for farms |
| Crops | `/api/crops/` | Reference data |
| Rootstocks | `/api/rootstocks/` | Reference data |
| Pesticide Products | `/api/products/` | Product database |
| Applications | `/api/applications/` | Pesticide applications |

### Farm Custom Actions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/farms/{id}/update-coordinates/` | POST | Update only GPS coordinates (bypasses full serializer) |
| `/api/farms/{id}/fields/` | GET | Get all fields for a farm |
| `/api/farms/{id}/bulk-parcels/` | POST | Bulk add parcels to farm |

**Update Coordinates Request (v11.3):**
```json
POST /api/farms/{id}/update-coordinates/
{
    "gps_latitude": 36.7783,
    "gps_longitude": -119.4179
}
```
Returns: `{"success": true, "gps_latitude": 36.7783, "gps_longitude": -119.4179}`

### Water & SGMA

| Resource | Endpoint | Notes |
|----------|----------|-------|
| Water Sources | `/api/water-sources/` | Wells + other sources |
| Water Tests | `/api/water-tests/` | Quality tests |
| Wells | `/api/wells/` | Well management |
| Well Readings | `/api/well-readings/` | Meter readings |
| Meter Calibrations | `/api/meter-calibrations/` | Calibration records |
| Water Allocations | `/api/water-allocations/` | SGMA allocations |
| Extraction Reports | `/api/extraction-reports/` | Groundwater extraction |
| SGMA Dashboard | `/api/sgma/dashboard/` | Summary view |

### Irrigation (NEW)

| Resource | Endpoint | Notes |
|----------|----------|-------|
| Irrigation Zones | `/api/irrigation-zones/` | Management zones |
| Irrigation Events | `/api/irrigation-events/` | Irrigation records |
| Recommendations | `/api/irrigation-recommendations/` | Scheduling recs (includes satellite adjustment) |
| Kc Profiles | `/api/kc-profiles/` | Crop coefficients |
| Soil Moisture | `/api/soil-moisture-readings/` | Soil monitoring |
| Dashboard | `/api/irrigation/dashboard/` | Summary view |
| CIMIS Stations | `/api/irrigation/cimis-stations/` | Weather stations |

**Irrigation Recommendation Response (v11.2):**

```json
{
  "recommended": true,
  "recommended_depth_inches": 0.94,
  "current_depletion_pct": 52.3,
  "details": {
    "cumulative_etc": 1.84,
    "avg_daily_etc": 0.13,
    "satellite_adjustment": {
      "base_kc": 0.65,
      "adjusted_kc": 0.54,
      "canopy_factor": 0.83,
      "health_modifier": 1.0,
      "canopy_coverage_percent": 25.0,
      "reference_coverage_percent": 30.0,
      "crop_type": "avocado",
      "tree_age": 2,
      "zone_avg_ndvi": 0.78,
      "detection_date": "2026-01-05",
      "data_freshness": "current",
      "satellite_data_used": true,
      "adjustments_applied": [
        "Using avocado maturation curve (year 2 reference: 30%)",
        "Canopy coverage (25.0%) below reference (30%) - Kc reduced by 17%"
      ]
    }
  }
}
```

### Harvest & Labor

| Resource | Endpoint | Notes |
|----------|----------|-------|
| Harvests | `/api/harvests/` | Harvest events |
| Harvest Loads | `/api/harvest-loads/` | Load tracking |
| Harvest Labor | `/api/harvest-labor/` | Labor records |
| Buyers | `/api/buyers/` | Buyer companies |
| Labor Contractors | `/api/labor-contractors/` | Contractors |

### Nutrients

| Resource | Endpoint | Notes |
|----------|----------|-------|
| Fertilizer Products | `/api/fertilizer-products/` | Product database |
| Nutrient Applications | `/api/nutrient-applications/` | Applications |
| Nutrient Plans | `/api/nutrient-plans/` | Annual plans |
| Nitrogen Summary | `/api/reports/nitrogen-summary/` | N calculations |
| Nitrogen Export | `/api/reports/nitrogen-export/` | ILRP export |

### Weather (NEW)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/weather/current/<farm_id>/` | GET | Current weather |
| `/api/weather/forecast/<farm_id>/` | GET | Weather forecast |
| `/api/weather/spray-conditions/<farm_id>/` | GET | Spray recommendations |
| `/api/weather/thresholds/` | GET | Spray thresholds |
| `/api/weather/farms/` | GET | All farms weather |

### Satellite Imagery & Tree Detection

#### SatelliteImageViewSet (`/api/satellite-images/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/satellite-images/` | GET | List images (filtered by company, optional `?farm=`) |
| `/api/satellite-images/` | POST | Upload new GeoTIFF (multipart/form-data) |
| `/api/satellite-images/<id>/` | GET | Image details with covered fields list |
| `/api/satellite-images/<id>/` | DELETE | Delete image |
| `/api/satellite-images/<id>/detect-trees/` | POST | **Trigger tree detection** (async) |

**Detect Trees Request:**
```json
POST /api/satellite-images/{id}/detect-trees/
{
    "field_ids": [1, 2, 3],
    "parameters": {
        "min_canopy_diameter_m": 3.0,
        "max_canopy_diameter_m": 8.0,
        "min_tree_spacing_m": 4.0
    }
}
```
Returns: `{"run_ids": [...]}`  Status: 202 ACCEPTED

#### TreeDetectionRunViewSet (`/api/detection-runs/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/detection-runs/` | GET | List runs (`?status=`, `?field=`, `?satellite_image=`) |
| `/api/detection-runs/<id>/` | GET | Run details with results |
| `/api/detection-runs/<id>/trees/` | GET | All trees for run (`?format=geojson`, `?status=`) |
| `/api/detection-runs/<id>/approve/` | POST | Approve run & update field stats |

**Approve Request:**
```json
POST /api/detection-runs/{id}/approve/
{"review_notes": "Verified against field inspection"}
```

#### DetectedTreeViewSet (`/api/detected-trees/`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/detected-trees/<id>/` | PATCH | Update tree (status, is_verified, notes only) |

#### Field-Centric Tree Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/fields/<id>/trees/` | GET | Trees from latest approved run (`?format=geojson`, `?run_id=`) |
| `/api/fields/<id>/tree-summary/` | GET | Compare manual vs satellite counts |
| `/api/fields/<id>/detection-history/` | GET | All detection runs for field |
| `/api/fields/<id>/trees/export/` | GET | Download GeoJSON file |

**Tree Summary Response:**
```json
{
    "field_id": 1,
    "field_name": "Block A",
    "total_acres": 10.5,
    "manual_tree_count": 1050,
    "manual_trees_per_acre": 100,
    "satellite_tree_count": 1023,
    "satellite_trees_per_acre": 97.4,
    "canopy_coverage_percent": 45.2,
    "detection_date": "2026-01-15",
    "count_difference": -27,
    "count_difference_percent": -2.6
}

### Analytics & Audit (NEW)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/analytics/dashboard/` | GET | Analytics dashboard |
| `/api/analytics/summary/` | GET | Summary metrics |
| `/api/audit-logs/` | GET | Audit log list |
| `/api/audit-logs/<id>/` | GET | Audit log detail |
| `/api/audit-logs/filters/` | GET | Available filters |
| `/api/audit-logs/export/` | GET | Export audit logs |
| `/api/audit-logs/statistics/` | GET | Audit statistics |

### Quarantine (NEW)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/quarantine/check/` | GET | Check quarantine status |
| `/api/quarantine/boundaries/` | GET | Quarantine boundaries |

**Note (v11.3):** The `QuarantineStatusBadge` component now returns `null` (renders nothing) when the CDFA quarantine API is unavailable, instead of showing a confusing "Unknown" badge. The CDFA API at `gis2.cdfa.ca.gov` may be unreliable or have moved to a different URL.

### Compliance Management (NEW v11.4)

#### Compliance Profile & Alerts

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/compliance/profile/` | GET/PUT | Get/update company compliance profile |
| `/api/compliance/dashboard/` | GET | Compliance dashboard summary |
| `/api/compliance/alerts/` | GET | List active compliance alerts |
| `/api/compliance/alerts/<id>/acknowledge/` | POST | Acknowledge an alert |

#### Compliance Deadlines

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/compliance/deadlines/` | GET/POST | List/create deadlines |
| `/api/compliance/deadlines/<id>/` | GET/PUT/DELETE | Deadline CRUD |
| `/api/compliance/deadlines/<id>/complete/` | POST | Mark deadline complete |
| `/api/compliance/deadlines/generate/` | POST | Generate recurring deadlines |

#### License Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/licenses/` | GET/POST | List/create licenses |
| `/api/licenses/<id>/` | GET/PUT/DELETE | License CRUD |
| `/api/licenses/expiring/` | GET | Get licenses expiring soon |
| `/api/licenses/<id>/renew/` | POST | Start renewal process |

#### WPS Compliance

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/wps/training/` | GET/POST | WPS training records |
| `/api/wps/training/<id>/` | GET/PUT/DELETE | Training record CRUD |
| `/api/wps/training/expiring/` | GET | Training expiring soon |
| `/api/wps/posting-locations/` | GET/POST | Central posting locations |
| `/api/wps/posting-locations/<id>/` | GET/PUT/DELETE | Posting location CRUD |
| `/api/wps/posting-locations/<id>/verify/` | PUT | Verify posting compliance |
| `/api/wps/rei-postings/` | GET | REI posting records |
| `/api/wps/rei-postings/active/` | GET | Active REI postings |
| `/api/wps/rei-postings/<id>/mark-posted/` | POST | Mark REI as posted |
| `/api/wps/rei-postings/<id>/mark-removed/` | POST | Mark REI notice removed |
| `/api/wps/dashboard/` | GET | WPS compliance summary |

#### Compliance Reports

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/compliance/reports/` | GET/POST | List/create reports |
| `/api/compliance/reports/<id>/` | GET/PUT/DELETE | Report CRUD |
| `/api/compliance/reports/generate/` | POST | Auto-generate report |
| `/api/compliance/reports/<id>/validate/` | POST | Validate report data |
| `/api/compliance/reports/<id>/submit/` | POST | Submit report to authority |

#### Incident Reporting

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/compliance/incidents/` | GET/POST | List/create incidents |
| `/api/compliance/incidents/<id>/` | GET/PUT/DELETE | Incident CRUD |
| `/api/compliance/incidents/<id>/resolve/` | POST | Resolve incident |

#### Notification Preferences

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/compliance/notifications/preferences/` | GET/PUT | User notification settings |

**Compliance Dashboard Response:**
```json
{
  "overall_status": "warning",
  "score": 87,
  "summary": {
    "deadlines_this_month": 5,
    "overdue_items": 2,
    "expiring_licenses": 3,
    "active_alerts": 8
  },
  "by_category": {
    "reporting": { "status": "good", "pending": 1 },
    "training": { "status": "warning", "expiring_soon": 3 },
    "licenses": { "status": "good", "expiring_soon": 1 }
  },
  "upcoming_deadlines": [...],
  "active_alerts": [...]
}
```

### Company & Team

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/companies/<id>/` | GET | Company details |
| `/api/companies/<id>/update/` | PUT | Update company |
| `/api/companies/<id>/stats/` | GET | Company statistics |
| `/api/companies/<id>/members/` | GET/POST | Team members |
| `/api/companies/<id>/members/<id>/` | GET/PUT | Member details |
| `/api/companies/<id>/members/<id>/remove/` | DELETE | Remove member |
| `/api/roles/available/` | GET | Available roles |
| `/api/invitations/` | GET | List invitations |
| `/api/invitations/<id>/resend/` | POST | Resend invitation |
| `/api/invitations/<id>/` | DELETE | Revoke invitation |

### Reference Data (NEW)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/reference/california-counties/` | GET | CA county list |
| `/api/reference/primary-crops/` | GET | Crop options |

### Onboarding

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/onboarding/status/` | GET | Onboarding status |
| `/api/onboarding/step/` | POST | Update step |
| `/api/onboarding/complete/` | POST | Complete onboarding |
| `/api/onboarding/skip/` | POST | Skip onboarding |
| `/api/onboarding/reset/` | POST | Reset onboarding |

### Reports

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/reports/statistics/` | GET | Report statistics |
| `/api/applications/export-pur/` | POST | PUR export |
| `/api/geocode/` | GET | Address geocoding |
| `/api/plss/` | GET | GPS to PLSS lookup |
| `/api/fields/<id>/boundary/` | PUT | Update field boundary |

---

## ROW-LEVEL SECURITY (RLS)

### Overview

Row-Level Security provides database-enforced tenant isolation. Even if application code forgets to filter by company, the database itself will only return rows belonging to the current tenant.

### How It Works

```
1. User Request          2. Middleware              3. Database
+----------------+       +----------------+         +----------------+
| GET /farms/    |------>| Set company    |-------->| RLS Policy     |
| Auth: JWT      |       | context:       |         | checks:        |
|                |       | SET app.       |         | company_id =   |
|                |       | current_       |         | current_       |
|                |       | company_id=5   |         | company_id     |
+----------------+       +----------------+         +----------------+
                                                          |
                                                          v
                                                   Only company 5's
                                                   farms returned
```

### RLS Middleware

Location: `backend/api/rls_middleware.py`

```python
class RowLevelSecurityMiddleware:
    """Sets PostgreSQL session variable for RLS on each request."""

    def __call__(self, request):
        if request.user.is_authenticated and request.user.current_company_id:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SET app.current_company_id = %s",
                    [str(request.user.current_company_id)]
                )
        return self.get_response(request)
```

### RLS-Protected Tables

| Protection Level | Tables |
|------------------|--------|
| **Direct company_id** | Farm, Invitation, AuditLog, FertilizerProduct, Crop, Rootstock |
| **Via Farm** | FarmParcel, Field, WaterSource, IrrigationZone |
| **Via Field** | PesticideApplication, NutrientApplication, Harvest, IrrigationEvent, SatelliteImage |
| **Via Harvest** | HarvestLoad, HarvestLabor |
| **Via WaterSource** | WaterTest, WellReading, MeterCalibration, WaterAllocation |
| **Via SatelliteImage** | TreeDetectionRun, DetectedTree |

### Using RLS in Django Shell

```python
from django.db import connection
from api.models import Farm, Company

# Without context - returns 0 (RLS blocks access)
Farm.objects.count()  # 0

# Set context manually
company = Company.objects.first()
with connection.cursor() as cursor:
    cursor.execute("SET app.current_company_id = %s", [company.id])

# Now returns your farms
Farm.objects.count()  # Your actual count
```

---

## STATE MANAGEMENT (FRONTEND)

### Context API Architecture

The frontend uses React Context API (not Redux) with 3 main contexts:

#### AuthContext (`contexts/AuthContext.js`)

Manages authentication state and multi-company support.

```javascript
// Provides:
{
  user,              // Current user object
  currentCompany,    // Active company
  companies,         // User's companies list
  token,             // JWT access token
  loading,

  // Methods
  login(email, password),
  logout(),
  register(userData),
  switchCompany(companyId),
  refreshToken(),
}
```

#### DataContext (`contexts/DataContext.js`)

Manages core application data.

```javascript
// Provides:
{
  farms,
  fields,
  applications,
  products,
  waterSources,
  crops,
  rootstocks,
  loading,

  // Methods
  fetchFarms(),
  fetchFields(farmId),
  createFarm(data),
  updateField(id, data),
  // ... etc
}
```

#### ModalContext (`contexts/ModalContext.js`)

Manages global modal state for 20+ entity types.

```javascript
// Provides:
{
  modals: {
    farm: { isOpen, data },
    field: { isOpen, data },
    application: { isOpen, data },
    harvest: { isOpen, data },
    // ... 20+ modal types
  },

  openModal(type, data),
  closeModal(type),
}
```

### API Service (`services/api.js`)

Axios instance with auto-retry and token refresh:

```javascript
// Configuration
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
});

// Request interceptor - adds JWT
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor - refreshes on 401
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Attempt token refresh
      // Retry original request
    }
    return Promise.reject(error);
  }
);
```

---

## ASYNC TASK PROCESSING (CELERY)

### Configuration

Location: `backend/pesticide_tracker/celery.py`

```python
from celery import Celery

app = Celery('pesticide_tracker')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
```

Settings in `settings.py`:
```python
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
```

### Tree Detection Tasks

Location: `backend/api/tasks/imagery_tasks.py`

```python
@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_tree_detection(self, detection_run_id):
    """
    Async task to process satellite imagery for tree detection.
    Flow:
    1. Load TreeDetectionRun with related objects
    2. Mark as 'processing'
    3. Parse detection parameters
    4. Run detect_trees() algorithm
    5. Bulk create DetectedTree records (batch_size=1000)
    6. Update run with results (tree_count, trees_per_acre, etc.)
    7. Set status to 'completed'

    Error handling: Catches exceptions, marks as 'failed',
    auto-retries up to 3 times with 60s delay
    """

@shared_task
def cleanup_old_detection_runs(days_old=90):
    """Removes old unapproved detection runs and their trees."""

@shared_task
def reprocess_detection_run(detection_run_id, new_parameters=None):
    """Creates new run with same image/field but different parameters."""
```

### Compliance Tasks (NEW v11.4)

Location: `backend/api/tasks/compliance_tasks.py`

```python
@shared_task
def check_compliance_deadlines():
    """
    Daily task (6 AM) to update deadline statuses and generate alerts.
    Flow:
    1. Query all pending deadlines
    2. Update status based on due_date vs current date:
       - upcoming → due_soon (within warning_days)
       - due_soon → overdue (past due_date)
    3. Generate ComplianceAlert for status changes
    4. Log statistics
    """

@shared_task
def generate_recurring_deadlines(company_id=None):
    """
    Generate next 12 months of deadlines from ComplianceProfile.
    Creates deadlines for:
    - Monthly PUR reporting (if requires_pur_reporting)
    - Semi-annual SGMA reports (if wells present)
    - Annual WPS compliance reviews (if requires_wps_compliance)
    - Annual license renewals
    """

@shared_task
def check_license_expirations():
    """
    Daily task to check license expiration dates.
    Generates alerts at 90, 60, 30, 14, 7 days before expiration.
    """

@shared_task
def check_wps_training_expirations():
    """
    Daily task to check WPS training expiration.
    Generates alerts at 90, 60, 30 days before expiration.
    """

@shared_task
def send_compliance_reminder_emails():
    """
    Sends email reminders based on NotificationPreference settings.
    Respects email_digest preference (instant/daily/weekly).
    """

@shared_task
def send_daily_compliance_digest():
    """7 AM daily - Sends digest to users with daily preference."""

@shared_task
def send_weekly_compliance_digest():
    """Monday 7 AM - Sends digest to users with weekly preference."""

@shared_task
def auto_generate_monthly_pur(month=None, year=None):
    """
    1st of month - Auto-generate draft PUR report for previous month.
    Creates ComplianceReport with status='draft'.
    """

@shared_task
def generate_rei_posting_records():
    """
    Called when PesticideApplication created.
    Auto-creates REIPostingRecord with calculated rei_end_datetime.
    """
```

**Celery Beat Schedule (compliance tasks):**
```python
CELERY_BEAT_SCHEDULE = {
    'check-compliance-deadlines': {
        'task': 'api.tasks.compliance_tasks.check_compliance_deadlines',
        'schedule': crontab(hour=6, minute=0),  # Daily 6 AM
    },
    'check-license-expirations': {
        'task': 'api.tasks.compliance_tasks.check_license_expirations',
        'schedule': crontab(hour=6, minute=15),  # Daily 6:15 AM
    },
    'check-wps-training': {
        'task': 'api.tasks.compliance_tasks.check_wps_training_expirations',
        'schedule': crontab(hour=6, minute=30),  # Daily 6:30 AM
    },
    'send-daily-digest': {
        'task': 'api.tasks.compliance_tasks.send_daily_compliance_digest',
        'schedule': crontab(hour=7, minute=0),  # Daily 7 AM
    },
    'send-weekly-digest': {
        'task': 'api.tasks.compliance_tasks.send_weekly_compliance_digest',
        'schedule': crontab(hour=7, minute=0, day_of_week=1),  # Monday 7 AM
    },
    'auto-generate-pur': {
        'task': 'api.tasks.compliance_tasks.auto_generate_monthly_pur',
        'schedule': crontab(hour=3, minute=0, day_of_month=1),  # 1st of month 3 AM
    },
}
```

---

## TREE DETECTION SERVICE

Location: `backend/api/services/tree_detection.py` (702 lines)

### Algorithm Overview

1. **Load GeoTIFF** - Extract metadata (resolution, CRS, bounds)
2. **Windowed tile processing** - 2048px tiles with 128px overlap (memory-safe)
3. **Clip to field boundary** - Per tile using GeoJSON polygon
4. **Calculate vegetation index**:
   - NDVI if NIR available: `(NIR - Red) / (NIR + Red)`
   - Excess Green fallback (RGB-only): `2*Green - Red - Blue`
5. **Shadow masking** - Permissive OR logic for valid pixels
6. **Gaussian smoothing** - Reduce noise
7. **Blob detection** - Difference of Gaussian with spacing constraint
8. **De-duplication** - KDTree across tile boundaries
9. **Coordinate conversion** - Pixel to lat/lon (WGS84)
10. **Calculate metrics** - Trees/acre, canopy coverage %

### Detection Parameters

```python
@dataclass
class DetectionParams:
    min_canopy_diameter_m: float = 3.0    # Minimum canopy size
    max_canopy_diameter_m: float = 8.0    # Maximum canopy size
    min_tree_spacing_m: float = 4.0       # De-duplication spacing
    tile_size_px: int = 2048              # Tile size for windowed read
    tile_overlap_px: int = 128            # Overlap between tiles
    gaussian_sigma_px: float = 1.0        # Smoothing sigma
    blob_threshold: float = 0.05          # Blob detection threshold
    blob_overlap: float = 0.5             # Blob overlap tolerance
    min_brightness_percentile: float = 5.0  # Shadow threshold
    shadow_ndvi_max: float = 0.3          # Max NDVI for shadow
    min_nir_brightness: float = 0.03      # Min NIR value
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `detect_trees(image_path, field_boundary, params)` | Main entry point |
| `calculate_ndvi(red, nir)` | NDVI calculation, normalized to 0-1 |
| `calculate_excess_green(rgb)` | ExG for RGB-only imagery |
| `create_shadow_mask(image, params)` | Permissive shadow detection |
| `find_trees_blob_detection(veg_index, params)` | Difference of Gaussian detection |
| `calculate_canopy_metrics(trees, field_acres)` | Trees/acre and coverage % |
| `extract_geotiff_metadata(file_path)` | Metadata for SatelliteImage creation |

### Supported Imagery

| Bands | Type | Index Used | Notes |
|-------|------|------------|-------|
| 3 | RGB | Excess Green (ExG) | Lower accuracy |
| 4 | BGRN | NDVI | **Preferred** - SkyWatch standard |

### Frontend Components

Location: `frontend/src/components/imagery/`

| Component | Purpose | Size |
|-----------|---------|------|
| `SatelliteImageUpload.js` | Drag-drop GeoTIFF upload with validation | 357 lines |
| `TreeDetectionPanel.js` | Multi-field detection with parameters, live progress polling | 465 lines |
| `TreeMapLayer.js` | Leaflet layer for tree markers with color coding | 241 lines |
| `TreeSummaryCard.js` | Manual vs satellite count comparison | 201 lines |

### Management Commands

```bash
# Run tree detection
python manage.py run_tree_detection --image-id 1
python manage.py run_tree_detection --image-id 1 --field-ids 1 2 3
python manage.py run_tree_detection --image-id 1 --sync  # Without Celery

# Testing
python manage.py test_tree_detection
python manage.py smoke_tree_detection
python manage.py export_tree_detection_qa
```

### Running Celery

```bash
# Start worker
celery -A pesticide_tracker worker --loglevel=info

# Start beat (for scheduled tasks)
celery -A pesticide_tracker beat --loglevel=info
```

---

## SATELLITE-BASED KC ADJUSTMENT SERVICE (v11.2)

Location: `backend/api/services/satellite_kc_adjuster.py`

### Overview

Integrates satellite-derived canopy coverage and NDVI data into irrigation scheduling to improve ETc (crop evapotranspiration) calculations. The key formula change:

```
Previous:  ETc = ETo × Kc_base
New:       ETc = ETo × Kc_base × canopy_factor × health_modifier
```

### Algorithm

1. **Canopy Factor Calculation**
   - `canopy_factor = actual_coverage / reference_coverage`
   - Clamped to range [0.30, 1.0] to prevent severe underwatering
   - Uses crop-specific, age-appropriate reference coverage

2. **Health Modifier (NDVI-based)**
   - Stressed vegetation (low NDVI) gets increased water
   - NDVI ≥ 0.75: healthy → modifier = 1.0
   - NDVI 0.65-0.75: mild stress → modifier = 1.05
   - NDVI 0.55-0.65: moderate stress → modifier = 1.10
   - NDVI < 0.55: severe stress → modifier = 1.15

### Crop Maturation Curves

Different crops mature at different rates. The service uses crop-specific maturation curves to determine expected canopy coverage for each tree age:

| Crop Type | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 | Mature |
|-----------|--------|--------|--------|--------|--------|--------|
| **Citrus** (oranges, lemons, etc.) | 10% | 25% | 40% | 55% | 65% | 70% |
| **Avocado** | 15% | 30% | 45% | 55% | 65% | 75% |
| **Stone Fruit** (peaches, plums) | 20% | 40% | 55% | 65% | 70% | 70% |
| **Almond/Walnut** | 10% | 20% | 35% | 50% | 60% | 65% |
| **Grape/Vine** | 25% | 50% | 65% | 70% | 70% | 70% |
| **Pistachio** | 8% | 15% | 25% | 35% | 45% | 55% |
| **Default** (unknown crops) | 15% | 30% | 50% | 60% | 65% | 70% |

**Example:** A 2-year-old avocado block at 25% actual coverage:
- Uses reference = 30% (avocado year 2 from maturation curve)
- `canopy_factor = 25/30 = 0.83` (appropriate slight reduction)
- NOT `25/75 = 0.33` (would be wrong for young trees)

### Class: SatelliteKcAdjuster

```python
class SatelliteKcAdjuster:
    def __init__(self, zone):
        """Initialize with an IrrigationZone instance."""

    def get_adjusted_kc(self, base_kc: Decimal, month: int) -> dict:
        """
        Returns dict with:
        - adjusted_kc: Final adjusted Kc value
        - base_kc: Original Kc value
        - canopy_factor: Factor from canopy coverage
        - health_modifier: Factor from NDVI health
        - satellite_data_used: Whether satellite data was used
        - adjustments_applied: List of adjustment descriptions
        - data_freshness: 'current', 'stale', or 'unavailable'
        - canopy_coverage_percent: Actual coverage from satellite
        - reference_coverage_percent: Expected coverage for crop/age
        - zone_avg_ndvi: Average NDVI of active trees
        - detection_date: Date of satellite imagery used
        """
```

### Integration with IrrigationScheduler

The `IrrigationScheduler` service automatically uses `SatelliteKcAdjuster` when:
1. Zone has `use_satellite_kc_adjustment = True` (default)
2. Field has satellite data (`satellite_canopy_coverage_percent` is set)
3. Field has a `latest_detection_date`

The adjustment details are included in the recommendation response under `details.satellite_adjustment`.

### Data Freshness

- Data age tracked via `latest_detection_date` on Field model
- Data older than 180 days flagged as "stale"
- Stale data still used but warning included in `adjustments_applied`
- No satellite data = graceful fallback to base Kc

### Frontend Display

The `IrrigationZoneCard` component displays satellite adjustment data in a collapsible section showing:
- Active/Not Available status badge
- Base Kc → Adjusted Kc with visual strikethrough
- Canopy coverage (actual vs reference)
- Average NDVI with health status indicator (Healthy/Mild Stress/Stressed)
- Adjustment factors (canopy_factor, health_modifier)
- Data freshness and detection date
- Human-readable adjustment descriptions

---

## EXTERNAL SERVICE INTEGRATIONS

### Weather Services

#### OpenWeatherMap

Location: `backend/api/weather_service.py`

```python
# API Key in settings
OPENWEATHERMAP_API_KEY = os.environ.get('OPENWEATHERMAP_API_KEY')

# Endpoints used:
# - /weather (current)
# - /forecast (5-day)
```

#### CIMIS (California Irrigation Management)

Location: `backend/api/services/cimis_service.py`

```python
# Provides:
# - Reference evapotranspiration (ETo)
# - Weather station data
# - Historical data for irrigation calculations
```

### Geolocation Services

#### BLM PLSS API

Location: `backend/api/models.py` (LocationMixin)

```python
def lookup_plss_from_coordinates(self, save=True):
    """Call BLM PLSS service to populate PLSS fields from GPS."""
    url = "https://gis.blm.gov/arcgis/rest/services/Cadastral/..."
    # Returns: section, township, range, meridian
```

### Email Services

Location: `backend/api/email_service.py`

Supports multiple backends:
- Gmail SMTP
- SendGrid
- AWS SES
- Generic SMTP

Configured via `EMAIL_BACKEND_TYPE` environment variable.

---

## RUNNING THE APPLICATION

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Create .env file
# DB_NAME=farm_tracker
# DB_USER=farm_tracker_user
# DB_PASSWORD=your_password
# DB_HOST=localhost
# DB_PORT=5432

# Run migrations
python manage.py migrate

# Setup default roles/permissions (first time)
python manage.py shell
>>> from api.models import setup_default_permissions
>>> setup_default_permissions()
>>> exit()

# Start server
python manage.py runserver
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

### Celery Setup (for async tasks)

```bash
# Start Redis (required)
redis-server

# Start Celery worker
cd backend
celery -A pesticide_tracker worker --loglevel=info
```

### Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api/
- **Django Admin**: http://localhost:8000/admin/

---

## ENVIRONMENT VARIABLES

### Backend (.env)

```bash
# Database
DB_NAME=farm_tracker
DB_USER=farm_tracker_user
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# Email
EMAIL_BACKEND=console  # or sendgrid, ses, smtp
EMAIL_HOST_PASSWORD=your_api_key

# External APIs
OPENWEATHERMAP_API_KEY=your_key
CIMIS_API_KEY=your_key

# Celery/Redis
CELERY_BROKER_URL=redis://localhost:6379/0
```

---

## COMMON PATTERNS & CONVENTIONS

### Backend Patterns

1. **ViewSets with company filtering**: All ViewSets filter by user's current company
2. **LocationMixin**: Abstract base for GPS/PLSS fields (Farm, Field, WaterSource)
3. **Audit logging**: Use `AuditLogMixin` or manual `AuditLog.objects.create()`
4. **RLS context**: Always set via middleware, use `RLSContextManager` for background tasks
5. **Serializers**: Nested serializers for related data, separate list/detail serializers

### Frontend Patterns

1. **Context API**: Global state in AuthContext, DataContext, ModalContext
2. **Modal pattern**: `GlobalModals` component renders all modals based on ModalContext state
3. **API calls**: All through `services/api.js` with automatic token handling
4. **Form handling**: Controlled components with local state
5. **Tailwind CSS**: Utility classes, no separate CSS files (except App.css for globals)

### Naming Conventions

- **Models**: PascalCase, singular (Farm, Field, Harvest)
- **API endpoints**: kebab-case, plural (/api/farms/, /api/water-sources/)
- **React components**: PascalCase (FarmModal.js, WaterManagement.js)
- **Context/services**: camelCase (authContext, api.js)
- **Database tables**: api_modelname (api_farm, api_field)

---

## TROUBLESHOOTING

### Common Issues

| Issue | Solution |
|-------|----------|
| "currentCompany is null" | User has no company membership - create via Django shell |
| "No company associated with user" | User's `current_company` not set - assign via Django shell |
| "new row violates row-level security policy" | RLS blocking insert - check if company context is set |
| Django shell returns 0 for all queries | RLS working correctly - set company context first |
| Celery tasks not running | Check Redis is running, Celery worker is started |
| Weather data not loading | Check API keys in .env, verify farm has GPS coordinates |

### Testing RLS in Django Shell

```python
from django.db import connection
from api.models import Farm, Company

# This should return 0 (no context set)
print(Farm.objects.count())

# Set context
company = Company.objects.first()
with connection.cursor() as cursor:
    cursor.execute("SET app.current_company_id = %s", [company.id])

# This should return your farms
print(Farm.objects.count())
```

---

## ROADMAP

### Completed (v11.0)

- [x] Multi-tenant authentication with RLS
- [x] Farm/Field/Application management
- [x] Crop & Rootstock reference database
- [x] Weather integration (OpenWeatherMap + CIMIS)
- [x] Irrigation scheduling
- [x] Satellite imagery & tree detection
- [x] Analytics dashboard
- [x] Quarantine status checking
- [x] Password reset flow
- [x] Audit log viewer UI
- [x] PUR export
- [x] Nutrient management / ILRP reporting

### Completed (v11.2)

- [x] **Satellite-based Kc adjustment** - Integrate satellite canopy/NDVI data into irrigation scheduling
- [x] Crop-specific maturation curves for young tree handling
- [x] NDVI health modifiers (stressed vegetation gets more water)
- [x] User-configurable thresholds per zone
- [x] Frontend UI for satellite adjustment display in IrrigationZoneCard

### Completed (v11.4)

- [x] **Compliance Management System** - Comprehensive regulatory compliance tracking
- [x] **Compliance Dashboard** - Central hub with compliance score, deadlines, alerts
- [x] **Deadline Calendar** - Calendar and list views with auto-generation
- [x] **License Management** - Track applicator/PCA licenses with expiration alerts
- [x] **WPS Compliance** - Training records, central posting, REI tracker
- [x] **Compliance Reports** - Auto-generated PUR, SGMA, ILRP, WPS reports
- [x] **Compliance Settings** - Profile configuration and notification preferences
- [x] **10 New Backend Models** - ComplianceProfile, ComplianceDeadline, ComplianceAlert, License, WPSTrainingRecord, CentralPostingLocation, REIPostingRecord, ComplianceReport, IncidentReport, NotificationPreference
- [x] **Celery Compliance Tasks** - Automated deadline checking, alert generation, email reminders
- [x] **Compliance Email Templates** - Deadline reminders, license expiration, training due, digest emails

### Phase 2: Near-term

- [ ] Email sending for invitations (currently logged to console)
- [ ] Extraction report PDF generation
- [ ] GSA portal direct submission
- [ ] Permission-based UI hiding
- [ ] Add company FK to Buyer/LaborContractor models
- [ ] Improved error handling and user feedback

### Phase 3: Medium-term

- [ ] Split models.py into domain-specific apps
- [ ] Data export/portability for customers
- [ ] QuickBooks integration
- [ ] Mobile responsive improvements
- [ ] Bulk data import (CSV)
- [ ] Offline capability for field workers

### Phase 4: SaaS Launch

- [ ] Stripe billing integration
- [ ] Subscription management
- [ ] AWS/Cloud deployment
- [ ] Mobile app (React Native)

---

## KEY FILE LOCATIONS

| Purpose | Path |
|---------|------|
| Django settings | `backend/pesticide_tracker/settings.py` |
| Environment variables | `backend/.env` |
| Database models | `backend/api/models.py` |
| API views | `backend/api/views.py` |
| API routes | `backend/api/urls.py` |
| Serializers | `backend/api/serializers.py` |
| RLS Middleware | `backend/api/rls_middleware.py` |
| Auth views | `backend/api/auth_views.py` |
| Weather service | `backend/api/weather_service.py` |
| CIMIS service | `backend/api/services/cimis_service.py` |
| **Imagery views** | `backend/api/imagery_views.py` |
| **Tree detection service** | `backend/api/services/tree_detection.py` |
| **Satellite Kc adjuster** | `backend/api/services/satellite_kc_adjuster.py` |
| **Celery imagery tasks** | `backend/api/tasks/imagery_tasks.py` |
| React app entry | `frontend/src/App.js` |
| Auth context | `frontend/src/contexts/AuthContext.js` |
| Data context | `frontend/src/contexts/DataContext.js` |
| API service | `frontend/src/services/api.js` |
| **Farms page** | `frontend/src/components/Farms.js` |
| **FarmCard component** | `frontend/src/components/FarmCard.js` |
| **FieldCard component** | `frontend/src/components/FieldCard.js` |
| **FarmToolbar component** | `frontend/src/components/FarmToolbar.js` |
| **FarmInsightsPanel component** | `frontend/src/components/FarmInsightsPanel.js` |
| **GeocodePreviewModal** | `frontend/src/components/GeocodePreviewModal.js` |
| **QuarantineStatusBadge** | `frontend/src/components/QuarantineStatusBadge.js` |
| **Imagery components** | `frontend/src/components/imagery/` |
| **Irrigation zone card** | `frontend/src/components/IrrigationZoneCard.js` |
| **Compliance views** | `backend/api/compliance_views.py` |
| **Compliance Celery tasks** | `backend/api/tasks/compliance_tasks.py` |
| **Compliance Dashboard** | `frontend/src/components/compliance/ComplianceDashboard.js` |
| **Deadline Calendar** | `frontend/src/components/compliance/DeadlineCalendar.js` |
| **License Management** | `frontend/src/components/compliance/LicenseManagement.js` |
| **WPS Compliance** | `frontend/src/components/compliance/WPSCompliance.js` |
| **Compliance Reports** | `frontend/src/components/compliance/ComplianceReports.js` |
| **Compliance Settings** | `frontend/src/components/compliance/ComplianceSettings.js` |

---

## FOR AI ASSISTANTS

When working on this codebase:

1. **Check this document first** for architecture understanding
2. **Follow existing patterns** - see Common Patterns section
3. **RLS awareness** - all tenant data is company-scoped
4. **API consistency** - follow existing endpoint naming conventions
5. **Frontend state** - use Context API, not local state for shared data
6. **Testing** - consider RLS context when testing queries
7. **Migrations** - new models need RLS policies for tenant tables

### Quick Reference Commands

```bash
# Backend
cd backend && python manage.py runserver
python manage.py makemigrations
python manage.py migrate
python manage.py shell

# Frontend
cd frontend && npm start
npm run build

# Celery
celery -A pesticide_tracker worker --loglevel=info
```

---

*Document Version: 11.4 | Last Updated: January 19, 2026*

*Changes in v11.4:*
- *Added Comprehensive Compliance Management System:*
  - *10 new models: ComplianceProfile, ComplianceDeadline, ComplianceAlert, License, WPSTrainingRecord, CentralPostingLocation, REIPostingRecord, ComplianceReport, IncidentReport, NotificationPreference*
  - *New `compliance_views.py` with 40+ API endpoints for compliance management*
  - *New `compliance_tasks.py` with Celery tasks for automated deadline checking, alert generation, and email reminders*
  - *Migration 0025_compliance_models.py*
- *Frontend Compliance Components (6 new components):*
  - *`ComplianceDashboard.js` - Central compliance hub with score, deadlines, alerts, and quick actions*
  - *`DeadlineCalendar.js` - Calendar and list views for tracking regulatory deadlines*
  - *`LicenseManagement.js` - Track applicator/PCA licenses with expiration alerts*
  - *`WPSCompliance.js` - WPS training records, central posting, REI tracker (3 tabs)*
  - *`ComplianceReports.js` - Auto-generated PUR, SGMA, ILRP, WPS reports*
  - *`ComplianceSettings.js` - Profile configuration and notification preferences*
- *Email Templates for Compliance:*
  - *`compliance_deadline_reminder.html`, `license_expiration_warning.html`, `training_due_reminder.html`, `compliance_digest.html`*
- *Updated `Breadcrumbs.js` with compliance sub-view navigation*
- *Updated `api.js` with comprehensive complianceAPI, licensesAPI, wpsTrainingAPI, postingLocationsAPI, reiPostingsAPI endpoints*
- *Updated model count from 40+ to 50+*
- *Added Celery Beat schedule for compliance automation*

*Changes in v11.3:*
- *Farms Page Redesign - Refactored monolithic `Farms.js` into modular components:*
  - *`FarmCard.js` - Extracted farm card component with mobile-responsive action menus*
  - *`FieldCard.js` - Extracted field card component with mobile-responsive action menus*
  - *`FarmToolbar.js` - Consolidated search, filter, view mode controls, and expand/collapse*
  - *`FarmInsightsPanel.js` - Aggregated insights (total acreage, field coverage, crop distribution)*
  - *`GeocodePreviewModal.js` - Interactive map preview with draggable marker for GPS adjustments*
- *Added GPS Coordinate Update Endpoint:*
  - *New `POST /api/farms/{id}/update-coordinates/` endpoint*
  - *Bypasses full FarmSerializer validation for coordinate-only updates*
  - *Supports the geocode preview modal's "drag to adjust" workflow*
- *QuarantineStatusBadge Improvement:*
  - *Now returns `null` when CDFA API is unavailable (instead of showing "Unknown")*
  - *Graceful degradation when external quarantine service is down*
- *Frontend API service additions:*
  - *Added `farmsAPI.updateCoordinates(id, lat, lng)` method*
  - *Added `farmsAPI.patch(id, data)` method for partial updates*

*Changes in v11.2:*
- *Added Satellite-based Kc Adjustment Service:*
  - *New `satellite_kc_adjuster.py` service with crop-specific maturation curves*
  - *Integrates canopy coverage and NDVI into irrigation ETc calculations*
  - *Formula: `ETc = ETo × Kc_base × canopy_factor × health_modifier`*
  - *Supports 15+ crop types with age-appropriate reference coverage*
  - *NDVI health modifiers: stressed vegetation receives 5-15% more water*
- *Added 5 new IrrigationZone model fields for satellite adjustment config*
- *Added migration 0023_satellite_kc_adjustment.py*
- *Updated IrrigationScheduler to integrate satellite adjustments*
- *Added satellite adjustment details to irrigation recommendation API response*
- *Updated IrrigationZoneCard.js with collapsible satellite data display*

*Changes in v11.1:*
- *Expanded Satellite Imagery & Tree Detection documentation:*
  - *Detailed SatelliteImage, TreeDetectionRun, DetectedTree model fields*
  - *Full API endpoint documentation with request/response examples*
  - *Tree Detection Service algorithm documentation (10-step process)*
  - *DetectionParams dataclass with all configurable parameters*
  - *Frontend component inventory (4 components in imagery/)*
  - *Management commands for tree detection*
  - *Supported imagery types (RGB vs BGRN/NDVI)*

*Changes from v10.0 to v11.0:*
- *Added Weather integration (OpenWeatherMap + CIMIS)*
- *Added Irrigation scheduling system*
- *Added Satellite imagery & tree detection with Celery*
- *Added Crop & Rootstock reference models*
- *Enhanced Field model with satellite data fields*
- *Added Analytics dashboard*
- *Added Quarantine status checking*
- *Added Password reset flow*
- *Added Company management endpoints*
- *Updated model count from 28 to 40+*
- *Added Celery/Redis async task processing*
- *Updated package versions throughout*
- *Added detailed API endpoint reference*
- *Added state management documentation*
- *Added AI assistant guidance section*
