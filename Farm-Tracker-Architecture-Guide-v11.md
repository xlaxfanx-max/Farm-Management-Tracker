# Farm Management Tracker - System Architecture Guide
## Version 14.0 | February 23, 2026

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
| **Tree Detection (Claude Vision)** | Drone/satellite imagery tree detection via Claude Vision API, NDVI health scoring |
| **Disease Prevention** | Proximity-based disease alerts, scouting reports (NEW) |
| **Nutrient Management** | Fertilizer tracking, nitrogen calculations, ILRP reporting |
| **Harvest Operations** | Yield tracking, revenue, labor costs, PHI compliance |
| **Quarantine Compliance** | Plant quarantine status checking with zone management |
| **Analytics Dashboard** | Farm performance metrics and visualizations |
| **Packinghouse Management** | Packinghouses, pools, deliveries, packout tracking, commodity-aware units |
| **Settlement Intelligence** | 5 grower profitability analytics views (ROI, deductions, trends, report card) |
| **Harvest-to-Packing Pipeline** | End-to-end traceability from harvest to packout |
| **PDF Statement Extraction** | AI-powered extraction from packinghouse PDF statements |
| **PrimusGFS Compliance** | 40+ models for GAP/GMP certification (CAC Food Safety Manual V5.0) |
| **FSMA Compliance** | Facility management, PHI checks, water assessments, audit binders |
| **Yield Forecasting** | ML-based yield predictions with soil/climate/tree health features |
| **Compliance Reporting** | PUR exports, SGMA semi-annual reports, Nitrogen/ILRP reports |
| **Audit Logging** | Comprehensive activity tracking for compliance |

### What's New in v14.0

| Feature | Description |
|---------|-------------|
| **CAC Audit Binder System** | Full audit binder lifecycle: CACBinderTemplate, AuditBinderInstance, BinderSection, BinderSupportingDocument models. Two-panel PDF editor with form fields + iframe preview. Auto-fill from model data, manual overrides, field-schema endpoint |
| **CAC PDF Field Mapping** | `cac_pdf_filler.py` discovers AcroForm fields, `cac_data_mapper.py` resolves model data to field names, `cac_field_labels.py` provides human-readable labels. `PDFFieldEditor.js` + `PDFPreviewPanel.js` frontend |
| **HttpOnly Cookie Authentication** | Migrated from JWT header tokens to HttpOnly cookie-based auth. `CookieJWTAuthentication` class in `authentication.py`, nginx proxy for cookie passthrough, `SameSite=Lax` in production |
| **Mission Produce Format** | Multi-block avocado grower statement support. `block_id` field on SettlementGradeLine and SettlementDeduction (migration 0064). ExtractedDataPreview groups by block_id. Extraction prompt max_tokens increased to 8192 |
| **Settlement Financial Validation** | `_validate_settlement_financials()` checks dollar amount consistency. `_reconcile_settlement_from_grade_lines()` checks bin/weight sums. Batch confirm path now includes reconciliation and pool status updates |
| **Batch Statement Upload** | `BatchUploadModal.js` for multi-PDF uploads. Warning pattern: amber modal shows non-blocking validation warnings |
| **NOI Submission Model** | New model for Notice of Intent submissions (migration 0071) |
| **Updated Counts** | 75 migrations, 180+ frontend components, 120+ models, 17 model files, 28 view files, 21 serializer files |

### What's New in v13.0

| Feature | Description |
|---------|-------------|
| **Codebase Modularization** | Split monolithic `models.py` into 16 domain files, `views.py` into 27 domain files, `serializers.py` into 20 domain files — all with re-export hubs for backward compatibility |
| **Tree Detection Overhaul** | Removed 11 old models (SatelliteImage, TreeDetectionRun, LiDAR*, Tree, TreeObservation, etc.), rebuilt with 2 models (TreeSurvey, DetectedTree) using Claude Vision API + NDVI health scoring |
| **PrimusGFS Compliance Module** | 40+ models covering GAP/GMP certification: document control, audits, corrective actions, land history, suppliers, mock recalls, food defense, sanitation, calibration, pest control, pre-harvest |
| **CAC Food Safety Manual V5.0** | 15 new models: FoodSafetyProfile, CommitteeMeeting, TrainingRecord/Session, PerimeterMonitoring, PreSeasonChecklist, FieldRiskAssessment, NonConformance, ProductHolds, SupplierVerification, FoodFraud, EmergencyContacts, ChemicalInventory, SanitationMaintenance |
| **Settlement Intelligence** | 5 new grower profitability analytics views: commodity ROI ranking, deduction creep analysis, grade/size/price trends, packinghouse report card, pack percent impact |
| **Yield Forecasting** | ExternalDataSource, SoilSurveyData, YieldFeatureSnapshot, YieldForecast models with dashboard and season comparison |
| **FSMA Compliance** | Facility management, PHI compliance checks, water risk assessments (source/field/environmental), audit binder generation |
| **Commodity-Aware Units** | Citrus tracks bins, avocados track pounds throughout pipeline |
| **Frontend URL Routing** | Centralized `routes.js` with VIEW_TO_PATH/PATH_TO_VIEW mappings, React Router v6 |
| **Shared View Helpers** | `view_helpers.py` centralizes company access validation (get_user_company, require_company) |
| **Updated Counts** | 68 migrations, 170+ frontend components, 120+ models, 16 model files, 27 view files, 20 serializer files |

### What's New in v12.3

| Feature | Description |
|---------|-------------|
| **Software Evaluation** | Comprehensive codebase evaluation with prioritized improvement roadmap |
| **Season Management** | SeasonTemplate and GrowingCycle models for citrus season tracking (2024-2025 format) |
| **Celery Worker Procfile** | Procfile for deploying Celery background worker as separate Railway service |
| **Bug Fixes** | Password reset token model, settlement deduction unit default, citrus season format fixes |
| **Updated Counts** | 45 migrations, 144 frontend components, 80+ models |

### What's New in v12.2

| Feature | Description |
|---------|-------------|
| **Harvest Analytics Module** | Profitability analysis, deduction breakdown, and season comparison dashboards |
| **PoolSettlement Model** | Detailed settlement tracking with credits, deductions, and net returns |
| **ProfitabilityDashboard Component** | Multi-tab analytics with profitability, deductions, and YoY comparisons |
| **Settlement Structure** | Pick & haul costs included in deductions; Net Settlement = grower's actual return |
| **3 New Analytics Endpoints** | `/harvest-analytics/profitability/`, `/deductions/`, `/seasons/` |
| **SettlementDetail Component** | Detailed view of pool settlement breakdowns |
| **PackinghouseDashboard Component** | Unified packinghouse management dashboard |

### What's New in v12.1

| Feature | Description |
|---------|-------------|
| **Packinghouse Module** | Complete packinghouse management with pools, deliveries, and packout tracking |
| **Harvest-to-Packing Pipeline** | Unified workflow from field harvest to packinghouse settlement |
| **PDF Statement AI Extraction** | Anthropic Claude-powered extraction from packinghouse PDF statements |
| **Harvest Linking** | Link packinghouse deliveries to harvest records for full traceability |
| **Pipeline Overview** | Visual pipeline showing harvest → delivery → packout → settlement flow |
| **7 Packinghouse Models** | Packinghouse, Pool, PackinghouseDelivery, PackoutReport, PackoutGrade, PoolSettlement, PackinghouseStatement |
| **Dark Mode Support** | Application-wide dark mode toggle |
| **PyMuPDF Integration** | PDF-to-image conversion for AI extraction (replacing pdf2image/poppler) |

### What's New in v12.0

| Feature | Description |
|---------|-------------|
| **LiDAR Integration System** | Complete LiDAR point cloud processing with terrain analysis and tree detection |
| **Unified Tree Identity** | Persistent tree tracking across multiple detection sources (satellite, LiDAR) |
| **Disease Prevention Module** | Proximity-based disease alerts, scouting reports, tree health records |
| **Enhanced Compliance** | QuarantineZone model, NotificationLog for audit trails |
| **7 New LiDAR Models** | LiDARDataset, LiDARProcessingRun, LiDARDetectedTree, TerrainAnalysis |
| **5 New Tree Identity Models** | Tree, TreeObservation, TreeMatchingRun, TreeFeedback, ExternalDetection |
| **6 New Disease Models** | DiseaseAlertRule, DiseaseAnalysisRun, DiseaseAlert, ScoutingReport, ScoutingPhoto, TreeHealthRecord |
| **New Celery Tasks** | LiDAR processing tasks, disease analysis tasks |
| **MCP Integration** | AI agent integration support via MCP protocol |
| **Extended Services** | New service modules for compliance, operations, analytics |

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

---

## HIGH-LEVEL ARCHITECTURE

