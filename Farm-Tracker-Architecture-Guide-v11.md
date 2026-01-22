# Farm Management Tracker - System Architecture Guide
## Version 12.2 | January 21, 2026

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
| **LiDAR Processing** | Point cloud analysis for terrain, tree detection, frost risk (NEW) |
| **Unified Tree Identity** | Persistent tree tracking across satellite/LiDAR sources (NEW) |
| **Disease Prevention** | Proximity-based disease alerts, scouting reports (NEW) |
| **Nutrient Management** | Fertilizer tracking, nitrogen calculations, ILRP reporting |
| **Harvest Operations** | Yield tracking, revenue, labor costs, PHI compliance |
| **Quarantine Compliance** | Plant quarantine status checking with zone management |
| **Analytics Dashboard** | Farm performance metrics and visualizations |
| **Packinghouse Management** | Packinghouses, pools, deliveries, packout tracking (NEW) |
| **Harvest-to-Packing Pipeline** | End-to-end traceability from harvest to packout (NEW) |
| **PDF Statement Extraction** | AI-powered extraction from packinghouse PDF statements (NEW) |
| **Compliance Reporting** | PUR exports, SGMA semi-annual reports, Nitrogen/ILRP reports |
| **Audit Logging** | Comprehensive activity tracking for compliance |

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
|  |              FRONTEND (React 19 + Tailwind CSS 4)                 |  |
|  |              http://localhost:3000                                |  |
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
|  |  - FarmModal            - Profile              Imagery (12)       |  |
|  |  - FieldModal                                  - SatelliteUpload  |  |
|  |  - ApplicationModal     Compliance (6)         - TreeDetection    |  |
|  |  - HarvestModal, etc.   - Dashboard            - LiDARUpload      |  |
|  |                         - Deadlines            - UnifiedTreeMap   |  |
|  |  Disease (5) NEW        - Licenses                                |  |
|  |  - DiseaseDashboard     - WPSCompliance        Dashboard (5)      |  |
|  |  - ThreatMap            - Reports              - AlertsBanner     |  |
|  |  - ProximityRiskCard    - Settings             - TaskList         |  |
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
|  |  /api/products/         /api/water-           /api/kc-profiles/   |  |
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
|  |  LiDAR (NEW)            Unified Trees (NEW)   Disease (NEW)       |  |
|  |  /api/lidar-datasets/   /api/trees/           /api/disease/       |  |
|  |  /api/lidar-runs/       /api/tree-matching-     alerts/           |  |
|  |  /api/lidar-trees/        runs/               /api/disease/       |  |
|  |                         /api/tree-feedback/     scouting/         |  |
|  |                                               /api/disease/       |  |
|  |  Weather                Analytics               dashboard/        |  |
|  |  /api/weather/          /api/analytics/                           |  |
|  |    current/             /api/audit-logs/      Reports             |  |
|  |    forecast/                                  /api/reports/       |  |
|  |    spray-conditions/    Quarantine              statistics/       |  |
|  |                         /api/quarantine/        pur-export/       |  |
|  |                                                 nitrogen-summary/ |  |
|  |  Compliance                                                       |  |
|  |  /api/compliance/profile/  /api/compliance/licenses/              |  |
|  |  /api/compliance/deadlines/  /api/compliance/wps-training/        |  |
|  |  /api/compliance/alerts/   /api/compliance/reports/               |  |
|  +-------------------------------------------------------------------+  |
|                              |                                          |
|  +-------------------------------------------------------------------+  |
|  |                DATABASE (PostgreSQL 18)                           |  |
|  |                Database: farm_tracker                             |  |
|  |                                                                   |  |
|  |  66+ Tables organized by domain:                                  |  |
|  |  - Auth: Company, User, Role, Permission, CompanyMembership       |  |
|  |  - Core: Farm, FarmParcel, Field, Crop, Rootstock                 |  |
|  |  - Pesticide: PesticideProduct, PesticideApplication              |  |
|  |  - Water: WaterSource, WaterTest, WellReading, WaterAllocation    |  |
|  |  - Irrigation: IrrigationZone, IrrigationEvent, CropCoefficient   |  |
|  |  - Harvest: Harvest, HarvestLoad, HarvestLabor, Buyer, Contractor |  |
|  |  - Nutrients: FertilizerProduct, NutrientApplication, NutrientPlan|  |
|  |  - Satellite: SatelliteImage, TreeDetectionRun, DetectedTree      |  |
|  |  - LiDAR: LiDARDataset, LiDARProcessingRun, LiDARDetectedTree,    |  |
|  |           TerrainAnalysis (NEW)                                   |  |
|  |  - Tree Identity: Tree, TreeObservation, TreeMatchingRun,         |  |
|  |                   TreeFeedback (NEW)                              |  |
|  |  - Disease: DiseaseAlertRule, DiseaseAlert, DiseaseAnalysisRun,   |  |
|  |             ScoutingReport, TreeHealthRecord (NEW)                |  |
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
| djangorestframework-simplejwt | 5.3+ | JWT authentication |
| django-cors-headers | 4.3 | CORS for frontend |
| psycopg2-binary | >=2.9.0 | PostgreSQL adapter |
| python-dotenv | 1.0.0 | Environment variable management |
| python-decouple | 3.8 | Additional config management |
| Pillow | >=10.1.0 | Image processing |
| Celery | >=5.3.0 | Async task processing |
| Redis | >=4.5.0 | Message broker & caching |
| rasterio | >=1.3.0 | Satellite imagery processing |
| numpy | >=1.24.0 | Numerical operations |
| scipy | >=1.10.0 | Scientific computing |
| scikit-image | >=0.21.0 | Image analysis |
| shapely | >=2.0.0 | Geometric operations |
| **laspy[lazrs]** | **>=2.4.0** | **LiDAR point cloud file format (NEW)** |
| **pyproj** | **>=3.5.0** | **Geospatial coordinate transformations (NEW)** |
| **mcp** | **>=1.25.0** | **MCP Server for AI Agent Integration (NEW)** |
| **anthropic** | **>=0.18.0** | **Anthropic Claude API for PDF extraction (NEW)** |
| **PyMuPDF** | **>=1.23.0** | **PDF to image conversion (fitz library) (NEW)** |

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
|       +-- models.py                     # 66+ database models (8,800+ lines)
|       +-- views.py                      # ViewSets + utility views (4,900+ lines)
|       +-- serializers.py                # DRF serializers (3,400+ lines)
|       +-- urls.py                       # API routing (300 lines)
|       |
|       +-- auth_views.py                 # Authentication endpoints
|       +-- team_views.py                 # Team management endpoints
|       +-- onboarding_views.py           # Onboarding endpoints
|       +-- company_views.py              # Company management
|       +-- weather_views.py              # Weather API endpoints
|       +-- analytics_views.py            # Analytics dashboard
|       +-- audit_views.py                # Audit log endpoints
|       +-- imagery_views.py              # Satellite/tree detection
|       +-- lidar_views.py                # LiDAR processing endpoints (NEW)
|       +-- tree_views.py                 # Unified tree identity endpoints (NEW)
|       +-- compliance_views.py           # Compliance management endpoints
|       +-- disease_views.py              # Disease prevention endpoints (NEW)
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
|       |   +-- tree_detection.py         # ML tree detection
|       |   +-- tree_matching.py          # Unified tree identity matching (NEW)
|       |   +-- lidar_processing.py       # LiDAR point cloud analysis (NEW)
|       |   +-- cdfa_data_sync.py         # CDFA data synchronization (NEW)
|       |   +-- proximity_calculator.py   # Disease proximity calculations (NEW)
|       |   |
|       |   +-- compliance/               # Compliance services (NEW)
|       |   |   +-- __init__.py
|       |   |   +-- pesticide_compliance.py
|       |   |   +-- water_compliance.py
|       |   |
|       |   +-- operations/               # Operations planning (NEW)
|       |   |   +-- __init__.py
|       |   |   +-- harvest_planning.py
|       |   |   +-- spray_planning.py
|       |   |
|       |   +-- analytics/                # Analytics services (NEW)
|       |   |   +-- __init__.py
|       |   |
|       |   +-- reporting/                # Reporting services (NEW)
|       |       +-- __init__.py
|       |
|       +-- tasks/                        # Celery Tasks
|       |   +-- __init__.py
|       |   +-- imagery_tasks.py          # Async tree detection
|       |   +-- lidar_tasks.py            # LiDAR processing tasks (NEW)
|       |   +-- disease_tasks.py          # Disease analysis tasks (NEW)
|       |   +-- compliance_tasks.py       # Compliance deadline/alert tasks
|       |
|       +-- pur_reporting.py              # PUR report generator
|       +-- product_import_tool.py        # EPA product importer
|       +-- weather_service.py            # Weather API client
|       +-- email_service.py              # Email configuration
|       |
|       +-- migrations/                   # 34 migration files
|       |   +-- 0001_initial.py
|       |   +-- ...
|       |   +-- 0018_lidar_integration.py
|       |   +-- 0020_unified_tree_identity.py
|       |   +-- 0022_tree_feedback.py
|       |   +-- 0023_satellite_kc_adjustment.py
|       |   +-- 0025_compliancedeadline_wpstrainingrecord_and_more.py
|       |   +-- 0026_disease_prevention.py
|       |   +-- 0027_remove_field_baseline_canopy_coverage_and_more.py
|       |   +-- 0028_quarantine_zone.py
|       |   +-- 0029_fix_auditlog_rls_coalesce.py
|       |
|       +-- templates/                    # Email templates
|           +-- emails/
|               +-- compliance_deadline_reminder.html
|               +-- license_expiration_warning.html
|               +-- training_due_reminder.html
|               +-- compliance_digest.html
|               +-- base.html
|               +-- invitation.html
|               +-- password_changed.html
|               +-- password_reset.html
|               +-- welcome.html
|
+-- frontend/                             # React Frontend
    +-- src/
    |   +-- components/                   # 100+ UI components
    |   |   +-- Dashboard.js
    |   |   +-- Farms.js                  # Refactored - uses FarmCard, FarmToolbar
    |   |   +-- FarmCard.js               # Extracted farm card component
    |   |   +-- FieldCard.js              # Extracted field card component
    |   |   +-- FarmToolbar.js            # Search, filter, view controls
    |   |   +-- FarmInsightsPanel.js      # Aggregated farm insights
    |   |   +-- GeocodePreviewModal.js    # GPS preview with adjustable marker
    |   |   +-- Fields.js
    |   |   +-- FarmMap.js
    |   |   +-- Analytics.js
    |   |   +-- AnalyticsWidget.js
    |   |   +-- Reports.js, PURReports.js
    |   |   +-- Harvests.js               # Unified Harvest & Packing module
    |   |   +-- HarvestAnalytics.js
    |   |   +-- ProfitabilityDashboard.js # Settlement profitability analytics
    |   |   +-- NutrientManagement.js
    |   |   +-- WaterManagement.js
    |   |   +-- Wells.js
    |   |   +-- IrrigationDashboard.js
    |   |   +-- IrrigationZoneCard.js     # Zone card with satellite data
    |   |   +-- WeatherForecast.js
    |   |   +-- WeatherWidget.js
    |   |   +-- TeamManagement.js
    |   |   +-- AuditLogViewer.js
    |   |   +-- CompanySettings.js
    |   |   +-- Profile.js
    |   |   +-- Login.js
    |   |   +-- ForgotPassword.js
    |   |   +-- ResetPassword.js
    |   |   +-- AcceptInvitation.js
    |   |   +-- OnboardingWizard.js
    |   |   +-- GlobalModals.js
    |   |   +-- ProductManagement.js
    |   |   +-- QuarantineStatusBadge.js
    |   |   +-- QuarantineLayer.js
    |   |   +-- FarmParcelManager.js
    |   |   +-- *Modal.js (25+ modal components)
    |   |   |
    |   |   +-- imagery/                  # Satellite & LiDAR components (12)
    |   |   |   +-- index.js
    |   |   |   +-- SatelliteImageUpload.js
    |   |   |   +-- TreeDetectionPanel.js
    |   |   |   +-- TreeDetailModal.js
    |   |   |   +-- TreeMapLayer.js
    |   |   |   +-- TreeLayerPanel.js
    |   |   |   +-- TreeSummaryCard.js
    |   |   |   +-- TreeFeedbackForm.js
    |   |   |   +-- LiDARUploadPanel.js       # (NEW)
    |   |   |   +-- LiDARSummaryCard.js       # (NEW)
    |   |   |   +-- LiDARTreeMapLayer.js      # (NEW)
    |   |   |   +-- UnifiedTreeMapLayer.js    # (NEW)
    |   |   |
    |   |   +-- compliance/               # Compliance management (6)
    |   |   |   +-- ComplianceDashboard.js
    |   |   |   +-- DeadlineCalendar.js
    |   |   |   +-- LicenseManagement.js
    |   |   |   +-- WPSCompliance.js
    |   |   |   +-- ComplianceReports.js
    |   |   |   +-- ComplianceSettings.js
    |   |   |
    |   |   +-- packinghouse/             # Packinghouse management (15)
    |   |   |   +-- index.js
    |   |   |   +-- PackinghouseList.js       # Packinghouse directory
    |   |   |   +-- PackinghouseModal.js      # Add/edit packinghouse
    |   |   |   +-- PackinghouseDashboard.js  # Unified packinghouse dashboard
    |   |   |   +-- PoolList.js               # Pool management
    |   |   |   +-- PoolModal.js              # Add/edit pool
    |   |   |   +-- PoolDetail.js             # Pool detail with deliveries/packouts
    |   |   |   +-- DeliveryModal.js          # Record deliveries with harvest linking
    |   |   |   +-- PackoutReportModal.js     # Enter packout data
    |   |   |   +-- PDFUploadModal.js         # Upload & AI extract statements
    |   |   |   +-- ExtractedDataPreview.js   # Review extracted PDF data
    |   |   |   +-- StatementList.js          # List uploaded statements
    |   |   |   +-- SettlementDetail.js       # Pool settlement details
    |   |   |   +-- PipelineOverview.js       # Harvest-to-packing pipeline viz
    |   |   |   +-- PackinghouseAnalytics.js  # Packinghouse analytics
    |   |   |
    |   |   +-- disease/                  # Disease prevention (5) (NEW)
    |   |   |   +-- index.js
    |   |   |   +-- DiseaseDashboard.js
    |   |   |   +-- DiseaseAlertsList.js
    |   |   |   +-- ProximityRiskCard.js
    |   |   |   +-- ThreatMap.js
    |   |   |
    |   |   +-- dashboard/                # Dashboard components (5)
    |   |   |   +-- FarmStatusStrip.js
    |   |   |   +-- ModuleStatusCard.js
    |   |   |   +-- OperationalAlertsBanner.js
    |   |   |   +-- QuickActionsGrid.js
    |   |   |   +-- UnifiedTaskList.js
    |   |   |
    |   |   +-- navigation/               # Navigation components
    |   |   |   +-- Breadcrumbs.js
    |   |   |
    |   |   +-- ui/                       # Reusable UI components
    |   |       +-- MetricCard.js
    |   |       +-- StatusBadge.js
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

