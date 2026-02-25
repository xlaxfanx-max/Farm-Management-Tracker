// =============================================================================
// WATER MANAGEMENT - REDESIGNED UNIFIED COMPONENT
// =============================================================================
// src/components/WaterManagement.js
// Modern, fluid design for Water Sources, Wells/SGMA, Irrigation, Quality Tests
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Droplets, Plus, Search, AlertTriangle, CheckCircle,
  Clock, ChevronDown, ChevronRight, MapPin, Gauge, Calendar,
  Edit, Trash2, Eye, FileText, RefreshCw, ArrowLeft, Droplet,
  AlertCircle, Building2, ClipboardList, BarChart3, Sprout,
  Activity, TrendingUp, Waves, ThermometerSun, CloudRain,
  Filter, MoreHorizontal, ArrowUpRight, Zap
} from 'lucide-react';
import api, { irrigationDashboardAPI } from '../services/api';
import { useData } from '../contexts/DataContext';
import { useModal } from '../contexts/ModalContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useToast } from '../contexts/ToastContext';
import IrrigationDashboard from './IrrigationDashboard';

// =============================================================================
// CONSTANTS
// =============================================================================

const GSA_NAMES = {
  'obgma': 'Ojai Basin GMA',
  'uwcd': 'United Water Conservation District',
  'fpbgsa': 'Fillmore & Piru Basins GSA',
  'uvrga': 'Upper Ventura River GA',
  'fcgma': 'Fox Canyon GMA',
  'other': 'Other',
  'none': 'None'
};

const BASIN_NAMES = {
  'ojai_valley': 'Ojai Valley',
  'fillmore': 'Fillmore',
  'piru': 'Piru',
  'upper_ventura_river': 'Upper Ventura River',
  'santa_paula': 'Santa Paula',
  'other': 'Other'
};

const SOURCE_TYPE_LABELS = {
  'well': 'Well',
  'municipal': 'Municipal/Public',
  'surface': 'Surface Water',
  'recycled': 'Recycled Water',
  'other': 'Other'
};

const SOURCE_TYPE_COLORS = {
  'well': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'municipal': 'bg-blue-100 text-blue-700 border-blue-200',
  'surface': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'recycled': 'bg-purple-100 text-purple-700 border-purple-200',
  'other': 'bg-gray-100 text-gray-700 border-gray-200'
};

const STATUS_COLORS = {
  'active': 'bg-green-100 text-green-800',
  'inactive': 'bg-gray-100 text-gray-800',
  'standby': 'bg-yellow-100 text-yellow-800',
  'destroyed': 'bg-red-100 text-red-800',
  'monitoring': 'bg-blue-100 text-blue-800'
};

