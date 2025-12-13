import React, { useState, useEffect } from 'react';
import { X, Droplet } from 'lucide-react';

function WaterSourceModal({ source, farms, fields, onClose, onSave }) {
  const [formData, setFormData] = useState({
    farm: '',
    name: '',
    source_type: 'well',
    location_description: '',
    used_for_irrigation: true,
    used_for_washing: false,
    used_for_pesticide_mixing: false,
    fields_served: [],
    test_frequency_days: 365,
    active: true,
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (source) {
      setFormData({
        farm: source.farm || '',
        name: source.name || '',
        source_type: source.source_type || 'well',
        location_description: source.location_description || '',
        used_for_irrigation: source.used_for_irrigation ?? true,
        used_for_washing: source.used_for_washing ?? false,
        used_for_pesticide_mixing: source.used_for_pesticide_mixing ?? false,
        fields_served: source.fields_served || [],
        test_frequency_days: source.test_frequency_days || 365,
        active: source.active ?? true,
      });
    }
  }, [source]);

  const validate = () => {
    const newErrors = {};

    if (!formData.farm) {
      newErrors.farm = 'Farm is required';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Water source name is required';
    }

    if (!formData.source_type) {
      newErrors.source_type = 'Source type is required';
    }

    if (formData.test_frequency_days < 1) {
      newErrors.test_frequency_days = 'Test frequency must be at least 1 day';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  const farmFields = fields.filter(f => f.farm === parseInt(formData.farm));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Droplet className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold text-slate-800">
              {source ? 'Edit Water Source' : 'Add Water Source'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Farm Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Farm <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.farm}
                onChange={(e) => setFormData({ ...formData, farm: e.target.value, fields_served: [] })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.farm ? 'border-red-500' : 'border-slate-300'
                }`}
              >
                <option value="">Select a farm</option>
                {farms.map(farm => (
                  <option key={farm.id} value={farm.id}>{farm.name}</option>
                ))}
              </select>
              {errors.farm && <p className="mt-1 text-sm text-red-600">{errors.farm}</p>}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Water Source Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Well #1, North Pond"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-slate-300'
                }`}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            {/* Source Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Source Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.source_type}
                onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.source_type ? 'border-red-500' : 'border-slate-300'
                }`}
              >
                <option value="well">Well</option>
                <option value="municipal">Municipal/Public</option>
                <option value="surface">Surface Water (pond, stream, etc.)</option>
                <option value="other">Other</option>
              </select>
              {errors.source_type && <p className="mt-1 text-sm text-red-600">{errors.source_type}</p>}
            </div>

            {/* Location Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Location Description
              </label>
              <textarea
                value={formData.location_description}
                onChange={(e) => setFormData({ ...formData, location_description: e.target.value })}
                placeholder="Physical location or GPS coordinates"
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Usage Checkboxes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Used For
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.used_for_irrigation}
                    onChange={(e) => setFormData({ ...formData, used_for_irrigation: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-slate-700">Irrigation</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.used_for_washing}
                    onChange={(e) => setFormData({ ...formData, used_for_washing: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-slate-700">Produce Washing</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.used_for_pesticide_mixing}
                    onChange={(e) => setFormData({ ...formData, used_for_pesticide_mixing: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-slate-700">Pesticide Mixing</span>
                </label>
              </div>
            </div>

            {/* Fields Served */}
            {formData.farm && farmFields.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fields Served (Optional)
                </label>
                <div className="max-h-40 overflow-y-auto border border-slate-300 rounded-lg p-3 space-y-2">
                  {farmFields.map(field => (
                    <label key={field.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.fields_served.includes(field.id)}
                        onChange={(e) => {
                          const newFields = e.target.checked
                            ? [...formData.fields_served, field.id]
                            : formData.fields_served.filter(id => id !== field.id);
                          setFormData({ ...formData, fields_served: newFields });
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-slate-700">{field.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Test Frequency */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Test Frequency (days) <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.test_frequency_days}
                onChange={(e) => setFormData({ ...formData, test_frequency_days: parseInt(e.target.value) })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.test_frequency_days ? 'border-red-500' : 'border-slate-300'
                }`}
              >
                <option value={90}>Quarterly (90 days)</option>
                <option value={180}>Semi-annually (180 days)</option>
                <option value={365}>Annually (365 days)</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                How often water testing should be performed
              </p>
              {errors.test_frequency_days && <p className="mt-1 text-sm text-red-600">{errors.test_frequency_days}</p>}
            </div>

            {/* Active Status */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-slate-700">Active</span>
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Inactive sources won't appear in test reminders
              </p>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {source ? 'Update' : 'Create'} Water Source
          </button>
        </div>
      </div>
    </div>
  );
}

export default WaterSourceModal;