```
+-------------------------------------------------------------------------+
|                         USER'S WEB BROWSER                              |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |              FRONTEND (React 19 + Tailwind CSS 3)                 |  |
|  |              http://localhost:3000                                |  |
|  |              URL-based routing via routes.js                     |  |
|  |                                                                   |  |
|  |  Authentication         Core Modules           Water/Irrigation   |  |
|  |  - Login/Register       - Dashboard            - WaterManagement  |  |
|  |  - AuthContext          - Farms                - IrrigationDash   |  |
|  |  - ForgotPassword       - Fields               - WeatherForecast  |  |
|  |  - ResetPassword        - FarmMap              - WeatherWidget    |  |
|  |  - AcceptInvitation     - Applications         - Wells            |  |
|  |  - TeamManagement       - Reports                                 |  |
|  |                                                Harvest/Nutrient   |  |
|  |  Onboarding             Analytics              - Harvests         |  |
|  |  - OnboardingWizard     - Analytics            - HarvestAnalytics |  |
|  |                         - AuditLogViewer       - NutrientMgmt     |  |
|  |  Modals (25+)           - CompanySettings                         |  |
|  |  - FarmModal            - Profile              Tree Detection (5) |  |
|  |  - FieldModal                                  - TreeDetectionPage|  |
|  |  - ApplicationModal     Compliance (6)         - SurveyUploadForm |  |
|  |  - HarvestModal, etc.   - Dashboard            - SurveyResults   |  |
|  |                         - Deadlines            - TreeMap          |  |
|  |  Disease (5)            - Licenses             - HealthLegend     |  |
|  |  - DiseaseDashboard     - WPSCompliance                           |  |
|  |  - ThreatMap            - Reports              Dashboard (5)      |  |
|  |  - ProximityRiskCard    - Settings             - AlertsBanner     |  |
|  |                                                - TaskList         |  |
|  |  PrimusGFS (29)         FSMA (9+)              Yield Forecast (2) |  |
|  |  - PrimusGFSDashboard   - FSMADashboard        - YieldForecastDash|  |
|  |  - 28 sub-modules       - WaterAssessment      - FieldForecastCard|  |
|  |  (see PrimusGFS section)- AuditBinder                             |  |
|  +-------------------------------------------------------------------+  |
|                              |                                          |
|                    HTTP/REST (axios + HttpOnly cookies)                 |
+-------------------------------------------------------------------------+
                               |
+-------------------------------------------------------------------------+
|                  BACKEND (Django 4.2 + REST Framework)                  |
|                  http://localhost:8000                                  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                    AUTHENTICATION LAYER                           |  |
|  |  HttpOnly Cookie JWT (CookieJWTAuthentication wrapping SimpleJWT) |  |
|  |  Custom User Model - Email-based Auth - SameSite=Lax             |  |
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
|  |  /api/products/         /api/water-           /api/kc-profiles/   |  |
|  |  /api/crops/              allocations/        /api/soil-moisture- |  |
|  |  /api/rootstocks/       /api/extraction-        readings/         |  |
|  |                           reports/                                |  |
|  |  Nutrients              Harvest               Tree Detection      |  |
|  |  /api/fertilizer-       /api/harvests/        /api/tree-surveys/  |  |
|  |    products/            /api/harvest-loads/     (detect, trees,   |  |
|  |  /api/nutrient-         /api/harvest-labor/     geojson, health)  |  |
|  |    applications/        /api/buyers/                               |  |
|  |  /api/nutrient-plans/   /api/labor-           Disease              |  |
|  |                           contractors/        /api/disease/        |  |
|  |                                                 alerts/            |  |
|  |  Weather                Analytics               scouting/          |  |
|  |  /api/weather/          /api/analytics/         dashboard/         |  |
|  |    current/             /api/audit-logs/                           |  |
|  |    forecast/                                  Reports              |  |
|  |    spray-conditions/    Quarantine             /api/reports/        |  |
|  |                         /api/quarantine/        statistics/        |  |
|  |                                                 pur-export/        |  |
|  |  Compliance             PrimusGFS (30+)        nitrogen-summary/  |  |
|  |  /api/compliance/*      /api/primusgfs/*                           |  |
|  |                                                                    |  |
|  |  FSMA                   Yield Forecast         Settlement Intel.  |  |
|  |  /api/fsma/*            /api/yield-forecast/*  /api/packinghouse-  |  |
|  |  /api/fsma/water-*      /api/soil-survey/       analytics/*       |  |
|  +-------------------------------------------------------------------+  |
|                              |                                          |
|  +-------------------------------------------------------------------+  |
|  |                DATABASE (PostgreSQL 18)                           |  |
|  |                Database: farm_tracker                             |  |
|  |                                                                   |  |
|  |  120+ Tables organized by domain (17 model files):                |  |
|  |  - Auth: Company, User, Role, Permission, CompanyMembership       |  |
|  |  - Core: Farm, FarmParcel, Field, Crop, Rootstock, Season*        |  |
|  |  - Pesticide: PesticideProduct, PesticideApplication              |  |
|  |  - Water: WaterSource, WaterTest, WellReading, WaterAllocation    |  |
|  |  - Irrigation: IrrigationZone, IrrigationEvent, CropCoefficient   |  |
|  |  - Harvest: Harvest, HarvestLoad, HarvestLabor, Buyer, Contractor |  |
|  |  - Nutrients: FertilizerProduct, NutrientApplication, NutrientPlan|  |
|  |  - Tree Detection: TreeSurvey, DetectedTree (Claude Vision)       |  |
|  |  - Disease: DiseaseAlertRule, DiseaseAlert, ScoutingReport, etc.  |  |
|  |  - Compliance: ComplianceProfile, License, WPSTrainingRecord, etc.|  |
|  |  - Packinghouse: Packinghouse, Pool, Delivery, Settlement, etc.   |  |
|  |  - PrimusGFS: 40+ models (documents, audits, CAC v5.0, etc.)     |  |
|  |  - Audit Binder: CACBinderTemplate, BinderSection, PDF fields    |  |
|  |  - FSMA: PHICheck, AuditBinder, WaterAssessment, Facility, etc.  |  |
|  |  - Yield: YieldForecast, YieldFeatureSnapshot, SoilSurveyData    |  |
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
|  |  - LiDAR point cloud processing (NEW)                             |  |
|  |  - Disease proximity analysis (NEW)                               |  |
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
|  |  - CDFA Data Sync - Disease detection data (NEW)                  |  |
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
| djangorestframework-simplejwt | 5.3+ | JWT token generation (delivered via HttpOnly cookies) |
| django-cors-headers | 4.3 | CORS for frontend |
| psycopg2-binary | >=2.9.0 | PostgreSQL adapter |
| python-dotenv | 1.0.0 | Environment variable management |
| python-decouple | 3.8 | Additional config management |
| Pillow | >=10.1.0 | Image processing |
| Celery | >=5.3.0 | Async task processing |
| Redis | >=4.5.0 | Message broker & caching |
| rasterio | >=1.3.0 | GeoTIFF imagery processing |
| numpy | >=1.24.0 | Numerical operations |
| shapely | >=2.0.0 | Geometric operations |
| pyproj | >=3.5.0 | Geospatial coordinate transformations |
| gunicorn | >=21.0.0 | Production WSGI server |
| whitenoise | >=6.6.0 | Static file serving |
| dj-database-url | >=2.1.0 | Database URL parsing |
| django-storages | >=1.14.0 | Cloud storage (S3/R2) |
| boto3 | >=1.34.0 | AWS/R2 SDK |
| openpyxl | >=3.1.0 | Excel export |
| python-dateutil | >=2.8.0 | Date utilities |
| mcp | >=1.25.0 | MCP Server for AI Agent Integration |
| anthropic | >=0.18.0 | Claude Vision API for tree detection & PDF extraction |
| PyPDF2 | >=3.0.0 | PDF parsing |
| pdf2image | >=1.16.0 | PDF to image conversion |
| PyMuPDF | >=1.23.0 | PDF to image conversion (fitz library) |

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
| Tailwind CSS | 3.4.17 | Utility-first styling |
| Leaflet | 1.9.4 | Interactive maps |
| react-leaflet | 5.0.0 | React map components |
| @react-leaflet/core | 3.0.0 | React-Leaflet core utilities |
| leaflet-draw | 1.0.4 | Boundary drawing |
| react-leaflet-draw | 0.21.0 | React wrapper for leaflet-draw |
| leaflet.heat | 0.2.0 | Heatmap visualization |
| lucide-react | 0.556.0 | Icons |

---

## PROJECT STRUCTURE

```
Farm-Management-Tracker/
|
+-- Farm-Tracker-Architecture-Guide-v11.md  # This document
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
|   |   +-- celery.py                     # Celery configuration
|   |
|   +-- api/                              # Main Application
|       +-- models/                       # Domain-specific model files (17 files)
|       |   +-- __init__.py               # Re-export hub (all models importable from api.models)
|       |   +-- base.py                   # LocationMixin, helper functions
|       |   +-- auth.py                   # Company, User, Role, Permission, etc.
|       |   +-- farm.py                   # Farm, FarmParcel, Crop, Rootstock, Field, Season*, Pesticide*
|       |   +-- harvest.py               # Buyer, LaborContractor, Harvest, HarvestLoad, HarvestLabor
|       |   +-- water.py                 # WaterSource, WaterTest, WellReading, Irrigation*
|       |   +-- nutrients.py             # FertilizerProduct, NutrientApplication, NutrientPlan
|       |   +-- imagery.py              # QuarantineStatus only
|       |   +-- tree_detection.py        # TreeSurvey, DetectedTree (Claude Vision)
|       |   +-- compliance.py            # ComplianceProfile, License, WPS*, Deadline, Alert, etc.
|       |   +-- disease.py              # ExternalDetection, DiseaseAlert, ScoutingReport, etc.
|       |   +-- packinghouse.py          # Packinghouse, Pool, Delivery, Settlement, Statement, etc.
|       |   +-- facility.py             # UserSignature, FacilityLocation, Cleaning/Visitor/Safety logs
|       |   +-- fsma.py                 # PHIComplianceCheck, AuditBinder, FSMAWaterAssessment, etc.
|       |   +-- primusgfs.py            # 40+ models: documents, audits, CAs, CAC v5.0 modules
|       |   +-- audit_binder.py        # CACBinderTemplate, AuditBinderInstance, BinderSection, BinderSupportingDocument
|       |   +-- yield_forecast.py       # ExternalDataSource, SoilSurveyData, YieldForecast
|       |
|       +-- views.py                      # Re-export hub (imports from all *_views.py files)
|       +-- serializers.py                # Re-export hub (imports from all *_serializers.py files)
|       +-- urls.py                       # API routing
|       +-- authentication.py             # CookieJWTAuthentication (HttpOnly cookie auth)
|       |
|       +-- view_helpers.py              # Shared helpers: get_user_company, require_company
|       |
|       +-- # Domain View Files (28 files):
|       +-- farm_views.py                # Farm, Field, Crop, Rootstock, FarmParcel ViewSets
|       +-- pesticide_views.py           # PesticideProduct, PesticideApplication ViewSets
|       +-- water_views.py               # WaterSource, WaterTest ViewSets
|       +-- harvest_views.py             # Buyer, Contractor, Harvest, HarvestLoad ViewSets
|       +-- sgma_views.py               # Well, WellReading, Allocation, Extraction ViewSets
|       +-- nutrient_views.py            # Fertilizer, NutrientApplication, NutrientPlan ViewSets
|       +-- quarantine_views.py          # Quarantine status checking
|       +-- irrigation_views.py          # IrrigationZone, Recommendation, Kc ViewSets
|       +-- water_data_views.py          # Water data loading
|       +-- tree_detection_views.py      # TreeSurveyViewSet (detect, trees, geojson, health)
|       +-- compliance_views.py          # Compliance management (profile, deadlines, licenses, WPS)
|       +-- disease_views.py             # Disease alerts, scouting, analysis ViewSets
|       +-- packinghouse_views.py        # Packinghouse, Pool, Settlement + Settlement Intelligence analytics
|       +-- fsma_views.py               # Facility, PHI, AuditBinder, FSMA dashboard ViewSets
|       +-- fsma_water_views.py          # FSMA water/source/field/environmental assessments
|       +-- primusgfs_views.py           # 30+ ViewSets for PrimusGFS + CAC v5.0
|       +-- yield_views.py              # YieldForecast, dashboard, season comparison
|       +-- audit_binder_views.py       # CAC Audit Binder: templates, instances, sections, documents
|       +-- analytics_views.py           # Analytics dashboard, season dashboard
|       +-- season_views.py              # SeasonTemplate, GrowingCycle ViewSets
|       +-- report_views.py              # Report statistics
|       +-- auth_views.py               # Authentication endpoints
|       +-- team_views.py               # Team management endpoints
|       +-- onboarding_views.py          # Onboarding endpoints
|       +-- company_views.py             # Company management
|       +-- weather_views.py             # Weather API endpoints
|       +-- audit_views.py              # Audit log endpoints
|       |
|       +-- # Domain Serializer Files (21 files):
|       +-- crop_serializers.py, company_serializers.py, farm_serializers.py
|       +-- pesticide_serializers.py, water_serializers.py, harvest_serializers.py
|       +-- well_serializers.py, nutrient_serializers.py, quarantine_serializers.py
|       +-- irrigation_serializers.py, tree_detection_serializers.py
|       +-- compliance_serializers.py, disease_serializers.py
|       +-- packinghouse_serializers.py, fsma_serializers.py, fsma_water_serializers.py
|       +-- season_serializers.py, yield_serializers.py, primusgfs_serializers.py
|       +-- audit_binder_serializers.py
|       |
|       +-- rls_middleware.py             # RLS context middleware
|       +-- permissions.py                # Permission utilities + CompanyMiddleware
|       +-- audit_utils.py                # Audit logging mixin
|       |
|       +-- services/                     # Business Logic Services
|       |   +-- __init__.py
|       |   +-- cimis_service.py          # California CIMIS weather API
|       |   +-- irrigation_scheduler.py   # Irrigation scheduling logic
|       |   +-- satellite_kc_adjuster.py  # Satellite-based Kc adjustment
|       |   +-- quarantine_service.py     # Plant quarantine status
|       |   +-- yolo_tree_detection.py    # Claude Vision API tree detection
|       |   +-- cdfa_data_sync.py         # CDFA data synchronization
|       |   +-- proximity_calculator.py   # Disease proximity calculations
|       |   +-- season_service.py         # Season management
|       |   +-- pdf_extraction_service.py # AI-powered PDF data extraction
|       |   +-- statement_matcher.py      # Statement matching logic
|       |   +-- packinghouse_lookup.py    # Packinghouse auto-detection
|       |   +-- yield_forecast_service.py # Yield prediction service
|       |   +-- yield_feature_engine.py   # Feature engineering for yield models
|       |   +-- climate_features.py       # Climate data features
|       |   +-- alternate_bearing.py      # Alternate bearing calculations
|       |   +-- soil_survey_service.py    # Soil survey data
|       |   |
|       |   +-- compliance/               # Compliance services
|       |   |   +-- pesticide_compliance.py, water_compliance.py
|       |   +-- operations/               # Operations planning
|       |   |   +-- harvest_planning.py, spray_planning.py
|       |   +-- analytics/                # Analytics computation
|       |   +-- reporting/                # Reporting utilities
|       |   +-- fsma/                     # FSMA services
|       |       +-- phi_compliance.py, audit_binder_generator.py
|       |       +-- cleaning_scheduler.py, water_risk_calculator.py
|       |       +-- water_assessment_pdf_generator.py
|       |
|       +-- tasks/                        # Celery Tasks
|       |   +-- __init__.py
|       |   +-- tree_detection_tasks.py   # Async Claude Vision tree detection
|       |   +-- disease_tasks.py          # Disease proximity analysis
|       |   +-- compliance_tasks.py       # Compliance deadline/alert tasks
|       |   +-- fsma_tasks.py             # FSMA scheduling tasks
|       |
|       +-- pur_reporting.py              # PUR report generator
|       +-- product_import_tool.py        # EPA product importer
|       +-- weather_service.py            # Weather API client
|       +-- email_service.py              # Email configuration
|       |
|       +-- migrations/                   # 75 migration files (0001-0075)
|       |
|       +-- templates/                    # Email templates
|           +-- emails/
|               +-- compliance_deadline_reminder.html
|               +-- license_expiration_warning.html
|               +-- training_due_reminder.html
|               +-- compliance_digest.html
|               +-- base.html, invitation.html, password_*.html, welcome.html
|
+-- frontend/                             # React Frontend
    +-- src/
    |   +-- routes.js                     # Centralized VIEW_TO_PATH/PATH_TO_VIEW mappings
    |   |
    |   +-- components/                   # 180+ UI components
    |   |   +-- Dashboard.js
    |   |   +-- Farms.js                  # Uses FarmCard, FarmToolbar
    |   |   +-- FarmCard.js, FieldCard.js, FarmToolbar.js, FarmInsightsPanel.js
    |   |   +-- GeocodePreviewModal.js
    |   |   +-- Fields.js, FarmMap.js
    |   |   +-- Analytics.js, AnalyticsWidget.js
    |   |   +-- Reports.js, PURReports.js
    |   |   +-- Harvests.js               # Unified Harvest & Packing module
    |   |   +-- HarvestAnalytics.js, ProfitabilityDashboard.js
    |   |   +-- NutrientManagement.js
    |   |   +-- WaterManagement.js, Wells.js
    |   |   +-- IrrigationDashboard.js, IrrigationZoneCard.js
    |   |   +-- WeatherForecast.js, WeatherWidget.js
    |   |   +-- TeamManagement.js, AuditLogViewer.js
    |   |   +-- CompanySettings.js, Profile.js
    |   |   +-- Login.js, ForgotPassword.js, ResetPassword.js, AcceptInvitation.js
    |   |   +-- OnboardingWizard.js, GlobalModals.js
    |   |   +-- ProductManagement.js
    |   |   +-- QuarantineStatusBadge.js, QuarantineLayer.js, FarmParcelManager.js
    |   |   +-- *Modal.js (25+ modal components)
    |   |   |
    |   |   +-- tree-detection/           # Tree detection (5 components)
    |   |   |   +-- index.js
    |   |   |   +-- TreeDetectionPage.js      # Main page for tree surveys
    |   |   |   +-- SurveyUploadForm.js       # Upload drone/satellite imagery
    |   |   |   +-- SurveyResultsPanel.js     # Display detected trees
    |   |   |   +-- TreeMap.js                # Interactive map visualization
    |   |   |   +-- HealthLegend.js           # NDVI health status legend
    |   |   |
    |   |   +-- compliance/               # Compliance management (6)
    |   |   |   +-- ComplianceDashboard.js    # Main compliance hub
    |   |   |   +-- DeadlineCalendar.js, LicenseManagement.js
    |   |   |   +-- WPSCompliance.js, ComplianceReports.js, ComplianceSettings.js
    |   |   |
    |   |   +-- primusgfs/                # PrimusGFS compliance (36+ components)
    |   |   |   +-- PrimusGFSDashboard.js     # Main dashboard with tab navigation
    |   |   |   +-- DocumentControlList.js, InternalAuditList.js
    |   |   |   +-- CorrectiveActionTracker.js, LandHistoryForm.js
    |   |   |   +-- SupplierManagement.js, MockRecallExercise.js
    |   |   |   +-- FoodDefensePlan.js, FieldSanitationTracker.js
    |   |   |   +-- EquipmentCalibration.js, PestControlProgram.js
    |   |   |   +-- PreHarvestInspection.js
    |   |   |   +-- PrefillBanner.js              # Auto-fill notification (NEW)
    |   |   |   +-- SeasonCopyModal.js             # Copy season data (NEW)
    |   |   |   +-- WhatsNextDashboard.js          # Next steps guidance (NEW)
    |   |   |   +-- CACManualViewer.js             # CAC manual reference (NEW)
    |   |   |   +-- CACSignaturePage.js            # Signature capture (NEW)
    |   |   |   +-- # CAC Food Safety Manual V5.0:
    |   |   |   +-- FoodSafetyProfile.js, OrgRoles.js, CommitteeMeetings.js
    |   |   |   +-- ManagementReview.js, TrainingMatrix.js, TrainingSessions.js
    |   |   |   +-- PerimeterMonitoring.js, PreSeasonChecklist.js
    |   |   |   +-- FieldRiskAssessment.js, NonConformanceLog.js
    |   |   |   +-- ProductHolds.js, SupplierVerification.js
    |   |   |   +-- FoodFraudAssessment.js, EmergencyContacts.js
    |   |   |   +-- ChemicalInventory.js, SanitationMaintenance.js
    |   |   |   +-- # CAC Audit Binder (NEW):
    |   |   |   +-- audit-binder/
    |   |   |       +-- AuditBinderDashboard.js    # Binder management dashboard
    |   |   |       +-- BinderOverview.js           # Binder instance overview
    |   |   |       +-- CreateBinderModal.js        # Create new binder instance
    |   |   |       +-- SectionDetail.js            # Section detail with PDF field tab
    |   |   |       +-- PDFFieldEditor.js           # HTML form fields for PDF AcroForm
    |   |   |       +-- PDFPreviewPanel.js          # iframe PDF preview panel
    |   |   |       +-- AutoFillPreview.js          # Auto-fill preview before apply
    |   |   |
    |   |   +-- packinghouse/             # Packinghouse management (16)
    |   |   |   +-- index.js
    |   |   |   +-- PackinghouseDashboard.js  # Unified packinghouse dashboard
    |   |   |   +-- PackinghouseList.js, PackinghouseModal.js
    |   |   |   +-- PackinghouseAnalytics.js  # Settlement Intelligence analytics (NEW)
    |   |   |   +-- PoolList.js, PoolModal.js, PoolDetail.js
    |   |   |   +-- DeliveryModal.js, PackoutReportModal.js
    |   |   |   +-- PDFUploadModal.js, ExtractedDataPreview.js
    |   |   |   +-- BatchUploadModal.js       # Multi-PDF batch upload with warnings (NEW)
    |   |   |   +-- StatementList.js          # Statement management list (NEW)
    |   |   |   +-- SettlementDetail.js, PipelineOverview.js
    |   |   |
    |   |   +-- disease/                  # Disease prevention (5)
    |   |   |   +-- index.js
    |   |   |   +-- DiseaseDashboard.js, DiseaseAlertsList.js
    |   |   |   +-- ProximityRiskCard.js, ThreatMap.js
    |   |   |
    |   |   +-- fsma/                     # FSMA compliance (9+)
    |   |   |   +-- FSMADashboard.js
    |   |   |   +-- SignatureCapture.js, VisitorLogList.js, CleaningLogList.js
    |   |   |   +-- SafetyMeetingList.js, FertilizerInventoryManager.js
    |   |   |   +-- PHIComplianceChecker.js, AuditBinderGenerator.js
    |   |   |   +-- water-assessment/     # FSMA Water Assessment sub-module
    |   |   |       +-- WaterAssessmentDashboard.js, WaterAssessmentWizard.js
    |   |   |
    |   |   +-- yield-forecast/           # Yield forecasting (2)
    |   |   |   +-- YieldForecastDashboard.js, FieldForecastCard.js
    |   |   |
    |   |   +-- dashboard/                # Dashboard components (5)
    |   |   |   +-- FarmStatusStrip.js, ModuleStatusCard.js
    |   |   |   +-- OperationalAlertsBanner.js, QuickActionsGrid.js
    |   |   |   +-- UnifiedTaskList.js
    |   |   |
    |   |   +-- navigation/               # Navigation components
    |   |   |   +-- Breadcrumbs.js
    |   |   |
    |   |   +-- ui/                       # Reusable UI components
    |   |       +-- MetricCard.js, StatusBadge.js
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

