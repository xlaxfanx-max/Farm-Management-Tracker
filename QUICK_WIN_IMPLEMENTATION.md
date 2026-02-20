# Quick Win Implementation Guide
## Increase Revenue by 110-190% in 2 Weeks

**Target**: Implement tiered feature gating + PDF metering + Analytics Pack
**Effort**: 18 hours total
**Impact**: +$55-95/customer MRR

---

## Step 1: Create Feature Gating Decorator (30 mins)

Create `backend/api/decorators.py`:

```python
from functools import wraps
from rest_framework.response import Response
from rest_framework import status


def require_tier(minimum_tier):
    """
    Decorator to restrict access to views/viewsets based on subscription tier.

    Usage:
        @require_tier('professional')
        def my_view(request):
            ...

    Tier hierarchy: free < starter < professional < enterprise
    """
    TIER_ORDER = ['free', 'starter', 'professional', 'enterprise']

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            # Get company from user
            if not hasattr(request.user, 'company'):
                return Response({
                    'error': 'User must be associated with a company'
                }, status=status.HTTP_403_FORBIDDEN)

            company = request.user.company
            current_tier = company.subscription_tier

            # Check if user's tier meets minimum requirement
            try:
                current_index = TIER_ORDER.index(current_tier)
                required_index = TIER_ORDER.index(minimum_tier)
            except ValueError:
                return Response({
                    'error': 'Invalid subscription tier'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            if current_index < required_index:
                return Response({
                    'error': f'This feature requires {minimum_tier.title()} tier or higher',
                    'current_tier': current_tier,
                    'required_tier': minimum_tier,
                    'upgrade_url': f'/dashboard/settings/billing?upgrade_to={minimum_tier}',
                    'feature_locked': True,
                }, status=status.HTTP_402_PAYMENT_REQUIRED)

            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


def require_feature(feature_name):
    """
    Decorator to restrict access based on add-on features.

    Usage:
        @require_feature('analytics_pack')
        def settlement_analytics(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            company = request.user.company

            # Check if feature is included in tier
            tier_includes = {
                'analytics_pack': ['professional', 'enterprise'],
                'imagery_pack': ['enterprise'],
                'api_access': ['professional', 'enterprise'],
            }

            included_tiers = tier_includes.get(feature_name, [])

            # Check if tier includes feature
            if company.subscription_tier in included_tiers:
                return view_func(request, *args, **kwargs)

            # Check if they purchased the add-on
            feature_field = f'has_{feature_name}'
            if hasattr(company, feature_field) and getattr(company, feature_field):
                return view_func(request, *args, **kwargs)

            # Feature not available
            add_on_prices = {
                'analytics_pack': 25,
                'imagery_pack': 75,
                'api_access': 50,
            }

            return Response({
                'error': f'This feature requires the {feature_name.replace("_", " ").title()} add-on',
                'add_on_price': f'${add_on_prices.get(feature_name, 0)}/month',
                'included_in_tiers': included_tiers,
                'upgrade_url': f'/dashboard/settings/billing?add_on={feature_name}',
                'feature_locked': True,
            }, status=status.HTTP_402_PAYMENT_REQUIRED)

        return wrapper
    return decorator
```

---

## Step 2: Update Company Model for Add-Ons (15 mins)

Add to `backend/api/models/auth.py` in the `Company` class:

