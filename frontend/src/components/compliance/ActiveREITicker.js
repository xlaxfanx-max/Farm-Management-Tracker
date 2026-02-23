import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import api from '../../services/api';

function formatCountdown(seconds) {
  if (seconds <= 0) return 'Expired';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function timerColor(seconds) {
  if (seconds > 4 * 3600) return 'text-green-600 dark:text-green-400';
  if (seconds > 3600) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function REIRow({ entry, onMarkCleared }) {
  const [remaining, setRemaining] = useState(entry.time_remaining_seconds);
  const intervalRef = useRef(null);

  useEffect(() => {
    setRemaining(entry.time_remaining_seconds);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [entry.time_remaining_seconds]);

  const expired = remaining <= 0;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-amber-200 dark:border-amber-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {entry.field_name}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">{entry.product_name}</p>
      </div>
      <div className={`text-sm font-mono font-semibold flex-shrink-0 ${timerColor(remaining)}`}>
        {formatCountdown(remaining)}
      </div>
      {expired && (
        <button
          onClick={() => onMarkCleared(entry.id)}
          className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
        >
          Mark Cleared
        </button>
      )}
    </div>
  );
}

export default function ActiveREITicker() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/compliance/rei-postings/active/');
      setEntries(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch {
      // silently fail — REI banner is supplementary
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleMarkCleared = useCallback(async (id) => {
    try {
      await api.post(`/compliance/rei-postings/${id}/mark_removed/`);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // ignore
    }
  }, []);

  if (loading || dismissed || entries.length === 0) return null;

  return (
    <div className="w-full bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-amber-100 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-700">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Active REI Intervals — Keep workers out of treated areas
          </span>
          <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 text-white text-xs font-bold">
            {entries.length}
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
          title="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-4 divide-y divide-amber-100 dark:divide-amber-800/50">
        {entries.map((entry) => (
          <REIRow key={entry.id} entry={entry} onMarkCleared={handleMarkCleared} />
        ))}
      </div>
    </div>
  );
}