### Model Count: 120+ Models (17 domain files)

Organized by domain:

### Authentication & Multi-Tenancy (7 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Company` | Tenant organization | name, county, operator_id, subscription_tier, onboarding_*, pca_license, qal_license |
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
| `WellReading` | Meter readings | water_source, reading_date, meter_reading, extraction_acre_feet |
| `WaterAllocation` | SGMA allocations | water_source, water_year, allocated_acre_feet |
| `MeterCalibration` | Calibration records | water_source, calibration_date, performed_by |
| `ExtractionReport` | Groundwater extraction | water_source, report_period, total_extraction_af |

### Irrigation Management (6 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `IrrigationZone` | Management zones | farm, name, fields (M2M), water_source, satellite_kc_config |
| `IrrigationEvent` | Irrigation applications | field, date, duration_hours, water_applied_af |
| `CropCoefficientProfile` | Kc values by growth stage | crop, growth_stage, kc_value |
| `CIMISDataCache` | Weather/ETo cache | station_id, date, eto, temperature |
| `IrrigationRecommendation` | Scheduling recs | zone, date, recommended_hours, based_on_eto |
| `SoilMoistureReading` | Soil monitoring | field, date, depth_inches, moisture_percent |

### Harvest Operations (5 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Harvest` | Harvest events | field, harvest_date, total_bins, price_per_bin, harvest_number, lot_number |
| `HarvestLoad` | Load tracking | harvest, load_number, bins, weight_lbs, buyer |
| `HarvestLabor` | Labor records | harvest, contractor, workers, hours, cost |
| `Buyer` | Buyer companies | name, contact_*, payment_terms |
| `LaborContractor` | Contractors | name, license_number, contact_* |

### Packinghouse Management (12 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Packinghouse` | Packinghouse facilities | company, name, short_code, address, contact_info, is_active |
| `Pool` | Grower pools | packinghouse, pool_number, pool_name, crop_variety, season, status (open/closed/settled) |
| `PackinghouseDelivery` | Fruit deliveries | pool, field, harvest (FK), delivery_date, ticket_number, bins, weight_lbs |
| `PackoutReport` | Packout summaries | pool, packout_date, total_bins_packed, cull_percent |
| `PackoutGradeLine` | Grade breakdown | packout_report, grade_name, size, cartons, weight_lbs, price_per_carton |
| `PoolSettlement` | Settlement records | pool, field, statement_date, total_bins, total_credits, total_deductions, net_return, net_per_bin |
| `SettlementGradeLine` | Settlement grade detail | settlement, grade_name, size, cartons, weight_lbs, price, block_id |
| `SettlementDeduction` | Settlement deduction items | settlement, description, amount, unit_of_measure, block_id |
| `GrowerLedgerEntry` | Grower financial ledger | company, pool, entry_type, amount, description |
| `PackinghouseStatement` | PDF statements | packinghouse, pool, original_filename, pdf_file, status, extracted_data (JSON), statement_type, statement_format (vpoa/sla/mission/generic) |
| `PackinghouseGrowerMapping` | Grower-to-packinghouse mapping | company, packinghouse, grower_id_at_packinghouse |
| `StatementBatchUpload` | Batch PDF upload tracking | company, packinghouse, uploaded_by, file_count, status |

**Settlement Structure Note:** Pick & haul costs are included as line items in settlement deductions. Therefore, `net_return` represents the grower's actual return after all packinghouse-related costs. Citrus tracks bins; avocados track pounds.

**Supported Statement Formats:** vpoa, sla, mission, generic. Mission Produce added for multi-block avocado grower statements. `block_id` field enables per-block grade line and deduction tracking.

**Settlement Reconciliation:** `_reconcile_settlement_from_grade_lines()` validates bin/weight sums. `_validate_settlement_financials()` checks dollar amount consistency. `_auto_update_pool_status()` promotes pool to 'settled' when settled >= packed. All three run on single confirm, update, and batch confirm paths.

### Nutrient Management (3 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `FertilizerProduct` | Nutrient products | name, n_percent, p_percent, k_percent, company |
| `NutrientApplication` | Fertilizer applications | field, product, application_date, amount, method |
| `NutrientPlan` | Nutrient plans | field, year, target_n_lbs_per_acre |

### Tree Detection (2 models) - Claude Vision API

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `TreeSurvey` | Drone/satellite imagery survey | company, farm, field, image (FileField), capture_date, status (pending/processing/completed/failed), tree_count, avg_ndvi, processing_metadata (JSON) |
| `DetectedTree` | Individual detected trees | survey (FK), latitude, longitude, canopy_diameter_m, ndvi_value, health_status (healthy/moderate/stressed/critical/unknown), confidence_score |

**Health Categories**: healthy (NDVI>0.6), moderate (0.4-0.6), stressed (0.2-0.4), critical (≤0.2), unknown (no NIR)

**Note**: This replaced the old 11-model system (SatelliteImage, TreeDetectionRun, DetectedTree, LiDARDataset, LiDARProcessingRun, LiDARDetectedTree, TerrainAnalysis, Tree, TreeObservation, TreeMatchingRun, TreeFeedback) in migrations 0064-0067.

### Disease Prevention (7 models) - NEW

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `ExternalDetection` | External disease data | disease_name, detection_date, latitude, longitude, source (CDFA/USDA/manual), severity, host_species |
| `QuarantineZone` | Quarantine boundaries | name, disease_name, boundary_geojson, effective_date, status (active/lifted) |
| `DiseaseAlertRule` | Alert configuration | company, disease_name, proximity_threshold_miles, alert_priority, is_active |
| `DiseaseAnalysisRun` | Analysis job tracking | company, status, external_detections_checked, alerts_generated |
| `DiseaseAlert` | Generated alerts | company, farm, disease_name, priority, distance_miles, nearest_detection (FK), status (active/acknowledged/resolved) |
| `ScoutingReport` | Field observations | company, field, scout_date, reported_by, findings, pest_observations (JSON), disease_observations (JSON) |
| `ScoutingPhoto` | Scouting images | scouting_report (FK), photo, caption, latitude, longitude |
| `TreeHealthRecord` | Tree health tracking | tree (FK), observation_date, health_status, symptoms (JSON), treatment_applied |

### Compliance Management (12 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `ComplianceProfile` | Company compliance config | company (OneToOne), primary_state, additional_states (JSON), requires_pur_reporting, requires_wps_compliance, requires_fsma_compliance, organic_certified, buyer_requirements (JSON) |
| `ComplianceDeadline` | Regulatory deadlines | company, name, description, category, due_date, frequency, warning_days, status, auto_generated, related_farm |
| `ComplianceAlert` | Proactive notifications | company, alert_type, priority, title, message, related_deadline (FK), is_active, is_acknowledged, action_url |
| `License` | Applicator/PCA licenses | company, user (optional), license_type, license_number, issuing_authority, issue_date, expiration_date, status, categories (JSON), document (FileField) |
| `WPSTrainingRecord` | Worker training records | company, trainee_name, trainee_user (FK), training_type, training_date, expiration_date, trainer_name, verified, certificate_document |
| `CentralPostingLocation` | WPS posting locations | company, farm, location_name, has_wps_poster, has_emergency_info, has_sds_available, last_verified_date |
| `REIPostingRecord` | REI posting tracking | application (OneToOne), posted_at, posted_by, rei_end_datetime, removed_at, posting_compliant |
| `ComplianceReport` | Generated reports | company, report_type, reporting_period_start, reporting_period_end, status, report_data (JSON), report_file, validation_errors (JSON), submitted_at |
| `IncidentReport` | Safety incidents | company, incident_type, severity, incident_date, farm, field, reported_by, affected_persons (JSON), description, status, corrective_actions |
| `NotificationPreference` | User notification settings | user (OneToOne), email_enabled, email_digest, notify_deadlines, notify_licenses, notify_training, deadline_reminder_days (JSON) |
| `NotificationLog` | Notification audit trail (NEW) | user, notification_type, sent_at, delivered, related_object_type, related_object_id |

### Facility & Safety (9 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `UserSignature` | Digital signatures | user, company, signature_data, created_at |
| `FacilityLocation` | Facility locations | company, farm, name, facility_type, location_description |
| `FacilityCleaningLog` | Cleaning records | facility, cleaned_by, cleaning_date, frequency, notes |
| `VisitorLog` | Visitor tracking | company, farm, visitor_name, visitor_type, check_in, check_out |
| `SafetyMeeting` | Safety meetings | company, meeting_type, meeting_date, location, topics |
| `SafetyMeetingAttendee` | Meeting attendees | meeting (FK), attendee_name, signature |
| `FertilizerInventory` | Fertilizer stock | company, product, current_quantity, unit |
| `FertilizerInventoryTransaction` | Stock movements | inventory (FK), transaction_type, quantity, date |
| `MonthlyInventorySnapshot` | Monthly snapshots | inventory (FK), month, year, opening_qty, closing_qty |

### FSMA Compliance (5 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `PHIComplianceCheck` | Pre-harvest interval checks | company, field, product, application_date, harvest_date, phi_days, is_compliant |
| `AuditBinder` | Audit documentation | company, farm, season, status, generated_at, binder_file |
| `FSMAWaterAssessment` | Water risk assessment | company, farm, assessment_date, status, overall_risk_score |
| `FSMASourceAssessment` | Water source assessment | water_assessment (FK), water_source, risk_factors (JSON) |
| `FSMAFieldAssessment` | Field assessment | water_assessment (FK), field, irrigation_method, risk_score |
| `FSMAEnvironmentalAssessment` | Environmental assessment | water_assessment (FK), assessment_type, findings (JSON) |
| `FSMAMitigationAction` | Risk mitigation | water_assessment (FK), action_description, responsible_party, due_date, status |

### PrimusGFS Compliance (40+ models)

**Phase 1 — Document Control & Auditing:**
`ControlledDocument`, `DocumentRevisionHistory`, `InternalAudit`, `AuditFinding`, `CorrectiveAction`, `LandHistoryAssessment`

**Phase 2 — Suppliers & Food Safety:**
`ApprovedSupplier`, `IncomingMaterialVerification`, `MockRecall`, `FoodDefensePlan`, `FieldSanitationLog`