### Model Count: 73 Models

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

### Packinghouse Management (7 models)

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Packinghouse` | Packinghouse facilities | company, name, short_code, address, contact_info, is_active |
| `Pool` | Grower pools | packinghouse, pool_number, pool_name, crop_variety, season, status (open/closed/settled) |
| `PackinghouseDelivery` | Fruit deliveries | pool, field, harvest (FK), delivery_date, ticket_number, bins, weight_lbs |
| `PackoutReport` | Packout summaries | pool, packout_date, total_bins_packed, cull_percent, grades (via PackoutGrade) |
| `PackoutGrade` | Grade breakdown | packout_report, grade_name (Fancy/Choice/etc), cartons, weight_lbs, price_per_carton |
| `PoolSettlement` | Settlement records | pool, field, statement_date, total_bins, total_credits, total_deductions, net_return, net_per_bin |
| `PackinghouseStatement` | PDF statements | packinghouse, pool, original_filename, pdf_file, status, extracted_data (JSON), statement_type |

**Settlement Structure Note:** Pick & haul costs are included as line items in settlement deductions. Therefore, `net_return` represents the grower's actual return after all packinghouse-related costs.

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

### LiDAR Processing (4 models) - NEW

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `LiDARDataset` | LAS/LAZ file storage | company, farm, file, capture_date, point_count, bounds_*, crs, source, classification_counts (JSON) |
| `LiDARProcessingRun` | Processing jobs | lidar_dataset, field, status, algorithm_version, parameters (JSON), tree_count, terrain_generated |
| `LiDARDetectedTree` | Individual trees from LiDAR | processing_run, field, latitude, longitude, height_m, crown_diameter_m, confidence_score, status |
| `TerrainAnalysis` | Terrain data | processing_run, field, elevation_min, elevation_max, slope_data (JSON), aspect_data (JSON), frost_pockets (JSON) |

### Unified Tree Identity (4 models) - NEW

| Model | Purpose | Key Fields |
|-------|---------|------------|
| `Tree` | Persistent tree identity | field, canonical_latitude, canonical_longitude, tree_id_code, status (active/dead/removed), first_detected, last_observed |
| `TreeObservation` | Multi-source observations | tree (FK), source_type (satellite/lidar/manual), source_run_id, observation_date, latitude, longitude, canopy_diameter_m, height_m, ndvi_value, health_score |
| `TreeMatchingRun` | Matching job tracking | field, status, matched_count, new_trees_count, algorithm_version |
| `TreeFeedback` | User corrections | tree (FK), user, feedback_type (confirm/reject/merge/split), notes |

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
| Confirm Statement | `/api/packinghouse-statements/<id>/confirm/` | Confirm extracted data |
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

### Satellite Imagery & Tree Detection

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/satellite-images/` | GET/POST | List/upload images |
| `/api/satellite-images/<id>/` | GET/DELETE | Image details/delete |
| `/api/satellite-images/<id>/detect-trees/` | POST | Trigger tree detection (async) |
| `/api/detection-runs/` | GET | List detection runs |
| `/api/detection-runs/<id>/` | GET | Run details |
| `/api/detection-runs/<id>/trees/` | GET | Trees for run |
| `/api/detection-runs/<id>/approve/` | POST | Approve run |
| `/api/detected-trees/<id>/` | PATCH | Update tree status |
| `/api/fields/<id>/trees/` | GET | Trees from latest approved run |
| `/api/fields/<id>/tree-summary/` | GET | Manual vs satellite comparison |
| `/api/fields/<id>/detection-history/` | GET | All detection runs |
| `/api/fields/<id>/trees/export/` | GET | Export GeoJSON |

