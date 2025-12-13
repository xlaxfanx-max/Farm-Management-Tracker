import React, { useState, useEffect } from 'react';
import { X, Trash2, CheckCircle } from 'lucide-react';

function ApplicationModal({ application, fields, products, onClose, onSave, onDelete, onMarkComplete }) {

  if (!fields || !Array.isArray(fields)) fields = [];
  if (!products || !Array.isArray(products)) products = [];
  
  const [formData, setFormData] = useState({
    application_date: new Date().toISOString().split('T')[0],
    field: '',
    product: '',
    amount_used: '',
    unit_of_measure: 'gal',
    applicator_name: '',
    start_time: '',
    end_time: '',
    application_method: '',
    target_pest: '',
    temperature: '',
    wind_speed: '',
    wind_direction: '',
    notes: ''
  });

  useEffect(() => {
    if (application) {
      setFormData({
        application_date: application.application_date,
        field: application.field,
        product: application.product,
        amount_used: application.amount_used.toString(),
        unit_of_measure: application.unit_of_measure,
        applicator_name: application.applicator_name,
        start_time: application.start_time || '',
        end_time: application.end_time || '',
        application_method: application.application_method || '',
        target_pest: application.target_pest || '',
        temperature: application.temperature || '',
        wind_speed: application.wind_speed || '',
        wind_direction: application.wind_direction || '',
        notes: application.notes || ''
      });
    }
  }, [application]);

  const handleSubmit = () => {
    if (!formData.field || !formData.product || !formData.amount_used || !formData.applicator_name) {
      alert('Please fill in all required fields');
      return;
    }

    const selectedField = fields.find(f => f.id === parseInt(formData.field));
    
    const dataToSend = {
      ...formData,
      field: parseInt(formData.field),
      product: parseInt(formData.product),
      amount_used: parseFloat(formData.amount_used),
      acres_treated: selectedField?.total_acres || 0,
      temperature: formData.temperature ? parseFloat(formData.temperature) : null,
      wind_speed: formData.wind_speed ? parseFloat(formData.wind_speed) : null,
    };

    onSave(dataToSend);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white">
          <div>
            <h2 className="text-2xl font-bold">{application ? 'Edit Application' : 'New Application'}</h2>
            {application && (
              <p className="text-sm text-slate-600 mt-1">
                Application #{application.id} • {application.field_name}
              </p>
            )}
          </div>
          <button onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date *</label>
            <input 
              type="date" 
              value={formData.application_date}
              onChange={(e) => setFormData({...formData, application_date: e.target.value})}
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Time *</label>
              <input 
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Time *</label>
              <input 
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Field *</label>
            <select 
              value={formData.field}
              onChange={(e) => setFormData({...formData, field: e.target.value})}
              className="w-full p-2 border rounded-lg"
            >
              <option value="">Select field...</option>
              {fields.map(f => (
                <option key={f.id} value={f.id}>{f.name} - {f.current_crop} ({f.total_acres} acres)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Product *</label>
            <select 
              value={formData.product}
              onChange={(e) => setFormData({...formData, product: e.target.value})}
              className="w-full p-2 border rounded-lg"
            >
              <option value="">Select product...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.product_name} - EPA #{p.epa_registration_number}
                  {p.restricted_use && ' (RESTRICTED)'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Amount *</label>
              <input 
                type="number" 
                step="0.01"
                value={formData.amount_used}
                onChange={(e) => setFormData({...formData, amount_used: e.target.value})}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unit *</label>
              <select 
                value={formData.unit_of_measure}
                onChange={(e) => setFormData({...formData, unit_of_measure: e.target.value})}
                className="w-full p-2 border rounded-lg"
              >
                <option value="gal">Gallons</option>
                <option value="lbs">Pounds</option>
                <option value="oz">Ounces</option>
                <option value="pt">Pints</option>
                <option value="qt">Quarts</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Method *</label>
            <select 
              value={formData.application_method}
              onChange={(e) => setFormData({...formData, application_method: e.target.value})}
              className="w-full p-2 border rounded-lg"
            >
              <option value="">Select method...</option>
              <option value="Ground Spray">Ground Spray</option>
              <option value="Aerial Application">Aerial Application</option>
              <option value="Chemigation">Chemigation</option>
              <option value="Soil Injection">Soil Injection</option>
              <option value="Broadcast">Broadcast</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Applicator *</label>
            <input 
              type="text"
              value={formData.applicator_name}
              onChange={(e) => setFormData({...formData, applicator_name: e.target.value})}
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Target Pest</label>
            <input 
              type="text"
              value={formData.target_pest}
              onChange={(e) => setFormData({...formData, target_pest: e.target.value})}
              className="w-full p-2 border rounded-lg"
              placeholder="e.g., Weeds, Aphids"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Temp (°F)</label>
              <input 
                type="number"
                value={formData.temperature}
                onChange={(e) => setFormData({...formData, temperature: e.target.value})}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Wind (mph)</label>
              <input 
                type="number"
                step="0.1"
                value={formData.wind_speed}
                onChange={(e) => setFormData({...formData, wind_speed: e.target.value})}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Direction</label>
              <select 
                value={formData.wind_direction}
                onChange={(e) => setFormData({...formData, wind_direction: e.target.value})}
                className="w-full p-2 border rounded-lg"
              >
                <option value="">-</option>
                <option value="N">N</option>
                <option value="NE">NE</option>
                <option value="E">E</option>
                <option value="SE">SE</option>
                <option value="S">S</option>
                <option value="SW">SW</option>
                <option value="W">W</option>
                <option value="NW">NW</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea 
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full p-2 border rounded-lg"
              rows="3"
            />
          </div>
        </div>

        <div className="p-6 border-t flex gap-3 justify-between">
          <div className="flex gap-3">
            {application && application.status === 'pending_signature' && (
              <button 
                onClick={() => onMarkComplete(application.id)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <CheckCircle size={18} />
                Mark Complete
              </button>
            )}
            {application && (
              <button 
                onClick={() => onDelete(application.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <Trash2 size={18} />
                Delete
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-6 py-2 border rounded-lg"
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApplicationModal;