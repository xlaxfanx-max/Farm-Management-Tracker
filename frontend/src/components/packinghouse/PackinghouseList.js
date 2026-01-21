// =============================================================================
// PACKINGHOUSE LIST COMPONENT
// List and manage packinghouse records
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  Boxes
} from 'lucide-react';
import { packinghousesAPI } from '../../services/api';
import PackinghouseModal from './PackinghouseModal';

const PackinghouseList = () => {
  const [packinghouses, setPackinghouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPackinghouse, setEditingPackinghouse] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    fetchPackinghouses();
  }, [showInactive]);

  const fetchPackinghouses = async () => {
    try {
      setLoading(true);
      const params = {};
      if (!showInactive) {
        params.is_active = true;
      }
      const response = await packinghousesAPI.getAll(params);
      setPackinghouses(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching packinghouses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      try {
        await packinghousesAPI.delete(id);
        fetchPackinghouses();
      } catch (error) {
        console.error('Error deleting packinghouse:', error);
        alert('Failed to delete packinghouse. It may have associated pools or deliveries.');
      }
    }
  };

  const handleEdit = (packinghouse) => {
    setEditingPackinghouse(packinghouse);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingPackinghouse(null);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingPackinghouse(null);
  };

  const handleSave = () => {
    fetchPackinghouses();
    handleModalClose();
  };

  const filteredPackinghouses = packinghouses.filter(ph =>
    ph.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ph.short_code && ph.short_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (ph.grower_id && ph.grower_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search packinghouses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="mr-2 rounded border-gray-300"
            />
            Show inactive
          </label>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Packinghouse
        </button>
      </div>

      {/* List */}
      {filteredPackinghouses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Packinghouses</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm ? 'No packinghouses match your search.' : 'Get started by adding your first packinghouse.'}
          </p>
          {!searchTerm && (
            <button
              onClick={handleCreate}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Packinghouse
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredPackinghouses.map((packinghouse) => (
            <div
              key={packinghouse.id}
              className={`bg-white rounded-lg border ${
                packinghouse.is_active ? 'border-gray-200' : 'border-gray-300 bg-gray-50'
              } p-4 hover:shadow-md transition-shadow`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {packinghouse.name}
                    </h3>
                    {packinghouse.short_code && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        {packinghouse.short_code}
                      </span>
                    )}
                    {!packinghouse.is_active && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded">
                        Inactive
                      </span>
                    )}
                  </div>

                  {packinghouse.grower_id && (
                    <p className="text-sm text-gray-600 mt-1">
                      Grower ID: <span className="font-medium">{packinghouse.grower_id}</span>
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
                    {(packinghouse.city || packinghouse.state) && (
                      <span className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {[packinghouse.city, packinghouse.state].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {packinghouse.contact_phone && (
                      <span className="flex items-center">
                        <Phone className="w-4 h-4 mr-1" />
                        {packinghouse.contact_phone}
                      </span>
                    )}
                    {packinghouse.contact_email && (
                      <span className="flex items-center">
                        <Mail className="w-4 h-4 mr-1" />
                        {packinghouse.contact_email}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {/* Pool Count */}
                  <div className="text-center px-4">
                    <div className="flex items-center text-gray-500">
                      <Boxes className="w-4 h-4 mr-1" />
                      <span className="text-lg font-semibold text-gray-900">
                        {packinghouse.pool_count || 0}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Pools</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(packinghouse)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(packinghouse.id, packinghouse.name)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <PackinghouseModal
          packinghouse={editingPackinghouse}
          onClose={handleModalClose}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default PackinghouseList;
