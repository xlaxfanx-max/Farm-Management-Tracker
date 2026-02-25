import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Circle,
  MinusCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  FileText,
  Database,
  Edit3,
  File,
  BookOpen,
} from 'lucide-react';
import { primusGFSAPI } from '../../../services/api';
import SectionDetail from './SectionDetail';

// Section group display order and icons
const SECTION_GROUPS = [
  { key: 'management', label: 'Food Safety Management System', icon: BookOpen },
  { key: 'field_sanitation', label: 'Field Sanitation & Hygiene', icon: FileText },
  { key: 'agricultural_inputs', label: 'Agricultural Inputs', icon: Database },
  { key: 'worker_health', label: 'Worker Health, Hygiene & Training', icon: FileText },
  { key: 'training', label: 'Training', icon: Edit3 },
  { key: 'audit_checklists', label: 'Audit Checklists', icon: FileText },
  { key: 'risk_assessment', label: 'Risk Assessment', icon: AlertCircle },
];

const BinderOverview = ({ binderId, onBack }) => {
  const [binder, setBinder] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [selectedSection, setSelectedSection] = useState(null);

  const loadBinder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [binderRes, readinessRes] = await Promise.all([
        primusGFSAPI.getAuditBinder(binderId),
        primusGFSAPI.getBinderReadiness(binderId),
      ]);
      setBinder(binderRes.data);
      setReadiness(readinessRes.data);
      // Expand all groups by default
      const expanded = {};
      SECTION_GROUPS.forEach(g => { expanded[g.key] = true; });
      setExpandedGroups(expanded);
    } catch (err) {
      console.error('Error loading binder:', err);
      setError('Failed to load binder details.');
    } finally {
      setLoading(false);
    }
  }, [binderId]);

  useEffect(() => {
    loadBinder();
  }, [loadBinder]);

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'not_applicable':
        return <MinusCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <Circle className="w-4 h-4 text-gray-300" />;
    }
  };

  const getDocTypeLabel = (docType) => {
    const labels = {
      auto_fill: 'Auto-Fill',
      partial_fill: 'Partial Fill',
      sop: 'SOP',
      blank_template: 'Template',
      reference: 'Reference',
    };
    return labels[docType] || docType;
  };

  const getDocTypeBadge = (docType) => {
    const styles = {
      auto_fill: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      partial_fill: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
      sop: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      blank_template: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
      reference: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    };
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${styles[docType] || styles.blank_template}`}>
        {getDocTypeLabel(docType)}
      </span>
    );
  };

  // If a section is selected, show SectionDetail
  if (selectedSection) {
    return (
      <SectionDetail
        sectionId={selectedSection.id}
        onBack={() => {
          setSelectedSection(null);
          loadBinder();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Back to binders
        </button>
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      </div>
    );
  }

  if (!binder) return null;

  const overall = readiness?.overall || binder.completion_stats || {};
  const groups = readiness?.groups || {};
  const sections = binder.sections || [];

  // Group sections by section_group
  const sectionsByGroup = {};
  sections.forEach(s => {
    if (!sectionsByGroup[s.section_group]) sectionsByGroup[s.section_group] = [];
    sectionsByGroup[s.section_group].push(s);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to binders
          </button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {binder.name}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {binder.template_name} v{binder.template_version}
            {binder.farm_name && ` - ${binder.farm_name}`}
            {' - '}{binder.season_year}
          </p>
        </div>
        <button
          onClick={loadBinder}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Overall Readiness */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Audit Readiness
        </h3>
        <div className="flex items-center gap-6">
          {/* Big percentage */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${
              overall.percent === 100 ? 'text-primary' :
              overall.percent >= 50 ? 'text-blue-600' : 'text-amber-600'
            }`}>
              {overall.percent || 0}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Complete</div>
          </div>

          {/* Progress bar */}
          <div className="flex-1">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
              <div
                className={`h-3 rounded-full transition-all ${
                  overall.percent === 100 ? 'bg-green-500' :
                  overall.percent >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                }`}
                style={{ width: `${overall.percent || 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                {overall.complete || 0} Complete
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-500" />
                {overall.in_progress || 0} In Progress
              </span>
              <span className="flex items-center gap-1">
                <Circle className="w-3 h-3 text-gray-300" />
                {overall.not_started || 0} Not Started
              </span>
              <span className="flex items-center gap-1">
                <MinusCircle className="w-3 h-3 text-gray-400" />
                {overall.not_applicable || 0} N/A
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section Groups */}
      <div className="space-y-3">
        {SECTION_GROUPS.map(group => {
          const groupSections = sectionsByGroup[group.key] || [];
          if (groupSections.length === 0) return null;
          const groupStats = groups[group.key] || {};
          const isExpanded = expandedGroups[group.key];
          const GroupIcon = group.icon;

          return (
            <div
              key={group.key}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.key)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <GroupIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {group.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {groupStats.total > 0 && (
                    <>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {groupStats.complete || 0}/{groupStats.total - (groupStats.not_applicable || 0)}
                      </span>
                      <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${
                            groupStats.percent === 100 ? 'bg-green-500' :
                            groupStats.percent > 0 ? 'bg-blue-500' : 'bg-gray-300'
                          }`}
                          style={{ width: `${groupStats.percent || 0}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </button>

              {/* Section List */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  {groupSections.map(section => (
                    <button
                      key={section.id}
                      onClick={() => setSelectedSection(section)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-b-0"
                    >
                      {getStatusIcon(section.status)}
                      <span className="text-sm text-gray-500 dark:text-gray-400 w-8 text-right">
                        {String(section.doc_number).padStart(2, '0')}
                      </span>
                      <span className="flex-1 text-left text-sm text-gray-800 dark:text-gray-200">
                        {section.title}
                      </span>
                      {getDocTypeBadge(section.doc_type)}
                      {section.supporting_doc_count > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <File className="w-3 h-3" />
                          {section.supporting_doc_count}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BinderOverview;
