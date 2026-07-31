// =============================================================================
// POOL DETAIL COMPONENT
// Detailed view of a pool with deliveries, packout reports, and settlements
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Boxes,
  Edit,
  Truck,
  FileText,
  DollarSign,
  Plus,
  RefreshCw,
  Calendar,
  TrendingUp,
  Building2,
  Link2,
  Wheat,
  Eye
} from 'lucide-react';
import { poolsAPI } from '../../services/api';
import DeliveryModal from './DeliveryModal';
import PackoutReportModal from './PackoutReportModal';
import SettlementDetail from './SettlementDetail';
import PoolLedgerTab from './PoolLedgerTab';

const PoolDetail = ({ pool, onBack, onEdit, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('deliveries');
  const [summary, setSummary] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [packoutReports, setPackoutReports] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showPackoutModal, setShowPackoutModal] = useState(false);
  const [selectedSettlementId, setSelectedSettlementId] = useState(null);

  useEffect(() => {
    fetchPoolData();
  }, [pool.id]);

  const fetchPoolData = async () => {
    try {
      setLoading(true);
      const [summaryRes, deliveriesRes, packoutsRes, settlementsRes] = await Promise.all([
        poolsAPI.getSummary(pool.id),
        poolsAPI.getDeliveries(pool.id),
        poolsAPI.getPackoutReports(pool.id),
        poolsAPI.getSettlements(pool.id),
      ]);

      setSummary(summaryRes.data);
      setDeliveries(deliveriesRes.data);
      setPackoutReports(packoutsRes.data);
      setSettlements(settlementsRes.data);
    } catch (error) {
      console.error('Error fetching pool data:', error);
    } finally {
      setLoading(false);
    }
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
      currency: 'USD'
    }).format(value);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'closed': return 'bg-yellow-100 text-yellow-800';
      case 'settled': return 'bg-orange-100 text-orange-700';
      default: return 'bg-cream-100 text-text';
    }
  };

  const tabs = [
    { id: 'deliveries', label: 'Deliveries', icon: Truck, count: deliveries.length },
    { id: 'packouts', label: 'Packout Reports', icon: FileText, count: packoutReports.length },
    { id: 'settlements', label: 'Settlements', icon: DollarSign, count: settlements.length },
    { id: 'ledger', label: 'Advances & Payments', icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-cream-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-bark-600" />
          </button>
          <div>
            <h2 className="text-xl text-heading flex items-center">
              <Boxes className="w-6 h-6 mr-2 text-primary" />
              {pool.name}
            </h2>
            <div className="flex items-center space-x-3 text-sm text-text-secondary mt-1">
              <span className="flex items-center">
                <Building2 className="w-4 h-4 mr-1" />
                {pool.packinghouse_name}
              </span>
              <span>{pool.commodity}</span>
              {pool.variety && <span className="text-text-muted">• {pool.variety}</span>}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(pool.status)}`}>
                {pool.status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchPoolData}
            className="p-2 text-text-muted hover:text-bark-600 hover:bg-cream-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={onEdit}
            className="flex items-center px-4 py-2 border border-border-strong rounded-button hover:bg-cream-50"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Pool
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-surface-raised rounded-card border border-border p-4">
            <div className="text-sm text-text-secondary">Total Deliveries</div>
            <div className="text-2xl font-bold text-heading">
              {summary.delivery_stats?.total_deliveries || 0}
            </div>
          </div>
          <div className="bg-surface-raised rounded-card border border-border p-4">
            <div className="text-sm text-text-secondary">Total Bins</div>
            <div className="text-2xl font-bold text-primary">
              {formatNumber(summary.delivery_stats?.total_bins)}
            </div>
          </div>
          {summary.packout_stats && (
            <div className="bg-surface-raised rounded-card border border-border p-4">
              <div className="text-sm text-text-secondary">Pack Percentage</div>
              <div className="text-2xl font-bold text-link">
                {summary.packout_stats.total_packed_percent}%
              </div>
              {summary.packout_stats.house_avg_packed_percent && (
                <div className="text-xs text-text-secondary mt-1">
                  House Avg: {summary.packout_stats.house_avg_packed_percent}%
                </div>
              )}
            </div>
          )}
          {summary.settlement_stats && (
            <div className="bg-surface-raised rounded-card border border-border p-4">
              <div className="text-sm text-text-secondary">Net Return</div>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(summary.settlement_stats.net_return)}
              </div>
              <div className="text-xs text-text-secondary mt-1">
                {formatCurrency(summary.settlement_stats.net_per_bin)}/bin
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fields Breakdown */}
      {summary?.fields_breakdown?.length > 0 && (
        <div className="bg-surface-raised rounded-card border border-border">
          <div className="p-4 border-b border-border">
            <h3 className=" text-text">Deliveries by Block</h3>
          </div>
          <div className="divide-y divide-border">
            {summary.fields_breakdown.map((field, idx) => (
              <div key={idx} className="p-3 flex justify-between items-center">
                <span className="text-heading">{field.field__name}</span>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-text-secondary">{field.deliveries} deliveries</span>
                  <span className="font-semibold text-primary">{formatNumber(field.bins)} bins</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="flex space-x-8">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-secondary hover:text-bark-700'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {label}
              {count !== undefined && (
                <span className="ml-2 px-2 py-0.5 bg-cream-100 text-bark-600 rounded-full text-xs">
                  {count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Deliveries Tab */}
          {activeTab === 'deliveries' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowDeliveryModal(true)}
                  className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Record Delivery
                </button>
              </div>

              {deliveries.length === 0 ? (
                <div className="text-center py-8 bg-cream-50 rounded-lg">
                  <Truck className="w-12 h-12 mx-auto text-sand-300 mb-3" />
                  <p className="text-text-secondary">No deliveries recorded yet.</p>
                </div>
              ) : (
                <div className="bg-surface-raised rounded-card border border-border overflow-hidden">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-cream-50 bg-surface-sunken">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Ticket #</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Field</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Harvest</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-caps">Bins</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-caps">Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {deliveries.map((d) => (
                        <tr key={d.id} className="hover:bg-cream-50">
                          <td className="px-4 py-3 text-sm">
                            {new Date(d.delivery_date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            {d.ticket_number}
                          </td>
                          <td className="px-4 py-3 text-sm">{d.field_name}</td>
                          <td className="px-4 py-3 text-sm">
                            {d.harvest ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs">
                                <Wheat className="w-3 h-3" />
                                {d.harvest_lot || d.harvest_date}
                              </span>
                            ) : (
                              <span className="text-text-muted text-xs">Not linked</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold">
                            {formatNumber(d.bins, 2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-text-secondary">
                            {d.weight_lbs ? `${formatNumber(d.weight_lbs)} lbs` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Packout Reports Tab */}
          {activeTab === 'packouts' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowPackoutModal(true)}
                  className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Packout Report
                </button>
              </div>

              {packoutReports.length === 0 ? (
                <div className="text-center py-8 bg-cream-50 rounded-lg">
                  <FileText className="w-12 h-12 mx-auto text-sand-300 mb-3" />
                  <p className="text-text-secondary">No packout reports recorded yet.</p>
                </div>
              ) : (
                <div className="bg-surface-raised rounded-card border border-border overflow-hidden">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-cream-50 bg-surface-sunken">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Report Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Period</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Field</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-caps">Bins</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-caps">Pack %</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-caps">House Avg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {packoutReports.map((r) => (
                        <tr key={r.id} className="hover:bg-cream-50">
                          <td className="px-4 py-3 text-sm">
                            {new Date(r.report_date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-text-secondary">
                            {new Date(r.period_start).toLocaleDateString()} - {new Date(r.period_end).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm">{r.field_name}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {formatNumber(r.bins_this_period, 2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-link">
                            {r.total_packed_percent}%
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-text-secondary">
                            {r.house_avg_packed_percent ? `${r.house_avg_packed_percent}%` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Settlements Tab */}
          {activeTab === 'settlements' && (
            <div className="space-y-4">
              {settlements.length === 0 ? (
                <div className="text-center py-8 bg-cream-50 rounded-lg">
                  <DollarSign className="w-12 h-12 mx-auto text-sand-300 mb-3" />
                  <p className="text-text-secondary">No settlements recorded yet.</p>
                </div>
              ) : (
                <div className="bg-surface-raised rounded-card border border-border overflow-hidden">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-cream-50 bg-surface-sunken">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-caps">Field</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-caps">Bins</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-caps">Net Return</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-caps">$/Bin</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-caps">Amount Due</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary uppercase tracking-caps">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {settlements.map((s) => (
                        <tr
                          key={s.id}
                          className="hover:bg-primary-light cursor-pointer transition-colors"
                          onClick={() => setSelectedSettlementId(s.id)}
                        >
                          <td className="px-4 py-3 text-sm">
                            {new Date(s.statement_date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {s.field_name || <span className="text-text-muted">All Blocks</span>}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {formatNumber(s.total_bins, 2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {formatCurrency(s.net_return)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {formatCurrency(s.net_per_bin)}
                            {s.variance_vs_house_per_bin !== null && (
                              <span className={`ml-1 text-xs ${
                                s.variance_vs_house_per_bin >= 0 ? 'text-primary' : 'text-danger'
                              }`}>
                                ({s.variance_vs_house_per_bin >= 0 ? '+' : ''}{formatCurrency(s.variance_vs_house_per_bin)})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-primary">
                            {formatCurrency(s.amount_due)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSettlementId(s.id);
                              }}
                              className="p-1.5 text-primary hover:bg-green-100 rounded-lg transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Advances & Payments Tab */}
          {activeTab === 'ledger' && <PoolLedgerTab pool={pool} />}
        </>
      )}

      {/* Modals */}
      {showDeliveryModal && (
        <DeliveryModal
          poolId={pool.id}
          onClose={() => setShowDeliveryModal(false)}
          onSave={() => {
            setShowDeliveryModal(false);
            fetchPoolData();
            onRefresh();
          }}
        />
      )}

      {showPackoutModal && (
        <PackoutReportModal
          poolId={pool.id}
          onClose={() => setShowPackoutModal(false)}
          onSave={() => {
            setShowPackoutModal(false);
            fetchPoolData();
            onRefresh();
          }}
        />
      )}

      {/* Settlement Detail Modal */}
      {selectedSettlementId && (
        <SettlementDetail
          settlementId={selectedSettlementId}
          onClose={() => setSelectedSettlementId(null)}
        />
      )}
    </div>
  );
};

export default PoolDetail;
