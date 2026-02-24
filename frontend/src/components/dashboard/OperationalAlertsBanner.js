import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileSignature,
  Droplet,
  Wheat,
  Leaf,
  X,
  Bug,
  MapPin
} from 'lucide-react';

/**
 * Aggregated alerts banner showing critical items from all modules
 */
function OperationalAlertsBanner({
  applications = [],
  applicationEvents = [],
  waterSources = [],
  waterTests = [],
  harvests = [],
  nutrients = [],
  diseaseAlerts = [],
  onAlertClick,
  onDismiss
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Collect all alerts from different modules
  const alerts = [];

  // Pending signatures (high priority)
  const pendingSignatures = applications.filter(a => a.status === 'pending_signature');
  if (pendingSignatures.length > 0) {
    alerts.push({
      id: 'pending-signatures',
      type: 'warning',
      icon: FileSignature,
      title: `${pendingSignatures.length} application${pendingSignatures.length > 1 ? 's' : ''} pending signature`,
      module: 'applications',
      count: pendingSignatures.length,
      priority: 'high'
    });
  }

  // Applications ready for PUR submission (legacy)
  const readyForPur = applications.filter(a => a.status === 'complete' && !a.submitted_to_pur);
  if (readyForPur.length > 0) {
    alerts.push({
      id: 'ready-for-pur',
      type: 'info',
      icon: FileSignature,
      title: `${readyForPur.length} application${readyForPur.length > 1 ? 's' : ''} ready for PUR submission`,
      module: 'reports',
      count: readyForPur.length,
      priority: 'medium'
    });
  }

  // Draft application events (new PUR system) needing review/submission
  const draftEvents = applicationEvents.filter(e => e.pur_status === 'draft');
  if (draftEvents.length > 0) {
    alerts.push({
      id: 'draft-application-events',
      type: 'info',
      icon: FileSignature,
      title: `${draftEvents.length} application event${draftEvents.length > 1 ? 's' : ''} in draft status`,
      module: 'reports',
      count: draftEvents.length,
      priority: 'medium'
    });
  }

  // Overdue water tests (check last_test_date and test_frequency)
  const now = new Date();
  const overdueWaterSources = waterSources.filter(ws => {
    if (!ws.active || !ws.test_frequency || !ws.last_test_date) return false;
    const lastTest = new Date(ws.last_test_date);
    const daysSinceTest = Math.floor((now - lastTest) / (1000 * 60 * 60 * 24));
    return daysSinceTest > ws.test_frequency;
  });

  if (overdueWaterSources.length > 0) {
    alerts.push({
      id: 'overdue-water-tests',
      type: 'warning',
      icon: Droplet,
      title: `${overdueWaterSources.length} water source${overdueWaterSources.length > 1 ? 's' : ''} overdue for testing`,
      module: 'water',
      count: overdueWaterSources.length,
      priority: 'high'
    });
  }

  // Water tests due soon (within 7 days)
  const dueSoonWaterSources = waterSources.filter(ws => {
    if (!ws.active || !ws.test_frequency || !ws.last_test_date) return false;
    const lastTest = new Date(ws.last_test_date);
    const daysSinceTest = Math.floor((now - lastTest) / (1000 * 60 * 60 * 24));
    const daysRemaining = ws.test_frequency - daysSinceTest;
    return daysRemaining > 0 && daysRemaining <= 7;
  });

  if (dueSoonWaterSources.length > 0) {
    alerts.push({
      id: 'due-soon-water-tests',
      type: 'info',
      icon: Droplet,
      title: `${dueSoonWaterSources.length} water test${dueSoonWaterSources.length > 1 ? 's' : ''} due within 7 days`,
      module: 'water',
      count: dueSoonWaterSources.length,
      priority: 'low'
    });
  }

  // Disease alerts - Critical proximity alerts (HLB/ACP nearby)
  const criticalDiseaseAlerts = diseaseAlerts.filter(
    a => a.is_active && (a.priority === 'critical' || a.priority === 'high')
  );
  if (criticalDiseaseAlerts.length > 0) {
    const hlbCount = criticalDiseaseAlerts.filter(a => a.alert_type === 'proximity_hlb').length;
    const acpCount = criticalDiseaseAlerts.filter(a => a.alert_type === 'proximity_acp').length;
    const otherCount = criticalDiseaseAlerts.length - hlbCount - acpCount;

    let title = '';
    if (hlbCount > 0) title += `${hlbCount} HLB`;
    if (acpCount > 0) title += title ? `, ${acpCount} ACP` : `${acpCount} ACP`;
    if (otherCount > 0) title += title ? `, ${otherCount} other` : `${otherCount}`;
    title += ` disease alert${criticalDiseaseAlerts.length > 1 ? 's' : ''} nearby`;

    alerts.push({
      id: 'disease-alerts-critical',
      type: 'warning',
      icon: Bug,
      title: title,
      module: 'disease',
      count: criticalDiseaseAlerts.length,
      priority: 'high',
      data: criticalDiseaseAlerts
    });
  }

  // Health anomaly alerts (NDVI issues)
  const healthAlerts = diseaseAlerts.filter(
    a => a.is_active && (a.alert_type === 'ndvi_anomaly' || a.alert_type === 'tree_decline')
  );
  if (healthAlerts.length > 0) {
    alerts.push({
      id: 'disease-health-alerts',
      type: 'info',
      icon: Leaf,
      title: `${healthAlerts.length} field health alert${healthAlerts.length > 1 ? 's' : ''} detected`,
      module: 'disease',
      count: healthAlerts.length,
      priority: 'medium',
      data: healthAlerts
    });
  }

  // Sort alerts by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // If no alerts, show success state
  if (alerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
          <span className="text-green-600 text-lg">✓</span>
        </div>
        <div>
          <p className="text-sm font-medium text-green-800">All systems operational</p>
          <p className="text-xs text-green-600">No pending tasks or alerts</p>
        </div>
      </div>
    );
  }

  const highPriorityCount = alerts.filter(a => a.priority === 'high').length;

  return (
    <div className={`
      rounded-lg border overflow-hidden
      ${highPriorityCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}
    `}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center
            ${highPriorityCount > 0 ? 'bg-amber-100' : 'bg-blue-100'}
          `}>
            <AlertTriangle className={`w-4 h-4 ${highPriorityCount > 0 ? 'text-amber-600' : 'text-blue-600'}`} />
          </div>
          <div className="text-left">
            <p className={`text-sm font-medium ${highPriorityCount > 0 ? 'text-amber-800' : 'text-blue-800'}`}>
              {alerts.length} item{alerts.length > 1 ? 's' : ''} need{alerts.length === 1 ? 's' : ''} attention
            </p>
            {!isExpanded && (
              <p className={`text-xs ${highPriorityCount > 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                {alerts.slice(0, 2).map(a => a.title).join(' • ')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`
            px-2 py-0.5 rounded-full text-xs font-medium
            ${highPriorityCount > 0 ? 'bg-amber-200 text-amber-700' : 'bg-blue-200 text-blue-700'}
          `}>
            {alerts.length}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Alert List */}
      {isExpanded && (
        <div className="px-4 pb-3 space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => onAlertClick?.(alert.module, alert)}
              className={`
                flex items-center gap-3 p-2 rounded-lg cursor-pointer
                transition-colors
                ${alert.priority === 'high' ? 'bg-amber-100/50 hover:bg-amber-100' : ''}
                ${alert.priority === 'medium' ? 'bg-blue-100/50 hover:bg-blue-100' : ''}
                ${alert.priority === 'low' ? 'bg-gray-100/50 hover:bg-gray-100' : ''}
              `}
            >
              <alert.icon className={`
                w-4 h-4 flex-shrink-0
                ${alert.priority === 'high' ? 'text-amber-600' : ''}
                ${alert.priority === 'medium' ? 'text-blue-600' : ''}
                ${alert.priority === 'low' ? 'text-gray-500' : ''}
              `} />
              <span className="text-sm text-gray-700 flex-1">{alert.title}</span>
              <span className={`
                text-xs font-medium px-2 py-0.5 rounded
                ${alert.priority === 'high' ? 'bg-amber-200 text-amber-700' : ''}
                ${alert.priority === 'medium' ? 'bg-blue-200 text-blue-700' : ''}
                ${alert.priority === 'low' ? 'bg-gray-200 text-gray-600' : ''}
              `}>
                {alert.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OperationalAlertsBanner;