const TEST_STATUS_CONFIG = {
  'pending': { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  'pass': { label: 'Pass', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  'fail': { label: 'Fail', color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle },
};

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

const MetricCard = ({ title, value, subtitle, icon: Icon, trend, color = 'blue', onClick }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    cyan: 'from-cyan-500 to-cyan-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
  };

  return (
    <div
      className={`relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-all ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs ${trend > 0 ? 'text-primary' : 'text-red-600'}`}>
              <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
              <span>{Math.abs(trend)}% vs last month</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${colorClasses[color]} opacity-60`} />
    </div>
  );
};

const AlertBanner = ({ type, title, message, action, onAction }) => {
  const config = {
    error: { bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800', icon: AlertTriangle, iconColor: 'text-red-500 dark:text-red-400', textColor: 'text-red-800 dark:text-red-200' },
    warning: { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-800', icon: AlertCircle, iconColor: 'text-amber-500 dark:text-amber-400', textColor: 'text-amber-800 dark:text-amber-200' },
    info: { bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', icon: Activity, iconColor: 'text-blue-500 dark:text-blue-400', textColor: 'text-blue-800 dark:text-blue-200' },
    success: { bg: 'bg-primary-light dark:bg-green-900/30', border: 'border-green-200 dark:border-green-800', icon: CheckCircle, iconColor: 'text-green-500 dark:text-green-400', textColor: 'text-green-800 dark:text-green-200' },
  };

  const { bg, border, icon: Icon, iconColor, textColor } = config[type] || config.info;

  return (
    <div className={`${bg} ${border} border rounded-xl p-4 flex items-start gap-3`}>
      <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${textColor}`}>{title}</p>
        {message && <p className={`text-sm ${textColor} opacity-80 mt-0.5`}>{message}</p>}
      </div>
      {action && (
        <button
          onClick={onAction}
          className={`text-sm font-medium ${textColor} hover:underline flex items-center gap-1`}
        >
          {action}
          <ArrowUpRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

const QuickActionButton = ({ icon: Icon, label, onClick, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    cyan: 'bg-cyan-600 hover:bg-cyan-700',
    green: 'bg-primary hover:bg-primary-hover',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 ${colorClasses[color]} text-white rounded-lg text-sm font-medium transition-colors shadow-sm`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
};

// =============================================================================
// WELL USAGE CHART COMPONENTS
// =============================================================================

const aggregateByYear = (readings) => {
  const yearMap = {};
  readings.forEach(r => {
    const year = new Date(r.reading_date).getFullYear();
    if (!yearMap[year]) yearMap[year] = 0;
    yearMap[year] += parseFloat(r.extraction_acre_feet) || 0;
  });
  return Object.entries(yearMap)
    .map(([year, total]) => ({ year: parseInt(year), total: Math.round(total * 10000) / 10000 }))
    .sort((a, b) => a.year - b.year);
};

const selectLabelIndices = (length, maxLabels) => {
  if (length <= maxLabels) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (maxLabels - 1);
  return Array.from({ length: maxLabels }, (_, i) => Math.round(i * step));
};

const shortDate = (dateStr) => {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
};

const formatAF = (val) => {
  const n = parseFloat(val);
  if (n >= 100) return n.toFixed(1);
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
};

const ExtractionLineChart = ({ readings }) => {
  const chartWidth = 600;
  const chartHeight = 160;
  const pad = { top: 15, right: 20, bottom: 28, left: 55 };
  const plotW = chartWidth - pad.left - pad.right;
  const plotH = chartHeight - pad.top - pad.bottom;

  const values = readings.map(r => parseFloat(r.extraction_acre_feet) || 0);
  const maxVal = Math.max(...values, 0.001);

  const points = readings.map((r, i) => {
    const x = pad.left + (readings.length === 1 ? plotW / 2 : (i / (readings.length - 1)) * plotW);
    const y = pad.top + plotH - (values[i] / maxVal) * plotH;
    return { x, y, reading: r, val: values[i] };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const yTicks = [0, maxVal / 2, maxVal];
  const xLabels = selectLabelIndices(readings.length, 6);

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" style={{ maxHeight: '200px' }}>
      {yTicks.map((val, i) => {
        const y = pad.top + plotH - (val / maxVal) * plotH;
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={chartWidth - pad.right} y2={y}
              stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4,4" />
            <text x={pad.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#9ca3af">
              {formatAF(val)} AF
            </text>
          </g>
        );
      })}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH}
        stroke="#e5e7eb" strokeWidth="1" />
      {points.length > 1 && (
        <polygon
          points={`${points[0].x},${pad.top + plotH} ${polyline} ${points[points.length - 1].x},${pad.top + plotH}`}
          fill="#0891b2" fillOpacity="0.06"
        />
      )}
      {points.length > 1 && (
        <polyline points={polyline} fill="none"
          stroke="#0891b2" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5"
          fill="#0891b2" stroke="white" strokeWidth="2" className="cursor-pointer">
          <title>{`${new Date(p.reading.reading_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}: ${formatAF(p.val)} AF`}</title>
        </circle>
      ))}
      {xLabels.map(i => (
        <text key={i} x={points[i].x} y={chartHeight - 4}
          textAnchor="middle" fontSize="9" fill="#9ca3af">
          {shortDate(readings[i].reading_date)}
        </text>
      ))}
    </svg>
  );
};

const AnnualBarChart = ({ readings }) => {
  const yearData = aggregateByYear(readings);
  if (yearData.length === 0) return null;

  const maxVal = Math.max(...yearData.map(d => d.total), 0.001);
  const barHeight = 140;

  return (
    <div className="flex items-end gap-3" style={{ height: `${barHeight + 30}px` }}>
      <div className="flex flex-col justify-between text-right pr-1" style={{ height: `${barHeight}px`, minWidth: '45px' }}>
        <span className="text-xs text-gray-400">{formatAF(maxVal)}</span>
        <span className="text-xs text-gray-400">{formatAF(maxVal / 2)}</span>
        <span className="text-xs text-gray-400">0</span>
      </div>
      <div className="flex-1 flex items-end gap-2 relative" style={{ height: `${barHeight + 24}px` }}>
        <div className="absolute left-0 right-0 top-0 border-t border-dashed border-gray-200" style={{ height: '1px' }} />
        <div className="absolute left-0 right-0 border-t border-dashed border-gray-200" style={{ top: `${barHeight / 2}px`, height: '1px' }} />
        <div className="absolute left-0 right-0 border-t border-gray-200" style={{ top: `${barHeight}px`, height: '1px' }} />
        {yearData.map((item) => {
          const pct = (item.total / maxVal) * barHeight;
          return (
            <div key={item.year} className="flex-1 flex flex-col items-center justify-end" style={{ height: `${barHeight + 24}px`, maxWidth: '80px' }}>
              <span className="text-xs text-cyan-700 font-medium mb-1">{formatAF(item.total)}</span>
              <div
                className="w-full bg-cyan-500 rounded-t-md hover:bg-cyan-400 transition-colors cursor-pointer"
                style={{ height: `${Math.max(pct, 3)}px` }}
                title={`${item.year}: ${formatAF(item.total)} AF`}
              />
              <span className="text-xs text-gray-500 mt-1.5 font-medium">{item.year}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const WellUsageChart = ({ readings }) => {
  const [chartMode, setChartMode] = useState('line');

  const validReadings = (readings || [])
    .filter(r => r.extraction_acre_feet != null && parseFloat(r.extraction_acre_feet) > 0)
    .sort((a, b) => new Date(a.reading_date) - new Date(b.reading_date));

  if (validReadings.length === 0) return null;

  return (
    <div className="mt-6 mb-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          Extraction History
        </h4>
        <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-0.5">
          <button
            onClick={() => setChartMode('line')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              chartMode === 'line'
                ? 'bg-white dark:bg-gray-600 text-cyan-700 dark:text-cyan-300 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Per Reading
          </button>
          <button
            onClick={() => setChartMode('bar')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              chartMode === 'bar'
                ? 'bg-white dark:bg-gray-600 text-cyan-700 dark:text-cyan-300 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Annual Total
          </button>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        {chartMode === 'line' ? (
          <ExtractionLineChart readings={validReadings} />
        ) : (
          <AnnualBarChart readings={validReadings} />
        )}
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const WaterManagement = () => {
  const { farms, fields, waterSources: initialWaterSources, loadData } = useData();
  const {
    openWaterSourceModal,
    openWaterTestModal,
    openWellModal,
    openWellReadingModal,
    openWellSourceModal,
    openBatchReadingModal
  } = useModal();
  const confirm = useConfirm();
  const toast = useToast();

  // Active tab state
  const [activeTab, setActiveTab] = useState('overview');

  // Data state
  const [waterSources, setWaterSources] = useState(initialWaterSources || []);
  const [wells, setWells] = useState([]);
  const [waterTests, setWaterTests] = useState([]);
  const [sgmaDashboard, setSgmaDashboard] = useState(null);
  const [irrigationData, setIrrigationData] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFarm, setFilterFarm] = useState('');
  const [filterGSA, setFilterGSA] = useState('');
  const [filterSourceType, setFilterSourceType] = useState('');
  const [expandedItems, setExpandedItems] = useState({});
  const [selectedSource, setSelectedSource] = useState(null);
  const [wellReadings, setWellReadings] = useState({});  // { wellId: [readings] }
  const [loadingReadings, setLoadingReadings] = useState({});
  const [deletingReading, setDeletingReading] = useState(null);

  // =============================================================================
  // DATA FETCHING
  // =============================================================================

  const fetchWaterSources = useCallback(async () => {
    try {
      const response = await api.get('/water-sources/');
      setWaterSources(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching water sources:', err);
    }
  }, []);

  const fetchWells = useCallback(async () => {
    try {
      const params = { source_type: 'well' };
      if (filterGSA) params.gsa = filterGSA;
      const response = await api.get('/water-sources/', { params });
      setWells(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching wells:', err);
    }
  }, [filterGSA]);

  const fetchWaterTests = useCallback(async () => {
    try {
      const params = {};
      if (selectedSource) params.water_source = selectedSource.id;
      const response = await api.get('/water-tests/', { params });
      setWaterTests(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching water tests:', err);
    }
  }, [selectedSource]);

  const fetchSGMADashboard = useCallback(async () => {
    try {
      const response = await api.get('/sgma/dashboard/');
      setSgmaDashboard(response.data);
    } catch (err) {
      console.error('Error fetching SGMA dashboard:', err);
    }
  }, []);

  const fetchIrrigationData = useCallback(async () => {
    try {
      const response = await irrigationDashboardAPI.get();
      setIrrigationData(response.data);
    } catch (err) {
      console.error('Error fetching irrigation data:', err);
    }
  }, []);

  const fetchWellReadings = useCallback(async (wellId) => {
    setLoadingReadings(prev => ({ ...prev, [wellId]: true }));
    try {
      const response = await api.get('/well-readings/', { params: { water_source: wellId } });
      const readings = response.data.results || response.data || [];
      setWellReadings(prev => ({ ...prev, [wellId]: readings }));
    } catch (err) {
      console.error('Error fetching well readings:', err);
    } finally {
      setLoadingReadings(prev => ({ ...prev, [wellId]: false }));
    }
  }, []);

  const deleteWellReading = useCallback(async (readingId, wellId) => {
    try {
      await api.delete(`/well-readings/${readingId}/`);
      // Refresh readings for this well and reload well data
      fetchWellReadings(wellId);
      fetchWells();
    } catch (err) {
      console.error('Error deleting reading:', err);
      toast.error('Failed to delete reading. Please try again.');
    } finally {
      setDeletingReading(null);
    }
  }, [fetchWellReadings, fetchWells]);

  // Load data based on active tab
  useEffect(() => {
    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        if (activeTab === 'overview') {
          await Promise.all([fetchWaterSources(), fetchWells(), fetchSGMADashboard(), fetchIrrigationData()]);
        } else if (activeTab === 'sources') {
          await fetchWaterSources();
        } else if (activeTab === 'wells') {
          await Promise.all([fetchWells(), fetchSGMADashboard()]);
        } else if (activeTab === 'tests') {
          await Promise.all([fetchWaterSources(), fetchWaterTests()]);
        } else if (activeTab === 'reports') {
          await fetchSGMADashboard();
        }
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab, fetchWaterSources, fetchWells, fetchWaterTests, fetchSGMADashboard, fetchIrrigationData]);

  const refreshExpandedReadings = useCallback(() => {
    // Refresh readings for any currently expanded wells
    Object.keys(expandedItems).forEach(wellId => {
      if (expandedItems[wellId]) {
        fetchWellReadings(parseInt(wellId));
      }
    });
  }, [expandedItems, fetchWellReadings]);

  // Sync with parent's waterSources prop and refresh expanded readings
  useEffect(() => {
    if (initialWaterSources) {
      setWaterSources(initialWaterSources);
      // Refresh readings for expanded wells when data reloads
      refreshExpandedReadings();
    }
  }, [initialWaterSources, refreshExpandedReadings]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleRefresh = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') await Promise.all([fetchWaterSources(), fetchWells(), fetchSGMADashboard(), fetchIrrigationData()]);
      else if (activeTab === 'sources') await fetchWaterSources();
      else if (activeTab === 'wells') await Promise.all([fetchWells(), fetchSGMADashboard()]);
      else if (activeTab === 'tests') await fetchWaterTests();
      else if (activeTab === 'reports') await fetchSGMADashboard();
      else if (activeTab === 'irrigation') await fetchIrrigationData();
      refreshExpandedReadings();
      loadData();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSource = async (sourceId) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this water source?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/water-sources/${sourceId}/`);
      handleRefresh();
    } catch (err) {
      toast.error('Failed to delete water source');
    }
  };

  const toggleExpanded = (id) => {
    const isExpanding = !expandedItems[id];
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
    // Fetch readings when expanding a well card
    if (isExpanding && !wellReadings[id]) {
      fetchWellReadings(id);
    }
  };

  // =============================================================================
  // FILTERED DATA
  // =============================================================================

  const filteredSources = waterSources.filter(source => {
    const matchesSearch = !searchTerm ||
      source.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      farms.find(f => f.id === source.farm)?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFarm = !filterFarm || source.farm === parseInt(filterFarm);
    const matchesType = !filterSourceType || source.source_type === filterSourceType;
    return matchesSearch && matchesFarm && matchesType;
  });

  const filteredWells = wells.filter(well => {
    const matchesSearch = !searchTerm ||
      well.well_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      well.water_source_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      well.farm_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGSA = !filterGSA || well.gsa === filterGSA;
    return matchesSearch && matchesGSA;
  });

  // =============================================================================
  // STATS CALCULATIONS
  // =============================================================================

  const sourceStats = {
    total: waterSources.length,
    wells: waterSources.filter(s => s.source_type === 'well').length,
    municipal: waterSources.filter(s => s.source_type === 'municipal').length,
    surface: waterSources.filter(s => s.source_type === 'surface').length,
    active: waterSources.filter(s => s.active).length,
  };

  const wellStats = sgmaDashboard ? {
    total: sgmaDashboard.total_wells,
    active: sgmaDashboard.active_wells,
    calibrationDue: (sgmaDashboard.calibrations_due_soon || 0) + (sgmaDashboard.calibrations_overdue || 0),
    ytdExtraction: sgmaDashboard.ytd_extraction_af,
    allocationUsed: sgmaDashboard.percent_allocation_used,
    allocationRemaining: sgmaDashboard.allocation_remaining_af
  } : {
    total: wells.length,
    active: wells.filter(w => w.status === 'active').length,
    calibrationDue: wells.filter(w => w.calibration_due_soon).length,
    ytdExtraction: wells.reduce((sum, w) => sum + (w.ytd_extraction_af || 0), 0),
    allocationUsed: 0,
    allocationRemaining: 0
  };

  // =============================================================================
  // TAB DEFINITIONS
  // =============================================================================

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'sources', label: 'Water Sources', icon: Droplet, count: sourceStats.total },
    { id: 'wells', label: 'Wells & SGMA', icon: Gauge, count: wellStats.total },
    { id: 'irrigation', label: 'Irrigation', icon: Sprout },
    { id: 'tests', label: 'Quality Tests', icon: ClipboardList },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const formatNumber = (num, decimals = 1) => {
    if (num === null || num === undefined) return '-';
    return Number(num).toFixed(decimals);
  };

  // =============================================================================
  // RENDER: OVERVIEW TAB
  // =============================================================================

  const renderOverviewTab = () => {
    const alerts = [];

    // Irrigation alerts (priority)
    const zonesNeedingIrrigation = irrigationData?.zones_needing_irrigation || 0;
    const zonesIrrigationSoon = irrigationData?.zones_irrigation_soon || 0;

    if (zonesNeedingIrrigation > 0) {
      alerts.push({
        type: 'error',
        title: `${zonesNeedingIrrigation} zone${zonesNeedingIrrigation > 1 ? 's' : ''} need irrigation today`,
        message: 'Soil moisture has reached the management allowable depletion threshold',
        action: 'View Irrigation',
        onAction: () => setActiveTab('irrigation')
      });
    }

    if (zonesIrrigationSoon > 0) {
      alerts.push({
        type: 'warning',
        title: `${zonesIrrigationSoon} zone${zonesIrrigationSoon > 1 ? 's' : ''} need irrigation soon`,
        message: 'Plan irrigation within the next 2 days',
        action: 'View Zones',
        onAction: () => setActiveTab('irrigation')
      });
    }

    // Check for calibration alerts
    if (wellStats.calibrationDue > 0) {
      alerts.push({
        type: 'warning',
        title: `${wellStats.calibrationDue} meter calibration${wellStats.calibrationDue > 1 ? 's' : ''} due`,
        message: 'Keep your flow meters calibrated for accurate SGMA reporting',
        action: 'View Wells',
        onAction: () => setActiveTab('wells')
      });
    }

    // Check for allocation usage
    if (wellStats.allocationUsed > 80) {
      alerts.push({
        type: wellStats.allocationUsed > 95 ? 'error' : 'warning',
        title: `${formatNumber(wellStats.allocationUsed)}% of water allocation used`,
        message: `${formatNumber(wellStats.allocationRemaining)} AF remaining this year`,
        action: 'View Reports',
        onAction: () => setActiveTab('reports')
      });
    }

    // Add SGMA alerts if available
    if (sgmaDashboard?.alerts) {
      sgmaDashboard.alerts.forEach(alert => {
        alerts.push({
          type: alert.type === 'error' ? 'error' : alert.type === 'warning' ? 'warning' : 'info',
          title: alert.message,
          message: alert.action
        });
      });
    }

    // Irrigation stats
    const irrigationStats = {
      totalZones: irrigationData?.active_zones || 0,
      totalAcres: irrigationData?.total_acres || 0,
      avgDepletion: irrigationData?.avg_depletion_pct || 0,
      recentEto: irrigationData?.recent_eto_total,
      recentRain: irrigationData?.recent_rainfall_total,
      pendingRecs: irrigationData?.pending_recommendations?.length || 0
    };

    // Zones needing attention
    const urgentZones = irrigationData?.zones_by_status?.needs_irrigation || [];
    const soonZones = irrigationData?.zones_by_status?.irrigation_soon || [];

    return (
      <div className="space-y-6">
        {/* Alerts Section */}
        {alerts.length > 0 && (
          <div className="space-y-3">
            {alerts.slice(0, 4).map((alert, idx) => (
              <AlertBanner key={idx} {...alert} />
            ))}
          </div>
        )}

        {/* IRRIGATION PRIORITY SECTION */}
        <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-teal-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                <Sprout className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Irrigation Status</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Real-time crop water needs based on ET data</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('irrigation')}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover shadow-sm transition-colors"
            >
              <span>Full Dashboard</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Irrigation Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-green-100 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Active Zones</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{irrigationStats.totalZones}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatNumber(irrigationStats.totalAcres)} acres</p>
            </div>

            <div className={`bg-white/80 backdrop-blur rounded-xl p-4 border ${zonesNeedingIrrigation > 0 ? 'border-red-200 bg-red-50/50' : 'border-green-100'}`}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className={`w-4 h-4 ${zonesNeedingIrrigation > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Need Water</span>
              </div>
              <p className={`text-2xl font-bold ${zonesNeedingIrrigation > 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>{zonesNeedingIrrigation}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Irrigate today</p>
            </div>

            <div className={`bg-white/80 backdrop-blur rounded-xl p-4 border ${zonesIrrigationSoon > 0 ? 'border-amber-200 bg-amber-50/50' : 'border-green-100'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Clock className={`w-4 h-4 ${zonesIrrigationSoon > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Soon</span>
              </div>
              <p className={`text-2xl font-bold ${zonesIrrigationSoon > 0 ? 'text-amber-600' : 'text-gray-900 dark:text-white'}`}>{zonesIrrigationSoon}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Within 2 days</p>
            </div>

            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-green-100 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <Gauge className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Depletion</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(irrigationStats.avgDepletion, 0)}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Soil moisture used</p>
            </div>

            {irrigationStats.recentEto !== null && irrigationStats.recentEto !== undefined && (
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-green-100 dark:border-green-800">
                <div className="flex items-center gap-2 mb-1">
                  <ThermometerSun className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">7-Day ETo</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(irrigationStats.recentEto, 2)}"</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Evapotranspiration</p>
              </div>
            )}

            {irrigationStats.recentRain !== null && irrigationStats.recentRain !== undefined && (
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur rounded-xl p-4 border border-green-100 dark:border-green-800">
                <div className="flex items-center gap-2 mb-1">
                  <CloudRain className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">7-Day Rain</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(irrigationStats.recentRain, 2)}"</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Precipitation</p>
              </div>
            )}
          </div>

          {/* Zones Needing Attention */}
          {(urgentZones.length > 0 || soonZones.length > 0) && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Zones Needing Attention</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {urgentZones.slice(0, 3).map(zone => (
                  <div key={zone.zone_id} className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded-full">Irrigate Now</span>
                        </div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">{zone.zone_name}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{zone.field_name} • {zone.crop_type}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatNumber(zone.depletion_pct, 0)}%</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">depleted</p>
                      </div>
                    </div>
                    {zone.recommended_depth_inches && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Recommended:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-200">{formatNumber(zone.recommended_depth_inches, 2)}" ({formatNumber(zone.recommended_duration_hours, 1)} hrs)</span>
                      </div>
                    )}
                  </div>
                ))}
                {soonZones.slice(0, 3 - urgentZones.slice(0, 3).length).map(zone => (
                  <div key={zone.zone_id} className="bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full">Soon</span>
                        </div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">{zone.zone_name}</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{zone.field_name} • {zone.crop_type}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatNumber(zone.depletion_pct, 0)}%</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">depleted</p>
                      </div>
                    </div>
                    {zone.days_until_irrigation !== null && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Irrigate in:</span>
                        <span className="font-medium text-amber-700">{zone.days_until_irrigation} day{zone.days_until_irrigation !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {(urgentZones.length + soonZones.length) > 3 && (
                <button
                  onClick={() => setActiveTab('irrigation')}
                  className="text-sm text-primary hover:text-primary-hover font-medium flex items-center gap-1"
                >
                  View all {urgentZones.length + soonZones.length} zones needing attention
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* No zones state */}
          {irrigationStats.totalZones === 0 && (
            <div className="text-center py-6">
              <Sprout className="w-10 h-10 text-green-300 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 mb-3">No irrigation zones configured yet</p>
              <button
                onClick={() => setActiveTab('irrigation')}
                className="text-primary hover:text-primary-hover font-medium text-sm"
              >
                Set up your first irrigation zone →
              </button>
            </div>
          )}
        </div>

        {/* Secondary Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Water Sources"
            value={sourceStats.total}
            subtitle={`${sourceStats.active} active`}
            icon={Droplets}
            color="blue"
            onClick={() => setActiveTab('sources')}
          />
          <MetricCard
            title="Wells"
            value={wellStats.total}
            subtitle={wellStats.calibrationDue > 0 ? `${wellStats.calibrationDue} need calibration` : 'All current'}
            icon={Gauge}
            color="cyan"
            onClick={() => setActiveTab('wells')}
          />
          <MetricCard
            title="YTD Extraction"
            value={`${formatNumber(wellStats.ytdExtraction)} AF`}
            subtitle={`${formatNumber(wellStats.allocationUsed)}% of allocation`}
            icon={TrendingUp}
            color={wellStats.allocationUsed > 80 ? 'red' : 'green'}
          />
          <MetricCard
            title="Allocation Left"
            value={`${formatNumber(wellStats.allocationRemaining)} AF`}
            subtitle="Remaining this year"
            icon={Waves}
            color="purple"
          />
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <QuickActionButton icon={Sprout} label="Record Irrigation" onClick={() => setActiveTab('irrigation')} color="green" />
            <QuickActionButton icon={Plus} label="Add Zone" onClick={() => setActiveTab('irrigation')} color="green" />
            <QuickActionButton icon={Plus} label="Add Well" onClick={() => openWellSourceModal()} color="cyan" />
            <QuickActionButton icon={Gauge} label="Batch Readings" onClick={() => {
              if (wells.length > 0) openBatchReadingModal(wells);
              else toast.info('Add wells first to record readings');
            }} color="cyan" />
            <QuickActionButton icon={Gauge} label="Single Reading" onClick={() => {
              if (wells.length > 0) openWellReadingModal(wells[0].id, wells[0].well_name);
              else toast.info('Add a well first to record readings');
            }} color="blue" />
            <QuickActionButton icon={FileText} label="Add Water Test" onClick={() => {
              if (waterSources.length > 0) openWaterTestModal(null, waterSources[0]);
              else toast.info('Add a water source first');
            }} color="blue" />
          </div>
        </div>

        {/* Bottom Section: Sources & SGMA */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Source Type Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Water Sources by Type</h3>
            <div className="space-y-3">
              {Object.entries(SOURCE_TYPE_LABELS).map(([type, label]) => {
                const count = waterSources.filter(s => s.source_type === type).length;
                const percentage = sourceStats.total > 0 ? (count / sourceStats.total) * 100 : 0;
                if (count === 0) return null;

                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{count}</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${type === 'well' ? 'bg-cyan-500' : type === 'municipal' ? 'bg-blue-500' : type === 'surface' ? 'bg-emerald-500' : 'bg-gray-400'}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setActiveTab('sources')}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View all sources
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* SGMA Compliance */}
          {sgmaDashboard && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">SGMA Compliance</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Allocation Usage</span>
                    <span className={`text-sm font-semibold ${wellStats.allocationUsed > 80 ? 'text-red-600' : 'text-primary'}`}>
                      {formatNumber(wellStats.allocationUsed)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${wellStats.allocationUsed > 95 ? 'bg-red-500' : wellStats.allocationUsed > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(wellStats.allocationUsed, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Water Year</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{sgmaDashboard.water_year}</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Current Period</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{sgmaDashboard.current_period}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>Next report: {formatDate(sgmaDashboard.next_report_due)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('reports')}
                className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                View full report
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // =============================================================================
  // RENDER: SOURCES TAB
  // =============================================================================

  const renderSourcesTab = () => (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search water sources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={filterFarm}
            onChange={(e) => setFilterFarm(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All Farms</option>
            {farms.map(farm => (
              <option key={farm.id} value={farm.id}>{farm.name}</option>
            ))}
          </select>
          <select
            value={filterSourceType}
            onChange={(e) => setFilterSourceType(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All Types</option>
            {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            className="p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sources Grid */}
      {filteredSources.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Droplet className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No water sources found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Get started by adding your first well or water source.</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => openWellSourceModal()}
              className="inline-flex items-center gap-2 bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700"
            >
              <Plus className="w-5 h-5" />
              Add Well
            </button>
            <button
              onClick={() => openWaterSourceModal()}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Other Source
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSources.map(source => {
            const farm = farms.find(f => f.id === source.farm);
            const isWell = source.source_type === 'well';

            return (
              <div
                key={source.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all overflow-hidden"
              >
                {/* Card Header */}
                <div className={`px-4 py-3 ${isWell ? 'bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-cyan-100' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${SOURCE_TYPE_COLORS[source.source_type]}`}>
                        {SOURCE_TYPE_LABELS[source.source_type]}
                      </span>
                    </div>
                    {source.active ? (
                      <div className="flex items-center gap-1 text-primary">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs font-medium">Active</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs font-medium">Inactive</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{source.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{farm?.name}</p>

                  {/* Usage Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {source.used_for_irrigation && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Irrigation</span>
                    )}
                    {source.used_for_washing && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Washing</span>
                    )}
                    {source.used_for_pesticide_mixing && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Pesticide</span>
                    )}
                  </div>

                  {/* Test Frequency */}
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <Clock className="w-4 h-4" />
                    <span>Tests every {source.test_frequency_days || 365} days</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => {
                        setSelectedSource(source);
                        setActiveTab('tests');
                      }}
                      className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      Tests
                    </button>
                    {isWell && (
                      <button
                        onClick={() => setActiveTab('wells')}
                        className="flex-1 px-3 py-2 text-sm font-medium text-cyan-600 bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-colors"
                      >
                        SGMA
                      </button>
                    )}
                    <button
                      onClick={() => isWell ? openWellSourceModal(source) : openWaterSourceModal(source)}
                      className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // =============================================================================
  // RENDER: WELLS TAB
  // =============================================================================

  const renderWellsTab = () => (
    <div className="space-y-6">
      {/* SGMA Summary Cards */}
      {sgmaDashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Total Wells"
            value={sgmaDashboard.total_wells}
            subtitle={`${sgmaDashboard.active_wells} active`}
            icon={Droplets}
            color="blue"
          />
          <MetricCard
            title="YTD Extraction"
            value={`${formatNumber(sgmaDashboard.ytd_extraction_af)} AF`}
            subtitle="Acre-feet this year"
            icon={Gauge}
            color="cyan"
          />
          <MetricCard
            title="Allocation Remaining"
            value={`${formatNumber(sgmaDashboard.allocation_remaining_af)} AF`}
            subtitle={`${formatNumber(100 - sgmaDashboard.percent_allocation_used)}% remaining`}
            icon={Waves}
            color={sgmaDashboard.percent_allocation_used > 80 ? 'red' : 'green'}
          />
          <MetricCard
            title="Calibration Due"
            value={(sgmaDashboard.calibrations_due_soon || 0) + (sgmaDashboard.calibrations_overdue || 0)}
            subtitle={sgmaDashboard.calibrations_overdue > 0 ? `${sgmaDashboard.calibrations_overdue} overdue` : 'All meters current'}
            icon={AlertTriangle}
            color={(sgmaDashboard.calibrations_overdue || 0) > 0 ? 'red' : 'yellow'}
          />
        </div>
      )}

      {/* Alerts */}
      {sgmaDashboard?.alerts?.length > 0 && (
        <div className="space-y-2">
          {sgmaDashboard.alerts.map((alert, idx) => (
            <AlertBanner
              key={idx}
              type={alert.type === 'error' ? 'error' : alert.type === 'warning' ? 'warning' : 'info'}
              title={alert.message}
              message={alert.action}
            />
          ))}
        </div>
      )}

      {/* Quick Actions Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search wells..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* GSA Filter */}
          <select
            value={filterGSA}
            onChange={(e) => setFilterGSA(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-cyan-500 bg-white dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All GSAs</option>
            {Object.entries(GSA_NAMES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {/* Batch Reading Button */}
          <button
            onClick={() => {
              if (filteredWells.length > 0) openBatchReadingModal(filteredWells);
              else toast.info('No wells available for batch reading');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-medium"
          >
            <Gauge className="w-5 h-5" />
            Batch Readings
          </button>

          {/* Refresh */}
          <button onClick={handleRefresh} className="p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Reading Status Summary */}
      {filteredWells.length > 0 && (() => {
        const now = new Date();
        const wellsNeedingReading = filteredWells.filter(w => {
          if (!w.latest_reading?.date) return true;
          const lastDate = new Date(w.latest_reading.date);
          const daysSince = Math.ceil((now - lastDate) / (1000 * 60 * 60 * 24));
          return daysSince > 30;
        });
        const wellsOverdue = filteredWells.filter(w => {
          if (!w.latest_reading?.date) return true;
          const lastDate = new Date(w.latest_reading.date);
          const daysSince = Math.ceil((now - lastDate) / (1000 * 60 * 60 * 24));
          return daysSince > 90;
        });

        if (wellsNeedingReading.length === 0) return null;

        return (
          <div className={`rounded-xl p-4 flex items-center justify-between ${
            wellsOverdue.length > 0 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            <div className="flex items-center gap-3">
              <Clock className={`w-5 h-5 ${wellsOverdue.length > 0 ? 'text-red-500' : 'text-amber-500'}`} />
              <div>
                <p className={`font-medium ${wellsOverdue.length > 0 ? 'text-red-800' : 'text-amber-800'}`}>
                  {wellsOverdue.length > 0
                    ? `${wellsOverdue.length} well${wellsOverdue.length > 1 ? 's' : ''} overdue for reading (90+ days)`
                    : `${wellsNeedingReading.length} well${wellsNeedingReading.length > 1 ? 's' : ''} due for reading (30+ days)`
                  }
                </p>
                <p className={`text-sm ${wellsOverdue.length > 0 ? 'text-red-600' : 'text-amber-600'}`}>
                  {wellsNeedingReading.map(w => w.well_name || w.name).slice(0, 3).join(', ')}
                  {wellsNeedingReading.length > 3 && ` +${wellsNeedingReading.length - 3} more`}
                </p>
              </div>
            </div>
            <button
              onClick={() => openBatchReadingModal(wellsNeedingReading)}
              className={`px-4 py-2 rounded-lg font-medium ${
                wellsOverdue.length > 0
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              Record Readings
            </button>
          </div>
        );
      })()}

      {/* Wells List */}
      {filteredWells.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Droplets className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No wells found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Add a well to track groundwater extraction and SGMA compliance.</p>
          <button
            onClick={() => openWellSourceModal()}
            className="inline-flex items-center gap-2 bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700"
          >
            <Plus className="w-5 h-5" />
            Add Well
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredWells.map(well => (
            <div key={well.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all">
              {/* Well Header */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => toggleExpanded(well.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${well.calibration_due_soon || !well.meter_calibration_current ? 'bg-amber-100' : 'bg-cyan-100'}`}>
                      <Droplets className={`w-6 h-6 ${well.calibration_due_soon || !well.meter_calibration_current ? 'text-amber-600' : 'text-cyan-600'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{well.well_name || well.water_source_name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{well.farm_name} • {GSA_NAMES[well.gsa] || well.gsa}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Reading Status Badge */}
                    {(() => {
                      if (!well.latest_reading?.date) {
                        return (
                          <span className="flex items-center gap-1.5 text-gray-600 text-xs bg-gray-100 px-2.5 py-1 rounded-full">
                            <AlertCircle className="w-3.5 h-3.5" />
                            No readings
                          </span>
                        );
                      }
                      const lastDate = new Date(well.latest_reading.date);
                      const daysSince = Math.ceil((new Date() - lastDate) / (1000 * 60 * 60 * 24));
                      if (daysSince > 90) {
                        return (
                          <span className="flex items-center gap-1.5 text-red-600 text-xs bg-red-50 px-2.5 py-1 rounded-full">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {daysSince}d ago
                          </span>
                        );
                      }
                      if (daysSince > 30) {
                        return (
                          <span className="flex items-center gap-1.5 text-amber-600 text-xs bg-amber-50 px-2.5 py-1 rounded-full">
                            <Clock className="w-3.5 h-3.5" />
                            {daysSince}d ago
                          </span>
                        );
                      }
                      return (
                        <span className="flex items-center gap-1.5 text-primary text-xs bg-primary-light px-2.5 py-1 rounded-full">
                          <CheckCircle className="w-3.5 h-3.5" />
                          {daysSince}d ago
                        </span>
                      );
                    })()}

                    {well.calibration_due_soon && (
                      <span className="flex items-center gap-1.5 text-amber-600 text-xs bg-amber-50 px-2.5 py-1 rounded-full">
                        <Zap className="w-3.5 h-3.5" />
                        Cal. Due
                      </span>
                    )}
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-gray-400">YTD Extraction</p>
                      <p className="font-semibold text-cyan-600 dark:text-cyan-400">{formatNumber(well.ytd_extraction_af, 2)} AF</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[well.status] || 'bg-gray-100'}`}>
                      {well.status}
                    </span>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openWellReadingModal(well.id, well.well_name)}
                        className="p-2 text-cyan-600 hover:bg-cyan-50 rounded-lg"
                        title="Add Reading"
                      >
                        <Gauge className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openWellSourceModal(well)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        title="Edit"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                    </div>
                    {expandedItems[well.id] ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedItems[well.id] && (
                <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-5">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Well Info</h4>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-gray-500 dark:text-gray-400">State Well #:</dt>
                          <dd className="text-gray-900 font-medium text-xs">{well.state_well_number || '-'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500 dark:text-gray-400">Basin:</dt>
                          <dd className="text-gray-900 dark:text-gray-200 font-medium">{BASIN_NAMES[well.basin] || well.basin || '-'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-500 dark:text-gray-400">Meter Units:</dt>
                          <dd className="text-gray-900 dark:text-gray-200 font-medium">{well.flowmeter_units || '-'}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Fee Rates</h4>
                      <dl className="space-y-2 text-sm">
                        {well.base_extraction_rate && (
                          <div className="flex justify-between">
                            <dt className="text-gray-500 dark:text-gray-400">Base Rate:</dt>
                            <dd className="text-gray-900 dark:text-gray-200 font-medium">${parseFloat(well.base_extraction_rate).toFixed(2)}/AF</dd>
                          </div>
                        )}
                        {well.gsp_rate && (
                          <div className="flex justify-between">
                            <dt className="text-gray-500 dark:text-gray-400">GSP Rate:</dt>
                            <dd className="text-gray-900 dark:text-gray-200 font-medium">${parseFloat(well.gsp_rate).toFixed(2)}/AF</dd>
                          </div>
                        )}
                        {well.domestic_rate && (
                          <div className="flex justify-between">
                            <dt className="text-gray-500 dark:text-gray-400">Domestic:</dt>
                            <dd className="text-gray-900 dark:text-gray-200 font-medium">${parseFloat(well.domestic_rate).toFixed(2)}/AF</dd>
                          </div>
                        )}
                        {well.fixed_quarterly_fee && (
                          <div className="flex justify-between">
                            <dt className="text-gray-500 dark:text-gray-400">Fixed/Qtr:</dt>
                            <dd className="text-gray-900 dark:text-gray-200 font-medium">${parseFloat(well.fixed_quarterly_fee).toFixed(2)}</dd>
                          </div>
                        )}
                        {!well.base_extraction_rate && !well.gsp_rate && !well.domestic_rate && (
                          <p className="text-gray-400 italic">No rates configured</p>
                        )}
                      </dl>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">YTD Costs</h4>
                      {well.ytd_extraction_af > 0 && (well.base_extraction_rate || well.gsp_rate) ? (
                        <dl className="space-y-2 text-sm">
                          {well.base_extraction_rate && (
                            <div className="flex justify-between">
                              <dt className="text-gray-500 dark:text-gray-400">Base Fee:</dt>
                              <dd className="text-primary font-medium">
                                ${(parseFloat(well.ytd_extraction_af || 0) * parseFloat(well.base_extraction_rate)).toFixed(2)}
                              </dd>
                            </div>
                          )}
                          {well.gsp_rate && (
                            <div className="flex justify-between">
                              <dt className="text-gray-500 dark:text-gray-400">GSP Fee:</dt>
                              <dd className="text-primary font-medium">
                                ${(parseFloat(well.ytd_extraction_af || 0) * parseFloat(well.gsp_rate)).toFixed(2)}
                              </dd>
                            </div>
                          )}
                          <div className="flex justify-between pt-1 border-t border-gray-200">
                            <dt className="text-gray-700 font-medium">Est. Total:</dt>
                            <dd className="text-primary font-bold">
                              ${(
                                (parseFloat(well.ytd_extraction_af || 0) * parseFloat(well.base_extraction_rate || 0)) +
                                (parseFloat(well.ytd_extraction_af || 0) * parseFloat(well.gsp_rate || 0))
                              ).toFixed(2)}
                            </dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No extraction or rates</p>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">Latest Reading</h4>
                      {well.latest_reading ? (
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-gray-500 dark:text-gray-400">Date:</dt>
                            <dd className="text-gray-900 dark:text-gray-200 font-medium">{formatDate(well.latest_reading.date)}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-gray-500 dark:text-gray-400">Reading:</dt>
                            <dd className="text-gray-900 dark:text-gray-200 font-medium">{well.latest_reading.meter_reading}</dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No readings recorded</p>
                      )}
                    </div>
                  </div>

                  {/* Extraction History Chart */}
                  {!loadingReadings[well.id] && (
                    <WellUsageChart readings={wellReadings[well.id]} />
                  )}

                  {/* Reading History */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Reading History</h4>
                      <button
                        onClick={() => openWellReadingModal(well.id, well.well_name)}
                        className="flex items-center gap-1.5 text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                      >
                        <Plus className="w-4 h-4" />
                        Add Reading
                      </button>
                    </div>

                    {loadingReadings[well.id] ? (
                      <div className="flex items-center justify-center py-6 text-gray-400">
                        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                        Loading readings...
                      </div>
                    ) : wellReadings[well.id]?.length > 0 ? (
                      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">
                              <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Meter Reading</th>
                              <th className="px-4 py-2.5 text-right font-semibold">Extraction (AF)</th>
                              <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                              <th className="px-4 py-2.5 text-left font-semibold">Recorded By</th>
                              <th className="px-4 py-2.5 text-center font-semibold">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {wellReadings[well.id].map((reading) => (
                              <tr key={reading.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <td className="px-4 py-2.5 text-gray-900 dark:text-gray-200">{formatDate(reading.reading_date)}</td>
                                <td className="px-4 py-2.5 text-right font-mono text-gray-900 dark:text-gray-200">{Number(reading.meter_reading).toLocaleString()}</td>
                                <td className="px-4 py-2.5 text-right text-cyan-700 dark:text-cyan-400 font-medium">
                                  {reading.extraction_acre_feet != null ? formatNumber(reading.extraction_acre_feet, 4) : '-'}
                                </td>
                                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{reading.reading_type_display || reading.reading_type}</td>
                                <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{reading.recorded_by || '-'}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => openWellReadingModal(well.id, well.well_name, reading)}
                                      className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                                      title="Edit Reading"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    {deletingReading === reading.id ? (
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => deleteWellReading(reading.id, well.id)}
                                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                        >
                                          Confirm
                                        </button>
                                        <button
                                          onClick={() => setDeletingReading(null)}
                                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setDeletingReading(reading.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete Reading"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-gray-400">
                        <Gauge className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No readings recorded for this well</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // =============================================================================
  // RENDER: TESTS TAB
  // =============================================================================

  const renderTestsTab = () => (
    <div className="space-y-6">
      {/* Source Selector */}
      {selectedSource ? (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedSource(null)}
                className="p-2 hover:bg-white rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-blue-600" />
              </button>
              <div>
                <h3 className="font-semibold text-blue-900">{selectedSource.name}</h3>
                <p className="text-sm text-blue-700">
                  {SOURCE_TYPE_LABELS[selectedSource.source_type]} • Tests every {selectedSource.test_frequency_days || 365} days
                </p>
              </div>
            </div>
            <button
              onClick={() => openWaterTestModal(null, selectedSource)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add Test
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Select a water source to view tests</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {waterSources.map(source => (
              <button
                key={source.id}
                onClick={() => setSelectedSource(source)}
                className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left"
              >
                <div className={`p-2 rounded-lg ${source.source_type === 'well' ? 'bg-cyan-100' : 'bg-blue-100'}`}>
                  <Droplet className={`w-4 h-4 ${source.source_type === 'well' ? 'text-cyan-600' : 'text-blue-600'}`} />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{source.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{SOURCE_TYPE_LABELS[source.source_type]}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tests List */}
      {selectedSource && (
        waterTests.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No test records</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Start tracking water quality by adding your first test result.</p>
            <button
              onClick={() => openWaterTestModal(null, selectedSource)}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-5 h-5" />
              Add First Test
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {waterTests.map(test => {
              const statusConfig = TEST_STATUS_CONFIG[test.status] || TEST_STATUS_CONFIG.pending;
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={test.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all cursor-pointer overflow-hidden"
                  onClick={() => openWaterTestModal(test)}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{formatDate(test.test_date)}</h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {test.test_type === 'microbial' ? 'Microbial' :
                           test.test_type === 'chemical' ? 'Chemical' : 'Microbial & Chemical'}
                        </span>
                      </div>
                      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {test.ecoli_result !== null && (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                          <p className="text-gray-500 dark:text-gray-400 text-xs">E. coli</p>
                          <p className="font-semibold text-gray-900 dark:text-white">{test.ecoli_result} CFU/100mL</p>
                        </div>
                      )}
                      {test.ph_level !== null && (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                          <p className="text-gray-500 dark:text-gray-400 text-xs">pH Level</p>
                          <p className="font-semibold text-gray-900 dark:text-white">{test.ph_level}</p>
                        </div>
                      )}
                    </div>

                    {test.status === 'fail' && test.corrective_actions && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                        <p className="font-medium text-red-800 text-xs uppercase tracking-wider mb-1">Corrective Actions</p>
                        <p className="text-red-700">{test.corrective_actions}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );

  // =============================================================================
  // RENDER: REPORTS TAB
  // =============================================================================

  const renderReportsTab = () => (
    <div className="space-y-6">
      {sgmaDashboard ? (
        <>
          {/* SGMA Overview */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">SGMA Compliance Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Water Year</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{sgmaDashboard.water_year}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Period</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{sgmaDashboard.current_period}</p>
              </div>
              <div className="text-center p-4 bg-cyan-50 rounded-xl">
                <p className="text-sm text-cyan-600 mb-1">YTD Extraction</p>
                <p className="text-2xl font-bold text-cyan-700">{formatNumber(sgmaDashboard.ytd_extraction_af, 2)} AF</p>
              </div>
              <div className={`text-center p-4 rounded-xl ${sgmaDashboard.percent_allocation_used > 80 ? 'bg-red-50' : 'bg-green-50'}`}>
                <p className={`text-sm mb-1 ${sgmaDashboard.percent_allocation_used > 80 ? 'text-red-600' : 'text-primary'}`}>Allocation Used</p>
                <p className={`text-2xl font-bold ${sgmaDashboard.percent_allocation_used > 80 ? 'text-red-700' : 'text-primary'}`}>
                  {formatNumber(sgmaDashboard.percent_allocation_used)}%
                </p>
              </div>
            </div>
          </div>

          {/* Allocation Progress & Cost Estimate */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Allocation Progress</h3>
              {/* Monthly Rate Indicator */}
              {sgmaDashboard.ytd_extraction_af > 0 && (() => {
                const now = new Date();
                const waterYearStart = now.getMonth() >= 9
                  ? new Date(now.getFullYear(), 9, 1)
                  : new Date(now.getFullYear() - 1, 9, 1);
                const monthsElapsed = Math.max(1, Math.ceil((now - waterYearStart) / (1000 * 60 * 60 * 24 * 30)));
                const monthlyRate = sgmaDashboard.ytd_extraction_af / monthsElapsed;
                const projectedTotal = monthlyRate * 12;
                const percentOfAllocation = sgmaDashboard.total_allocation_af > 0
                  ? (projectedTotal / sgmaDashboard.total_allocation_af) * 100
                  : 0;

                return (
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Monthly Avg</p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatNumber(monthlyRate, 1)} AF/mo</p>
                  </div>
                );
              })()}
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {formatNumber(sgmaDashboard.ytd_extraction_af, 2)} AF used of {formatNumber(sgmaDashboard.total_allocation_af, 2)} AF
                </span>
                <span className={`text-sm font-semibold ${sgmaDashboard.percent_allocation_used > 80 ? 'text-red-600' : 'text-primary'}`}>
                  {formatNumber(sgmaDashboard.allocation_remaining_af, 2)} AF remaining
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all ${
                    sgmaDashboard.percent_allocation_used > 95 ? 'bg-red-500' :
                    sgmaDashboard.percent_allocation_used > 80 ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(sgmaDashboard.percent_allocation_used, 100)}%` }}
                />
              </div>

              {/* Projected end-of-year usage indicator */}
              {sgmaDashboard.ytd_extraction_af > 0 && sgmaDashboard.total_allocation_af > 0 && (() => {
                const now = new Date();
                const waterYearStart = now.getMonth() >= 9
                  ? new Date(now.getFullYear(), 9, 1)
                  : new Date(now.getFullYear() - 1, 9, 1);
                const waterYearEnd = new Date(waterYearStart.getFullYear() + 1, 8, 30);
                const totalDays = (waterYearEnd - waterYearStart) / (1000 * 60 * 60 * 24);
                const daysElapsed = Math.max(1, (now - waterYearStart) / (1000 * 60 * 60 * 24));
                const projectedTotal = (sgmaDashboard.ytd_extraction_af / daysElapsed) * totalDays;
                const projectedPercent = (projectedTotal / sgmaDashboard.total_allocation_af) * 100;

                return (
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Projected Year-End Usage:</span>
                      <span className={`font-semibold ${projectedPercent > 100 ? 'text-red-600' : projectedPercent > 90 ? 'text-amber-600' : 'text-primary'}`}>
                        {formatNumber(projectedTotal, 1)} AF ({formatNumber(projectedPercent, 0)}%)
                      </span>
                    </div>
                    {projectedPercent > 100 && (
                      <p className="text-xs text-red-600 mt-1">
                        At current rate, you may exceed allocation by {formatNumber(projectedTotal - sgmaDashboard.total_allocation_af, 1)} AF
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Estimated Fees Summary */}
            {sgmaDashboard.wells_by_gsa?.length > 0 && (() => {
              let totalEstFees = 0;
              const feesByGSA = sgmaDashboard.wells_by_gsa.map(gsa => {
                // Use approximate GSA rates
                const rates = {
                  'obgma': { base: 25, gsp: 100 },
                  'uwcd': { base: 192.34, gsp: 0 },
                  'fpbgsa': { base: 75, gsp: 50 },
                  'default': { base: 100, gsp: 0 }
                };
                const gsaRates = rates[gsa.gsa?.toLowerCase()] || rates.default;
                const estFee = gsa.ytd_extraction * (gsaRates.base + gsaRates.gsp);
                totalEstFees += estFee;
                return { gsa: gsa.gsa, extraction: gsa.ytd_extraction, fee: estFee, rates: gsaRates };
              });

              if (totalEstFees === 0) return null;

              return (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Estimated YTD Fees</h4>
                  <div className="space-y-2">
                    {feesByGSA.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          {GSA_NAMES[item.gsa] || item.gsa} ({formatNumber(item.extraction, 1)} AF)
                        </span>
                        <span className="font-medium text-gray-900 dark:text-gray-200">${formatNumber(item.fee, 2)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100 dark:border-gray-700">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Total Estimated</span>
                      <span className="font-bold text-primary">${formatNumber(totalEstFees, 2)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    * Estimates based on default GSA rates. Actual fees may vary.
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Deadlines */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Upcoming Deadlines</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl">
                  <Calendar className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-blue-600">Next Report Due</p>
                    <p className="font-semibold text-blue-900">{formatDate(sgmaDashboard.next_report_due)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl">
                  <Gauge className="w-8 h-8 text-amber-600" />
                  <div>
                    <p className="text-sm text-amber-600">Next Calibration Due</p>
                    <p className="font-semibold text-amber-900">{formatDate(sgmaDashboard.next_calibration_due)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Wells by GSA */}
            {sgmaDashboard.wells_by_gsa?.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Wells by GSA</h3>
                <div className="space-y-3">
                  {sgmaDashboard.wells_by_gsa.map((gsa, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{GSA_NAMES[gsa.gsa] || gsa.gsa}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{gsa.active} active of {gsa.count} wells</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-cyan-600 dark:text-cyan-400">{formatNumber(gsa.ytd_extraction, 2)} AF</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">YTD</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No report data available</h3>
          <p className="text-gray-500 dark:text-gray-400">Add wells and meter readings to see SGMA compliance reports.</p>
        </div>
      )}
    </div>
  );

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Water Management</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Track water sources, wells, irrigation, and SGMA compliance</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => openWellSourceModal()}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Add Water Source
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 -mb-px flex space-x-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchTerm('');
                if (tab.id !== 'tests') setSelectedSource(null);
              }}
              className={`flex items-center gap-2 px-4 py-3 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gray-50 dark:bg-gray-900 text-blue-600 dark:text-blue-400 border-t border-l border-r border-gray-200 dark:border-gray-700'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <AlertBanner
            type="error"
            title="Failed to load data"
            message={error}
            action="Retry"
            onAction={handleRefresh}
          />
        )}

        {/* Tab Content */}
        {!loading && !error && (
          <>
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'sources' && renderSourcesTab()}
            {activeTab === 'wells' && renderWellsTab()}
            {activeTab === 'irrigation' && <IrrigationDashboard />}
            {activeTab === 'tests' && renderTestsTab()}
            {activeTab === 'reports' && renderReportsTab()}
          </>
        )}
      </div>
    </div>
  );
};

export default WaterManagement;
