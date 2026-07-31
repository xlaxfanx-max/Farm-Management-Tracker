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

  // Sort alerts by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // If no alerts, show success state
  if (alerts.length === 0) {
    return (
      <div className="bg-primary-light border border-green-200 rounded-lg p-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
          <span className="text-primary text-lg">✓</span>
        </div>
        <div>
          <p className="text-sm font-medium text-green-700">All systems operational</p>
          <p className="text-xs text-primary">No pending tasks or alerts</p>
        </div>
      </div>
    );
  }

  const highPriorityCount = alerts.filter(a => a.priority === 'high').length;

  return (
    <div className={`
      rounded-lg border overflow-hidden
      ${highPriorityCount > 0 ? 'bg-yellow-100 border-yellow-200' : 'bg-orange-50 border-orange-200'}
    `}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center
            ${highPriorityCount > 0 ? 'bg-yellow-200' : 'bg-orange-100'}
          `}>
            <AlertTriangle className={`w-4 h-4 ${highPriorityCount > 0 ? 'text-yellow-600' : 'text-link'}`} />
          </div>
          <div className="text-left">
            <p className={`text-sm font-medium ${highPriorityCount > 0 ? 'text-yellow-800' : 'text-orange-700'}`}>
              {alerts.length} item{alerts.length > 1 ? 's' : ''} need{alerts.length === 1 ? 's' : ''} attention
            </p>
            {!isExpanded && (
              <p className={`text-xs ${highPriorityCount > 0 ? 'text-yellow-600' : 'text-link'}`}>
                {alerts.slice(0, 2).map(a => a.title).join(' • ')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`
            px-2 py-0.5 rounded-full text-xs font-medium
            ${highPriorityCount > 0 ? 'bg-yellow-200 text-yellow-700' : 'bg-orange-200 text-orange-700'}
          `}>
            {alerts.length}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-text-muted" />
          ) : (
            <ChevronDown className="w-5 h-5 text-text-muted" />
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
                ${alert.priority === 'high' ? 'bg-yellow-200/50 hover:bg-yellow-200' : ''}
                ${alert.priority === 'medium' ? 'bg-orange-100/50 hover:bg-orange-100' : ''}
                ${alert.priority === 'low' ? 'bg-cream-100/50 hover:bg-cream-100' : ''}
              `}
            >
              <alert.icon className={`
                w-4 h-4 flex-shrink-0
                ${alert.priority === 'high' ? 'text-yellow-600' : ''}
                ${alert.priority === 'medium' ? 'text-link' : ''}
                ${alert.priority === 'low' ? 'text-text-secondary' : ''}
              `} />
              <span className="text-sm text-bark-700 flex-1">{alert.title}</span>
              <span className={`
                text-xs font-medium px-2 py-0.5 rounded
                ${alert.priority === 'high' ? 'bg-yellow-200 text-yellow-700' : ''}
                ${alert.priority === 'medium' ? 'bg-orange-200 text-orange-700' : ''}
                ${alert.priority === 'low' ? 'bg-sand-200 text-bark-600' : ''}
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
