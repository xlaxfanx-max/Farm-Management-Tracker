// =============================================================================
// PIPELINE OVERVIEW COMPONENT
// Shows the packout → settlement flow for growers who receive packinghouse reports
//
// Two modes:
// 1. All Commodities (default) - Summary tiles + per-commodity cards
// 2. Specific Commodity - Season dropdown + pipeline flow + farm breakdown
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Package,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Clock,
  Layers,
  Calendar,
  BarChart3,
  TrendingUp,
  ChevronRight
} from 'lucide-react';
import { packinghouseAnalyticsAPI, packoutReportsAPI, poolSettlementsAPI } from '../../services/api';
import DrillDownModal from '../ui/DrillDownModal';

const PipelineOverview = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCommodity, setSelectedCommodity] = useState(null); // null = All Commodities
  const [selectedSeason, setSelectedSeason] = useState('');
  const [breakdownView, setBreakdownView] = useState(null); // null or 'farm'

  // Drill-down modal state
  const [drillDown, setDrillDown] = useState({ isOpen: false, title: '', subtitle: '', icon: null, columns: [], data: [], loading: false, error: null, summaryRow: null });

  const openDrillDown = async (type) => {
    const params = {};
    if (selectedCommodity) params.commodity = selectedCommodity;
    const season = selectedSeason || data?.selected_season;
    if (season) params.season = season;

    // Determine unit label for current context
    const currentCard = selectedCommodity && data?.commodity_cards
      ? data.commodity_cards.find(c => c.commodity === selectedCommodity)
      : null;
    const unitLabel = currentCard?.primary_unit_label || 'Bins';
    const isLbs = currentCard?.primary_unit === 'LBS';
    const qtyKey = isLbs ? 'total_weight_lbs' : 'total_bins';

    const configs = {
      packed_bins: {
        title: `Packed ${unitLabel} — Detail`,
        icon: Package,
        columns: [
          { key: 'report_date', label: 'Date', format: 'date' },
          { key: 'field_name', label: 'Field' },
          { key: 'pool_name', label: 'Pool' },
          { key: 'bins_this_period', label: `${unitLabel} (Period)`, align: 'right', format: 'number' },
          { key: 'bins_cumulative', label: 'Cumulative', align: 'right', format: 'number' },
          { key: 'total_packed_percent', label: 'Pack %', align: 'right', format: 'percent' },
          { key: 'house_avg_packed_percent', label: 'House Avg %', align: 'right', format: 'percent' },
        ],
        fetch: () => packoutReportsAPI.getAll({ ...params, ordering: '-report_date' }),
        extractData: (res) => res.data.results || res.data || [],
        summaryKey: 'bins_this_period',
      },
      settled: {
        title: 'Settlements — Detail',
        icon: DollarSign,
        columns: [
          { key: 'pool_name', label: 'Pool' },
          { key: 'field_name', label: 'Field' },
          { key: 'primary_quantity', label: unitLabel, align: 'right', format: 'number' },
          { key: 'total_credits', label: 'Credits', align: 'right', format: 'currency' },
          { key: 'total_deductions', label: 'Deductions', align: 'right', format: 'currency' },
          { key: 'net_return', label: 'Net Return', align: 'right', format: 'currency' },
        ],
        fetch: () => poolSettlementsAPI.getAll({ ...params, ordering: '-created_at' }),
        extractData: (res) => res.data.results || res.data || [],
        summaryKey: 'net_return',
      },
      total_revenue: {
        title: 'Total Revenue — Detail',
        icon: DollarSign,
        columns: [
          { key: 'pool_name', label: 'Pool' },
          { key: 'field_name', label: 'Field' },
          { key: 'primary_quantity', label: unitLabel, align: 'right', format: 'number' },
          { key: 'total_credits', label: 'Revenue', align: 'right', format: 'currency' },
          { key: 'net_return', label: 'Net Return', align: 'right', format: 'currency' },
        ],
        fetch: () => poolSettlementsAPI.getAll({ ...params, ordering: '-created_at' }),
        extractData: (res) => res.data.results || res.data || [],
        summaryKey: 'total_credits',
      },
      bins_packed_all: {
        title: 'All Quantity Packed — Detail',
        icon: Package,
        columns: [
          { key: 'report_date', label: 'Date', format: 'date' },
          { key: 'field_name', label: 'Field' },
          { key: 'pool_name', label: 'Pool' },
          { key: 'bins_this_period', label: 'Qty (Period)', align: 'right', format: 'number' },
          { key: 'bins_cumulative', label: 'Cumulative', align: 'right', format: 'number' },
          { key: 'total_packed_percent', label: 'Pack %', align: 'right', format: 'percent' },
        ],
        fetch: () => packoutReportsAPI.getAll({ ordering: '-report_date' }),
        extractData: (res) => res.data.results || res.data || [],
        summaryKey: 'bins_this_period',
      },
      bins_settled_all: {
        title: 'All Settled — Detail',
        icon: TrendingUp,
        columns: [
          { key: 'pool_name', label: 'Pool' },
          { key: 'field_name', label: 'Field' },
          { key: 'primary_quantity', label: 'Quantity', align: 'right', format: 'number' },
          { key: 'net_return', label: 'Net Return', align: 'right', format: 'currency' },
        ],
        fetch: () => poolSettlementsAPI.getAll({ ordering: '-created_at' }),
        extractData: (res) => res.data.results || res.data || [],
        summaryKey: 'primary_quantity',
      },
    };

    const config = configs[type];
    if (!config) return;

    setDrillDown({
      isOpen: true,
      title: config.title,
      subtitle: '',
      icon: config.icon,
      columns: config.columns,
      data: [],
      loading: true,
      error: null,
      summaryRow: null,
    });

    try {
      const response = await config.fetch();
      const records = config.extractData(response);
      const summaryRow = config.summaryKey
        ? { [config.columns[0].key]: 'Total', [config.summaryKey]: records.reduce((sum, r) => sum + (Number(r[config.summaryKey]) || 0), 0) }
        : null;
      setDrillDown(prev => ({
        ...prev,
        data: records,
        loading: false,
        subtitle: `${records.length} ${records.length === 1 ? 'record' : 'records'}`,
        summaryRow,
      }));
    } catch (err) {
      console.error('Drill-down fetch error:', err);
      setDrillDown(prev => ({ ...prev, loading: false, error: 'Failed to load records' }));
    }
  };

  const closeDrillDown = () => setDrillDown(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    fetchPipelineData();
  }, [selectedCommodity, selectedSeason, breakdownView]);

  const fetchPipelineData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (selectedCommodity) {
        params.commodity = selectedCommodity;
        if (selectedSeason) params.season = selectedSeason;
        if (breakdownView) params.breakdown = breakdownView;
      }
      const response = await packinghouseAnalyticsAPI.getPipeline(params);
      setData(response.data);
      // Auto-set season from response if in commodity mode and not already set
      if (selectedCommodity && !selectedSeason && response.data.selected_season) {
        setSelectedSeason(response.data.selected_season);
      }
    } catch (err) {
      console.error('Error fetching pipeline data:', err);
      setError('Failed to load pipeline data');
    } finally {
      setLoading(false);
    }
  };

  const handleCommoditySelect = (commodity) => {
    setSelectedCommodity(commodity);
    setSelectedSeason(''); // Reset season when switching commodity
    setBreakdownView(null); // Reset breakdown
  };

  const handleBackToAll = () => {
    setSelectedCommodity(null);
    setSelectedSeason('');
    setBreakdownView(null);
  };

  const handleSeasonChange = (e) => {
    setSelectedSeason(e.target.value);
  };

  const formatNumber = (value, decimals = 0) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'packout': return <Package className="w-4 h-4 text-purple-600" />;
      case 'settlement': return <DollarSign className="w-4 h-4 text-green-600" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActivityBgColor = (type) => {
    switch (type) {
      case 'packout': return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
      case 'settlement': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      default: return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  // Get a color accent for commodity cards based on crop category
  const getCommodityColor = (cropCategory) => {
    switch (cropCategory) {
      case 'citrus': return { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300', accent: 'text-orange-600', badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200' };
      case 'subtropical': return { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', accent: 'text-emerald-600', badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200' };
      case 'nut': return { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', accent: 'text-amber-600', badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200' };
      case 'vine': return { bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-800', text: 'text-violet-700 dark:text-violet-300', accent: 'text-violet-600', badge: 'bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200' };
      default: return { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', accent: 'text-blue-600', badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200' };
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <AlertCircle className="inline w-5 h-5 mr-2" />
        {error}
        <button
          onClick={fetchPipelineData}
          className="ml-4 text-red-800 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  // Drill-Down Modal (shared across both modes)
  const drillDownModal = (
    <DrillDownModal
      isOpen={drillDown.isOpen}
      onClose={closeDrillDown}
      title={drillDown.title}
      subtitle={drillDown.subtitle}
      icon={drillDown.icon}
      columns={drillDown.columns}
      data={drillDown.data}
      loading={drillDown.loading}
      error={drillDown.error}
      summaryRow={drillDown.summaryRow}
    />
  );

  // =========================================================================
  // MODE A: ALL COMMODITIES VIEW
  // =========================================================================
  if (data.mode === 'all_commodities') {
    const { summary, commodity_cards } = data;

    return (
      <div className="space-y-6">
        {drillDownModal}
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Harvest Pipeline
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              All commodities — select a commodity to view season details
            </p>
          </div>
          <button
            onClick={fetchPipelineData}
            className="flex items-center gap-2 px-3 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Summary Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:shadow-md hover:border-green-200 border border-transparent transition-all" onClick={() => openDrillDown('total_revenue')}>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <DollarSign className="w-4 h-4" />
              Total Revenue
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.total_revenue)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Click for details</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:shadow-md hover:border-green-200 border border-transparent transition-all" onClick={() => openDrillDown('bins_packed_all')}>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <Package className="w-4 h-4" />
              Qty Packed
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {formatNumber(summary.total_bins_packed)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Click for details</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:shadow-md hover:border-green-200 border border-transparent transition-all" onClick={() => openDrillDown('bins_settled_all')}>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              Qty Settled
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {formatNumber(summary.total_bins_settled)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Click for details</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <BarChart3 className="w-4 h-4" />
              Settlement
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {summary.settlement_percent}%
            </p>
          </div>
        </div>

        {/* Commodity Cards */}
        {commodity_cards && commodity_cards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {commodity_cards.map((card) => {
              const colors = getCommodityColor(card.crop_category);
              const totalPools = (card.pools?.active || 0) + (card.pools?.closed || 0) + (card.pools?.settled || 0);
              return (
                <div
                  key={card.commodity}
                  onClick={() => handleCommoditySelect(card.commodity)}
                  className={`${colors.bg} border ${colors.border} rounded-lg p-5 cursor-pointer hover:shadow-md transition-all group`}
                >
                  {/* Card Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className={`font-bold text-lg ${colors.text}`}>
                        {card.commodity}
                      </h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
                        Season {card.current_season}
                      </span>
                    </div>
                    <ChevronRight className={`w-5 h-5 ${colors.accent} opacity-50 group-hover:opacity-100 transition-opacity`} />
                  </div>

                  {/* Stats */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{card.primary_unit_label || 'Bins'} Packed</span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {formatNumber(card.quantity_packed != null ? card.quantity_packed : card.bins_packed)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Settlement</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(card.settlement_percent, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-12 text-right">
                          {card.settlement_percent}%
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Revenue</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(card.revenue)}
                      </span>
                    </div>
                    {(card.avg_per_unit || card.avg_per_bin) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">$/{card.primary_unit === 'LBS' ? 'Lb' : 'Bin'}</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          ${formatNumber(card.avg_per_unit || card.avg_per_bin, 2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Pool Status Footer */}
                  {totalPools > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex gap-3 text-xs">
                      {card.pools.active > 0 && (
                        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          {card.pools.active} active
                        </span>
                      )}
                      {card.pools.closed > 0 && (
                        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                          {card.pools.closed} closed
                        </span>
                      )}
                      {card.pools.settled > 0 && (
                        <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          {card.pools.settled} settled
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              No commodity data available. Upload packinghouse statements to get started.
            </p>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // MODE B: SPECIFIC COMMODITY VIEW
  // =========================================================================
  const { pipeline_stages, pool_status, pipeline_efficiency, recent_activity } = data;

  // Dynamic unit info for this commodity
  const isLbsCommodity = data.primary_unit === 'LBS';
  const commodityUnitLabel = data.primary_unit_label || 'Bins';
  const commodityUnitSingular = isLbsCommodity ? 'Lb' : 'Bin';

  // Calculate settlement efficiency
  const packedBins = pipeline_stages.packout.total_bins || 0;
  const settledBins = pipeline_stages.settlement.total_bins || 0;
  // For weight-based commodities, use lbs harvested as the "packed" baseline
  const harvestedQuantity = isLbsCommodity
    ? (pipeline_stages.harvest.total_lbs || pipeline_stages.harvest.primary_quantity || 0)
    : (pipeline_stages.harvest.total_bins || 0);
  const settledQuantity = isLbsCommodity
    ? (pipeline_stages.settlement.total_lbs || pipeline_stages.settlement.primary_quantity || 0)
    : settledBins;
  // For avocados: compare lbs settled to lbs harvested. For citrus: bins settled to bins packed.
  const packedQuantity = isLbsCommodity ? harvestedQuantity : packedBins;
  const settlementPercent = pipeline_efficiency?.packout_to_settlement ?? (packedQuantity > 0 ? Math.round((settledQuantity / packedQuantity) * 100) : 0);
  const hasMissingPackouts = !isLbsCommodity && settledBins > packedBins && settledBins > 0;
  const missingPackoutBins = hasMissingPackouts ? Math.round(settledBins - packedBins) : 0;

  // Filter recent activity to only show packout and settlement
  const filteredActivity = recent_activity?.filter(
    item => item.type === 'packout' || item.type === 'settlement'
  ) || [];

  return (
    <div className="space-y-6">
      {drillDownModal}
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            {/* Back Button + Title */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToAll}
                className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                All Commodities
              </button>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {data.selected_commodity} Pipeline
            </h2>
            {/* Season Selector */}
            <div className="flex items-center gap-3 mt-1">
              <span className="text-gray-600 dark:text-gray-400 flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                Season:
              </span>
              <select
                value={selectedSeason || data?.selected_season || ''}
                onChange={handleSeasonChange}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800 dark:text-gray-200 dark:bg-gray-700 text-sm font-medium"
              >
                {data?.available_seasons?.map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={fetchPipelineData}
            className="flex items-center gap-2 px-3 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
        {/* View Toggle - only All and By Farm/Ranch */}
        <div className="flex space-x-2">
          {[
            { id: null, label: 'All', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'farm', label: 'By Farm / Ranch', icon: <Layers className="w-4 h-4" /> },
          ].map((view) => (
            <button
              key={view.id || 'all'}
              onClick={() => setBreakdownView(view.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                breakdownView === view.id
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {view.icon}
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {!breakdownView ? (
        /* Aggregate Pipeline Flow Visualization */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-center gap-8">
            {/* Stage 1: Packout (or Harvested for weight-based) */}
            <div className="flex-1 max-w-xs text-center cursor-pointer group" onClick={() => openDrillDown('packed_bins')}>
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-3 group-hover:ring-2 transition-all ${
                isLbsCommodity
                  ? 'bg-blue-100 dark:bg-blue-900/30 group-hover:ring-blue-300'
                  : 'bg-purple-100 dark:bg-purple-900/30 group-hover:ring-purple-300'
              }`}>
                {isLbsCommodity
                  ? <Layers className="w-10 h-10 text-blue-600" />
                  : <Package className="w-10 h-10 text-purple-600" />
                }
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                {isLbsCommodity ? 'Harvested' : pipeline_stages.packout.label}
              </h3>
              <p className={`text-3xl font-bold mt-2 group-hover:underline ${isLbsCommodity ? 'text-blue-600 decoration-blue-300' : 'text-purple-600 decoration-purple-300'}`}>
                {isLbsCommodity
                  ? formatNumber(harvestedQuantity)
                  : formatNumber(pipeline_stages.packout.total_bins)
                }
              </p>
              <p className="text-sm text-gray-500">
                {isLbsCommodity
                  ? `lbs in ${pipeline_stages.harvest.total_count} harvests`
                  : `bins in ${pipeline_stages.packout.total_count} reports`
                }
              </p>
              {isLbsCommodity ? (
                /* For weight-based: show harvest status breakdown */
                <div className="mt-3 flex justify-center gap-2 text-xs">
                  {pipeline_stages.harvest.breakdown.verified > 0 && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                      {pipeline_stages.harvest.breakdown.verified} verified
                    </span>
                  )}
                  {pipeline_stages.harvest.breakdown.complete > 0 && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      {pipeline_stages.harvest.breakdown.complete} complete
                    </span>
                  )}
                </div>
              ) : (
                /* For bin-based: show packout stats */
                <div className="mt-3 flex justify-center gap-2 text-xs">
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                    {pipeline_stages.packout.avg_pack_percent}% packed
                  </span>
                  {pipeline_stages.packout.avg_house_percent > 0 && (
                    <span className={`px-2 py-1 rounded ${
                      pipeline_stages.packout.avg_pack_percent >= pipeline_stages.packout.avg_house_percent
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      vs {pipeline_stages.packout.avg_house_percent}% house
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center px-6">
              <ArrowRight className="w-10 h-10 text-gray-400" />
              <span className="text-sm text-gray-500 mt-2 font-medium">
                {settlementPercent}%
              </span>
              <span className="text-xs text-gray-400">settled</span>
            </div>

            {/* Stage 2: Settlement */}
            <div className="flex-1 max-w-xs text-center cursor-pointer group" onClick={() => openDrillDown('settled')}>
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-3 group-hover:ring-2 group-hover:ring-green-300 transition-all">
                <DollarSign className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                {pipeline_stages.settlement.label}
              </h3>
              <p className="text-3xl font-bold text-green-600 mt-2 group-hover:underline decoration-green-300">
                {formatCurrency(pipeline_stages.settlement.total_revenue)}
              </p>
              <p className="text-sm text-gray-500">{formatNumber(settledQuantity)} {commodityUnitLabel.toLowerCase()} settled</p>
              <div className="mt-3 flex justify-center gap-2 text-xs">
                {(pipeline_stages.settlement.avg_per_unit || pipeline_stages.settlement.avg_per_bin) > 0 && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                    ${formatNumber(pipeline_stages.settlement.avg_per_unit || pipeline_stages.settlement.avg_per_bin, 2)}/{commodityUnitSingular.toLowerCase()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-8 pt-6 border-t dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Settlement Progress
              </span>
              <span className={`text-sm font-bold ${hasMissingPackouts ? 'text-orange-600' : 'text-gray-900 dark:text-gray-100'}`}>
                {hasMissingPackouts ? (
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {formatNumber(settledBins)} / {formatNumber(packedBins)} {commodityUnitLabel.toLowerCase()}
                  </span>
                ) : (
                  `${settlementPercent}%`
                )}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  hasMissingPackouts
                    ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                    : isLbsCommodity
                      ? 'bg-gradient-to-r from-blue-500 to-green-500'
                      : 'bg-gradient-to-r from-purple-500 to-green-500'
                }`}
                style={{ width: `${Math.min(settlementPercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {hasMissingPackouts
                ? `Settlements exceed packouts by ${formatNumber(missingPackoutBins)} ${commodityUnitLabel.toLowerCase()} - packout reports may be missing`
                : isLbsCommodity
                  ? `Percentage of harvested ${commodityUnitLabel.toLowerCase()} that have been settled`
                  : `Percentage of packed ${commodityUnitLabel.toLowerCase()} that have been settled`
              }
            </p>
          </div>
        </div>
      ) : (
        /* Farm Breakdown View */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Pipeline by Farm / Ranch
          </h3>

          {data.breakdowns && data.breakdowns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                    <th className="py-3 px-3">Farm / Ranch</th>
                    <th className="py-3 px-3 text-right">{commodityUnitLabel} Packed</th>
                    <th className="py-3 px-3 text-right">Pack %</th>
                    <th className="py-3 px-3 text-right">{commodityUnitLabel} Settled</th>
                    <th className="py-3 px-3 text-right">Settlement</th>
                    <th className="py-3 px-3 text-right">Revenue</th>
                    <th className="py-3 px-3 text-right">$/{commodityUnitSingular}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.breakdowns.map((row, idx) => (
                    <tr
                      key={row.label || idx}
                      className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="py-3 px-3 font-medium text-gray-900 dark:text-gray-100">
                        {row.label}
                      </td>
                      <td className="py-3 px-3 text-right text-purple-600 dark:text-purple-400 font-semibold">
                        {formatNumber(row.bins_packed)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded text-xs font-medium">
                          {row.avg_pack_percent}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-green-600 dark:text-green-400 font-semibold">
                        {formatNumber(row.bins_settled)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(row.settlement_percent, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-400 w-10 text-right">
                            {row.settlement_percent}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right text-green-700 dark:text-green-400 font-semibold">
                        {formatCurrency(row.revenue)}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-700 dark:text-gray-300">
                        {row.avg_per_bin > 0 ? `$${formatNumber(row.avg_per_bin, 2)}` : '-'}
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-gray-50 dark:bg-gray-700/50 font-semibold">
                    <td className="py-3 px-3 text-gray-900 dark:text-gray-100">Total</td>
                    <td className="py-3 px-3 text-right text-purple-600 dark:text-purple-400">
                      {formatNumber(data.breakdowns.reduce((sum, r) => sum + (r.bins_packed || 0), 0))}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded text-xs font-medium">
                        {pipeline_stages.packout.avg_pack_percent}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-green-600 dark:text-green-400">
                      {formatNumber(data.breakdowns.reduce((sum, r) => sum + (r.bins_settled || 0), 0))}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {settlementPercent}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-green-700 dark:text-green-400">
                      {formatCurrency(data.breakdowns.reduce((sum, r) => sum + (r.revenue || 0), 0))}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-700 dark:text-gray-300">
                      {pipeline_stages.settlement.avg_per_bin > 0
                        ? `$${formatNumber(pipeline_stages.settlement.avg_per_bin, 2)}`
                        : '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : data.breakdowns && data.breakdowns.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No data available for this breakdown view
            </p>
          ) : (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          )}
        </div>
      )}

      {/* Pool Status & Recent Activity */}
      <div className="grid grid-cols-3 gap-6">
        {/* Pool Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Pool Status
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                Active
              </span>
              <span className="font-semibold">{pool_status.active}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                Closed (Pending Settlement)
              </span>
              <span className="font-semibold">{pool_status.closed}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                Settled
              </span>
              <span className="font-semibold">{pool_status.settled}</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" />
            Recent Activity
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {filteredActivity.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            ) : (
              filteredActivity.map((item, index) => (
                <div
                  key={`${item.type}-${item.id}-${index}`}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${getActivityBgColor(item.type)}`}
                >
                  <div className="mt-0.5">
                    {getActivityIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {item.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.field && `${item.field} • `}
                      {item.packinghouse && `${item.packinghouse} • `}
                      {formatDate(item.date)}
                    </p>
                  </div>
                  {item.bins && (
                    <span className="text-sm font-medium text-gray-700">
                      {formatNumber(item.bins)} bins
                    </span>
                  )}
                  {item.pack_percent && (
                    <span className={`text-sm font-medium ${
                      item.pack_percent >= (item.house_avg || 0)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {item.pack_percent}%
                    </span>
                  )}
                  {item.net_return && (
                    <span className="text-sm font-medium text-green-600">
                      {formatCurrency(item.net_return)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Alerts/Warnings */}
      {(pool_status.closed > 0 || hasMissingPackouts) && (
        <div className={`border rounded-lg p-4 ${
          hasMissingPackouts
            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        }`}>
          <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${
            hasMissingPackouts
              ? 'text-orange-800 dark:text-orange-200'
              : 'text-yellow-800 dark:text-yellow-200'
          }`}>
            <AlertCircle className="w-4 h-4" />
            Action Items
          </h3>
          <ul className={`text-sm space-y-1 ${
            hasMissingPackouts
              ? 'text-orange-700 dark:text-orange-300'
              : 'text-yellow-700 dark:text-yellow-300'
          }`}>
            {hasMissingPackouts && (
              <li>
                • <strong>Missing packout reports:</strong> {formatNumber(missingPackoutBins)} more bins have been settled than packed. Upload the corresponding packout reports to reconcile.
              </li>
            )}
            {pool_status.closed > 0 && (
              <li>
                • {pool_status.closed} pool{pool_status.closed > 1 ? 's are' : ' is'} closed and awaiting settlement
              </li>
            )}
          </ul>
        </div>
      )}

    </div>
  );
};

export default PipelineOverview;