**Phase 3 — Equipment & Operations:**
`EquipmentCalibration`, `PestControlProgram`, `PestMonitoringLog`, `PreHarvestInspection`

**CAC Food Safety Manual V5.0 — 15 new models (migration 0068):**

| Model | Purpose |
|-------|---------|
| `FoodSafetyProfile` | Company-level food safety coordinator and policy info |
| `FoodSafetyRoleAssignment` | Organizational role assignments |
| `FoodSafetyCommitteeMeeting` | Quarterly committee meetings with attendees |
| `ManagementVerificationReview` | Annual management review of FSM system |
| `TrainingRecord` | Employee training matrix (PSA, animal intrusion, food safety, crop protection, etc.) |
| `WorkerTrainingSession` | Training sessions with attendee tracking |
| `PerimeterMonitoringLog` | Weekly perimeter security checks, animal activity, water source integrity |
| `PreSeasonChecklist` | Land history, water, fertilizer, records checklist |
| `FieldRiskAssessment` | Comprehensive field risk assessment (land use, water, inputs, hygiene) |
| `EmployeeNonConformance` | Employee hygiene/procedure violation tracking |
| `ProductHoldRelease` | Product quarantine/hold tracking with investigation notes |
| `SupplierVerificationLog` | Supplier verification audits with checklist items |
| `FoodFraudAssessment` | Food fraud vulnerability assessment (annual) |
| `EmergencyContact` | Emergency contact directory (fire, police, hospital, county ag, etc.) |
| `ChemicalInventoryLog` | Chemical inventory counts (monthly) |
| `SanitationMaintenanceLog` | Toilet/handwash facility maintenance logs |

**CorrectiveAction enhancements:** Added `is_nuoca`, `nuoca_category` (11 categories), `occurrence_time`, `reported_by_name`, `source_type='nuoca'`

### CAC Audit Binder (4 models) - NEW

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `CACBinderTemplate` | Versioned CAC Food Safety Manual PDF template | company, version, name, pdf_file, section_definitions (JSON), is_active |
| `AuditBinderInstance` | Specific audit binder being prepared | company, template (FK), name, season_year, farm (FK), status (draft/in_progress/ready/submitted), generated_pdf, created_by |
| `BinderSection` | One of 39 documents within a binder instance | binder (FK), doc_number (1-39), title, section_group, doc_type, status (not_started/in_progress/complete/not_applicable), sop_content, auto_fill_source, auto_fill_data (JSON), manual_overrides (JSON), pdf_field_data (JSON), completed_by, completed_at |
| `BinderSupportingDocument` | Supporting docs attached to sections | section (FK), file, file_name, description, uploaded_by |

**Section Groups**: management, field_sanitation, agricultural_inputs, worker_health, training, audit_checklists, risk_assessment

**Doc Types**: auto_fill (from system data), partial_fill, sop (Standard Operating Procedure), blank_template (on-site use), reference (static)

**PDF Field Data**: `BinderSection.pdf_field_data` stores field values keyed by AcroForm field names (e.g. `{'1-a-100': 'Sunrise Ranch'}`). The two-panel PDF editor allows left-side HTML form editing with right-side iframe PDF preview.

**Default 39 section definitions** stored as `CAC_V5_SECTION_DEFINITIONS` constant, covering 7 sections from Ranch Information through Field Risk Assessment.

### Yield Forecasting (4 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `ExternalDataSource` | External data connections | company, source_type, name, api_url, credentials (JSON) |
| `SoilSurveyData` | Soil characteristics | field, survey_date, soil_type, ph, organic_matter, drainage |
| `YieldFeatureSnapshot` | ML feature snapshots | field, season, tree_count, avg_ndvi, climate_features (JSON), soil_features (JSON) |
| `YieldForecast` | Yield predictions | field, season, predicted_yield, confidence_interval, actual_yield, model_version |

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
| `/api/auth/accept-invitation-existing/` | POST | Accept for existing user |
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
| `/api/farms/{id}/update-coordinates/` | POST | Update only GPS coordinates |
| `/api/farms/{id}/fields/` | GET | Get all fields for a farm |
| `/api/farms/{id}/bulk-parcels/` | POST | Bulk add parcels to farm |

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

### Irrigation

| Resource | Endpoint | Notes |
|----------|----------|-------|
| Irrigation Zones | `/api/irrigation-zones/` | Management zones |
| Irrigation Events | `/api/irrigation-events/` | Irrigation records |
| Recommendations | `/api/irrigation-recommendations/` | Scheduling recs |
| Kc Profiles | `/api/kc-profiles/` | Crop coefficients |
| Soil Moisture | `/api/soil-moisture-readings/` | Soil monitoring |
| Dashboard | `/api/irrigation/dashboard/` | Summary view |
| CIMIS Stations | `/api/irrigation/cimis-stations/` | Weather stations |

### Harvest & Labor

| Resource | Endpoint | Notes |
|----------|----------|-------|
| Harvests | `/api/harvests/` | Harvest events |
| Harvest Loads | `/api/harvest-loads/` | Load tracking |
| Harvest Labor | `/api/harvest-labor/` | Labor records |
| Buyers | `/api/buyers/` | Buyer companies |
| Labor Contractors | `/api/labor-contractors/` | Contractors |

### Packinghouse Management (NEW)

| Resource | Endpoint | Notes |
|----------|----------|-------|
| Packinghouses | `/api/packinghouses/` | Packinghouse CRUD |
| Pools | `/api/pools/` | Pool management |
| Pools by Packinghouse | `/api/pools/?packinghouse=<id>` | Filter by packinghouse |
| Pool Summary | `/api/pools/<id>/summary/` | Deliveries, packout stats |
| Deliveries | `/api/packinghouse-deliveries/` | Delivery records |
| Packout Reports | `/api/packout-reports/` | Packout summaries |
| Packout Grades | `/api/packout-grades/` | Grade breakdown |
| Statements | `/api/packinghouse-statements/` | PDF statement upload |
| Extract Statement | `/api/packinghouse-statements/<id>/extract/` | Trigger AI extraction |
| Confirm Statement | `/api/packinghouse-statements/<id>/confirm/` | Confirm extracted data (single) |
| Batch Confirm | `/api/packinghouse-statements/batch_confirm/` | Confirm multiple statements at once |
| Pipeline Overview | `/api/harvest-packing/pipeline/` | Harvest-to-packing pipeline stats |

### Harvest Analytics

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/harvest-analytics/profitability/` | GET | Profitability analysis by field/pool with margins |
| `/api/harvest-analytics/deductions/` | GET | Deduction breakdown by category |
| `/api/harvest-analytics/seasons/` | GET | Year-over-year season comparison |

**Query Parameters (all endpoints):**
- `season`: Filter by season (e.g., "2024-2025")
- `packinghouse`: Filter by packinghouse ID
- `field_id`: Filter by specific field

### Nutrients

| Resource | Endpoint | Notes |
|----------|----------|-------|
| Fertilizer Products | `/api/fertilizer-products/` | Product database |
| Nutrient Applications | `/api/nutrient-applications/` | Applications |
| Nutrient Plans | `/api/nutrient-plans/` | Annual plans |
| Nitrogen Summary | `/api/reports/nitrogen-summary/` | N calculations |
| Nitrogen Export | `/api/reports/nitrogen-export/` | ILRP export |

### Weather

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/weather/current/<farm_id>/` | GET | Current weather |
| `/api/weather/forecast/<farm_id>/` | GET | Weather forecast |
| `/api/weather/spray-conditions/<farm_id>/` | GET | Spray recommendations |
| `/api/weather/thresholds/` | GET | Spray thresholds |
| `/api/weather/farms/` | GET | All farms weather |

### Tree Detection (Claude Vision API)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tree-surveys/` | GET/POST | List/upload survey imagery |
| `/api/tree-surveys/<id>/` | GET/DELETE | Survey details/delete |
| `/api/tree-surveys/<id>/detect/` | POST | Trigger Claude Vision tree detection (async) |
| `/api/tree-surveys/<id>/trees/` | GET | Detected trees for survey |
| `/api/tree-surveys/<id>/trees/geojson/` | GET | Export trees as GeoJSON |
| `/api/tree-surveys/<id>/health-summary/` | GET | Health category summary |

### Disease Prevention

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/disease/external-detections/` | GET | List external detections |
| `/api/disease/alerts/` | GET | List disease alerts |
| `/api/disease/alerts/<id>/` | GET/PATCH | Alert details/acknowledge |
| `/api/disease/alert-rules/` | GET/POST | List/create alert rules |
| `/api/disease/alert-rules/<id>/` | GET/PUT/DELETE | Rule CRUD |
| `/api/disease/analyses/` | GET/POST | List/trigger analysis |
| `/api/disease/analyses/<id>/` | GET | Analysis run details |
| `/api/disease/scouting/` | GET/POST | List/create scouting reports |
| `/api/disease/scouting/<id>/` | GET/PUT/DELETE | Scouting report CRUD |
| `/api/disease/scouting/<id>/photos/` | POST | Upload scouting photos |
| `/api/disease/dashboard/` | GET | Disease dashboard summary |

### Analytics & Audit

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/analytics/dashboard/` | GET | Analytics dashboard |
| `/api/analytics/summary/` | GET | Summary metrics |
| `/api/audit-logs/` | GET | Audit log list |
| `/api/audit-logs/<id>/` | GET | Audit log detail |
| `/api/audit-logs/filters/` | GET | Available filters |
| `/api/audit-logs/export/` | GET | Export audit logs |
| `/api/audit-logs/statistics/` | GET | Audit statistics |

### Quarantine

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/quarantine/check/` | GET | Check quarantine status |
| `/api/quarantine/boundaries/` | GET | Quarantine boundaries |

### Compliance Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/compliance/profile/` | GET/PUT | Company compliance profile |
| `/api/compliance/dashboard/` | GET | Compliance dashboard summary |
| `/api/compliance/deadlines/` | GET/POST | List/create deadlines |
| `/api/compliance/deadlines/<id>/` | GET/PUT/DELETE | Deadline CRUD |
| `/api/compliance/deadlines/<id>/complete/` | POST | Mark deadline complete |
| `/api/compliance/deadlines/generate/` | POST | Generate recurring deadlines |
| `/api/compliance/alerts/` | GET | List active alerts |
| `/api/compliance/alerts/<id>/acknowledge/` | POST | Acknowledge alert |
| `/api/compliance/licenses/` | GET/POST | List/create licenses |
| `/api/compliance/licenses/<id>/` | GET/PUT/DELETE | License CRUD |
| `/api/compliance/licenses/expiring/` | GET | Expiring licenses |
| `/api/compliance/wps-training/` | GET/POST | WPS training records |
| `/api/compliance/wps-training/<id>/` | GET/PUT/DELETE | Training record CRUD |
| `/api/compliance/wps-training/expiring/` | GET | Expiring training |
| `/api/compliance/posting-locations/` | GET/POST | Central posting locations |
| `/api/compliance/posting-locations/<id>/verify/` | PUT | Verify posting compliance |
| `/api/compliance/rei-postings/` | GET | REI posting records |
| `/api/compliance/rei-postings/active/` | GET | Active REI postings |
| `/api/compliance/reports/` | GET/POST | List/create reports |
| `/api/compliance/reports/generate/` | POST | Auto-generate report |
| `/api/compliance/reports/<id>/validate/` | POST | Validate report |
| `/api/compliance/reports/<id>/submit/` | POST | Submit report |
| `/api/compliance/incidents/` | GET/POST | List/create incidents |
| `/api/compliance/incidents/<id>/resolve/` | POST | Resolve incident |
| `/api/compliance/notification-preferences/` | GET/PUT | User notification settings |

