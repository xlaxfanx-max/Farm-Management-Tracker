import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Clock,
  Calendar,
  FileText,
  Award,
  Users,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';

const ICON_MAP = {
  FileText,
  Award,
  Users,
  Calendar,
  Clock,
  AlertTriangle,
};

function CategoryIcon({ category }) {
  switch (category) {
    case 'reporting': return <FileText className="w-4 h-4" />;
    case 'testing':   return <Award className="w-4 h-4" />;
    case 'training':  return <Users className="w-4 h-4" />;
    case 'licensing': return <Award className="w-4 h-4" />;
    default:          return <Calendar className="w-4 h-4" />;
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 bg-sand-200 rounded-lg" />
      ))}
    </div>
  );
}

function SectionHeader({ label, colorClass }) {
  return (
    <p className={`text-xs font-bold tracking-widest uppercase px-1 mb-2 ${colorClass}`}>
      {label}
    </p>
  );
}

function ActionItem({ item, onNavigate, urgency }) {
  const borderColor =
    urgency === 'overdue'
      ? 'border-danger/40'
      : urgency === 'today'
      ? 'border-yellow-300'
      : 'border-orange-200';

  const buttonColor =
    urgency === 'overdue'
      ? 'bg-danger hover:bg-danger-hover text-white'
      : 'bg-orange-500 hover:bg-orange-600 text-white';

  return (
    <div
      className={`flex items-center gap-3 p-3 bg-surface-raised rounded-card border ${borderColor} shadow-sm`}
    >
      <div className="flex-shrink-0 text-text-secondary">
        <CategoryIcon category={item.category} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-heading truncate">
          {item.title}
        </p>
        <p className="text-xs text-text-secondary">
          {urgency === 'overdue'
            ? `${item.days_overdue} day${item.days_overdue !== 1 ? 's' : ''} overdue`
            : `Due ${item.due_date}`}
        </p>
      </div>
      {item.url_key && (
        <button
          onClick={() => onNavigate(item.url_key)}
          className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${buttonColor}`}
        >
          {urgency === 'overdue' ? 'Fix' : 'View'}
        </button>
      )}
    </div>
  );
}

function QuickWinChip({ win, onNavigate }) {
  const IconComponent = ICON_MAP[win.icon] || FileText;
  const chipColor =
    win.priority === 'high'
      ? 'bg-danger-bg border-danger/25 text-danger hover:bg-danger-bg'
      : 'bg-yellow-100 border-yellow-200 text-yellow-700 hover:bg-yellow-200';

  return (
    <button
      onClick={() => onNavigate(win.url_key)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${chipColor}`}
    >
      <IconComponent className="w-3.5 h-3.5" />
      {win.action}
      <ChevronRight className="w-3 h-3 opacity-60" />
    </button>
  );
}

export default function TodayActionList({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.get('/compliance/dashboard/today/');
      setData(res.data);
    } catch {
      setError("Could not load today's actions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="bg-surface-raised rounded-card border border-border p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-40 bg-sand-200 rounded animate-pulse" />
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface-raised rounded-card border border-danger/25 p-4 shadow-sm">
        <p className="text-sm text-danger">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  if (data.all_clear) {
    return (
      <div className="bg-primary-light rounded-card border border-green-200 p-6 flex items-center gap-4 shadow-sm">
        <CheckCircle2 className="w-10 h-10 text-green-600 flex-shrink-0" />
        <div>
          <p className="font-semibold text-green-700 text-lg">
            All caught up for today!
          </p>
          <p className="text-sm text-primary">
            No overdue items, no deadlines today. Keep it up.
          </p>
        </div>
      </div>
    );
  }

  const hasOverdue =
    (data.overdue_deadlines && data.overdue_deadlines.length > 0) ||
    (data.expired_licenses && data.expired_licenses.length > 0);
  const hasToday = data.due_today && data.due_today.length > 0;
  const hasThisWeek =
    (data.due_this_week && data.due_this_week.length > 0) ||
    (data.expiring_training && data.expiring_training.length > 0);
  const hasQuickWins = data.quick_wins && data.quick_wins.length > 0;

  return (
    <div className="bg-surface-raised rounded-card border border-border p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base text-heading">
            Today's Actions
          </h2>
          <p className="text-xs text-text-secondary">{data.date}</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="p-1.5 rounded-lg text-text-muted hover:text-bark-600 hover:bg-cream-100 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {hasOverdue && (
        <div>
          <SectionHeader label="Overdue" colorClass="text-danger" />
          <div className="space-y-2">
            {(data.overdue_deadlines || []).map((item) => (
              <ActionItem key={`od-${item.id}`} item={item} onNavigate={onNavigate} urgency="overdue" />
            ))}
            {(data.expired_licenses || []).map((item) => (
              <ActionItem
                key={`el-${item.id}`}
                item={{
                  id: item.id,
                  title: `${item.license_type} License Expired — ${item.holder_name}`,
                  due_date: item.expiration_date,
                  category: 'licensing',
                  days_overdue: Math.floor(
                    (Date.now() - new Date(item.expiration_date).getTime()) / 86400000
                  ),
                  url_key: 'compliance-licenses',
                }}
                onNavigate={onNavigate}
                urgency="overdue"
              />
            ))}
          </div>
        </div>
      )}

      {hasToday && (
        <div>
          <SectionHeader label="Today" colorClass="text-yellow-600" />
          <div className="space-y-2">
            {data.due_today.map((item) => (
              <ActionItem key={`dt-${item.id}`} item={item} onNavigate={onNavigate} urgency="today" />
            ))}
          </div>
        </div>
      )}

      {hasThisWeek && (
        <div>
          <SectionHeader label="This Week" colorClass="text-link" />
          <div className="space-y-2">
            {(data.due_this_week || []).map((item) => (
              <ActionItem key={`dw-${item.id}`} item={item} onNavigate={onNavigate} urgency="week" />
            ))}
            {(data.expiring_training || []).map((item) => (
              <ActionItem
                key={`et-${item.id}`}
                item={{
                  id: item.id,
                  title: `${item.training_type.replace(/_/g, ' ')} expiring — ${item.worker_name}`,
                  due_date: item.expiration_date,
                  category: 'training',
                  url_key: 'compliance-wps',
                }}
                onNavigate={onNavigate}
                urgency="week"
              />
            ))}
          </div>
        </div>
      )}

      {hasQuickWins && (
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-text-muted px-1 mb-2">
            Quick Actions
          </p>
          <div className="flex flex-wrap gap-2">
            {data.quick_wins.map((win, idx) => (
              <QuickWinChip key={idx} win={win} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      )}

      {data.pending_pur_month && (
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-card">
          <FileText className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <p className="text-xs text-orange-700 flex-1">
            <span className="font-semibold">{data.pending_pur_month}</span> PUR report not yet submitted
          </p>
          <button
            onClick={() => onNavigate('compliance-reports')}
            className="text-xs font-semibold text-orange-700 hover:underline flex-shrink-0"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