### LiDAR Processing (NEW)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/lidar-datasets/` | GET/POST | List/upload LiDAR files |
| `/api/lidar-datasets/<id>/` | GET/DELETE | Dataset details/delete |
| `/api/lidar-datasets/<id>/process/` | POST | Trigger LiDAR processing (async) |
| `/api/lidar-runs/` | GET | List processing runs |
| `/api/lidar-runs/<id>/` | GET | Run details with results |
| `/api/lidar-runs/<id>/approve/` | POST | Approve run |
| `/api/lidar-trees/` | GET | List LiDAR-detected trees |
| `/api/lidar-trees/<id>/` | PATCH | Update tree status |
| `/api/fields/<id>/lidar-trees/` | GET | LiDAR trees for field |
| `/api/fields/<id>/lidar-summary/` | GET | LiDAR detection summary |
| `/api/fields/<id>/terrain/` | GET | Terrain analysis data |
| `/api/fields/<id>/frost-risk/` | GET | Frost pocket analysis |
| `/api/fields/<id>/lidar-history/` | GET | All LiDAR runs |
| `/api/fields/<id>/lidar-trees/export/` | GET | Export LiDAR trees GeoJSON |

### Unified Tree Identity (NEW)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/trees/` | GET | List all unified trees |
| `/api/trees/<id>/` | GET/PATCH | Tree details/update |
| `/api/trees/<id>/observations/` | GET | All observations for tree |
| `/api/trees/<id>/timeline/` | GET | Tree history timeline |
| `/api/tree-matching-runs/` | GET/POST | List/trigger matching |
| `/api/tree-matching-runs/<id>/` | GET | Matching run details |
| `/api/tree-feedback/` | GET/POST | List/create feedback |
| `/api/tree-feedback/<id>/` | GET | Feedback details |
| `/api/fields/<pk>/unified-trees/` | GET | Unified trees for field |
| `/api/fields/<pk>/tree-summary/` | GET | Unified tree summary |
| `/api/fields/<pk>/tree-timeline/` | GET | Field tree timeline |
| `/api/fields/<pk>/match-trees/` | POST | Trigger tree matching |