### PrimusGFS Compliance

| Resource | Endpoint | Notes |
|----------|----------|-------|
| Dashboard | `/api/primusgfs/dashboard/` | Compliance overview |
| Documents | `/api/primusgfs/documents/` | Controlled documents CRUD |
| Audits | `/api/primusgfs/audits/` | Internal audits CRUD |
| Findings | `/api/primusgfs/findings/` | Audit findings CRUD |
| Corrective Actions | `/api/primusgfs/corrective-actions/` | CAs with NUOCA support |
| Land History | `/api/primusgfs/land-assessments/` | Land use history assessments |
| Suppliers | `/api/primusgfs/suppliers/` | Approved supplier management |
| Material Verification | `/api/primusgfs/material-verifications/` | Incoming material checks |
| Mock Recalls | `/api/primusgfs/mock-recalls/` | Mock recall exercises |
| Food Defense | `/api/primusgfs/food-defense-plans/` | Food defense plans |
| Sanitation | `/api/primusgfs/sanitation-logs/` | Field sanitation logs |
| Calibration | `/api/primusgfs/calibrations/` | Equipment calibration records |
| Pest Control | `/api/primusgfs/pest-programs/` | Pest control programs |
| Pest Monitoring | `/api/primusgfs/pest-monitoring/` | Pest monitoring logs |
| Pre-Harvest | `/api/primusgfs/pre-harvest/` | Pre-harvest inspections |
| **CAC v5.0 endpoints:** | | |
| Food Safety Profile | `/api/primusgfs/food-safety-profile/` | Company food safety config |
| Org Roles | `/api/primusgfs/org-roles/` | Role assignments |
| Committee Meetings | `/api/primusgfs/committee-meetings/` | Quarterly meetings |
| Management Review | `/api/primusgfs/management-reviews/` | Annual reviews |
| Training Matrix | `/api/primusgfs/training-records/` | Employee training records |
| Training Sessions | `/api/primusgfs/training-sessions/` | Training session logs |
| Perimeter Monitoring | `/api/primusgfs/perimeter-monitoring/` | Weekly perimeter checks |
| Pre-Season Checklist | `/api/primusgfs/pre-season-checklists/` | Pre-season checklists |
| Field Risk Assessment | `/api/primusgfs/field-risk-assessments/` | Field risk evaluations |
| Non-Conformances | `/api/primusgfs/non-conformances/` | Employee violations |
| Product Holds | `/api/primusgfs/product-holds/` | Product hold/release |
| Supplier Verification | `/api/primusgfs/supplier-verifications/` | Supplier audits |
| Food Fraud | `/api/primusgfs/food-fraud-assessments/` | Fraud vulnerability |
| Emergency Contacts | `/api/primusgfs/emergency-contacts/` | Emergency directory |
| Chemical Inventory | `/api/primusgfs/chemical-inventory/` | Chemical counts |
| Sanitation Maintenance | `/api/primusgfs/sanitation-maintenance/` | Facility maintenance |
| **CAC Audit Binder endpoints:** | | |
| CAC Templates | `/api/primusgfs/cac-templates/` | Binder template CRUD |
| Audit Binders | `/api/primusgfs/audit-binders/` | Binder instance CRUD |
| Binder Sections | `/api/primusgfs/binder-sections/` | Section management |
| Section Field Schema | `/api/primusgfs/binder-sections/<id>/field-schema/` | PDF field schema with values/sources |
| Save PDF Fields | `/api/primusgfs/binder-sections/<id>/save_pdf_fields/` | Save user-edited PDF field values |
| Reset PDF Fields | `/api/primusgfs/binder-sections/<id>/reset_pdf_fields/` | Reset to auto-fill defaults |
| Apply Auto-Fill | `/api/primusgfs/binder-sections/<id>/apply_auto_fill/` | Bridge auto-fill to pdf_field_data |
| Binder Documents | `/api/primusgfs/binder-documents/` | Supporting document uploads |

### FSMA Compliance

| Resource | Endpoint | Notes |
|----------|----------|-------|
| Dashboard | `/api/fsma/dashboard/` | FSMA compliance overview |
| Signatures | `/api/fsma/signatures/` | Digital signatures |
| Facilities | `/api/fsma/facilities/` | Facility locations |
| Cleaning Logs | `/api/fsma/cleaning-logs/` | Facility cleaning records |
| Visitor Logs | `/api/fsma/visitor-logs/` | Visitor tracking |
| Safety Meetings | `/api/fsma/safety-meetings/` | Safety meeting records |
| Inventory | `/api/fsma/fertilizer-inventory/` | Fertilizer inventory |
| PHI Checks | `/api/fsma/phi-checks/` | Pre-harvest interval compliance |
| Audit Binders | `/api/fsma/audit-binders/` | Audit documentation |
| Water Assessments | `/api/fsma/water-assessments/` | Water risk assessments |
| Source Assessments | `/api/fsma/source-assessments/` | Water source evaluations |
| Field Assessments | `/api/fsma/field-assessments/` | Field irrigation assessments |
| Environmental | `/api/fsma/environmental-assessments/` | Environmental evaluations |
| Mitigation Actions | `/api/fsma/mitigation-actions/` | Risk mitigation tracking |

### Yield Forecasting

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/yield-forecast/forecasts/` | GET/POST | List/create forecasts |
| `/api/yield-forecast/forecasts/<id>/generate/` | POST | Generate ML forecast |
| `/api/yield-forecast/dashboard/` | GET | Forecast dashboard |
| `/api/yield-forecast/field-detail/<field_id>/` | GET | Field forecast detail |
| `/api/yield-forecast/season-comparison/` | GET | Season-over-season comparison |
| `/api/yield-forecast/feature-snapshots/` | GET | Feature snapshot data |
| `/api/yield-forecast/soil-survey/` | GET | Soil survey data |

### Settlement Intelligence Analytics

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/packinghouse-analytics/block-performance/` | GET | Block/field performance |
| `/api/packinghouse-analytics/packout-trends/` | GET | Packout trend analysis |
| `/api/packinghouse-analytics/settlement-comparison/` | GET | Settlement comparison |
| `/api/packinghouse-analytics/size-distribution/` | GET | Fruit size distribution |
| `/api/packinghouse-analytics/size-pricing/` | GET | Size-based pricing |
| `/api/packinghouse-analytics/commodity-roi/` | GET | Commodity ROI ranking |
| `/api/packinghouse-analytics/deduction-creep/` | GET | Deduction creep analysis |
| `/api/packinghouse-analytics/price-trends/` | GET | Grade/size/price trends |
| `/api/packinghouse-analytics/report-card/` | GET | Packinghouse report card |
| `/api/packinghouse-analytics/pack-impact/` | GET | Pack percent impact |
| `/api/harvest-analytics/profitability/` | GET | Profitability analysis |
| `/api/harvest-analytics/deductions/` | GET | Deduction breakdown |
| `/api/harvest-analytics/seasons/` | GET | Season comparison |

### Season Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/seasons/info/` | GET | Current season info |
| `/api/seasons/date-range/` | GET | Season date ranges |
| `/api/season-templates/` | GET/POST | Season template CRUD |
| `/api/growing-cycles/` | GET/POST | Growing cycle CRUD |

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

### Reference Data

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

### Task Modules

| Module | Location | Purpose |
|--------|----------|---------|
| `tree_detection_tasks.py` | `backend/api/tasks/` | Async Claude Vision tree detection |
| `disease_tasks.py` | `backend/api/tasks/` | Disease proximity analysis |
| `compliance_tasks.py` | `backend/api/tasks/` | Compliance deadlines & alerts |
| `fsma_tasks.py` | `backend/api/tasks/` | FSMA scheduling tasks |

### Key Tasks

**Tree Detection Tasks:**
```python
@shared_task
def run_tree_detection_task(survey_id):
    """Async tree detection using Claude Vision API."""
```

**Disease Tasks:**
```python
@shared_task
def run_disease_proximity_analysis(company_id=None):
    """Check proximity to external disease detections."""

@shared_task
def sync_cdfa_detections():
    """Sync external detection data from CDFA."""

@shared_task
def generate_disease_alerts(analysis_run_id):
    """Generate alerts from proximity analysis."""
```

**Compliance Tasks:**
```python
@shared_task
def check_compliance_deadlines():
    """Daily task to update deadline statuses."""

@shared_task
def check_license_expirations():
    """Check license expiration dates."""

@shared_task
def check_wps_training_expirations():
    """Check WPS training expiration."""

@shared_task
def send_daily_compliance_digest():
    """Send daily compliance digest emails."""

@shared_task
def auto_generate_monthly_pur(month=None, year=None):
    """Auto-generate draft PUR report."""
```

### Celery Beat Schedule

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
    'sync-cdfa-detections': {
        'task': 'api.tasks.disease_tasks.sync_cdfa_detections',
        'schedule': crontab(hour=2, minute=0),  # Daily 2 AM
    },
    'run-disease-analysis': {
        'task': 'api.tasks.disease_tasks.run_disease_proximity_analysis',
        'schedule': crontab(hour=3, minute=0),  # Daily 3 AM
    },
}
```

### Running Celery

```bash
# Start worker
celery -A pesticide_tracker worker --loglevel=info

