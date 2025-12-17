import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, MapPin } from 'lucide-react';
import api from '../services/api';

const OWNERSHIP_TYPES = [
  { value: 'owned', label: 'Owned' },
  { value: 'leased', label: 'Leased' },
  { value: 'managed', label: 'Managed' },
];

/**
 * Format APN based on county conventions
 * Ventura: XXX-X-XXX-XXX (10 digits)
 * Standard CA: XXX-XXX-XXX (9 digits)
 */
const formatAPN = (apn, county) => {
  if (!apn) return '';
  const digits = apn.replace(/\D/g, '');
  
  if (county?.toLowerCase() === 'ventura' && digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits[3]}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  return apn;
};

function FarmParcelManager({ 
  farmId, 
  county, 
  parcels: initialParcels = [], 
  onChange,
  readOnly = false 
}) {
  const [parcels, setParcels] = useState(initialParcels);
  const [editingId, setEditingId] = useState(null);
  const [newParcel, setNewParcel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync with parent
  useEffect(() => {
    setParcels(initialParcels);
  }, [initialParcels]);

  // Notify parent of changes
  const notifyChange = (updatedParcels) => {
    setParcels(updatedParcels);
    if (onChange) {
      onChange(updatedParcels);
    }
  };

  // Load parcels from API if farmId provided
  useEffect(() => {
    if (farmId && initialParcels.length === 0) {
      loadParcels();
    }
  }, [farmId]);

  const loadParcels = async () => {
    if (!farmId) return;
    setLoading(true);
    try {
      const response = await api.get(`/farms/${farmId}/parcels/`);
      notifyChange(response.data);
    } catch (err) {
      setError('Failed to load parcels');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setNewParcel({
      apn: '',
      acreage: '',
      ownership_type: 'owned',
      notes: ''
    });
    setError(null);
  };

  const handleSaveNew = async () => {
    if (!newParcel.apn.trim()) {
      setError('APN is required');
      return;
    }

    console.log('Token:', localStorage.getItem('farm_tracker_access_token'));

    const formattedParcel = {
      ...newParcel,
      apn: formatAPN(newParcel.apn, county),
      acreage: newParcel.acreage ? parseFloat(newParcel.acreage) : null
    };

    if (farmId) {
      try {
        setLoading(true);
        const response = await api.post(`/farms/${farmId}/parcels/`, formattedParcel);
        notifyChange([...parcels, response.data]);
        setNewParcel(null);
        setError(null);
      } catch (err) {
        const errorMsg = err.response?.data?.apn?.[0] || 
                        err.response?.data?.detail ||
                        'Failed to add parcel';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    } else {
      // Local only (for new farm being created)
      notifyChange([...parcels, { ...formattedParcel, id: `temp-${Date.now()}` }]);
      setNewParcel(null);
      setError(null);
    }
  };

  const handleEdit = (parcel) => {
    setEditingId(parcel.id);
    setError(null);
  };

  const handleSaveEdit = async (parcel, updates) => {
    const formattedUpdates = {
      ...updates,
      apn: formatAPN(updates.apn, county),
      acreage: updates.acreage ? parseFloat(updates.acreage) : null
    };

    if (farmId && !String(parcel.id).startsWith('temp-')) {
      try {
        setLoading(true);
        const response = await api.put(`/farm-parcels/${parcel.id}/`, {
          farm: farmId,
          ...formattedUpdates
        });
        notifyChange(parcels.map(p => p.id === parcel.id ? response.data : p));
        setEditingId(null);
        setError(null);
      } catch (err) {
        setError('Failed to update parcel');
      } finally {
        setLoading(false);
      }
    } else {
      notifyChange(parcels.map(p => p.id === parcel.id ? { ...p, ...formattedUpdates } : p));
      setEditingId(null);
    }
  };

  const handleDelete = async (parcel) => {
    if (!window.confirm(`Remove APN ${parcel.apn}?`)) return;

    if (farmId && !String(parcel.id).startsWith('temp-')) {
      try {
        setLoading(true);
        await api.delete(`/farm-parcels/${parcel.id}/`);
        notifyChange(parcels.filter(p => p.id !== parcel.id));
      } catch (err) {
        setError('Failed to delete parcel');
      } finally {
        setLoading(false);
      }
    } else {
      notifyChange(parcels.filter(p => p.id !== parcel.id));
    }
  };

  // Calculate totals
  const totalAcreage = parcels.reduce((sum, p) => sum + (parseFloat(p.acreage) || 0), 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <MapPin size={16} />
          Assessor Parcel Numbers (APNs)
        </h4>
        {!readOnly && (
          <button
            type="button"
            onClick={handleAddNew}
            disabled={newParcel !== null || loading}
            className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1 disabled:opacity-50"
          >
            <Plus size={16} />
            Add APN
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Parcel list */}
      <div className="space-y-2">
        {parcels.map((parcel) => (
          <ParcelRow
            key={parcel.id}
            parcel={parcel}
            county={county}
            isEditing={editingId === parcel.id}
            readOnly={readOnly}
            onEdit={() => handleEdit(parcel)}
            onSave={(updates) => handleSaveEdit(parcel, updates)}
            onCancel={() => setEditingId(null)}
            onDelete={() => handleDelete(parcel)}
          />
        ))}

        {/* New parcel form */}
        {newParcel && (
          <ParcelRow
            parcel={newParcel}
            county={county}
            isEditing={true}
            isNew={true}
            onSave={handleSaveNew}
            onCancel={() => {
              setNewParcel(null);
              setError(null);
            }}
            onChange={setNewParcel}
          />
        )}

        {/* Empty state */}
        {parcels.length === 0 && !newParcel && (
          <div className="text-sm text-gray-500 italic py-2 text-center">
            No parcels added yet
          </div>
        )}
      </div>

      {/* Summary */}
      {parcels.length > 0 && (
        <div className="text-sm text-gray-600 pt-2 border-t flex justify-between">
          <span>
            <strong>{parcels.length}</strong> parcel{parcels.length !== 1 ? 's' : ''}
          </span>
          {totalAcreage > 0 && (
            <span>
              <strong>{totalAcreage.toFixed(2)}</strong> total acres
            </span>
          )}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="text-center py-2">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
        </div>
      )}
    </div>
  );
}

// Individual parcel row
function ParcelRow({ 
  parcel, 
  county,
  isEditing, 
  isNew = false,
  readOnly = false,
  onEdit, 
  onSave, 
  onCancel, 
  onDelete,
  onChange 
}) {
  const [editData, setEditData] = useState(parcel);

  useEffect(() => {
    setEditData(parcel);
  }, [parcel]);

  const handleChange = (field, value) => {
    const updated = { ...editData, [field]: value };
    setEditData(updated);
    if (isNew && onChange) {
      onChange(updated);
    }
  };

  if (isEditing) {
    return (
      <div className="bg-slate-50 rounded-lg p-3 space-y-3 border">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              APN *
            </label>
            <input
              type="text"
              value={editData.apn}
              onChange={(e) => handleChange('apn', e.target.value)}
              placeholder={county?.toLowerCase() === 'ventura' ? '123-0-456-789' : '123-456-789'}
              className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Acreage
            </label>
            <input
              type="number"
              step="0.01"
              value={editData.acreage || ''}
              onChange={(e) => handleChange('acreage', e.target.value)}
              placeholder="0.00"
              className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Ownership
            </label>
            <select
              value={editData.ownership_type}
              onChange={(e) => handleChange('ownership_type', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {OWNERSHIP_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={editData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Optional notes"
              className="w-full px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(editData)}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            {isNew ? 'Add' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-white border rounded-lg hover:bg-slate-50 group">
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm font-medium text-gray-800">
          {parcel.apn}
        </span>
        {parcel.ownership_type !== 'owned' && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            parcel.ownership_type === 'leased' 
              ? 'bg-yellow-100 text-yellow-700' 
              : 'bg-blue-100 text-blue-700'
          }`}>
            {parcel.ownership_type}
          </span>
        )}
        {parcel.acreage && (
          <span className="text-sm text-gray-500">
            {parseFloat(parcel.acreage).toFixed(2)} ac
          </span>
        )}
      </div>
      
      {!readOnly && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded"
            title="Remove"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default FarmParcelManager;