### Disease Prevention (NEW)

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
| `imagery_tasks.py` | `backend/api/tasks/` | Satellite tree detection processing |
| `lidar_tasks.py` | `backend/api/tasks/` | LiDAR point cloud processing (NEW) |
| `disease_tasks.py` | `backend/api/tasks/` | Disease proximity analysis (NEW) |
| `compliance_tasks.py` | `backend/api/tasks/` | Compliance deadlines & alerts |

### Key Tasks

**Imagery Tasks:**
```python
@shared_task
def process_tree_detection(detection_run_id):
    """Async satellite tree detection processing."""

@shared_task
def cleanup_old_detection_runs(days_old=90):
    """Remove old unapproved detection runs."""
```

**LiDAR Tasks (NEW):**
```python
@shared_task
def process_lidar_dataset(processing_run_id):
    """Async LiDAR point cloud processing."""

@shared_task
def generate_terrain_analysis(processing_run_id):
    """Generate terrain analysis from LiDAR data."""

@shared_task
def calculate_frost_risk(processing_run_id):
    """Calculate frost pocket risk from terrain data."""
```

**Disease Tasks (NEW):**
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
├── cimis_service.py          # CIMIS weather API integration
├── irrigation_scheduler.py   # Irrigation scheduling logic
├── satellite_kc_adjuster.py  # Satellite-based Kc adjustment
├── quarantine_service.py     # Plant quarantine status
├── tree_detection.py         # ML satellite tree detection
├── tree_matching.py          # Unified tree identity matching (NEW)
├── lidar_processing.py       # LiDAR point cloud analysis (NEW)
├── cdfa_data_sync.py         # CDFA data synchronization (NEW)
├── proximity_calculator.py   # Disease proximity calculations (NEW)
│
├── pdf_extraction_service.py # AI-powered PDF data extraction (NEW)
│
├── compliance/               # Compliance services (NEW)
│   ├── __init__.py
│   ├── pesticide_compliance.py
│   └── water_compliance.py
│
├── operations/               # Operations planning (NEW)
│   ├── __init__.py
│   ├── harvest_planning.py
│   └── spray_planning.py
│
├── analytics/                # Analytics services (NEW)
│   └── __init__.py
│
└── reporting/                # Reporting services (NEW)
    └── __init__.py