```python
class Company(models.Model):
    # ... existing fields ...

    # Add-on Features (new fields)
    has_analytics_pack = models.BooleanField(default=False, help_text="Settlement Intelligence analytics add-on")
    has_imagery_pack = models.BooleanField(default=False, help_text="Satellite/LiDAR imagery processing add-on")
    has_api_access = models.BooleanField(default=False, help_text="Premium API access add-on")

    # Usage Tracking (new fields)
    pdf_extractions_this_month = models.IntegerField(default=0)
    imagery_runs_this_month = models.IntegerField(default=0)
    api_calls_this_month = models.IntegerField(default=0)

    def get_pdf_limit(self):
        """Get monthly PDF extraction limit based on tier"""
        limits = {
            'free': 10,
            'starter': 100,
            'professional': 500,
            'enterprise': 999999,  # Unlimited
        }
        return limits.get(self.subscription_tier, 10)

    def can_extract_pdf(self):
        """Check if company can extract another PDF this month"""
        return self.pdf_extractions_this_month < self.get_pdf_limit()

    def increment_pdf_usage(self):
        """Increment PDF extraction counter"""
        self.pdf_extractions_this_month += 1
        self.save(update_fields=['pdf_extractions_this_month'])

    def get_imagery_limit(self):
        """Get monthly satellite imagery run limit based on tier"""
        base_limits = {
            'free': 0,
            'starter': 0,
            'professional': 10,
            'enterprise': 50,
        }
        base = base_limits.get(self.subscription_tier, 0)

        if self.has_imagery_pack:
            base += 25

        return base

    def can_run_imagery(self):
        """Check if company can run another imagery analysis this month"""
        return self.imagery_runs_this_month < self.get_imagery_limit()

    def increment_imagery_usage(self):
        """Increment imagery run counter"""
        self.imagery_runs_this_month += 1
        self.save(update_fields=['imagery_runs_this_month'])
```

Create migration:
```bash
cd backend
python manage.py makemigrations api
python manage.py migrate
```

---

## Step 3: Apply Tier Gating to Premium Features (4 hours)

### 3a. PrimusGFS Module (Professional tier)

Edit `backend/api/primusgfs_views.py`:

```python
from .decorators import require_tier

# Apply to ALL 14 PrimusGFS ViewSets
class PrimusGFSDocumentViewSet(viewsets.ModelViewSet):
    @require_tier('professional')
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @require_tier('professional')
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @require_tier('professional')
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @require_tier('professional')
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @require_tier('professional')
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)

# Repeat for:
# - InternalAuditViewSet
# - AuditFindingViewSet
# - CorrectiveActionViewSet
# - LandHistoryAssessmentViewSet
# - ApprovedSupplierViewSet
# - IncomingMaterialVerificationViewSet
# - MockRecallExerciseViewSet
# - FoodDefensePlanViewSet
# - SanitationLogViewSet
# - EquipmentCalibrationViewSet
# - PestControlProgramViewSet
# - PestControlLogViewSet
# - PreHarvestInspectionViewSet
```

### 3b. Settlement Intelligence (Analytics Pack)

Edit `backend/api/packinghouse_views.py`:

```python
from .decorators import require_feature

# Apply to 5 analytics views
@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('analytics_pack')
def commodity_roi_ranking(request):
    """Rank commodities by ROI to guide future planting decisions."""
    # ... existing code ...

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('analytics_pack')
def deduction_creep_analysis(request):
    """Identify deductions that have grown over time."""
    # ... existing code ...

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('analytics_pack')
def grade_size_price_trends(request):
    """Track price trends by grade/size to optimize harvest timing."""
    # ... existing code ...

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('analytics_pack')
def packinghouse_report_card(request):
    """Compare packinghouse performance metrics."""
    # ... existing code ...

@api_view(['GET'])
@permission_classes([IsAuthenticated])
@require_feature('analytics_pack')
def pack_percent_impact(request):
    """Show how pack% affects profitability."""
    # ... existing code ...
```

### 3c. Satellite/LiDAR Processing (Professional tier + Imagery Pack)

Edit `backend/api/imagery_views.py`:

```python
from .decorators import require_tier

class SatelliteImageViewSet(viewsets.ModelViewSet):
    @require_tier('professional')
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    @require_tier('professional')
    def process_tree_detection(self, request, pk=None):
        """Run ML-based tree detection on this image"""
        company = request.user.company

        # Check usage limit
        if not company.can_run_imagery():
            return Response({
                'error': 'Monthly imagery limit reached',
                'used': company.imagery_runs_this_month,
                'limit': company.get_imagery_limit(),
                'upgrade_message': 'Purchase Imagery Pack for $75/month (+25 runs)',
                'upgrade_url': '/dashboard/settings/billing?add_on=imagery_pack',
            }, status=status.HTTP_402_PAYMENT_REQUIRED)

        # Process imagery
        company.increment_imagery_usage()

        # ... existing tree detection code ...
```

