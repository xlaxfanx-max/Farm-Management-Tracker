import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, Building2, MapPin } from 'lucide-react';
import FarmParcelManager from './FarmParcelManager';

// California counties for dropdown
const CA_COUNTIES = [
  'Alameda', 'Alpine', 'Amador', 'Butte', 'Calaveras', 'Colusa', 'Contra Costa',
  'Del Norte', 'El Dorado', 'Fresno', 'Glenn', 'Humboldt', 'Imperial', 'Inyo',
  'Kern', 'Kings', 'Lake', 'Lassen', 'Los Angeles', 'Madera', 'Marin', 'Mariposa',
  'Mendocino', 'Merced', 'Modoc', 'Mono', 'Monterey', 'Napa', 'Nevada', 'Orange',
  'Placer', 'Plumas', 'Riverside', 'Sacramento', 'San Benito', 'San Bernardino',
  'San Diego', 'San Francisco', 'San Joaquin', 'San Luis Obispo', 'San Mateo',
  'Santa Barbara', 'Santa Clara', 'Santa Cruz', 'Shasta', 'Sierra', 'Siskiyou',
  'Solano', 'Sonoma', 'Stanislaus', 'Sutter', 'Tehama', 'Trinity', 'Tulare',
  'Tuolumne', 'Ventura', 'Yolo', 'Yuba'
];

const inputClasses = 'w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent';

function FarmModal({ farm, onClose, onSave }) {
  const isEditing = !!farm?.id;

  const [formData, setFormData] = useState({
    name: '',
    farm_number: '',
    owner_name: '',
    operator_name: '',
    address: '',
    county: 'Ventura',
    phone: '',
    email: ''
  });

  const [parcels, setParcels] = useState([]);
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (farm) {
      setFormData({
        name: farm.name || '',
        farm_number: farm.farm_number || '',
        owner_name: farm.owner_name || '',
        operator_name: farm.operator_name || '',
        address: farm.address || '',
        county: farm.county || 'Ventura',
        phone: farm.phone || '',
        email: farm.email || ''
      });
      setParcels(farm.parcels || []);
    }
  }, [farm]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.county) {
      setError('Please fill in Farm Name and County');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Collect new parcels (those with temp IDs) to pass along
      const newParcels = parcels.filter(p => String(p.id).startsWith('temp-'));

      // Delegate creation/update to the parent handler (DataContext.saveFarm)
      const dataToSave = isEditing ? { ...formData, id: farm.id } : formData;
      await onSave(dataToSave, newParcels);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save farm');
    } finally {
      setLoading(false);
    }
  };

  const modalTitle = farm ? 'Edit Farm' : 'Add Farm';

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: Building2 },
    { id: 'parcels', label: `Parcels${parcels.length ? ` (${parcels.length})` : ''}`, icon: MapPin },
  ];

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="relative bg-surface-raised dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="farm-modal-title"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <h2 id="farm-modal-title" className="text-2xl font-bold text-gray-900 dark:text-white">{modalTitle}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 flex-shrink-0" role="tablist">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset ${
                  isActive
                    ? 'border-primary text-primary dark:text-green-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm" role="alert">
              {error}
            </div>
          )}

          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="farm-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Farm Name *</label>
                  <input
                    id="farm-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className={inputClasses}
                    placeholder="e.g., Foster Park"
                    required
                    aria-required="true"
                  />
                </div>
                <div>
                  <label htmlFor="farm-number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Farm Number</label>
                  <input
                    id="farm-number"
                    type="text"
                    value={formData.farm_number}
                    onChange={(e) => setFormData({...formData, farm_number: e.target.value})}
                    className={inputClasses}
                    placeholder="e.g., FP-001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="owner-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owner Name</label>
                  <input
                    id="owner-name"
                    type="text"
                    value={formData.owner_name}
                    onChange={(e) => setFormData({...formData, owner_name: e.target.value})}
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label htmlFor="operator-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Operator Name</label>
                  <input
                    id="operator-name"
                    type="text"
                    value={formData.operator_name}
                    onChange={(e) => setFormData({...formData, operator_name: e.target.value})}
                    className={inputClasses}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="farm-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                <textarea
                  id="farm-address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className={inputClasses}
                  rows="2"
                  placeholder="Street address, city, state, zip"
                />
              </div>

              <div>
                <label htmlFor="farm-county" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">County *</label>
                <select
                  id="farm-county"
                  value={formData.county}
                  onChange={(e) => setFormData({...formData, county: e.target.value})}
                  className={inputClasses}
                  required
                  aria-required="true"
                >
                  {CA_COUNTIES.map(county => (
                    <option key={county} value={county}>{county}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="farm-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input
                    id="farm-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className={inputClasses}
                    placeholder="555-1234"
                  />
                </div>
                <div>
                  <label htmlFor="farm-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    id="farm-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className={inputClasses}
                    placeholder="farm@example.com"
                  />
                </div>
              </div>
            </>
          )}

          {/* Parcels Tab */}
          {activeTab === 'parcels' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Add all Assessor Parcel Numbers (APNs) associated with this farm.
                This helps with property tax tracking and regulatory reporting.
              </p>

              <FarmParcelManager
                farmId={farm?.id}
                county={formData.county}
                parcels={parcels}
                onChange={setParcels}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 justify-end bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default FarmModal;
