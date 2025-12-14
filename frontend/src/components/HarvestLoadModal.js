// =============================================================================
// HARVEST LOAD MODAL COMPONENT
// Save as: frontend/src/components/HarvestLoadModal.js
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, Plus, Truck } from 'lucide-react';
import { harvestLoadsAPI, buyersAPI, HARVEST_CONSTANTS } from '../services/api';

const HarvestLoadModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  load = null,
  harvestId,
  onAddBuyer
}) => {
  const [formData, setFormData] = useState({
    harvest: '',
    load_number: 1,
    bins: '',
    weight_lbs: '',
    weight_ticket_number: '',
    buyer: '',
    destination_address: '',
    grade: 'choice',
    size_grade: '',
    quality_notes: '',
    price_per_unit: '',
    price_unit: 'per_bin',
    total_revenue: '',
    payment_status: 'pending',
    payment_date: '',
    invoice_number: '',
    truck_id: '',
    trailer_id: '',
    driver_name: '',
    departure_time: '',
    arrival_time: '',
    temperature_at_loading: '',
    seal_number: '',
    notes: ''
  });

  const [buyers, setBuyers] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [calculatedRevenue, setCalculatedRevenue] = useState(0);

  // Fetch buyers on mount
  useEffect(() => {
    fetchBuyers();
  }, []);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (load) {
        // Editing existing load
        setFormData({
          ...load,
          harvest: load.harvest,
          buyer: load.buyer || '',
          departure_time: load.departure_time ? load.departure_time.slice(0, 16) : '',
          arrival_time: load.arrival_time ? load.arrival_time.slice(0, 16) : ''
        });
      } else {
        // New load
        setFormData(prev => ({
          ...prev,
          harvest: harvestId,
          load_number: 1,
          bins: '',
          weight_lbs: '',
          weight_ticket_number: '',
          buyer: '',
          destination_address: '',
          grade: 'choice',
          size_grade: '',
          quality_notes: '',
          price_per_unit: '',
          price_unit: 'per_bin',
          total_revenue: '',
          payment_status: 'pending',
          payment_date: '',
          invoice_number: '',
          truck_id: '',
          trailer_id: '',
          driver_name: '',
          departure_time: '',
          arrival_time: '',
          temperature_at_loading: '',
          seal_number: '',
          notes: ''
        }));
      }
      setErrors({});
    }
  }, [isOpen, load, harvestId]);

  // Calculate revenue when price or bins change
  useEffect(() => {
    calculateRevenue();
  }, [formData.bins, formData.weight_lbs, formData.price_per_unit, formData.price_unit]);

  const fetchBuyers = async () => {
    try {
      const response = await buyersAPI.getSimpleList();
      setBuyers(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching buyers:', error);
      setBuyers([]);
    }
  };

  const calculateRevenue = () => {
    if (!formData.price_per_unit) {
      setCalculatedRevenue(0);
      return;
    }

    const price = parseFloat(formData.price_per_unit);
    let revenue = 0;

    switch (formData.price_unit) {
      case 'per_bin':
        revenue = (parseInt(formData.bins) || 0) * price;
        break;
      case 'per_lb':
        revenue = (parseFloat(formData.weight_lbs) || 0) * price;
        break;
      case 'per_ton':
        revenue = ((parseFloat(formData.weight_lbs) || 0) / 2000) * price;
        break;
      case 'flat_rate':
        revenue = price;
        break;
      default:
        revenue = (parseInt(formData.bins) || 0) * price;
    }

    setCalculatedRevenue(revenue);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Auto-fill buyer address when buyer is selected
  const handleBuyerChange = (e) => {
    const buyerId = e.target.value;
    setFormData(prev => ({ ...prev, buyer: buyerId }));
    
    // Find buyer and fill address if empty
    if (buyerId && !formData.destination_address) {
      const buyer = buyers.find(b => b.id === parseInt(buyerId));
      if (buyer) {
        // You'd need full buyer data here, but for simple list we just have basic info
        // In practice, you might fetch the full buyer or store addresses in simple list
      }
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.bins || formData.bins <= 0) {
      newErrors.bins = 'Number of bins is required';
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
        ...formData,
        harvest: parseInt(harvestId),
        bins: parseInt(formData.bins),
        weight_lbs: formData.weight_lbs ? parseFloat(formData.weight_lbs) : null,
        buyer: formData.buyer ? parseInt(formData.buyer) : null,
        price_per_unit: formData.price_per_unit ? parseFloat(formData.price_per_unit) : null,
        total_revenue: formData.total_revenue ? parseFloat(formData.total_revenue) : calculatedRevenue || null,
        temperature_at_loading: formData.temperature_at_loading ? parseFloat(formData.temperature_at_loading) : null,
        departure_time: formData.departure_time || null,
        arrival_time: formData.arrival_time || null,
        payment_date: formData.payment_date || null
      };

      if (load) {
        await harvestLoadsAPI.update(load.id, dataToSave);
      } else {
        await harvestLoadsAPI.create(dataToSave);
      }
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving load:', error);
      if (error.response?.data) {
        setErrors(error.response.data);
      } else {
        alert('Failed to save load. Please try again.');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <Truck className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold">
              {load ? 'Edit Load' : 'Add Load to Harvest'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Quantity Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Quantity
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bins <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="bins"
                  value={formData.bins}
                  onChange={handleChange}
                  min="0"
                  className={`w-full border rounded-lg px-3 py-2 ${errors.bins ? 'border-red-500' : ''}`}
                  required
                />
                {errors.bins && <p className="text-red-500 text-sm mt-1">{errors.bins}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  name="weight_lbs"
                  value={formData.weight_lbs}
                  onChange={handleChange}
                  step="0.01"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Scale weight"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight Ticket #
                </label>
                <input
                  type="text"
                  name="weight_ticket_number"
                  value={formData.weight_ticket_number}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Scale ticket reference"
                />
              </div>
            </div>
          </div>

          {/* Destination Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Destination
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buyer
                </label>
                <div className="flex gap-2">
                  <select
                    name="buyer"
                    value={formData.buyer}
                    onChange={handleBuyerChange}
                    className="flex-1 border rounded-lg px-3 py-2"
                  >
                    <option value="">Select buyer...</option>
                    {buyers.map(buyer => (
                      <option key={buyer.id} value={buyer.id}>
                        {buyer.name} ({buyer.buyer_type_display})
                      </option>
                    ))}
                  </select>
                  {onAddBuyer && (
                    <button
                      type="button"
                      onClick={onAddBuyer}
                      className="px-3 py-2 border rounded-lg hover:bg-gray-50"
                      title="Add new buyer"
                    >
                      <Plus size={18} />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Destination Address
                </label>
                <input
                  type="text"
                  name="destination_address"
                  value={formData.destination_address}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Override buyer address if different"
                />
              </div>
            </div>
          </div>

          {/* Grade & Quality Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Grade & Quality
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grade
                </label>
                <select
                  name="grade"
                  value={formData.grade}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {HARVEST_CONSTANTS.GRADES.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Size Grade
                </label>
                <select
                  name="size_grade"
                  value={formData.size_grade}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select size...</option>
                  {HARVEST_CONSTANTS.SIZE_GRADES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quality Notes
                </label>
                <input
                  type="text"
                  name="quality_notes"
                  value={formData.quality_notes}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Brix, color, defects..."
                />
              </div>
            </div>
          </div>

          {/* Revenue Section */}
          <div className="border rounded-lg p-4 bg-green-50">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Revenue
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price
                </label>
                <input
                  type="number"
                  name="price_per_unit"
                  value={formData.price_per_unit}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price Unit
                </label>
                <select
                  name="price_unit"
                  value={formData.price_unit}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {HARVEST_CONSTANTS.PRICE_UNITS.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Revenue
                </label>
                <input
                  type="number"
                  name="total_revenue"
                  value={formData.total_revenue}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder={formatCurrency(calculatedRevenue)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Calculated: {formatCurrency(calculatedRevenue)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Status
                </label>
                <select
                  name="payment_status"
                  value={formData.payment_status}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {HARVEST_CONSTANTS.PAYMENT_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  name="invoice_number"
                  value={formData.invoice_number}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  name="payment_date"
                  value={formData.payment_date}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* Transportation (GAP/GHP) Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Transportation (GAP/GHP Traceability)
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Truck ID
                </label>
                <input
                  type="text"
                  name="truck_id"
                  value={formData.truck_id}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="License plate"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trailer ID
                </label>
                <input
                  type="text"
                  name="trailer_id"
                  value={formData.trailer_id}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Driver Name
                </label>
                <input
                  type="text"
                  name="driver_name"
                  value={formData.driver_name}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seal Number
                </label>
                <input
                  type="text"
                  name="seal_number"
                  value={formData.seal_number}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Departure Time
                </label>
                <input
                  type="datetime-local"
                  name="departure_time"
                  value={formData.departure_time}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Arrival Time
                </label>
                <input
                  type="datetime-local"
                  name="arrival_time"
                  value={formData.arrival_time}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Temp at Loading (°F)
                </label>
                <input
                  type="number"
                  name="temperature_at_loading"
                  value={formData.temperature_at_loading}
                  onChange={handleChange}
                  step="0.1"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : (load ? 'Update Load' : 'Add Load')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HarvestLoadModal;
