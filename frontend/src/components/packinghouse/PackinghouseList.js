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
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import PackinghouseModal from './PackinghouseModal';

const PackinghouseList = () => {
  const confirm = useConfirm();
  const toast = useToast();
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
    const ok = await confirm({
      title: 'Are you sure?',
      message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await packinghousesAPI.delete(id);
      fetchPackinghouses();
    } catch (error) {
      console.error('Error deleting packinghouse:', error);
      toast.error('Failed to delete packinghouse. It may have associated pools or deliveries.');
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
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted w-4 h-4" />
            <input
              type="text"
              placeholder="Search packinghouses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-border-strong rounded-card focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <label className="flex items-center text-sm text-bark-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="mr-2 rounded border-border-strong"
            />
            Show inactive
          </label>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Packinghouse
        </button>
      </div>

      {/* List */}
      {filteredPackinghouses.length === 0 ? (
        <div className="text-center py-12 bg-surface-raised rounded-card border border-border">
          <Building2 className="w-12 h-12 mx-auto text-sand-300 mb-4" />
          <h3 className="text-lg text-heading mb-1">No Packinghouses</h3>
          <p className="text-text-secondary mb-4">
            {searchTerm ? 'No packinghouses match your search.' : 'Get started by adding your first packinghouse.'}
          </p>
          {!searchTerm && (
            <button
              onClick={handleCreate}
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover"
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
              className={`bg-surface-raised rounded-lg border ${
                packinghouse.is_active ? 'border-border' : 'border-border-strong bg-cream-50'
              } p-4 hover:shadow-md transition-shadow`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg text-heading">
                      {packinghouse.name}
                    </h3>
                    {packinghouse.short_code && (
                      <span className="px-2 py-0.5 bg-cream-100 text-bark-600 text-xs rounded">
                        {packinghouse.short_code}
                      </span>
                    )}
                    {!packinghouse.is_active && (
                      <span className="px-2 py-0.5 bg-danger-bg text-danger text-xs rounded">
                        Inactive
                      </span>
                    )}
                  </div>

                  {packinghouse.grower_id && (
                    <p className="text-sm text-bark-600 mt-1">
                      Grower ID: <span className="font-medium">{packinghouse.grower_id}</span>
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-text-secondary">
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
                    <div className="flex items-center text-text-secondary">
                      <Boxes className="w-4 h-4 mr-1" />
                      <span className="text-lg font-semibold text-heading">
                        {packinghouse.pool_count || 0}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">Pools</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(packinghouse)}
                      className="p-2 text-text-muted hover:text-link hover:bg-orange-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(packinghouse.id, packinghouse.name)}
                      className="p-2 text-text-muted hover:text-danger hover:bg-danger-bg rounded-lg transition-colors"
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