# Start beat (for scheduled tasks)
celery -A pesticide_tracker beat --loglevel=info
```

---

## SERVICES ARCHITECTURE

### Service Directory Structure

```
backend/api/services/
├── __init__.py
├── cimis_service.py              # CIMIS weather API integration
├── irrigation_scheduler.py       # Irrigation scheduling logic
├── satellite_kc_adjuster.py      # Satellite-based Kc adjustment (queries TreeSurvey)
├── quarantine_service.py         # Plant quarantine status
├── yolo_tree_detection.py        # Claude Vision API tree detection
├── cdfa_data_sync.py             # CDFA data synchronization
├── proximity_calculator.py       # Disease proximity calculations
├── season_service.py             # Season management
├── pdf_extraction_service.py     # AI-powered PDF data extraction
├── statement_matcher.py          # Statement matching logic
├── packinghouse_lookup.py        # Packinghouse auto-detection
├── yield_forecast_service.py     # Yield prediction service
├── yield_feature_engine.py       # Feature engineering (queries TreeSurvey)
├── climate_features.py           # Climate data features
├── alternate_bearing.py          # Alternate bearing calculations
├── soil_survey_service.py        # Soil survey data
├── cac_auto_fill.py              # CAC audit binder auto-fill bridge (NEW)
│
├── compliance/                   # Compliance services
│   ├── pesticide_compliance.py
│   └── water_compliance.py
│
├── operations/                   # Operations planning
│   ├── harvest_planning.py
│   └── spray_planning.py
│
├── analytics/                    # Analytics computation
│
├── reporting/                    # Reporting utilities
│
├── primusgfs/                    # CAC PDF field mapping services (NEW)
│   ├── __init__.py
│   ├── cac_pdf_filler.py         # CACPDFFieldFiller: discover fields, generate with overrides
│   ├── cac_pdf_generator.py      # PDF generation for CAC sections
│   ├── cac_data_mapper.py        # CACDataMapper: resolve model data to PDF field names
│   ├── cac_field_labels.py       # Human-readable labels for PDF field names
│   └── cross_data_linker.py      # Cross-reference data linking
│
└── fsma/                         # FSMA services
    ├── phi_compliance.py
    ├── audit_binder_generator.py
    ├── cleaning_scheduler.py
    ├── water_risk_calculator.py
    └── water_assessment_pdf_generator.py
```

### Key Services

**Tree Detection Service** (`yolo_tree_detection.py`):
- Tree detection using Claude Vision API (replaced old DeepForest/blob detection)
- GeoTIFF tiling for Claude API processing
- NDVI health scoring from NIR band
- Geospatial coordinate extraction from raster metadata

**PDF Extraction Service** (`pdf_extraction_service.py`):
- Anthropic Claude-powered data extraction from packinghouse PDF statements
- Supports packout reports, settlement statements, wash reports
- PyMuPDF for PDF-to-image conversion

**Yield Forecast Service** (`yield_forecast_service.py`):
- ML-based yield prediction with soil, climate, and tree health features
- Season comparison and alternate bearing analysis

**CAC PDF Field Mapping** (`services/primusgfs/`):
- `CACPDFFieldFiller.discover_fields()` scans template PDFs for AcroForm fields (cached per process)
- `CACDataMapper.resolve_positional_fields()` maps model data to PDF field names
- `cac_field_labels.py` maps field names (e.g. `1-a-100`) to human-readable labels
- `generate_section_with_overrides()` applies auto-fill then user overrides
- `cac_auto_fill.py` bridges auto-fill to `pdf_field_data` via `_bridge_auto_fill_to_pdf_fields()`

**Proximity Calculator** (`proximity_calculator.py`):
- Calculates distances to external disease detections
- Generates alerts based on configurable thresholds
- Uses haversine formula for accurate distances

---

## ROW-LEVEL SECURITY (RLS)

### Overview

Row-Level Security provides database-enforced tenant isolation. Even if application code forgets to filter by company, the database itself will only return rows belonging to the current tenant.

### RLS-Protected Tables

| Protection Level | Tables |
|------------------|--------|
| **Direct company_id** | Farm, Invitation, AuditLog, FertilizerProduct, Crop, Rootstock, TreeSurvey, DiseaseAlert, ScoutingReport, Packinghouse, ComplianceProfile, ControlledDocument, InternalAudit, etc. |
| **Via Farm** | FarmParcel, Field, WaterSource, IrrigationZone |
| **Via Field** | PesticideApplication, NutrientApplication, Harvest, IrrigationEvent |
| **Via Harvest** | HarvestLoad, HarvestLabor |
| **Via WaterSource** | WaterTest, WellReading, MeterCalibration, WaterAllocation |
| **Via TreeSurvey** | DetectedTree |
| **Via Packinghouse** | Pool, PackinghouseStatement, StatementBatchUpload |
| **Via Pool** | PackinghouseDelivery, PackoutReport, PoolSettlement |

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

# Start Celery beat (for scheduled tasks)
celery -A pesticide_tracker beat --loglevel=info
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
ANTHROPIC_API_KEY=your_key  # For PDF extraction (NEW)

# Celery/Redis
CELERY_BROKER_URL=redis://localhost:6379/0
```

---

## COMMON PATTERNS & CONVENTIONS

### Backend Patterns

1. **Domain-specific files**: Models in `models/` (17 files), views in `*_views.py` (28 files), serializers in `*_serializers.py` (21 files) — all with re-export hubs
2. **ViewSets with company filtering**: All ViewSets filter by user's current company via `view_helpers.py`
3. **LocationMixin**: Abstract base for GPS/PLSS fields (Farm, Field, WaterSource)
4. **Audit logging**: Use `AuditLogMixin` or manual `AuditLog.objects.create()`
5. **RLS context**: Always set via middleware, use `RLSContextManager` for background tasks
6. **Serializers**: Nested serializers for related data, separate list/detail serializers
7. **Services**: Business logic in services/, not in views
8. **Auto-numbering**: document_number, audit_number, ca_number, recall_id support auto-generation (blank=True)

### Frontend Patterns

1. **URL-based routing**: Centralized in `routes.js` with VIEW_TO_PATH/PATH_TO_VIEW mappings
2. **Context API**: Global state in AuthContext, DataContext, ModalContext
3. **Modal pattern**: `GlobalModals` component renders all modals based on ModalContext state
4. **API calls**: All through `services/api.js` with automatic HttpOnly cookie handling (withCredentials: true)
5. **Form handling**: Controlled components with local state
6. **Tailwind CSS**: Utility classes, no separate CSS files (except App.css for globals)
7. **Component subdirectories**: Related components grouped (tree-detection/, primusgfs/, primusgfs/audit-binder/, fsma/, compliance/, disease/, packinghouse/, yield-forecast/, dashboard/)

### Naming Conventions

- **Models**: PascalCase, singular (Farm, Field, Harvest)
- **API endpoints**: kebab-case, plural (/api/farms/, /api/water-sources/)
- **React components**: PascalCase (FarmModal.js, WaterManagement.js)
- **Context/services**: camelCase (authContext, api.js)
- **Database tables**: api_modelname (api_farm, api_field)
- **Services**: snake_case files (tree_detection.py, lidar_processing.py)

---

## KEY FILE LOCATIONS

| Purpose | Path |
|---------|------|
| Django settings | `backend/pesticide_tracker/settings.py` |
| Environment variables | `backend/.env` |
| **Models (package)** | **`backend/api/models/`** (17 domain files + `__init__.py` re-export hub) |
| **Views (hub)** | **`backend/api/views.py`** (re-exports from 28 `*_views.py` files) |
| **Serializers (hub)** | **`backend/api/serializers.py`** (re-exports from 21 `*_serializers.py` files) |
| API routes | `backend/api/urls.py` |
| **View helpers** | **`backend/api/view_helpers.py`** (get_user_company, require_company) |
| RLS Middleware | `backend/api/rls_middleware.py` |
| Cookie auth | `backend/api/authentication.py` |
| Auth views | `backend/api/auth_views.py` |
| Tree detection views | `backend/api/tree_detection_views.py` |
| Compliance views | `backend/api/compliance_views.py` |
| PrimusGFS views | `backend/api/primusgfs_views.py` |
| FSMA views | `backend/api/fsma_views.py` |
| Packinghouse views | `backend/api/packinghouse_views.py` |
| Disease views | `backend/api/disease_views.py` |
| Yield views | `backend/api/yield_views.py` |
| Analytics views | `backend/api/analytics_views.py` |
| Tree detection service | `backend/api/services/yolo_tree_detection.py` |
| PDF extraction service | `backend/api/services/pdf_extraction_service.py` |
| Yield forecast service | `backend/api/services/yield_forecast_service.py` |
| Satellite Kc adjuster | `backend/api/services/satellite_kc_adjuster.py` |
| CIMIS service | `backend/api/services/cimis_service.py` |
| Weather service | `backend/api/weather_service.py` |
| Celery tree detection | `backend/api/tasks/tree_detection_tasks.py` |
| Celery disease tasks | `backend/api/tasks/disease_tasks.py` |
| Celery compliance tasks | `backend/api/tasks/compliance_tasks.py` |
| Celery FSMA tasks | `backend/api/tasks/fsma_tasks.py` |
| **Route mappings** | **`frontend/src/routes.js`** (VIEW_TO_PATH, PATH_TO_VIEW) |
| React app entry | `frontend/src/App.js` |
| Router wrapper | `frontend/src/Main.jsx` |
| Auth context | `frontend/src/contexts/AuthContext.js` |
| Data context | `frontend/src/contexts/DataContext.js` |
| API service | `frontend/src/services/api.js` |
| Tree detection UI | `frontend/src/components/tree-detection/` |
| PrimusGFS UI | `frontend/src/components/primusgfs/` |
| FSMA UI | `frontend/src/components/fsma/` |
| Compliance UI | `frontend/src/components/compliance/` |
| Disease UI | `frontend/src/components/disease/` |
| Packinghouse UI | `frontend/src/components/packinghouse/` |
| Audit binder views | `backend/api/audit_binder_views.py` |
| Audit binder models | `backend/api/models/audit_binder.py` |
| CAC PDF filler | `backend/api/services/primusgfs/cac_pdf_filler.py` |
| CAC data mapper | `backend/api/services/primusgfs/cac_data_mapper.py` |
| CAC field labels | `backend/api/services/primusgfs/cac_field_labels.py` |
| CAC auto-fill | `backend/api/services/cac_auto_fill.py` |
| Yield forecast UI | `frontend/src/components/yield-forecast/` |
| Dashboard UI | `frontend/src/components/dashboard/` |
| Audit binder UI | `frontend/src/components/primusgfs/audit-binder/` |

---

## FOR AI ASSISTANTS

When working on this codebase:

