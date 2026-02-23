import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  Calendar,
  Clock,
  MapPin,
  Link as LinkIcon,
  X,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  UserCheck,
  Truck,
  Briefcase,
  ClipboardCheck,
} from 'lucide-react';
import { fsmaAPI } from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import SignatureCapture from './SignatureCapture';

/**
 * VisitorLogList Component
 *
 * Manages visitor logs with:
 * - Quick entry mode for field workers
 * - Full entry form with signature capture
 * - Auto-suggest harvest linking
 * - Search and filter capabilities
 */
const VisitorLogList = () => {
  const confirm = useConfirm();
  const toast = useToast();
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    visitor_name: '',
    visitor_type: 'other',
    company_name: '',
    purpose: '',
    visit_date: new Date().toISOString().split('T')[0],
    time_in: '',
    time_out: '',
    fields_visited: [],
    vehicle_info: '',
    signature_data: '',
    notes: '',
  });

  // Related data
  const [farms, setFarms] = useState([]);
  const [fields, setFields] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState('');
  const [harvestSuggestions, setHarvestSuggestions] = useState([]);
  const [linkedHarvest, setLinkedHarvest] = useState(null);

  const visitorTypes = [
    { value: 'harvester', label: 'Harvester', icon: Truck },
    { value: 'inspector', label: 'Inspector', icon: ClipboardCheck },
    { value: 'contractor', label: 'Contractor', icon: Briefcase },
    { value: 'vendor', label: 'Vendor', icon: Users },
    { value: 'other', label: 'Other', icon: UserCheck },
  ];

  const fetchVisitors = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateFilter) params.visit_date = dateFilter;
      if (typeFilter) params.visitor_type = typeFilter;
      if (searchTerm) params.search = searchTerm;

      const response = await fsmaAPI.getVisitorLogs(params);
      setVisitors(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching visitors:', error);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, typeFilter, searchTerm]);

  const fetchRelatedData = async () => {
    try {
      const [farmsRes, fieldsRes] = await Promise.all([
        fsmaAPI.getFarms(),
        fsmaAPI.getFields(),
      ]);
      setFarms(farmsRes.data.results || farmsRes.data || []);
      setFields(fieldsRes.data.results || fieldsRes.data || []);
    } catch (error) {
      console.error('Error fetching related data:', error);
    }
  };

  useEffect(() => {
    fetchVisitors();
    fetchRelatedData();
  }, [fetchVisitors]);

  // Check for harvest overlaps when date or visitor type changes
  useEffect(() => {
    const checkHarvestOverlap = async () => {
      if (formData.visitor_type === 'harvester' && formData.visit_date) {
        try {
          const response = await fsmaAPI.checkHarvestOverlap({
            visit_date: formData.visit_date,
            fields_visited: formData.fields_visited,
          });
          setHarvestSuggestions(response.data.harvests || []);
        } catch (error) {
          console.error('Error checking harvest overlap:', error);
        }
      } else {
        setHarvestSuggestions([]);
      }
    };
    checkHarvestOverlap();
  }, [formData.visit_date, formData.visitor_type, formData.fields_visited]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFieldSelection = (fieldId) => {
    setFormData((prev) => {
      const fields = prev.fields_visited.includes(fieldId)
        ? prev.fields_visited.filter((id) => id !== fieldId)
        : [...prev.fields_visited, fieldId];
      return { ...prev, fields_visited: fields };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        linked_harvest: linkedHarvest,
      };

      if (editingVisitor) {
        await fsmaAPI.updateVisitorLog(editingVisitor.id, payload);
      } else {
        await fsmaAPI.createVisitorLog(payload);
      }

      setShowModal(false);
      resetForm();
      fetchVisitors();
    } catch (error) {
      console.error('Error saving visitor:', error);
      toast.error('Failed to save visitor log');
    }
  };

  const handleSignOut = async (visitorId) => {
    try {
      await fsmaAPI.signOutVisitor(visitorId, {
        time_out: new Date().toTimeString().slice(0, 5),
      });
      fetchVisitors();
    } catch (error) {
      console.error('Error signing out visitor:', error);
    }
  };

  const handleDelete = async (visitorId) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this visitor log?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await fsmaAPI.deleteVisitorLog(visitorId);
      fetchVisitors();
    } catch (error) {
      console.error('Error deleting visitor:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      visitor_name: '',
      visitor_type: 'other',
      company_name: '',
      purpose: '',
      visit_date: new Date().toISOString().split('T')[0],
      time_in: '',
      time_out: '',
      fields_visited: [],
      vehicle_info: '',
      signature_data: '',
      notes: '',
    });
    setEditingVisitor(null);
    setLinkedHarvest(null);
    setHarvestSuggestions([]);
  };

  const openEditModal = (visitor) => {
    setEditingVisitor(visitor);
    setFormData({
      visitor_name: visitor.visitor_name,
      visitor_type: visitor.visitor_type,
      company_name: visitor.company_name || '',
      purpose: visitor.purpose || '',
      visit_date: visitor.visit_date,
      time_in: visitor.time_in || '',
      time_out: visitor.time_out || '',
      fields_visited: visitor.fields_visited?.map((f) => f.id) || [],
      vehicle_info: visitor.vehicle_info || '',
      signature_data: visitor.signature_data || '',
      notes: visitor.notes || '',
    });
    setLinkedHarvest(visitor.linked_harvest?.id || null);
    setShowModal(true);
  };

  const getVisitorTypeIcon = (type) => {
    const visitorType = visitorTypes.find((vt) => vt.value === type);
    return visitorType ? visitorType.icon : UserCheck;
  };

  const filteredFields = selectedFarm
    ? fields.filter((f) => f.farm === parseInt(selectedFarm))
    : fields;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-6 h-6" />
          Visitor Logs
        </h2>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Visitor
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search visitors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">All Types</option>
            {visitorTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            setSearchTerm('');
            setDateFilter('');
            setTypeFilter('');
          }}
          className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Clear Filters
        </button>
      </div>

      {/* Visitor List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : visitors.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No visitor logs found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visitors.map((visitor) => {
            const TypeIcon = getVisitorTypeIcon(visitor.visitor_type);
            const isExpanded = expandedId === visitor.id;

            return (
              <div
                key={visitor.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Main row */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  onClick={() => setExpandedId(isExpanded ? null : visitor.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <TypeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {visitor.visitor_name}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(visitor.visit_date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {visitor.time_in}
                          {visitor.time_out && ` - ${visitor.time_out}`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {visitor.linked_harvest && (
                      <span className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded">
                        <LinkIcon className="w-3 h-3" />
                        Linked to Harvest
                      </span>
                    )}
                    {!visitor.time_out && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSignOut(visitor.id);
                        }}
                        className="px-3 py-1 text-sm bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded hover:bg-orange-200 dark:hover:bg-orange-900/50"
                      >
                        Sign Out
                      </button>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Company</p>
                        <p className="text-gray-900 dark:text-white">
                          {visitor.company_name || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Purpose</p>
                        <p className="text-gray-900 dark:text-white">
                          {visitor.purpose || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Fields Visited
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {visitor.fields_visited?.length > 0 ? (
                            visitor.fields_visited.map((field) => (
                              <span
                                key={field.id}
                                className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                              >
                                {field.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500">None recorded</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Vehicle</p>
                        <p className="text-gray-900 dark:text-white">
                          {visitor.vehicle_info || 'N/A'}
                        </p>
                      </div>
                      {visitor.notes && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-500 dark:text-gray-400">Notes</p>
                          <p className="text-gray-900 dark:text-white">{visitor.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => openEditModal(visitor)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(visitor.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingVisitor ? 'Edit Visitor Log' : 'Add Visitor'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Visitor Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Visitor Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {visitorTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, visitor_type: type.value }))
                        }
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                          formData.visitor_type === type.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Visitor Name *
                  </label>
                  <input
                    type="text"
                    name="visitor_name"
                    value={formData.visitor_name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Date/Time */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Visit Date *
                  </label>
                  <input
                    type="date"
                    name="visit_date"
                    value={formData.visit_date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Time In *
                  </label>
                  <input
                    type="time"
                    name="time_in"
                    value={formData.time_in}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Time Out
                  </label>
                  <input
                    type="time"
                    name="time_out"
                    value={formData.time_out}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Purpose of Visit
                </label>
                <input
                  type="text"
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleInputChange}
                  placeholder="e.g., Citrus harvest, Inspection, Delivery"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Fields Visited */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fields Visited
                </label>
                <div className="mb-2">
                  <select
                    value={selectedFarm}
                    onChange={(e) => setSelectedFarm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Farms</option>
                    {farms.map((farm) => (
                      <option key={farm.id} value={farm.id}>
                        {farm.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2">
                  {filteredFields.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 p-2">
                      No fields available
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {filteredFields.map((field) => (
                        <label
                          key={field.id}
                          className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.fields_visited.includes(field.id)}
                            onChange={() => handleFieldSelection(field.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {field.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Harvest Link Suggestions */}
              {formData.visitor_type === 'harvester' && harvestSuggestions.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    Link to Harvest Record
                  </h4>
                  <div className="space-y-2">
                    {harvestSuggestions.map((harvest) => (
                      <label
                        key={harvest.id}
                        className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="linked_harvest"
                          value={harvest.id}
                          checked={linkedHarvest === harvest.id}
                          onChange={() => setLinkedHarvest(harvest.id)}
                          className="text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {harvest.field_name} - {harvest.crop} ({harvest.harvest_date})
                        </span>
                      </label>
                    ))}
                    <label className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded cursor-pointer">
                      <input
                        type="radio"
                        name="linked_harvest"
                        value=""
                        checked={linkedHarvest === null}
                        onChange={() => setLinkedHarvest(null)}
                        className="text-gray-600 focus:ring-gray-500"
                      />
                      <span className="text-sm text-gray-500">No harvest link</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Vehicle Info */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Vehicle Information
                </label>
                <input
                  type="text"
                  name="vehicle_info"
                  value={formData.vehicle_info}
                  onChange={handleInputChange}
                  placeholder="e.g., White Ford F-150, License ABC123"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Signature */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Visitor Signature
                </label>
                <SignatureCapture
                  value={formData.signature_data}
                  onChange={(sig) => setFormData((prev) => ({ ...prev, signature_data: sig }))}
                  showSavedOption={false}
                  height={120}
                  width={350}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingVisitor ? 'Update' : 'Save'} Visitor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitorLogList;
