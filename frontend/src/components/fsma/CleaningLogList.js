import React, { useState, useEffect, useCallback } from 'react';
import {
  SprayCanIcon as Spray,
  Plus,
  Search,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Building,
  Warehouse,
  Truck,
  Package,
  Home,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Settings,
  X,
  Check,
} from 'lucide-react';
import { fsmaAPI } from '../../services/api';
import SignatureCapture from './SignatureCapture';

/**
 * CleaningLogList Component
 *
 * Manages facility cleaning logs with:
 * - Facility management
 * - Cleaning schedule tracking
 * - Checklist-based cleaning records
 * - Compliance status overview
 */
const CleaningLogList = () => {
  const [activeTab, setActiveTab] = useState('logs'); // 'logs' or 'facilities'
  const [cleaningLogs, setCleaningLogs] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showFacilityModal, setShowFacilityModal] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [editingFacility, setEditingFacility] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [dateFilter, setDateFilter] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('');

  // Farms for facility assignment
  const [farms, setFarms] = useState([]);

  // Log form state
  const [logFormData, setLogFormData] = useState({
    facility: '',
    cleaning_date: new Date().toISOString().split('T')[0],
    cleaning_time: new Date().toTimeString().slice(0, 5),
    cleaned_by: '',
    surfaces_cleaned: false,
    equipment_sanitized: false,
    floors_cleaned: false,
    waste_removed: false,
    chemicals_stored: false,
    signature_data: '',
    notes: '',
  });

  // Facility form state
  const [facilityFormData, setFacilityFormData] = useState({
    name: '',
    facility_type: 'packing_shed',
    farm: '',
    description: '',
    cleaning_frequency: 'daily',
    last_cleaned: '',
    is_active: true,
  });

  const facilityTypes = [
    { value: 'packing_shed', label: 'Packing Shed', icon: Warehouse },
    { value: 'storage', label: 'Storage', icon: Package },
    { value: 'equipment', label: 'Equipment Area', icon: Truck },
    { value: 'restroom', label: 'Restroom', icon: Home },
    { value: 'office', label: 'Office', icon: Building },
    { value: 'other', label: 'Other', icon: Building },
  ];

  const cleaningFrequencies = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Bi-Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
  ];

  const checklistItems = [
    { key: 'surfaces_cleaned', label: 'All surfaces cleaned and sanitized' },
    { key: 'equipment_sanitized', label: 'Equipment sanitized' },
    { key: 'floors_cleaned', label: 'Floors swept and mopped' },
    { key: 'waste_removed', label: 'Waste and debris removed' },
    { key: 'chemicals_stored', label: 'Chemicals properly stored' },
  ];

  const fetchCleaningLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateFilter) params.cleaning_date = dateFilter;
      if (facilityFilter) params.facility = facilityFilter;

      const response = await fsmaAPI.getCleaningLogs(params);
      setCleaningLogs(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching cleaning logs:', error);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, facilityFilter]);

  const fetchFacilities = async () => {
    try {
      const response = await fsmaAPI.getFacilities();
      setFacilities(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching facilities:', error);
    }
  };

  const fetchFarms = async () => {
    try {
      const response = await fsmaAPI.getFarms();
      setFarms(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching farms:', error);
    }
  };

  useEffect(() => {
    fetchCleaningLogs();
    fetchFacilities();
    fetchFarms();
  }, [fetchCleaningLogs]);

  const handleLogInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLogFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFacilityInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFacilityFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingLog) {
        await fsmaAPI.updateCleaningLog(editingLog.id, logFormData);
      } else {
        await fsmaAPI.createCleaningLog(logFormData);
      }
      setShowLogModal(false);
      resetLogForm();
      fetchCleaningLogs();
      fetchFacilities(); // Refresh to update last_cleaned
    } catch (error) {
      console.error('Error saving cleaning log:', error);
      alert('Failed to save cleaning log');
    }
  };

  const handleFacilitySubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingFacility) {
        await fsmaAPI.updateFacility(editingFacility.id, facilityFormData);
      } else {
        await fsmaAPI.createFacility(facilityFormData);
      }
      setShowFacilityModal(false);
      resetFacilityForm();
      fetchFacilities();
    } catch (error) {
      console.error('Error saving facility:', error);
      alert('Failed to save facility');
    }
  };

  const handleDeleteLog = async (logId) => {
    if (!window.confirm('Are you sure you want to delete this cleaning log?')) return;
    try {
      await fsmaAPI.deleteCleaningLog(logId);
      fetchCleaningLogs();
    } catch (error) {
      console.error('Error deleting cleaning log:', error);
    }
  };

  const handleDeleteFacility = async (facilityId) => {
    if (!window.confirm('Are you sure you want to delete this facility?')) return;
    try {
      await fsmaAPI.deleteFacility(facilityId);
      fetchFacilities();
    } catch (error) {
      console.error('Error deleting facility:', error);
    }
  };

  const resetLogForm = () => {
    setLogFormData({
      facility: '',
      cleaning_date: new Date().toISOString().split('T')[0],
      cleaning_time: new Date().toTimeString().slice(0, 5),
      cleaned_by: '',
      surfaces_cleaned: false,
      equipment_sanitized: false,
      floors_cleaned: false,
      waste_removed: false,
      chemicals_stored: false,
      signature_data: '',
      notes: '',
    });
    setEditingLog(null);
  };

  const resetFacilityForm = () => {
    setFacilityFormData({
      name: '',
      facility_type: 'packing_shed',
      farm: '',
      description: '',
      cleaning_frequency: 'daily',
      last_cleaned: '',
      is_active: true,
    });
    setEditingFacility(null);
  };

  const openEditLogModal = (log) => {
    setEditingLog(log);
    setLogFormData({
      facility: log.facility?.id || '',
      cleaning_date: log.cleaning_date,
      cleaning_time: log.cleaning_time || '',
      cleaned_by: log.cleaned_by || '',
      surfaces_cleaned: log.surfaces_cleaned || false,
      equipment_sanitized: log.equipment_sanitized || false,
      floors_cleaned: log.floors_cleaned || false,
      waste_removed: log.waste_removed || false,
      chemicals_stored: log.chemicals_stored || false,
      signature_data: log.signature_data || '',
      notes: log.notes || '',
    });
    setShowLogModal(true);
  };

  const openEditFacilityModal = (facility) => {
    setEditingFacility(facility);
    setFacilityFormData({
      name: facility.name,
      facility_type: facility.facility_type,
      farm: facility.farm?.id || '',
      description: facility.description || '',
      cleaning_frequency: facility.cleaning_frequency,
      last_cleaned: facility.last_cleaned || '',
      is_active: facility.is_active,
    });
    setShowFacilityModal(true);
  };

  const getFacilityIcon = (type) => {
    const facilityType = facilityTypes.find((ft) => ft.value === type);
    return facilityType ? facilityType.icon : Building;
  };

  const getComplianceStatus = (facility) => {
    if (!facility.last_cleaned) return 'overdue';

    const lastCleaned = new Date(facility.last_cleaned);
    const now = new Date();
    const daysSince = Math.floor((now - lastCleaned) / (1000 * 60 * 60 * 24));

    const frequencyDays = {
      daily: 1,
      weekly: 7,
      biweekly: 14,
      monthly: 30,
      quarterly: 90,
    };

    const requiredDays = frequencyDays[facility.cleaning_frequency] || 1;
    return daysSince <= requiredDays ? 'compliant' : 'overdue';
  };

  const getChecklistCompletionCount = (log) => {
    let completed = 0;
    checklistItems.forEach((item) => {
      if (log[item.key]) completed++;
    });
    return completed;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Spray className="w-6 h-6" />
          Facility Cleaning
        </h2>
        <div className="flex items-center gap-2">
          {activeTab === 'logs' ? (
            <button
              onClick={() => {
                resetLogForm();
                setShowLogModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Log Cleaning
            </button>
          ) : (
            <button
              onClick={() => {
                resetFacilityForm();
                setShowFacilityModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Facility
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Cleaning Logs
          </button>
          <button
            onClick={() => setActiveTab('facilities')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'facilities'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Manage Facilities
            </span>
          </button>
        </div>
      </div>

      {/* Cleaning Logs Tab */}
      {activeTab === 'logs' && (
        <>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                value={facilityFilter}
                onChange={(e) => setFacilityFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All Facilities</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                setDateFilter('');
                setFacilityFilter('');
              }}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Clear Filters
            </button>
          </div>

          {/* Logs List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : cleaningLogs.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Spray className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No cleaning logs found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cleaningLogs.map((log) => {
                const FacilityIcon = getFacilityIcon(log.facility?.facility_type);
                const isExpanded = expandedId === log.id;
                const checklistCount = getChecklistCompletionCount(log);

                return (
                  <div
                    key={log.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <FacilityIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {log.facility?.name || 'Unknown Facility'}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(log.cleaning_date).toLocaleDateString()}
                            </span>
                            {log.cleaning_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {log.cleaning_time}
                              </span>
                            )}
                            <span>by {log.cleaned_by}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            checklistCount === checklistItems.length
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          }`}
                        >
                          {checklistCount}/{checklistItems.length} Complete
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                          {checklistItems.map((item) => (
                            <div
                              key={item.key}
                              className={`flex items-center gap-2 p-2 rounded ${
                                log[item.key]
                                  ? 'bg-green-50 dark:bg-green-900/20'
                                  : 'bg-gray-50 dark:bg-gray-700/50'
                              }`}
                            >
                              {log[item.key] ? (
                                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                              ) : (
                                <X className="w-4 h-4 text-gray-400" />
                              )}
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {item.label}
                              </span>
                            </div>
                          ))}
                        </div>
                        {log.notes && (
                          <div className="mb-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Notes</p>
                            <p className="text-gray-900 dark:text-white">{log.notes}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <button
                            onClick={() => openEditLogModal(log)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
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
        </>
      )}

      {/* Facilities Tab */}
      {activeTab === 'facilities' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {facilities.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Building className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No facilities defined</p>
              <button
                onClick={() => {
                  resetFacilityForm();
                  setShowFacilityModal(true);
                }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add First Facility
              </button>
            </div>
          ) : (
            facilities.map((facility) => {
              const FacilityIcon = getFacilityIcon(facility.facility_type);
              const status = getComplianceStatus(facility);

              return (
                <div
                  key={facility.id}
                  className={`bg-white dark:bg-gray-800 border rounded-lg p-4 ${
                    status === 'compliant'
                      ? 'border-green-200 dark:border-green-800'
                      : 'border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          status === 'compliant'
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : 'bg-red-100 dark:bg-red-900/30'
                        }`}
                      >
                        <FacilityIcon
                          className={`w-5 h-5 ${
                            status === 'compliant'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {facility.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {facilityTypes.find((ft) => ft.value === facility.facility_type)?.label}
                        </p>
                      </div>
                    </div>
                    {status === 'compliant' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Frequency:</span>
                      <span className="text-gray-900 dark:text-white capitalize">
                        {facility.cleaning_frequency}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Last Cleaned:</span>
                      <span className="text-gray-900 dark:text-white">
                        {facility.last_cleaned
                          ? new Date(facility.last_cleaned).toLocaleDateString()
                          : 'Never'}
                      </span>
                    </div>
                    {facility.farm && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Farm:</span>
                        <span className="text-gray-900 dark:text-white">{facility.farm.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => {
                        setLogFormData((prev) => ({ ...prev, facility: facility.id }));
                        setShowLogModal(true);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50"
                    >
                      <Check className="w-4 h-4" />
                      Log Cleaning
                    </button>
                    <button
                      onClick={() => openEditFacilityModal(facility)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteFacility(facility.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Cleaning Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingLog ? 'Edit Cleaning Log' : 'Log Cleaning'}
              </h3>
              <button
                onClick={() => {
                  setShowLogModal(false);
                  resetLogForm();
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleLogSubmit} className="p-6 space-y-6">
              {/* Facility Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Facility *
                </label>
                <select
                  name="facility"
                  value={logFormData.facility}
                  onChange={handleLogInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select facility...</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date/Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    name="cleaning_date"
                    value={logFormData.cleaning_date}
                    onChange={handleLogInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    name="cleaning_time"
                    value={logFormData.cleaning_time}
                    onChange={handleLogInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Cleaned By */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cleaned By *
                </label>
                <input
                  type="text"
                  name="cleaned_by"
                  value={logFormData.cleaned_by}
                  onChange={handleLogInputChange}
                  required
                  placeholder="Enter name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Checklist */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cleaning Checklist
                </label>
                <div className="space-y-2">
                  {checklistItems.map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <input
                        type="checkbox"
                        name={item.key}
                        checked={logFormData[item.key]}
                        onChange={handleLogInputChange}
                        className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Signature */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Signature
                </label>
                <SignatureCapture
                  value={logFormData.signature_data}
                  onChange={(sig) =>
                    setLogFormData((prev) => ({ ...prev, signature_data: sig }))
                  }
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
                  value={logFormData.notes}
                  onChange={handleLogInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowLogModal(false);
                    resetLogForm();
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  {editingLog ? 'Update' : 'Save'} Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Facility Modal */}
      {showFacilityModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingFacility ? 'Edit Facility' : 'Add Facility'}
              </h3>
              <button
                onClick={() => {
                  setShowFacilityModal(false);
                  resetFacilityForm();
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleFacilitySubmit} className="p-6 space-y-6">
              {/* Facility Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Facility Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={facilityFormData.name}
                  onChange={handleFacilityInputChange}
                  required
                  placeholder="e.g., Main Packing Shed"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Facility Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Facility Type *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {facilityTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() =>
                          setFacilityFormData((prev) => ({
                            ...prev,
                            facility_type: type.value,
                          }))
                        }
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                          facilityFormData.facility_type === type.value
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

              {/* Farm */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Farm (Optional)
                </label>
                <select
                  name="farm"
                  value={facilityFormData.farm}
                  onChange={handleFacilityInputChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">No specific farm</option>
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cleaning Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Cleaning Frequency *
                </label>
                <select
                  name="cleaning_frequency"
                  value={facilityFormData.cleaning_frequency}
                  onChange={handleFacilityInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {cleaningFrequencies.map((freq) => (
                    <option key={freq.value} value={freq.value}>
                      {freq.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={facilityFormData.description}
                  onChange={handleFacilityInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Active Status */}
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={facilityFormData.is_active}
                  onChange={handleFacilityInputChange}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300">
                  Facility is active and requires cleaning
                </span>
              </label>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowFacilityModal(false);
                    resetFacilityForm();
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingFacility ? 'Update' : 'Save'} Facility
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleaningLogList;
