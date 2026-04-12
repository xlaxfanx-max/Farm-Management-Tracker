import React from 'react';
import { DollarSign, Wheat, Boxes } from 'lucide-react';
import HarvestAnalytics from '../HarvestAnalytics';
import ProfitabilityDashboard from '../ProfitabilityDashboard';
import { PackinghouseAnalytics } from '../packinghouse';

const HarvestAnalyticsTab = () => {
  return (
    <div className="space-y-6">
      {/* Profitability Dashboard - Primary Analytics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <DollarSign className="text-primary" size={20} />
          Profitability Analysis
        </h3>
        <ProfitabilityDashboard />
      </div>

      {/* Cost Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <Wheat className="text-orange-600" size={20} />
          Harvest Cost Analysis
        </h3>
        <HarvestAnalytics />
      </div>

      {/* Packinghouse Analytics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <Boxes className="text-primary" size={20} />
          Packinghouse Analytics
        </h3>
        <PackinghouseAnalytics />
      </div>
    </div>
  );
};

export default HarvestAnalyticsTab;