```

### Key Services

**Tree Detection Service** (`tree_detection.py`):
- Satellite imagery tree detection using blob detection
- NDVI/ExG vegetation index calculation
- Tiled processing for memory efficiency

**LiDAR Processing Service** (`lidar_processing.py`) - NEW:
- Point cloud loading via laspy
- Ground classification and DTM generation
- Tree detection from canopy height model
- Terrain analysis (slope, aspect, frost pockets)

**Tree Matching Service** (`tree_matching.py`) - NEW:
- Matches satellite and LiDAR detections to unified Tree entities
- Spatial matching with configurable tolerance
- Handles tree merging and splitting

**Proximity Calculator** (`proximity_calculator.py`) - NEW:
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
| **Direct company_id** | Farm, Invitation, AuditLog, FertilizerProduct, Crop, Rootstock, SatelliteImage, LiDARDataset, Tree, DiseaseAlert, ScoutingReport |
| **Via Farm** | FarmParcel, Field, WaterSource, IrrigationZone |
| **Via Field** | PesticideApplication, NutrientApplication, Harvest, IrrigationEvent, TreeDetectionRun, LiDARProcessingRun |
| **Via Harvest** | HarvestLoad, HarvestLabor |
| **Via WaterSource** | WaterTest, WellReading, MeterCalibration, WaterAllocation |
| **Via SatelliteImage** | TreeDetectionRun, DetectedTree |
| **Via LiDARDataset** | LiDARProcessingRun, LiDARDetectedTree, TerrainAnalysis |

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

1. **ViewSets with company filtering**: All ViewSets filter by user's current company
2. **LocationMixin**: Abstract base for GPS/PLSS fields (Farm, Field, WaterSource)
3. **Audit logging**: Use `AuditLogMixin` or manual `AuditLog.objects.create()`
4. **RLS context**: Always set via middleware, use `RLSContextManager` for background tasks
5. **Serializers**: Nested serializers for related data, separate list/detail serializers
6. **Services**: Business logic in services/, not in views

### Frontend Patterns

1. **Context API**: Global state in AuthContext, DataContext, ModalContext
2. **Modal pattern**: `GlobalModals` component renders all modals based on ModalContext state
3. **API calls**: All through `services/api.js` with automatic token handling
4. **Form handling**: Controlled components with local state
5. **Tailwind CSS**: Utility classes, no separate CSS files (except App.css for globals)
6. **Component subdirectories**: Related components grouped (imagery/, compliance/, disease/, dashboard/)

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
| Database models | `backend/api/models.py` |
| API views | `backend/api/views.py` |
| API routes | `backend/api/urls.py` |
| Serializers | `backend/api/serializers.py` |
| RLS Middleware | `backend/api/rls_middleware.py` |
| Auth views | `backend/api/auth_views.py` |
| Weather service | `backend/api/weather_service.py` |
| CIMIS service | `backend/api/services/cimis_service.py` |
| Imagery views | `backend/api/imagery_views.py` |
| LiDAR views | `backend/api/lidar_views.py` |
| Tree views | `backend/api/tree_views.py` |
| Disease views | `backend/api/disease_views.py` |
| Compliance views | `backend/api/compliance_views.py` |
| Packinghouse views | `backend/api/packinghouse_views.py` |
| Tree detection service | `backend/api/services/tree_detection.py` |
| LiDAR processing service | `backend/api/services/lidar_processing.py` |
| Tree matching service | `backend/api/services/tree_matching.py` |
| Satellite Kc adjuster | `backend/api/services/satellite_kc_adjuster.py` |
| Celery imagery tasks | `backend/api/tasks/imagery_tasks.py` |
| Celery LiDAR tasks | `backend/api/tasks/lidar_tasks.py` |
| Celery disease tasks | `backend/api/tasks/disease_tasks.py` |
| Celery compliance tasks | `backend/api/tasks/compliance_tasks.py` |
| React app entry | `frontend/src/App.js` |
| Auth context | `frontend/src/contexts/AuthContext.js` |
| Data context | `frontend/src/contexts/DataContext.js` |
| API service | `frontend/src/services/api.js` |
| Farms page | `frontend/src/components/Farms.js` |
| Harvests page | `frontend/src/components/Harvests.js` |
| Profitability dashboard | `frontend/src/components/ProfitabilityDashboard.js` |
| Imagery components | `frontend/src/components/imagery/` |
| Compliance components | `frontend/src/components/compliance/` |
| Disease components | `frontend/src/components/disease/` |
| Dashboard components | `frontend/src/components/dashboard/` |
| Packinghouse components | `frontend/src/components/packinghouse/` |
| PDF extraction service | `backend/api/services/pdf_extraction_service.py` |

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
8. **Services** - put business logic in services/, not views
9. **Components** - group related components in subdirectories

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

*Document Version: 12.2 | Last Updated: January 21, 2026*

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