1. **Check this document first** for architecture understanding
2. **Follow existing patterns** - see Common Patterns section
3. **Domain file structure** - models in `models/` (17 files), views in `*_views.py` (28 files), serializers in `*_serializers.py` (21 files) — add to re-export hubs
4. **View helpers** - use `get_user_company()` and `require_company()` from `view_helpers.py` for company scoping
5. **RLS awareness** - all tenant data is company-scoped
6. **API consistency** - follow existing endpoint naming conventions
7. **Frontend routing** - add new routes to `routes.js` VIEW_TO_PATH/PATH_TO_VIEW mappings
8. **Frontend state** - use Context API, not local state for shared data
9. **Migrations** - new models need RLS policies for tenant tables
10. **Services** - put business logic in services/, not views
11. **Components** - group related components in subdirectories

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
celery -A pesticide_tracker beat --loglevel=info
```

---

## ROADMAP

### Completed (v13.0)

- [x] **Codebase Modularization** — Split monolithic models.py (16 files), views.py (27 files), serializers.py (20 files) with re-export hubs
- [x] **Tree Detection Overhaul** — Removed 11 old models, rebuilt with Claude Vision API (2 models: TreeSurvey, DetectedTree)
- [x] **PrimusGFS Compliance Module** — 40+ models for GAP/GMP certification
- [x] **CAC Food Safety Manual V5.0** — 15 new models (FoodSafetyProfile, Training, Perimeter, Risk Assessment, etc.)
- [x] **Settlement Intelligence** — 5 grower profitability analytics views
- [x] **Yield Forecasting** — 4 models with ML-based predictions
- [x] **FSMA Compliance** — Facility management, PHI checks, water assessments, audit binders
- [x] **Commodity-Aware Units** — Citrus tracks bins, avocados track pounds
- [x] **Frontend URL Routing** — routes.js with centralized VIEW_TO_PATH/PATH_TO_VIEW
- [x] **Shared View Helpers** — view_helpers.py centralizing company access validation
- [x] **Cloudflare R2 Storage** — PDF statements and documents stored in cloud
- [x] **PDF Proxy Endpoint** — CORS-safe PDF serving from R2

### Completed (v12.2)

- [x] **Harvest Analytics Module** - Profitability, deductions, and season comparison dashboards
- [x] **PoolSettlement Model** - Detailed settlement tracking with credits, deductions, net returns
- [x] **ProfitabilityDashboard** - Multi-tab analytics with field/pool breakdowns
- [x] **Settlement Structure Clarification** - Net Settlement = grower's actual return (all costs deducted)

### Completed (v12.1)

- [x] **Packinghouse Module** - Complete packinghouse management (7 models)
- [x] **Harvest-to-Packing Pipeline** - End-to-end traceability with linking
- [x] **PDF Statement AI Extraction** - Anthropic Claude-powered PDF data extraction
- [x] **Harvest Linking** - Link deliveries to harvest records for traceability
- [x] **Pipeline Overview** - Visual pipeline from harvest to settlement
- [x] **Dark Mode** - Application-wide dark mode support
- [x] **PyMuPDF Integration** - Replaced pdf2image/poppler with PyMuPDF

### Completed (v12.0)

- [x] **LiDAR Integration System** - Complete point cloud processing with terrain analysis
- [x] **Unified Tree Identity** - Persistent tree tracking across sources
- [x] **Disease Prevention Module** - Proximity alerts, scouting reports
- [x] **QuarantineZone model** - Regional quarantine boundary tracking
- [x] **NotificationLog** - Audit trail for compliance notifications
- [x] **MCP Integration** - AI agent integration support
- [x] **Extended services architecture** - Compliance, operations, analytics submodules

### Completed (v11.4)

- [x] Compliance Management System
- [x] Compliance Dashboard with score, deadlines, alerts
- [x] Deadline Calendar with auto-generation
- [x] License Management with expiration alerts
- [x] WPS Compliance (training, posting, REI tracker)
- [x] Compliance Reports (PUR, SGMA, ILRP, WPS)
- [x] Celery Compliance Tasks

### Completed (v11.0-v11.3)

- [x] Multi-tenant authentication with RLS
- [x] Farm/Field/Application management
- [x] Crop & Rootstock reference database
- [x] Weather integration (OpenWeatherMap + CIMIS)
- [x] Irrigation scheduling with satellite Kc adjustment
- [x] Satellite imagery & tree detection
- [x] Analytics dashboard
- [x] Quarantine status checking
- [x] Password reset flow
- [x] Audit log viewer UI
- [x] PUR export
- [x] Nutrient management / ILRP reporting
- [x] Farms page redesign with modular components

### Phase 2: Near-term

- [x] ~~Split models.py into domain-specific files~~ (done in v13.0 — 16 model files)
- [x] ~~Split serializers.py and views.py into domain-specific modules~~ (done in v13.0 — 27 view files, 20 serializer files)
- [x] ~~Implement URL-based routing with React Router~~ (done in v13.0 — routes.js)
- [x] ~~Configure Cloudflare R2 cloud storage~~ (done — PDF statements stored in R2)
- [ ] Enable Celery worker in production (Procfile created — deploy as Railway service)
- [ ] Add automated tests for financial calculations (settlements, deductions, profitability)
- [ ] Add error monitoring service (Sentry) for production issue visibility
- [ ] Email sending for invitations (currently logged to console)
- [ ] Extraction report PDF generation
- [ ] GSA portal direct submission
- [ ] Permission-based UI hiding
- [ ] Improved error handling and user feedback

### Phase 3: Medium-term

- [ ] Stripe billing integration & subscription management
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

*Document Version: 13.0 | Last Updated: February 19, 2026*

*Changes in v13.0:*
- *Major codebase modularization: split monolithic models.py into 16 domain files, views.py into 27 domain files, serializers.py into 20 domain files — all with re-export hubs for backward compatibility*
- *Tree Detection Overhaul: removed 11 old models (SatelliteImage, TreeDetectionRun, LiDAR*, Tree, TreeObservation, etc.), rebuilt with 2 models (TreeSurvey, DetectedTree) using Claude Vision API + NDVI health scoring (migrations 0064-0067)*
- *PrimusGFS Compliance Module: 40+ models covering GAP/GMP certification (migrations 0058-0063)*
- *CAC Food Safety Manual V5.0: 15 new models including FoodSafetyProfile, TrainingRecord, PerimeterMonitoring, FieldRiskAssessment, ProductHoldRelease, etc. (migration 0068)*
- *Settlement Intelligence: 5 new grower profitability analytics views (commodity ROI, deduction creep, grade/size/price trends, packinghouse report card, pack percent impact)*
- *Yield Forecasting: 4 new models (ExternalDataSource, SoilSurveyData, YieldFeatureSnapshot, YieldForecast) with dashboard (migration 0055-0057)*
- *FSMA Compliance: facility management, PHI checks, water risk assessments, audit binder generation (migrations 0035, 0040-0041)*
- *Commodity-aware units: citrus tracks bins, avocados track pounds throughout pipeline (migration 0051)*
- *Frontend URL routing: centralized routes.js with VIEW_TO_PATH/PATH_TO_VIEW mappings*
- *Shared view_helpers.py centralizing company access validation across all view files*
- *Cloudflare R2 cloud storage integration with PDF proxy endpoint for CORS*
- *29 new PrimusGFS frontend components, 5 tree detection components, 9+ FSMA components, 2 yield forecast components*
- *Updated migration count from 45 to 68*
- *Updated frontend component count to 170+*
- *Updated model count to 120+*
- *72 commits since v12.3*

*Changes in v12.3:*
- *Comprehensive software evaluation completed — strengths and improvement areas documented*
- *Added Season Management module (SeasonTemplate, GrowingCycle models, migrations 0042-0043)*
- *Added Procfile for Railway Celery worker deployment*
- *Fixed password reset token model (migration 0044)*
- *Fixed settlement deduction unit_of_measure default (migration 0045)*
- *Fixed citrus season format (2024-2025) across harvest endpoints and analytics views*
- *Updated roadmap with evaluation findings: automated testing, error monitoring, infrastructure fixes, code splitting*
- *Updated migration count from 34 to 45*
- *Updated frontend component count to 144*
- *Updated model count to 80+*

*Changes in v12.2:*
- *Added Harvest Analytics Module with profitability analysis, deduction breakdown, and season comparison*
- *Added PoolSettlement model for detailed settlement tracking with credits, deductions, and net returns*
- *Added ProfitabilityDashboard.js component with multi-tab analytics views*
- *Added SettlementDetail.js and PackinghouseDashboard.js components*
- *Added 3 new harvest analytics API endpoints: /api/harvest-analytics/profitability/, /deductions/, /seasons/*
- *Clarified settlement structure: pick & haul costs are included in deductions, Net Settlement = grower's actual return*
- *Updated model count from 72 to 73*
- *Updated component count to 100+*
- *Updated migration count from 29 to 34*
- *Updated packinghouse component count from 12 to 15*

*Changes in v12.1:*
- *Added Packinghouse Management Module (7 models: Packinghouse, Pool, PackinghouseDelivery, PackoutReport, PackoutGrade, PoolSettlement, PackinghouseStatement)*
- *Added Harvest-to-Packing Pipeline with visual overview component*
- *Added PDF Statement AI Extraction using Anthropic Claude API*
- *Added Harvest Linking - deliveries can link to harvest records for traceability*
- *Added packinghouse frontend components in components/packinghouse/*
- *Merged Harvest and Packinghouse sections into unified "Harvest & Packing" module*
- *Added dark mode support across the application*
- *Added PyMuPDF (fitz) for PDF-to-image conversion (replaced pdf2image/poppler)*
- *Added anthropic>=0.18.0 dependency for PDF extraction*
- *New backend service: pdf_extraction_service.py*
- *New API endpoints: /api/packinghouses/, /api/pools/, /api/packinghouse-deliveries/, /api/packout-reports/, /api/packinghouse-statements/, /api/harvest-packing/pipeline/*

*Changes in v12.0:*
- *Added LiDAR Integration System (4 new models: LiDARDataset, LiDARProcessingRun, LiDARDetectedTree, TerrainAnalysis)*
- *Added Unified Tree Identity System (4 new models: Tree, TreeObservation, TreeMatchingRun, TreeFeedback)*
- *Added Disease Prevention Module (7 new models: ExternalDetection, QuarantineZone, DiseaseAlertRule, DiseaseAnalysisRun, DiseaseAlert, ScoutingReport, ScoutingPhoto, TreeHealthRecord)*
- *Added NotificationLog model for compliance audit trails*
- *New view files: lidar_views.py, tree_views.py, disease_views.py*
- *New service files: tree_matching.py, lidar_processing.py, cdfa_data_sync.py, proximity_calculator.py*
- *New service subdirectories: compliance/, operations/, analytics/, reporting/*
- *New Celery task files: lidar_tasks.py, disease_tasks.py*
- *New frontend component directories: disease/ (5 components)*
- *Extended imagery/ directory with LiDAR and unified tree components (12 total)*
- *Added MCP integration (mcp>=1.25.0) for AI agent support*
- *Added LiDAR dependencies: laspy[lazrs]>=2.4.0, pyproj>=3.5.0*
- *Updated model count from ~50 to 66*
- *Updated component count from ~70 to 83+*
- *Updated models.py from 6,500 to 8,800+ lines*
- *Updated serializers.py from 1,900 to 3,400+ lines*
- *Migration count increased from 25 to 29*
