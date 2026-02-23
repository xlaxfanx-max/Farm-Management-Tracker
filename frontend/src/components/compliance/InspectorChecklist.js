import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Shield,
  Download,
  ExternalLink,
} from 'lucide-react';
import api, { inspectorReportAPI } from '../../services/api';

function ChecklistItem({ item, onNavigate }) {
  return (
    <div className={`flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0`}>
      <div className="flex-shrink-0 mt-0.5">
        {item.is_passed ? (
          <CheckCircle2 className="w-5 h-5 text-green-500 dark:text-green-400" />
        ) : (
          <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</p>
        {item.detail && (
          <p className={`text-xs mt-0.5 ${item.is_passed ? 'text-gray-500 dark:text-gray-400' : 'text-red-600 dark:text-red-400'}`}>
            {item.detail}
          </p>
        )}
        {!item.is_passed && item.action_label && item.action_key && (
          <button
            onClick={() => onNavigate(item.action_key)}
            className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            {item.action_label} →
          </button>
        )}
      </div>
    </div>
  );
}

function SectionCard({ section, onNavigate }) {
  const [open, setOpen] = useState(true);
  const passed = section.items.filter((i) => i.is_passed).length;
  const total = section.items.length;
  const allGood = passed === total;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border shadow-sm overflow-hidden ${
      allGood ? 'border-green-200 dark:border-green-800' : 'border-gray-200 dark:border-gray-700'
    }`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{section.label}</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            allGood
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}>
            {passed}/{total}
          </span>
          {/* mini progress bar */}
          <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${allGood ? 'bg-green-500' : 'bg-red-400'}`}
              style={{ width: `${(passed / total) * 100}%` }}
            />
          </div>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-2">
          {section.items.map((item, idx) => (
            <ChecklistItem key={idx} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function InspectorChecklist({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/compliance/inspector-report/checklist/');
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const response = await inspectorReportAPI.downloadPDF();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inspector_report_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-green-600 animate-spin" />
      </div>
    );
  }

  const sections = data?.sections || [];
  const readinessPct = data?.readiness_pct || 0;
  const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);
  const passedItems = sections.reduce((s, sec) => s + sec.items.filter((i) => i.is_passed).length, 0);
  const gapCount = totalItems - passedItems;

  const ringColor = readinessPct >= 80 ? '#22c55e' : readinessPct >= 60 ? '#f59e0b' : '#ef4444';
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (readinessPct / 100) * circumference;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-green-100 dark:bg-green-900/40 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Inspector Readiness</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Review what an inspector would look for</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate?.('compliance')}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
            >
              <ExternalLink className="w-4 h-4" /> Hub
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
        {/* Score summary */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center gap-6">
            {/* Ring */}
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="10"
                  className="text-gray-200 dark:text-gray-700" />
                <circle cx="50" cy="50" r={radius} fill="none" stroke={ringColor} strokeWidth="10"
                  strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold leading-none" style={{ color: ringColor }}>{readinessPct}</span>
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>

            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                {readinessPct >= 80 ? 'Ready for Inspection' : readinessPct >= 60 ? 'Mostly Ready' : 'Needs Work Before Inspection'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {passedItems} of {totalItems} checks pass
                {gapCount > 0 && ` — ${gapCount} item${gapCount !== 1 ? 's' : ''} to fix`}
              </p>
              <button
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {downloading ? 'Generating PDF…' : 'Download Inspector Report'}
              </button>
            </div>
          </div>
        </div>

        {/* Sections */}
        {sections.map((section, idx) => (
          <SectionCard key={idx} section={section} onNavigate={onNavigate} />
        ))}

        {sections.length === 0 && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No checklist data available. Start adding compliance records to see your readiness score.</p>
          </div>
        )}
      </div>
    </div>
  );
}