Edit `backend/api/lidar_views.py` similarly.

---

## Step 4: Add PDF Metering (1 hour)

Find where PDF extraction happens (likely in `report_views.py` or similar):

```python
# Example: backend/api/report_views.py
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def extract_pdf_data(request):
    """Extract data from uploaded PDF using Anthropic Claude API"""
    company = request.user.company

    # Check PDF limit
    if not company.can_extract_pdf():
        return Response({
            'error': 'Monthly PDF extraction limit reached',
            'used': company.pdf_extractions_this_month,
            'limit': company.get_pdf_limit(),
            'upgrade_message': f'Upgrade to Professional for {company.get_pdf_limit_for_tier("professional")} extractions/month',
            'add_on_price': '$0.50 per additional PDF',
        }, status=status.HTTP_402_PAYMENT_REQUIRED)

    # Extract PDF
    company.increment_pdf_usage()

    # ... existing PDF extraction code using Anthropic Claude API ...

    return Response({
        'data': extracted_data,
        'usage': {
            'pdfs_used': company.pdf_extractions_this_month,
            'pdfs_remaining': company.get_pdf_limit() - company.pdf_extractions_this_month,
        }
    })

def get_pdf_limit_for_tier(tier):
    limits = {
        'free': 10,
        'starter': 100,
        'professional': 500,
        'enterprise': 999999,
    }
    return limits.get(tier, 10)
```

---

## Step 5: Create Monthly Usage Reset Cron Job (30 mins)

Create `backend/api/management/commands/reset_monthly_usage.py`:

```python
from django.core.management.base import BaseCommand
from api.models import Company

class Command(BaseCommand):
    help = 'Reset monthly usage counters (run on 1st of each month)'

    def handle(self, *args, **options):
        companies = Company.objects.all()

        for company in companies:
            company.pdf_extractions_this_month = 0
            company.imagery_runs_this_month = 0
            company.api_calls_this_month = 0
            company.save(update_fields=[
                'pdf_extractions_this_month',
                'imagery_runs_this_month',
                'api_calls_this_month',
            ])

        self.stdout.write(self.style.SUCCESS(f'Reset usage for {companies.count()} companies'))
```

Add to `settings.py` (if using Celery Beat):

```python
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    'reset-monthly-usage': {
        'task': 'api.tasks.reset_monthly_usage',
        'schedule': crontab(day_of_month='1', hour='0', minute='0'),
    },
}
```

Or use a Railway cron job:
```bash
# In Railway dashboard, add cron job:
# Schedule: 0 0 1 * *  (midnight on 1st of each month)
# Command: python manage.py reset_monthly_usage
```

---

## Step 6: Frontend - Upgrade Prompts (4 hours)

Create `frontend/src/components/common/UpgradePrompt.jsx`:

```jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

export const UpgradePrompt = ({
  requiredTier,
  currentTier,
  featureName,
  addOnName,
  addOnPrice,
  benefitMessage
}) => {
  const navigate = useNavigate();

  const tierColors = {
    starter: 'blue',
    professional: 'green',
    enterprise: 'purple',
  };

  const color = tierColors[requiredTier] || 'yellow';

  const handleUpgrade = () => {
    if (addOnName) {
      navigate(`/dashboard/settings/billing?add_on=${addOnName}`);
    } else {
      navigate(`/dashboard/settings/billing?upgrade_to=${requiredTier}`);
    }
  };

  return (
    <div className={`bg-${color}-50 border border-${color}-200 rounded-lg p-6 max-w-2xl mx-auto`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className={`h-6 w-6 text-${color}-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-lg font-semibold text-${color}-900`}>
            {addOnName ? `${featureName} Add-On Required` : `Upgrade to ${requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}`}
          </h3>

          <p className={`mt-2 text-sm text-${color}-700`}>
            {featureName} is available {addOnName ? `as an add-on for ${addOnPrice}/month` : `on ${requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)} plans and above`}.
          </p>

          {benefitMessage && (
            <p className={`mt-2 text-sm font-medium text-${color}-800`}>
              💡 {benefitMessage}
            </p>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleUpgrade}
              className={`bg-${color}-600 hover:bg-${color}-700 text-white px-4 py-2 rounded-md font-medium transition`}
            >
              {addOnName ? `Add ${addOnName.replace('_', ' ')} - ${addOnPrice}/mo` : `Upgrade Now`}
            </button>
            <button
              onClick={() => navigate('/dashboard/settings/billing')}
              className={`bg-white border border-${color}-300 text-${color}-700 px-4 py-2 rounded-md font-medium hover:bg-${color}-50 transition`}
            >
              View All Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Usage limit display component
export const UsageMeter = ({ used, limit, feature }) => {
  const percentage = (used / limit) * 100;
  const isNearLimit = percentage >= 80;
  const atLimit = used >= limit;

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{feature} Usage</span>
        <span className={`text-sm font-semibold ${atLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-gray-600'}`}>
          {used} / {limit === 999999 ? 'Unlimited' : limit}
        </span>
      </div>

      {limit !== 999999 && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              atLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}

      {atLimit && (
        <p className="mt-2 text-xs text-red-600">
          Limit reached. Upgrade your plan for more usage.
        </p>
      )}
    </div>
  );
};
```

---

## Step 7: Frontend - Catch 402 Errors and Show Upgrade Prompts (2 hours)

Update `frontend/src/services/api.js`:

```javascript
// Add response interceptor to handle 402 Payment Required errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 402 && error.response?.data?.feature_locked) {
      // Store the upgrade prompt data
      const upgradeData = {
        requiredTier: error.response.data.required_tier,
        currentTier: error.response.data.current_tier,
        featureName: error.response.data.error,
        upgradeUrl: error.response.data.upgrade_url,
        addOnPrice: error.response.data.add_on_price,
      };

      // Dispatch event to show upgrade modal
      window.dispatchEvent(new CustomEvent('showUpgradePrompt', { detail: upgradeData }));
    }

    return Promise.reject(error);
  }
);
```

Create `frontend/src/components/common/UpgradeModal.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { UpgradePrompt } from './UpgradePrompt';

export const UpgradeModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [upgradeData, setUpgradeData] = useState(null);

  useEffect(() => {
    const handleShowUpgrade = (event) => {
      setUpgradeData(event.detail);
      setIsOpen(true);
    };

    window.addEventListener('showUpgradePrompt', handleShowUpgrade);
    return () => window.removeEventListener('showUpgradePrompt', handleShowUpgrade);
  }, []);

  if (!isOpen || !upgradeData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 relative">
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <UpgradePrompt {...upgradeData} />
      </div>
    </div>
  );
};
```

Add to `frontend/src/App.js`:

```jsx
import { UpgradeModal } from './components/common/UpgradeModal';

function App() {
  return (
    <div className="App">
      {/* Existing app content */}

      {/* Add upgrade modal at root level */}
      <UpgradeModal />
    </div>
  );
}
```

---

## Step 8: Update Company Settings Page to Show Tier & Usage (3 hours)

Edit `frontend/src/components/settings/CompanySettings.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { UsageMeter } from '../common/UpgradePrompt';
import api from '../../services/api';

