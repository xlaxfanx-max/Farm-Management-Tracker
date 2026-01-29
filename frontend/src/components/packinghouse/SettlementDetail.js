// =============================================================================
// SETTLEMENT DETAIL COMPONENT
// Shows revenue breakdown (grades) and charges (deductions) normalized to per-bin
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  X, DollarSign, TrendingUp, TrendingDown, Minus,
  Package, Truck, Building2, FileText, Loader2,
  ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight,
  FileIcon, PanelLeftClose, PanelLeft, ExternalLink, Download
} from 'lucide-react';
import { poolSettlementsAPI, getApiUrl } from '../../services/api';

// Group deductions by category for display
const DEDUCTION_CATEGORIES = {
  packing: { label: 'Packing Charges', icon: Package, color: 'text-blue-600' },
  assessment: { label: 'Assessments', icon: FileText, color: 'text-purple-600' },
  pick_haul: { label: 'Pick & Haul', icon: Truck, color: 'text-orange-600' },
  capital: { label: 'Capital Funds', icon: Building2, color: 'text-gray-600' },
  marketing: { label: 'Marketing', icon: TrendingUp, color: 'text-green-600' },
  other: { label: 'Other Charges', icon: Minus, color: 'text-gray-500' },
};

const SettlementDetail = ({ settlementId, onClose }) => {
  const [settlement, setSettlement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showPdf, setShowPdf] = useState(true); // Show PDF by default if available
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    fetchSettlement();
  }, [settlementId]);

  // Fetch PDF as blob to bypass X-Frame-Options
  useEffect(() => {
    if (settlement?.source_pdf_url && showPdf) {
      fetchPdfBlob();
    }
    // Cleanup blob URL on unmount
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [settlement?.source_pdf_url, showPdf]);

  const fetchPdfBlob = async () => {
    if (!settlement?.source_pdf_url) return;

    try {
      setPdfLoading(true);

      // PDF is now served through our backend proxy endpoint to avoid CORS issues
      const pdfUrl = getApiUrl(settlement.source_pdf_url);
      const token = localStorage.getItem('farm_tracker_access_token');

      const response = await fetch(pdfUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch PDF');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      // Add PDF viewer parameters to hide sidebar and toolbar for cleaner view
      setPdfBlobUrl(url + '#toolbar=0&navpanes=0&view=FitH');
    } catch (err) {
      console.error('Error fetching PDF:', err);
      // Don't set error - just won't show PDF preview
    } finally {
      setPdfLoading(false);
    }
  };

  const fetchSettlement = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await poolSettlementsAPI.get(settlementId);
      setSettlement(response.data);

      // Expand all categories by default
      const categories = {};
      (response.data.deductions || []).forEach(d => {
        categories[d.category] = true;
      });
      setExpandedCategories(categories);
    } catch (err) {
      console.error('Error fetching settlement:', err);
      setError('Failed to load settlement details');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value, decimals = 2) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const formatNumber = (value, decimals = 0) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    return `${parseFloat(value).toFixed(1)}%`;
  };

  // Calculate per-bin value from total
  const perBin = (amount) => {
    if (!settlement?.total_bins || !amount) return null;
    return parseFloat(amount) / parseFloat(settlement.total_bins);
  };

  // Group deductions by category
  const groupDeductionsByCategory = (deductions) => {
    const grouped = {};
    (deductions || []).forEach(d => {
      const category = d.category || 'other';
      if (!grouped[category]) {
        grouped[category] = {
          items: [],
          total: 0,
        };
      }
      grouped[category].items.push(d);
      grouped[category].total += parseFloat(d.amount) || 0;
    });
    return grouped;
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto" />
          <p className="mt-3 text-gray-600">Loading settlement details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-md">
          <p className="text-red-600">{error}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!settlement) return null;

  const groupedDeductions = groupDeductionsByCategory(settlement.deductions);
  const totalBins = parseFloat(settlement.total_bins) || 0;
  const totalCredits = parseFloat(settlement.total_credits) || 0;
  const totalDeductions = parseFloat(settlement.total_deductions) || 0;
  const netReturn = parseFloat(settlement.net_return) || 0;
  const netPerBin = parseFloat(settlement.net_per_bin) || 0;
  const houseAvgPerBin = parseFloat(settlement.house_avg_per_bin) || null;
  const variance = houseAvgPerBin ? netPerBin - houseAvgPerBin : null;
  const hasPdf = !!settlement.source_pdf_url;
  const showPdfPanel = showPdf && hasPdf;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl shadow-2xl max-h-[95vh] overflow-hidden flex flex-col transition-all duration-300 ${
        showPdfPanel ? 'max-w-[95vw] w-full' : 'max-w-4xl w-full'
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                  Settlement Details
                </h2>
                <div className="flex items-center space-x-3 text-sm text-gray-600 mt-1">
                  <span>{settlement.pool_name}</span>
                  <span className="text-gray-400">|</span>
                  <span>{settlement.packinghouse_name}</span>
                  {settlement.field_name && (
                    <>
                      <span className="text-gray-400">|</span>
                      <span>{settlement.field_name}</span>
                    </>
                  )}
                  <span className="text-gray-400">|</span>
                  <span>{new Date(settlement.statement_date).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {/* PDF Toggle Button */}
              {hasPdf && (
                <button
                  onClick={() => setShowPdf(!showPdf)}
                  className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    showPdf
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={showPdf ? 'Hide PDF' : 'Show PDF'}
                >
                  {showPdf ? (
                    <>
                      <PanelLeftClose className="w-4 h-4 mr-1.5" />
                      Hide PDF
                    </>
                  ) : (
                    <>
                      <PanelLeft className="w-4 h-4 mr-1.5" />
                      Show PDF
                    </>
                  )}
                </button>
              )}
              {hasPdf && (
                <a
                  href={settlement.source_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white/50 rounded-lg"
                  title="Open PDF in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content - Split View */}
        <div className="flex-1 flex overflow-hidden">
          {/* PDF Panel */}
          {showPdfPanel && (
            <div className="w-1/2 border-r border-gray-200 bg-gray-100 flex flex-col">
              <div className="p-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center text-sm text-gray-600">
                  <FileIcon className="w-4 h-4 mr-2 text-red-500" />
                  <span className="truncate max-w-xs" title={settlement.source_pdf_filename}>
                    {settlement.source_pdf_filename || 'Source PDF'}
                  </span>
                </div>
                <a
                  href={settlement.source_pdf_url}
                  download
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                  title="Download PDF"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
              <div className="flex-1 bg-gray-200">
                {pdfLoading ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-500 mb-3" />
                    <p className="text-gray-500">Loading PDF...</p>
                  </div>
                ) : pdfBlobUrl ? (
                  <object
                    data={pdfBlobUrl}
                    type="application/pdf"
                    className="w-full h-full"
                  >
                    {/* Fallback if object doesn't work */}
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                      <FileIcon className="w-16 h-16 text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-4">
                        PDF preview not available in browser.
                      </p>
                      <a
                        href={settlement.source_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open PDF in New Tab
                      </a>
                    </div>
                  </object>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <FileIcon className="w-16 h-16 text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-4">
                      Unable to load PDF preview.
                    </p>
                    <a
                      href={settlement.source_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open PDF in New Tab
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Data Panel - Scrollable */}
          <div className={`flex-1 overflow-y-auto p-6 space-y-6 ${showPdfPanel ? 'w-1/2' : 'w-full'}`}>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-500">Total Bins</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(totalBins, 2)}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-700">Total Credits</div>
              <div className="text-2xl font-bold text-green-700">
                {formatCurrency(totalCredits)}
              </div>
              <div className="text-sm text-green-600 mt-1">
                {formatCurrency(perBin(totalCredits))}/bin
              </div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-sm text-red-700">Total Charges</div>
              <div className="text-2xl font-bold text-red-700">
                {formatCurrency(totalDeductions)}
              </div>
              <div className="text-sm text-red-600 mt-1">
                {formatCurrency(perBin(totalDeductions))}/bin
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-700">Net Return</div>
              <div className="text-2xl font-bold text-blue-700">
                {formatCurrency(netReturn)}
              </div>
              <div className="text-sm text-blue-600 mt-1 flex items-center">
                {formatCurrency(netPerBin)}/bin
                {variance !== null && (
                  <span className={`ml-2 flex items-center ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {variance >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {formatCurrency(Math.abs(variance))}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* House Average Comparison */}
          {houseAvgPerBin && (
            <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-between">
              <span className="text-gray-600">House Average</span>
              <div className="flex items-center space-x-4">
                <span className="font-medium">{formatCurrency(houseAvgPerBin)}/bin</span>
                <span className={`px-2 py-1 rounded text-sm font-medium ${
                  variance >= 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {variance >= 0 ? '+' : ''}{formatCurrency(variance)} vs house
                </span>
              </div>
            </div>
          )}

          {/* Pack Percentages */}
          {(settlement.fresh_fruit_percent || settlement.products_percent) && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-700 mb-3">Pack Distribution</h4>
              <div className="flex space-x-6">
                {settlement.fresh_fruit_percent && (
                  <div>
                    <span className="text-sm text-gray-500">Fresh Fruit:</span>
                    <span className="ml-2 font-semibold text-green-600">
                      {formatPercent(settlement.fresh_fruit_percent)}
                    </span>
                  </div>
                )}
                {settlement.products_percent && (
                  <div>
                    <span className="text-sm text-gray-500">Products/Juice:</span>
                    <span className="ml-2 font-semibold text-orange-600">
                      {formatPercent(settlement.products_percent)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* REVENUES - Grade Lines */}
          {settlement.grade_lines?.length > 0 && (
            <div className="border border-green-200 rounded-lg overflow-hidden">
              <div className="bg-green-50 px-4 py-3 border-b border-green-200">
                <h3 className="font-semibold text-green-800 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Revenues by Grade
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-green-50/50">
                    <tr className="text-xs text-green-700 uppercase">
                      <th className="px-4 py-2 text-left">Grade</th>
                      <th className="px-4 py-2 text-left">Size</th>
                      <th className="px-4 py-2 text-right">Quantity</th>
                      <th className="px-4 py-2 text-right">% of Total</th>
                      <th className="px-4 py-2 text-right">FOB Rate</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-right">Per Bin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-100">
                    {settlement.grade_lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-green-50/30">
                        <td className="px-4 py-2 font-medium text-gray-900">
                          {line.grade}
                        </td>
                        <td className="px-4 py-2 text-gray-600">
                          {line.size || '-'}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {formatNumber(line.quantity, 0)}
                          <span className="text-xs text-gray-400 ml-1">
                            {line.unit_display || line.unit_of_measure}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {formatPercent(line.percent_of_total)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {line.fob_rate ? formatCurrency(line.fob_rate, 4) : '-'}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-green-700">
                          {formatCurrency(line.total_amount)}
                        </td>
                        <td className="px-4 py-2 text-right text-green-600 font-medium">
                          {formatCurrency(perBin(line.total_amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-green-100">
                    <tr className="font-semibold">
                      <td colSpan="5" className="px-4 py-2 text-green-800">
                        Total Credits
                      </td>
                      <td className="px-4 py-2 text-right text-green-800">
                        {formatCurrency(totalCredits)}
                      </td>
                      <td className="px-4 py-2 text-right text-green-800">
                        {formatCurrency(perBin(totalCredits))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* CHARGES - Deductions by Category */}
          {settlement.deductions?.length > 0 && (
            <div className="border border-red-200 rounded-lg overflow-hidden">
              <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                <h3 className="font-semibold text-red-800 flex items-center">
                  <TrendingDown className="w-5 h-5 mr-2" />
                  Charges & Deductions
                </h3>
              </div>
              <div className="divide-y divide-red-100">
                {Object.entries(groupedDeductions).map(([category, data]) => {
                  const categoryInfo = DEDUCTION_CATEGORIES[category] || DEDUCTION_CATEGORIES.other;
                  const Icon = categoryInfo.icon;
                  const isExpanded = expandedCategories[category];

                  return (
                    <div key={category}>
                      {/* Category Header */}
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-50/50 transition-colors"
                      >
                        <div className="flex items-center">
                          <Icon className={`w-4 h-4 mr-2 ${categoryInfo.color}`} />
                          <span className="font-medium text-gray-800">
                            {categoryInfo.label}
                          </span>
                          <span className="ml-2 text-xs text-gray-400">
                            ({data.items.length} items)
                          </span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-red-700 font-medium">
                            {formatCurrency(data.total)}
                          </span>
                          <span className="text-red-600 text-sm">
                            {formatCurrency(perBin(data.total))}/bin
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Category Items */}
                      {isExpanded && (
                        <div className="bg-gray-50/50 px-4 pb-3">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-gray-500">
                                <th className="py-2 text-left">Description</th>
                                <th className="py-2 text-right">Qty</th>
                                <th className="py-2 text-right">Rate</th>
                                <th className="py-2 text-right">Amount</th>
                                <th className="py-2 text-right">Per Bin</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {data.items.map((item, idx) => (
                                <tr key={idx}>
                                  <td className="py-2 text-gray-700">
                                    {item.description}
                                  </td>
                                  <td className="py-2 text-right text-gray-600">
                                    {item.quantity ? (
                                      <>
                                        {formatNumber(item.quantity, 0)}
                                        <span className="text-xs text-gray-400 ml-1">
                                          {item.unit_of_measure}
                                        </span>
                                      </>
                                    ) : '-'}
                                  </td>
                                  <td className="py-2 text-right text-gray-600">
                                    {item.rate ? formatCurrency(item.rate, 4) : '-'}
                                  </td>
                                  <td className="py-2 text-right text-red-600 font-medium">
                                    {formatCurrency(item.amount)}
                                  </td>
                                  <td className="py-2 text-right text-red-500">
                                    {formatCurrency(perBin(item.amount))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Total Charges Footer */}
                <div className="bg-red-100 px-4 py-3 flex items-center justify-between font-semibold">
                  <span className="text-red-800">Total Charges</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-red-800">{formatCurrency(totalDeductions)}</span>
                    <span className="text-red-700">{formatCurrency(perBin(totalDeductions))}/bin</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NET RETURN SUMMARY */}
          <div className="bg-gradient-to-r from-blue-100 to-green-100 rounded-lg p-6">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-sm text-gray-600">Total Credits</div>
                <div className="text-xl font-bold text-green-700">
                  {formatCurrency(totalCredits)}
                </div>
                <div className="text-sm text-green-600">
                  {formatCurrency(perBin(totalCredits))}/bin
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Charges</div>
                <div className="text-xl font-bold text-red-700">
                  - {formatCurrency(totalDeductions)}
                </div>
                <div className="text-sm text-red-600">
                  {formatCurrency(perBin(totalDeductions))}/bin
                </div>
              </div>
              <div className="border-l-2 border-blue-300 pl-6">
                <div className="text-sm text-gray-600">Net Return</div>
                <div className="text-2xl font-bold text-blue-800">
                  {formatCurrency(netReturn)}
                </div>
                <div className="text-lg font-semibold text-blue-700">
                  {formatCurrency(netPerBin)}/bin
                </div>
              </div>
            </div>
          </div>

          {/* Amount Due */}
          {settlement.amount_due !== null && settlement.amount_due !== undefined && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-yellow-700">Amount Due (after advances)</div>
                {settlement.prior_advances && (
                  <div className="text-xs text-yellow-600 mt-1">
                    Prior advances: {formatCurrency(settlement.prior_advances)}
                  </div>
                )}
              </div>
              <div className="text-2xl font-bold text-yellow-800">
                {formatCurrency(settlement.amount_due)}
              </div>
            </div>
          )}
        </div>
        {/* End Data Panel */}
        </div>
        {/* End Split View Container */}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettlementDetail;
