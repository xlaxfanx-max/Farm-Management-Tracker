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
        <div key={i} className="h-14 bg-gray-200 dark:bg-gray-700 rounded-lg" />
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
      ? 'border-red-300 dark:border-red-700'
      : urgency === 'today'
      ? 'border-amber-300 dark:border-amber-700'
      : 'border-blue-200 dark:border-blue-800';

  const buttonColor =
    urgency === 'overdue'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-orange-500 hover:bg-orange-600 text-white';

  return (
    <div
      className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border ${borderColor} shadow-sm`}
    >
      <div className="flex-shrink-0 text-gray-500 dark:text-gray-400">
        <CategoryIcon category={item.category} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {item.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {urgency === 'overdue'
            ? `${item.days_overdue} day${item.days_overdue !== 1 ? 's' : ''} overdue`
            : `Due ${item.due_date}`}
        </p>
      </div>
      {item.url_key && (
        <button
          onClick={() => onNavigate(item.url_key)}
          className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${buttonColor}`}
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
      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40'
      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40';

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
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-4 shadow-sm">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  if (data.all_clear) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-6 flex items-center gap-4 shadow-sm">
        <CheckCircle2 className="w-10 h-10 text-green-500 dark:text-green-400 flex-shrink-0" />
        <div>
          <p className="font-semibold text-green-800 dark:text-green-200 text-lg">
            All caught up for today!
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">
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
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Today's Actions
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{data.date}</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {hasOverdue && (
        <div>
          <SectionHeader label="Overdue" colorClass="text-red-600 dark:text-red-400" />
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
          <SectionHeader label="Today" colorClass="text-amber-600 dark:text-amber-400" />
          <div className="space-y-2">
            {data.due_today.map((item) => (
              <ActionItem key={`dt-${item.id}`} item={item} onNavigate={onNavigate} urgency="today" />
            ))}
          </div>
        </div>
      )}

      {hasThisWeek && (
        <div>
          <SectionHeader label="This Week" colorClass="text-blue-600 dark:text-blue-400" />
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
          <p className="text-xs font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 px-1 mb-2">
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
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <FileText className="w-4 h-4 text-orange-500 dark:text-orange-400 flex-shrink-0" />
          <p className="text-xs text-orange-700 dark:text-orange-300 flex-1">
            <span className="font-semibold">{data.pending_pur_month}</span> PUR report not yet submitted
          </p>
          <button
            onClick={() => onNavigate('compliance-reports')}
            className="text-xs font-semibold text-orange-700 dark:text-orange-300 hover:underline flex-shrink-0"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