export const CompanySettings = () => {
  const [companyStats, setCompanyStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanyStats();
  }, []);

  const fetchCompanyStats = async () => {
    try {
      const { data } = await api.get('/companies/stats/');
      setCompanyStats(data);
    } catch (error) {
      console.error('Failed to fetch company stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const tierInfo = {
    free: {
      name: 'Free Trial',
      color: 'bg-gray-100 text-gray-700',
      price: '$0',
      features: ['3 farms', '5 users', 'Basic tracking', '10 PDFs/month']
    },
    starter: {
      name: 'Starter',
      color: 'bg-blue-100 text-blue-700',
      price: '$79/mo',
      features: ['5 farms', '10 users', 'FSMA compliance', '100 PDFs/month']
    },
    professional: {
      name: 'Professional',
      color: 'bg-green-100 text-green-700',
      price: '$149/mo',
      features: ['15 farms', '25 users', 'PrimusGFS', 'Analytics Pack', 'Unlimited PDFs', '10 imagery runs']
    },
    enterprise: {
      name: 'Enterprise',
      color: 'bg-purple-100 text-purple-700',
      price: 'Custom',
      features: ['Unlimited farms', 'Unlimited users', 'All features', 'API access', 'Priority support']
    }
  };

  if (loading) return <div>Loading...</div>;

  const currentTier = tierInfo[companyStats?.subscription_tier] || tierInfo.free;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Company Settings</h1>

      {/* Current Plan */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Current Plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${currentTier.color}`}>
              {currentTier.name}
            </span>
            <p className="mt-2 text-2xl font-bold text-gray-900">{currentTier.price}</p>
            <ul className="mt-2 space-y-1">
              {currentTier.features.map((feature, idx) => (
                <li key={idx} className="text-sm text-gray-600">✓ {feature}</li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => window.location.href = '/dashboard/settings/billing'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
          >
            Upgrade Plan
          </button>
        </div>
      </div>

      {/* Usage Meters */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Usage This Month</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UsageMeter
            used={companyStats?.pdf_extractions_this_month || 0}
            limit={companyStats?.pdf_limit || 10}
            feature="PDF Extractions"
          />

          {companyStats?.subscription_tier !== 'free' && companyStats?.subscription_tier !== 'starter' && (
            <UsageMeter
              used={companyStats?.imagery_runs_this_month || 0}
              limit={companyStats?.imagery_limit || 0}
              feature="Satellite Imagery"
            />
          )}
        </div>
      </div>

      {/* Farm & User Limits */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Account Limits</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Farms</span>
              <span className="text-sm font-semibold text-gray-600">
                {companyStats?.farms?.count} / {companyStats?.farms?.limit}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  companyStats?.farms?.at_limit ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ width: `${(companyStats?.farms?.count / companyStats?.farms?.limit) * 100}%` }}
              />
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Users</span>
              <span className="text-sm font-semibold text-gray-600">
                {companyStats?.users?.count} / {companyStats?.users?.limit}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  companyStats?.users?.at_limit ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ width: `${(companyStats?.users?.count / companyStats?.users?.limit) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## Step 9: Add Usage Stats to Company Stats Endpoint (1 hour)

Edit `backend/api/company_views.py`:

```python
@action(detail=False, methods=['get'])
def stats(self, request):
    """Get company statistics and usage limits"""
    company = request.user.company

    # ... existing farm/user count code ...

    return Response({
        'subscription_tier': company.subscription_tier,
        'farms': {
            'count': farm_count,
            'limit': company.max_farms,
            'remaining': company.max_farms - farm_count,
            'at_limit': farm_count >= company.max_farms,
        },
        'users': {
            'count': user_count,
            'limit': company.max_users,
            'remaining': company.max_users - user_count,
            'at_limit': user_count >= company.max_users,
        },
        # NEW: Usage tracking
        'pdf_extractions_this_month': company.pdf_extractions_this_month,
        'pdf_limit': company.get_pdf_limit(),
        'pdf_remaining': company.get_pdf_limit() - company.pdf_extractions_this_month,

        'imagery_runs_this_month': company.imagery_runs_this_month,
        'imagery_limit': company.get_imagery_limit(),
        'imagery_remaining': max(0, company.get_imagery_limit() - company.imagery_runs_this_month),

        # Add-ons
        'add_ons': {
            'analytics_pack': company.has_analytics_pack,
            'imagery_pack': company.has_imagery_pack,
            'api_access': company.has_api_access,
        },
    })
```

---

## Step 10: Test Everything (2 hours)

### Test Checklist:

1. **Tier Gating**:
   - [ ] Create test company with `free` tier
   - [ ] Try to access PrimusGFS module → should see 402 error
   - [ ] Try to access Settlement Intelligence → should see 402 error
   - [ ] Upgrade to `professional` tier (manually in admin)
   - [ ] Retry → should work

2. **PDF Metering**:
   - [ ] Set company to `starter` tier (100 PDF limit)
   - [ ] Extract 99 PDFs → should work
   - [ ] Extract 100th PDF → should work
   - [ ] Extract 101st PDF → should see 402 error
   - [ ] Run `python manage.py reset_monthly_usage`
   - [ ] Verify counter reset to 0

3. **Analytics Pack**:
   - [ ] Access Settlement Intelligence with `starter` tier → 402 error
   - [ ] Set `has_analytics_pack = True` in admin
   - [ ] Retry → should work
   - [ ] Upgrade to `professional` → should work (included)

4. **Frontend Upgrade Prompts**:
   - [ ] Trigger 402 error from API
   - [ ] Verify modal appears
   - [ ] Click "Upgrade Now" → redirects to billing page
   - [ ] Click "View All Plans" → redirects to billing page

5. **Company Settings Page**:
   - [ ] Load settings page
   - [ ] Verify current tier badge shows correctly
   - [ ] Verify usage meters show correct data
   - [ ] Verify farm/user limits display correctly

---

## Step 11: Deploy (1 hour)

```bash
# 1. Commit changes
git add .
git commit -m "Add tiered pricing and feature gating

- Implement @require_tier and @require_feature decorators
- Gate PrimusGFS module (Professional tier)
- Gate Settlement Intelligence (Analytics Pack)
- Add PDF extraction metering
- Add satellite imagery usage limits
- Create upgrade prompts and modals
- Update Company Settings UI with usage meters

Expected revenue impact: +110-190% MRR"

# 2. Push to Railway
git push origin main

# 3. Run migrations on Railway
# (Railway auto-deploys and runs migrations)

# 4. Verify in production
# - Check that existing users can still access their features
# - Check that new users see upgrade prompts
```

---

## Step 12: Update Existing Customers (Email Campaign)

**Subject**: New Features + Plan Updates for [Company Name]

**Send Date**: 7 days after deployment (grace period)

**Email Template**: See `MONETIZATION_RECOMMENDATIONS.md` Section 9

**Action Items**:
1. Export all company emails from database
2. Segment by current tier (most are probably on legacy $50/mo plan)
3. Send migration email with:
   - New tier placement (Starter at $79/mo)
   - List of new features they're getting
   - Upgrade option to Professional for $149/mo
   - 20% grandfathered discount if upgraded by deadline
4. Set `subscription_tier = 'starter'` for all existing customers in 30 days

---

## Expected Results

After implementing these changes:

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Average MRR per customer | $50 | $105-145 | +110-190% |
| Free tier conversion | N/A | 30% to Starter | New funnel |
| Starter → Professional | N/A | 20-30% | New upsell |
| Add-on purchases | N/A | 15-25% | New revenue |
| Total MRR (50 customers) | $2,500 | $5,250-7,250 | +110-190% |

**12-Month Projection**:
- Month 1-3: Existing customers migrate, +110% MRR
- Month 4-6: New features drive upgrades, +150% MRR
- Month 7-12: Self-serve growth via Stripe, +190% MRR

---

## Troubleshooting

### Issue: Decorator not working
**Fix**: Ensure `decorators.py` is imported in views file:
```python
from .decorators import require_tier, require_feature
```

### Issue: Migration fails
**Fix**: Check for existing fields with same name:
```bash
python manage.py showmigrations api
python manage.py migrate api --fake 0064  # Skip if needed
```

### Issue: Frontend not catching 402 errors
**Fix**: Verify axios interceptor is loaded before any API calls in `index.js`

### Issue: Usage meters not updating
**Fix**: Ensure `save(update_fields=[...])` is called in increment methods

---

## Next Steps

Once these Quick Wins are live:

1. **Week 3-4**: Implement Stripe integration (see `MONETIZATION_RECOMMENDATIONS.md` Section 2.1)
2. **Week 5-6**: Build Billing page with tier comparison
3. **Month 2**: Launch self-serve signups (remove "invitation-only")
4. **Month 3**: Add API access tier for Enterprise customers
5. **Month 4+**: White-label SaaS for B2B partners

---

**Questions?** Review the full monetization roadmap in `MONETIZATION_RECOMMENDATIONS.md` for detailed implementation guides for each feature.

**Need help?** Let me know which step you're stuck on, and I can provide more detailed code examples.
