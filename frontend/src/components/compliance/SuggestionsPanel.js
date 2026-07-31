import React, { useState, useEffect, useCallback } from 'react';
import { Lightbulb, ChevronDown, ChevronUp, X } from 'lucide-react';
import api from '../../services/api';

const PRIORITY_STYLES = {
  high: {
    card: 'bg-danger-bg border-danger/25',
    dot: 'bg-danger',
    label: 'text-danger',
    button: 'text-danger hover:underline',
  },
  medium: {
    card: 'bg-yellow-100 border-yellow-200',
    dot: 'bg-yellow-500',
    label: 'text-yellow-800',
    button: 'text-yellow-700 hover:underline',
  },
  low: {
    card: 'bg-orange-50 border-orange-200',
    dot: 'bg-orange-400',
    label: 'text-orange-700',
    button: 'text-link hover:underline',
  },
};

export default function SuggestionsPanel({ onNavigate }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(new Set());

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await api.get('/compliance/dashboard/suggestions/');
      const list = Array.isArray(res.data) ? res.data : res.data.results || [];
      setSuggestions(list);
    } catch {
      // silently fail — suggestions are supplementary
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const visible = suggestions.filter((s) => !dismissed.has(s.key));

  if (loading || visible.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-cream-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-heading">
            Smart Suggestions
          </span>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-200 text-yellow-700 text-xs font-bold">
            {visible.length}
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronUp className="w-4 h-4 text-text-muted" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {visible.map((s) => {
            const styles = PRIORITY_STYLES[s.priority] || PRIORITY_STYLES.low;
            return (
              <div
                key={s.key}
                className={`flex items-start gap-3 p-3 rounded-lg border ${styles.card}`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${styles.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${styles.label}`}>{s.message}</p>
                  {s.action && s.action_key && (
                    <button
                      onClick={() => onNavigate(s.action_key)}
                      className={`text-xs mt-0.5 font-medium ${styles.button}`}
                    >
                      {s.action} →
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setDismissed((prev) => new Set([...prev, s.key]))}
                  className="flex-shrink-0 p-0.5 rounded text-text-muted hover:text-bark-600 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
