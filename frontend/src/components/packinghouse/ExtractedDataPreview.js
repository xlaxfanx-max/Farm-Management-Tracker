// =============================================================================
// EXTRACTED DATA PREVIEW COMPONENT
// Display and edit AI-extracted data from packinghouse PDFs
// =============================================================================

import React, { useState } from 'react';
import {
  ChevronDown, ChevronUp, Edit2, Check, X, Plus, Trash2,
  DollarSign, Package, Percent
} from 'lucide-react';

// Determine if commodity is weight-based (avocados/subtropical)
const isWeightBasedCommodity = (commodity) => {
  if (!commodity) return false;
  const c = commodity.toLowerCase();
  return c.includes('avocado') || c.includes('subtropical');
};

const ExtractedDataPreview = ({ data, statementType, onChange }) => {
  const commodity = data?.header?.commodity || '';
  const isWeightBased = isWeightBasedCommodity(commodity);
  const unitLabel = isWeightBased ? 'Lb' : 'Bin';
  const [expandedSections, setExpandedSections] = useState({
    header: true,
    blocks: true,
    summary: true,
    gradeLines: true,
    financials: statementType === 'settlement' || statementType === 'grower_statement',
    deductions: statementType === 'settlement' || statementType === 'grower_statement',
  });

  const [editingField, setEditingField] = useState(null);
  const [tempValue, setTempValue] = useState('');

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const startEditing = (path, currentValue) => {
    setEditingField(path);
    setTempValue(currentValue ?? '');
  };

  const saveEdit = () => {
    if (!editingField) return;

    const pathParts = editingField.split('.');
    const newData = JSON.parse(JSON.stringify(data));

    let current = newData;
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) {
        current[pathParts[i]] = {};
      }
      current = current[pathParts[i]];
    }

    const lastKey = pathParts[pathParts.length - 1];
    current[lastKey] = tempValue === '' ? null : tempValue;

    onChange(newData);
    setEditingField(null);
    setTempValue('');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setTempValue('');
  };

  const getValue = (path) => {
    const pathParts = path.split('.');
    let current = data;
    for (const part of pathParts) {
      if (!current) return null;
      current = current[part];
    }
    return current;
  };

  const updateGradeLine = (index, field, value) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.grade_lines) newData.grade_lines = [];
    if (!newData.grade_lines[index]) return;
    newData.grade_lines[index][field] = value;
    onChange(newData);
  };

  const addGradeLine = () => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.grade_lines) newData.grade_lines = [];
    newData.grade_lines.push({
      grade: '',
      size: '',
      quantity: 0,
      percent: 0,
      unit: 'CARTON',
      fob_rate: null,
      total_amount: null
    });
    onChange(newData);
  };

  const removeGradeLine = (index) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.grade_lines) return;
    newData.grade_lines.splice(index, 1);
    onChange(newData);
  };

  const updateDeduction = (index, field, value) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.deductions) newData.deductions = [];
    if (!newData.deductions[index]) return;
    newData.deductions[index][field] = value;
    onChange(newData);
  };

  const addDeduction = () => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.deductions) newData.deductions = [];
    newData.deductions.push({
      category: 'other',
      description: '',
      quantity: 0,
      unit: 'UNIT',
      rate: 0,
      amount: 0
    });
    onChange(newData);
  };

  const removeDeduction = (index) => {
    const newData = JSON.parse(JSON.stringify(data));
    if (!newData.deductions) return;
    newData.deductions.splice(index, 1);
    onChange(newData);
  };

  const EditableField = ({ label, path, type = 'text' }) => {
    const value = getValue(path);
    const isEditing = editingField === path;

    return (
      <div className="flex items-center justify-between py-1">
        <span className="text-sm text-gray-600">{label}</span>
        {isEditing ? (
          <div className="flex items-center space-x-1">
            <input
              type={type}
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              className="w-32 px-2 py-1 text-sm border border-primary rounded focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
            />
            <button onClick={saveEdit} className="p-1 text-primary hover:bg-primary-light rounded">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={cancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-1">
            <span className="text-sm font-medium text-gray-900">
              {value ?? '-'}
            </span>
            <button
              onClick={() => startEditing(path, value)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const SectionHeader = ({ title, section, icon: Icon }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center">
        {Icon && <Icon className="w-4 h-4 mr-2 text-gray-600" />}
        <span className="font-medium text-gray-900">{title}</span>
      </div>
      {expandedSections[section] ? (
        <ChevronUp className="w-4 h-4 text-gray-400" />
      ) : (
        <ChevronDown className="w-4 h-4 text-gray-400" />
      )}
    </button>
  );

  if (!data) {
    return (
      <div className="p-4 text-center text-gray-500">
        No extracted data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <SectionHeader title="Statement Header" section="header" />
        {expandedSections.header && (
          <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-1">
            <EditableField label="Grower Name" path="header.grower_name" />
            <EditableField label="Grower ID" path="header.grower_id" />
            <EditableField label="Pool ID" path="header.pool_id" />
            <EditableField label="Pool Name" path="header.pool_name" />
            <EditableField label="Commodity" path="header.commodity" />
            <EditableField label="Variety" path="header.variety" />
            <EditableField label="Season" path="header.season" />
            <EditableField label="Report Date" path="header.report_date" type="date" />
            <EditableField label="Period Start" path="header.period_start" type="date" />
            <EditableField label="Period End" path="header.period_end" type="date" />
            <EditableField label="Run Numbers" path="header.run_numbers" />
          </div>
        )}
      </div>

      {/* Blocks Section (for multi-block statements like Mission Produce) */}
      {data.blocks && data.blocks.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <SectionHeader title={`Blocks (${data.blocks.length})`} section="blocks" icon={Package} />
          {expandedSections.blocks && (
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="pb-2 font-medium">Block ID</th>
                    <th className="pb-2 font-medium">Name</th>
                    {data.blocks[0]?.weight_lbs != null && <th className="pb-2 font-medium text-right">Weight (lbs)</th>}
                    {data.blocks[0]?.bins != null && <th className="pb-2 font-medium text-right">Bins</th>}
                    {data.blocks[0]?.gross_dollars != null && <th className="pb-2 font-medium text-right">Gross $</th>}
                    {data.blocks[0]?.net_dollars != null && <th className="pb-2 font-medium text-right">Net $</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.blocks.map((block, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-2 font-medium">{block.block_id}</td>
                      <td className="py-2 text-gray-600">{block.block_name || '-'}</td>
                      {data.blocks[0]?.weight_lbs != null && (
                        <td className="py-2 text-right">{block.weight_lbs?.toLocaleString() ?? '-'}</td>
                      )}
                      {data.blocks[0]?.bins != null && (
                        <td className="py-2 text-right">{block.bins?.toLocaleString() ?? '-'}</td>
                      )}
                      {data.blocks[0]?.gross_dollars != null && (
                        <td className="py-2 text-right">{block.gross_dollars != null ? `$${block.gross_dollars.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}</td>
                      )}
                      {data.blocks[0]?.net_dollars != null && (
                        <td className="py-2 text-right">{block.net_dollars != null ? `$${block.net_dollars.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Summary Section */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <SectionHeader title="Summary" section="summary" icon={Package} />
        {expandedSections.summary && (
          <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-1">
            <EditableField label={`Total ${isWeightBased ? 'Lbs' : 'Bins'}`} path="summary.total_bins" type="number" />
            <EditableField label="Total Cartons" path="summary.total_cartons" type="number" />
            <EditableField label="Total Weight (lbs)" path="summary.total_weight_lbs" type="number" />
            <EditableField label="Total Packed %" path="summary.total_packed_percent" type="number" />
            <EditableField label="House Avg Packed %" path="summary.house_avg_packed_percent" type="number" />
            <EditableField label="Juice %" path="summary.juice_percent" type="number" />
            <EditableField label="Cull %" path="summary.cull_percent" type="number" />
            <EditableField label="Fresh Fruit %" path="summary.fresh_fruit_percent" type="number" />
          </div>
        )}
      </div>

      {/* Grade Lines Section */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <SectionHeader
          title={`Grade Breakdown${data.grade_lines?.length ? ` (${data.grade_lines.length} lines)` : ''}`}
          section="gradeLines"
          icon={Percent}
        />
        {expandedSections.gradeLines && (
          <div className="p-4">
            {data.grade_lines && data.grade_lines.length > 0 ? (() => {
              // Check if grade lines have block_id grouping
              const hasBlocks = data.grade_lines.some(l => l.block_id);
              // Build ordered list of unique block IDs preserving document order
              const blockIds = hasBlocks
                ? [...new Map(data.grade_lines.filter(l => l.block_id).map(l => [l.block_id, true])).keys()]
                : [null];
              // Find matching block name from blocks array
              const getBlockLabel = (blockId) => {
                if (!blockId) return null;
                const block = (data.blocks || []).find(b => b.block_id === blockId);
                return block?.block_name ? `${blockId} - ${block.block_name}` : `Block ${blockId}`;
              };

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        {hasBlocks && <th className="pb-2 font-medium">Block</th>}
                        <th className="pb-2 font-medium">Grade</th>
                        <th className="pb-2 font-medium">Size</th>
                        <th className="pb-2 font-medium text-right">Qty</th>
                        <th className="pb-2 font-medium text-right">%</th>
                        {(statementType === 'settlement' || statementType === 'grower_statement') && (
                          <>
                            <th className="pb-2 font-medium text-right">FOB Rate</th>
                            <th className="pb-2 font-medium text-right">Total</th>
                          </>
                        )}
                        <th className="pb-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {blockIds.map((blockId) => {
                        const blockLines = hasBlocks
                          ? data.grade_lines.map((line, idx) => ({ line, idx })).filter(({ line }) => line.block_id === blockId)
                          : data.grade_lines.map((line, idx) => ({ line, idx }));
                        const blockLabel = getBlockLabel(blockId);

                        return (
                          <React.Fragment key={blockId || 'all'}>
                            {hasBlocks && blockLabel && (
                              <tr className="bg-gray-50">
                                <td colSpan={99} className="py-2 px-2 font-medium text-gray-700 text-xs uppercase tracking-wide">
                                  {blockLabel}
                                </td>
                              </tr>
                            )}
                            {blockLines.map(({ line, idx: index }) => (
                              <tr key={index} className="border-b border-gray-100">
                                {hasBlocks && (
                                  <td className="py-2 text-xs text-gray-400">{line.block_id || ''}</td>
                                )}
                                <td className="py-2">
                                  <input
                                    type="text"
                                    value={line.grade || ''}
                                    onChange={(e) => updateGradeLine(index, 'grade', e.target.value)}
                                    className="w-24 px-2 py-1 border border-gray-200 rounded text-sm focus:border-primary focus:outline-none"
                                  />
                                </td>
                                <td className="py-2">
                                  <input
                                    type="text"
                                    value={line.size || ''}
                                    onChange={(e) => updateGradeLine(index, 'size', e.target.value)}
                                    className="w-16 px-2 py-1 border border-gray-200 rounded text-sm focus:border-primary focus:outline-none"
                                  />
                                </td>
                                <td className="py-2 text-right">
                                  <input
                                    type="number"
                                    value={line.quantity || ''}
                                    onChange={(e) => updateGradeLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                                    className="w-20 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:border-primary focus:outline-none"
                                  />
                                </td>
                                <td className="py-2 text-right">
                                  <input
                                    type="number"
                                    value={line.percent || ''}
                                    onChange={(e) => updateGradeLine(index, 'percent', parseFloat(e.target.value) || 0)}
                                    step="0.01"
                                    className="w-16 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:border-primary focus:outline-none"
                                  />
                                </td>
                                {(statementType === 'settlement' || statementType === 'grower_statement') && (
                                  <>
                                    <td className="py-2 text-right">
                                      <input
                                        type="number"
                                        value={line.fob_rate || ''}
                                        onChange={(e) => updateGradeLine(index, 'fob_rate', parseFloat(e.target.value) || null)}
                                        step="0.000001"
                                        className="w-24 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:border-primary focus:outline-none"
                                      />
                                    </td>
                                    <td className="py-2 text-right">
                                      <input
                                        type="number"
                                        value={line.total_amount || ''}
                                        onChange={(e) => updateGradeLine(index, 'total_amount', parseFloat(e.target.value) || null)}
                                        step="0.01"
                                        className="w-24 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:border-primary focus:outline-none"
                                      />
                                    </td>
                                  </>
                                )}
                                <td className="py-2">
                                  <button
                                    onClick={() => removeGradeLine(index)}
                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })() : (
              <p className="text-sm text-gray-500 text-center py-2">No grade lines</p>
            )}
            <button
              onClick={addGradeLine}
              className="mt-3 flex items-center text-sm text-primary hover:text-primary-hover"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Grade Line
            </button>
          </div>
        )}
      </div>

      {/* Financials Section (for settlements) */}
      {(statementType === 'settlement' || statementType === 'grower_statement') && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <SectionHeader title="Financials" section="financials" icon={DollarSign} />
          {expandedSections.financials && (
            <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-1">
              <EditableField label="Total Credits" path="financials.total_credits" type="number" />
              <EditableField label="Total Deductions" path="financials.total_deductions" type="number" />
              <EditableField label="Net Return" path="financials.net_return" type="number" />
              <EditableField label="Prior Advances" path="financials.prior_advances" type="number" />
              <EditableField label="Amount Due" path="financials.amount_due" type="number" />
              <EditableField label={`Net Per ${unitLabel}`} path="financials.net_per_bin" type="number" />
              <EditableField label="Net Per Carton" path="financials.net_per_carton" type="number" />
              <EditableField label={`House Avg Per ${unitLabel}`} path="financials.house_avg_per_bin" type="number" />
              <EditableField label="House Avg Per Carton" path="financials.house_avg_per_carton" type="number" />
            </div>
          )}
        </div>
      )}

      {/* Deductions Section (for settlements) */}
      {(statementType === 'settlement' || statementType === 'grower_statement') && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <SectionHeader title="Deductions" section="deductions" />
          {expandedSections.deductions && (
            <div className="p-4">
              {data.deductions && data.deductions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-600 border-b">
                        <th className="pb-2 font-medium">Category</th>
                        <th className="pb-2 font-medium">Description</th>
                        <th className="pb-2 font-medium text-right">Qty</th>
                        <th className="pb-2 font-medium">Unit</th>
                        <th className="pb-2 font-medium text-right">Rate</th>
                        <th className="pb-2 font-medium text-right">Amount</th>
                        <th className="pb-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.deductions.map((ded, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="py-2">
                            <select
                              value={ded.category || 'other'}
                              onChange={(e) => updateDeduction(index, 'category', e.target.value)}
                              className="px-2 py-1 border border-gray-200 rounded text-sm focus:border-primary focus:outline-none"
                            >
                              <option value="packing">Packing</option>
                              <option value="assessment">Assessment</option>
                              <option value="pick_haul">Pick & Haul</option>
                              <option value="capital">Capital</option>
                              <option value="marketing">Marketing</option>
                              <option value="other">Other</option>
                            </select>
                          </td>
                          <td className="py-2">
                            <input
                              type="text"
                              value={ded.description || ''}
                              onChange={(e) => updateDeduction(index, 'description', e.target.value)}
                              className="w-32 px-2 py-1 border border-gray-200 rounded text-sm focus:border-primary focus:outline-none"
                            />
                          </td>
                          <td className="py-2 text-right">
                            <input
                              type="number"
                              value={ded.quantity || ''}
                              onChange={(e) => updateDeduction(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:border-primary focus:outline-none"
                            />
                          </td>
                          <td className="py-2">
                            <input
                              type="text"
                              value={ded.unit || ''}
                              onChange={(e) => updateDeduction(index, 'unit', e.target.value)}
                              className="w-16 px-2 py-1 border border-gray-200 rounded text-sm focus:border-primary focus:outline-none"
                            />
                          </td>
                          <td className="py-2 text-right">
                            <input
                              type="number"
                              value={ded.rate || ''}
                              onChange={(e) => updateDeduction(index, 'rate', parseFloat(e.target.value) || 0)}
                              step="0.0000001"
                              className="w-24 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:border-primary focus:outline-none"
                            />
                          </td>
                          <td className="py-2 text-right">
                            <input
                              type="number"
                              value={ded.amount || ''}
                              onChange={(e) => updateDeduction(index, 'amount', parseFloat(e.target.value) || 0)}
                              step="0.01"
                              className="w-24 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:border-primary focus:outline-none"
                            />
                          </td>
                          <td className="py-2">
                            <button
                              onClick={() => removeDeduction(index)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-2">No deductions</p>
              )}
              <button
                onClick={addDeduction}
                className="mt-3 flex items-center text-sm text-primary hover:text-primary-hover"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Deduction
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quality Notes */}
      {data.quality_notes && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <span className="text-sm font-medium text-yellow-800">Quality Notes: </span>
          <span className="text-sm text-yellow-700">{data.quality_notes}</span>
        </div>
      )}
    </div>
  );
};

export default ExtractedDataPreview;
