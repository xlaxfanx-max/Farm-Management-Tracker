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
      <div className="bg-surface-raised rounded-card shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Droplet className="text-link" size={24} />
            <h2 className="text-xl text-text">
              {source ? 'Edit Water Source' : 'Add Water Source'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-bark-600"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Farm Selection */}
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-2">
                Farm <span className="text-danger">*</span>
              </label>
              <select
                value={formData.farm}
                onChange={(e) => setFormData({ ...formData, farm: e.target.value, fields_served: [] })}
                className={`w-full px-3 py-2 border rounded-card focus:border-primary focus:ring-[3px] focus:ring-ring ${
                  errors.farm ? 'border-danger' : 'border-border-strong'
                }`}
              >
                <option value="">Select a farm</option>
                {farms.map(farm => (
                  <option key={farm.id} value={farm.id}>{farm.name}</option>
                ))}
              </select>
              {errors.farm && <p className="mt-1 text-sm text-danger">{errors.farm}</p>}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-2">
                Water Source Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Well #1, North Pond"
                className={`w-full px-3 py-2 border rounded-card focus:border-primary focus:ring-[3px] focus:ring-ring ${
                  errors.name ? 'border-danger' : 'border-border-strong'
                }`}
              />
              {errors.name && <p className="mt-1 text-sm text-danger">{errors.name}</p>}
            </div>

            {/* Source Type */}
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-2">
                Source Type <span className="text-danger">*</span>
              </label>
              <select
                value={formData.source_type}
                onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
                className={`w-full px-3 py-2 border rounded-card focus:border-primary focus:ring-[3px] focus:ring-ring ${
                  errors.source_type ? 'border-danger' : 'border-border-strong'
                }`}
              >
                <option value="well">Well</option>
                <option value="municipal">Municipal/Public</option>
                <option value="surface">Surface Water (pond, stream, etc.)</option>
                <option value="other">Other</option>
              </select>
              {errors.source_type && <p className="mt-1 text-sm text-danger">{errors.source_type}</p>}
            </div>

            {/* Location Description */}
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-2">
                Location Description
              </label>
              <textarea
                value={formData.location_description}
                onChange={(e) => setFormData({ ...formData, location_description: e.target.value })}
                placeholder="Physical location or GPS coordinates"
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              />
            </div>

            {/* Usage Checkboxes */}
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-2">
                Used For
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.used_for_irrigation}
                    onChange={(e) => setFormData({ ...formData, used_for_irrigation: e.target.checked })}
                    className="rounded border-border-strong text-link focus:ring-ring"
                  />
                  <span className="ml-2 text-sm text-bark-700">Irrigation</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.used_for_washing}
                    onChange={(e) => setFormData({ ...formData, used_for_washing: e.target.checked })}
                    className="rounded border-border-strong text-link focus:ring-ring"
                  />
                  <span className="ml-2 text-sm text-bark-700">Produce Washing</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.used_for_pesticide_mixing}
                    onChange={(e) => setFormData({ ...formData, used_for_pesticide_mixing: e.target.checked })}
                    className="rounded border-border-strong text-link focus:ring-ring"
                  />
                  <span className="ml-2 text-sm text-bark-700">Pesticide Mixing</span>
                </label>
              </div>
            </div>

            {/* Fields Served */}
            {formData.farm && farmFields.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-bark-700 mb-2">
                  Fields Served (Optional)
                </label>
                <div className="max-h-40 overflow-y-auto border border-border-strong rounded-card p-3 space-y-2">
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
                        className="rounded border-border-strong text-link focus:ring-ring"
                      />
                      <span className="ml-2 text-sm text-bark-700">{field.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Test Frequency */}
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-2">
                Test Frequency (days) <span className="text-danger">*</span>
              </label>
              <select
                value={formData.test_frequency_days}
                onChange={(e) => setFormData({ ...formData, test_frequency_days: parseInt(e.target.value) })}
                className={`w-full px-3 py-2 border rounded-card focus:border-primary focus:ring-[3px] focus:ring-ring ${
                  errors.test_frequency_days ? 'border-danger' : 'border-border-strong'
                }`}
              >
                <option value={90}>Quarterly (90 days)</option>
                <option value={180}>Semi-annually (180 days)</option>
                <option value={365}>Annually (365 days)</option>
              </select>
              <p className="mt-1 text-xs text-text-secondary">
                How often water testing should be performed
              </p>
              {errors.test_frequency_days && <p className="mt-1 text-sm text-danger">{errors.test_frequency_days}</p>}
            </div>

            {/* Active Status */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded border-border-strong text-link focus:ring-ring"
                />
                <span className="ml-2 text-sm text-bark-700">Active</span>
              </label>
              <p className="mt-1 text-xs text-text-secondary">
                Inactive sources won't appear in test reminders
              </p>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-border bg-cream-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-bark-700 border border-border-strong rounded-button hover:bg-surface-raised"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
          >
            {source ? 'Update' : 'Create'} Water Source
          </button>
        </div>
      </div>
    </div>
  );
}

export default WaterSourceModal;
