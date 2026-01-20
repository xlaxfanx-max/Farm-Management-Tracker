// =============================================================================
// HARVEST LABOR MODAL COMPONENT
// Save as: frontend/src/components/HarvestLaborModal.js
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, Plus, Users, AlertTriangle } from 'lucide-react';
import { harvestLaborAPI, laborContractorsAPI, HARVEST_CONSTANTS } from '../services/api';

const HarvestLaborModal = ({
  isOpen,
  onClose,
  onSave,
  labor = null,
  harvestId,
  onAddContractor,
  contractorRefreshTrigger
}) => {
  const [formData, setFormData] = useState({
    harvest: '',
    contractor: '',
    crew_name: '',
    foreman_name: '',
    worker_count: 1,
    start_time: '',
    end_time: '',
    total_hours: '',
    pay_type: 'piece_rate',
    rate: '',
    bins_picked: '',
    total_labor_cost: '',
    training_verified: false,
    hygiene_facilities_available: false,
    illness_check_performed: false,
    notes: ''
  });

  const [contractors, setContractors] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [calculatedCost, setCalculatedCost] = useState(0);
  const [calculatedHours, setCalculatedHours] = useState(0);
  const [lastLaborForContractor, setLastLaborForContractor] = useState(null);

  // Fetch contractors on mount and when contractorRefreshTrigger changes
  useEffect(() => {
    fetchContractors();
  }, [contractorRefreshTrigger]);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (labor) {
        // Editing existing labor record
        setFormData({
          ...labor,
          harvest: labor.harvest,
          contractor: labor.contractor || '',
          start_time: labor.start_time ? labor.start_time.slice(0, 16) : '',
          end_time: labor.end_time ? labor.end_time.slice(0, 16) : ''
        });
      } else {
        // New labor record
        setFormData({
          harvest: harvestId,
          contractor: '',
          crew_name: '',
          foreman_name: '',
          worker_count: 1,
          start_time: '',
          end_time: '',
          total_hours: '',
          pay_type: 'piece_rate',
          rate: '',
          bins_picked: '',
          total_labor_cost: '',
          training_verified: false,
          hygiene_facilities_available: false,
          illness_check_performed: false,
          notes: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, labor, harvestId]);

  // Calculate hours when start/end time change
  useEffect(() => {
    if (formData.start_time && formData.end_time) {
      const start = new Date(formData.start_time);
      const end = new Date(formData.end_time);
      const hours = (end - start) / (1000 * 60 * 60);
      if (hours > 0) {
        setCalculatedHours(Math.round(hours * 100) / 100);
      }
    }
  }, [formData.start_time, formData.end_time]);

  // Calculate cost when relevant fields change
  useEffect(() => {
    calculateCost();
  }, [formData.pay_type, formData.rate, formData.total_hours, formData.bins_picked, formData.worker_count, calculatedHours]);

  const fetchContractors = async () => {
    try {
      const response = await laborContractorsAPI.getSimpleList();
      setContractors(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching contractors:', error);
      setContractors([]);
    }
  };

  const calculateCost = () => {
    if (!formData.rate) {
      setCalculatedCost(0);
      return;
    }

    const rate = parseFloat(formData.rate);
    const hours = parseFloat(formData.total_hours) || calculatedHours;
    const workers = parseInt(formData.worker_count) || 1;
    const bins = parseInt(formData.bins_picked) || 0;
    
    let cost = 0;

    switch (formData.pay_type) {
      case 'hourly':
        cost = hours * rate * workers;
        break;
      case 'piece_rate':
        cost = bins * rate;
        break;
      case 'contract':
        cost = rate; // Flat rate
        break;
      default:
        cost = 0;
    }

    setCalculatedCost(Math.round(cost * 100) / 100);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Auto-fill defaults when contractor is selected
  const handleContractorChange = async (e) => {
    const contractorId = e.target.value;
    setFormData(prev => ({ ...prev, contractor: contractorId }));

    if (contractorId) {
      const contractor = contractors.find(c => c.id === parseInt(contractorId));
      if (contractor) {
        // Auto-fill rate based on pay type
        let defaultRate = '';
        if (formData.pay_type === 'hourly' && contractor.default_hourly_rate) {
          defaultRate = contractor.default_hourly_rate;
        } else if (formData.pay_type === 'piece_rate' && contractor.default_piece_rate) {
          defaultRate = contractor.default_piece_rate;
        }

        setFormData(prev => ({
          ...prev,
          rate: defaultRate || prev.rate,
          training_verified: contractor.food_safety_training_current
        }));

        // Fetch last labor record for this contractor
        if (!labor) { // Only for new records
          try {
            const response = await harvestLaborAPI.getAll({ contractor: contractorId, ordering: '-created_at', limit: 1 });
            if (response.data.results && response.data.results.length > 0) {
              setLastLaborForContractor(response.data.results[0]);
            }
          } catch (error) {
            console.error('Error fetching last labor record:', error);
          }
        }
      }
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.contractor && !formData.crew_name) {
      newErrors.contractor = 'Select a contractor or enter a crew name';
    }
    if (!formData.worker_count || formData.worker_count < 1) {
      newErrors.worker_count = 'At least 1 worker required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;

    setSaving(true);
    try {
      const dataToSave = {
        harvest: parseInt(harvestId),
        contractor: formData.contractor ? parseInt(formData.contractor) : null,
        crew_name: formData.crew_name,
        foreman_name: formData.foreman_name,
        worker_count: parseInt(formData.worker_count),
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        total_hours: formData.total_hours ? parseFloat(formData.total_hours) : (calculatedHours || null),
        pay_type: formData.pay_type,
        rate: formData.rate ? parseFloat(formData.rate) : null,
        bins_picked: formData.bins_picked ? parseInt(formData.bins_picked) : null,
        total_labor_cost: formData.total_labor_cost ? parseFloat(formData.total_labor_cost) : (calculatedCost || null),
        training_verified: formData.training_verified,
        hygiene_facilities_available: formData.hygiene_facilities_available,
        illness_check_performed: formData.illness_check_performed,
        notes: formData.notes
      };

      if (labor) {
        await harvestLaborAPI.update(labor.id, dataToSave);
      } else {
        await harvestLaborAPI.create(dataToSave);
      }
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving labor record:', error);
      if (error.response?.data) {
        setErrors(error.response.data);
      } else {
        alert('Failed to save labor record. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  // Check if selected contractor has warnings
  const getContractorWarnings = () => {
    if (!formData.contractor) return [];
    
    const contractor = contractors.find(c => c.id === parseInt(formData.contractor));
    if (!contractor) return [];
    
    const warnings = [];
    if (contractor.is_license_valid === false) {
      warnings.push('Contractor license may be expired');
    }
    if (!contractor.food_safety_training_current) {
      warnings.push('Food safety training not current');
    }
    return warnings;
  };

  const contractorWarnings = getContractorWarnings();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <Users className="text-purple-600" size={24} />
            <h2 className="text-xl font-semibold">
              {labor ? 'Edit Labor Record' : 'Add Labor to Harvest'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={24} />
          </button>
        </div>

        {/* Contractor Warnings */}
        {contractorWarnings.length > 0 && (
          <div className="mx-4 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="text-yellow-600 flex-shrink-0" size={20} />
              <div>
                <p className="font-medium text-yellow-800">Contractor Warnings</p>
                <ul className="text-sm text-yellow-700 mt-1">
                  {contractorWarnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Crew Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Crew Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Labor Contractor
                </label>
                <div className="flex gap-2">
                  <select
                    name="contractor"
                    value={formData.contractor}
                    onChange={handleContractorChange}
                    className={`flex-1 border rounded-lg px-3 py-2 ${errors.contractor ? 'border-red-500' : ''}`}
                  >
                    <option value="">Select contractor...</option>
                    {contractors.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} {c.is_license_valid === false ? '⚠️' : ''}
                      </option>
                    ))}
                  </select>
                  {onAddContractor && (
                    <button
                      type="button"
                      onClick={onAddContractor}
                      className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                      title="Add new contractor"
                    >
                      <Plus size={18} />
                    </button>
                  )}
                </div>
                {errors.contractor && <p className="text-red-500 text-sm mt-1">{errors.contractor}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Crew Name (if no contractor)
                </label>
                <input
                  type="text"
                  name="crew_name"
                  value={formData.crew_name}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., Morning Crew A"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Foreman Name
                </label>
                <input
                  type="text"
                  name="foreman_name"
                  value={formData.foreman_name}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Worker Count <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="worker_count"
                  value={formData.worker_count}
                  onChange={handleChange}
                  min="1"
                  className={`w-full border rounded-lg px-3 py-2 ${errors.worker_count ? 'border-red-500' : ''}`}
                  required
                />
                {errors.worker_count && <p className="text-red-500 text-sm mt-1">{errors.worker_count}</p>}
              </div>
            </div>
          </div>

          {/* Time Tracking */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Time Tracking
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  name="start_time"
                  value={formData.start_time}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  name="end_time"
                  value={formData.end_time}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Hours
                </label>
                <input
                  type="number"
                  name="total_hours"
                  value={formData.total_hours}
                  onChange={handleChange}
                  step="0.25"
                  min="0"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder={calculatedHours ? calculatedHours.toString() : ''}
                />
                {calculatedHours > 0 && !formData.total_hours && (
                  <p className="text-xs text-gray-500 mt-1">
                    Calculated: {calculatedHours} hours
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Cost Tracking */}
          <div className="border rounded-lg p-4 bg-purple-50">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Cost Tracking
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pay Type
                </label>
                <select
                  name="pay_type"
                  value={formData.pay_type}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {HARVEST_CONSTANTS.PAY_TYPES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rate
                </label>
                <input
                  type="number"
                  name="rate"
                  value={formData.rate}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder={formData.pay_type === 'hourly' ? '$/hour' : '$/bin'}
                />
                {lastLaborForContractor && formData.rate && !labor && (
                  <p className="text-xs text-blue-600 mt-1">
                    💡 Last rate: ${lastLaborForContractor.rate} ({lastLaborForContractor.pay_type_display || lastLaborForContractor.pay_type})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bins Picked
                </label>
                <input
                  type="number"
                  name="bins_picked"
                  value={formData.bins_picked}
                  onChange={handleChange}
                  min="0"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="For piece rate"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Cost
                </label>
                <input
                  type="number"
                  name="total_labor_cost"
                  value={formData.total_labor_cost}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder={formatCurrency(calculatedCost)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Calculated: {formatCurrency(calculatedCost)}
                </p>
              </div>
            </div>
          </div>

          {/* GAP/GHP Compliance */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              GAP/GHP Worker Compliance
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <label className="flex items-center gap-2 p-3 bg-white rounded-lg border cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  name="training_verified"
                  checked={formData.training_verified}
                  onChange={handleChange}
                  className="rounded border-gray-300"
                />
                <div>
                  <span className="text-sm font-medium">Training Verified</span>
                  <p className="text-xs text-gray-500">Workers have food safety training</p>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 bg-white rounded-lg border cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  name="hygiene_facilities_available"
                  checked={formData.hygiene_facilities_available}
                  onChange={handleChange}
                  className="rounded border-gray-300"
                />
                <div>
                  <span className="text-sm font-medium">Hygiene Facilities</span>
                  <p className="text-xs text-gray-500">Handwashing & toilets available</p>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 bg-white rounded-lg border cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  name="illness_check_performed"
                  checked={formData.illness_check_performed}
                  onChange={handleChange}
                  className="rounded border-gray-300"
                />
                <div>
                  <span className="text-sm font-medium">Illness Check</span>
                  <p className="text-xs text-gray-500">No sick workers present</p>
                </div>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Any additional notes..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : (labor ? 'Update Labor' : 'Add Labor')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HarvestLaborModal;
