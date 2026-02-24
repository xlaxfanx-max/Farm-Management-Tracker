import React, { useState, useMemo } from 'react';
import { Home, Plus, MapPin, Locate, Search, X } from 'lucide-react';
import FarmMap from './FarmMap';
import FarmCard from './FarmCard';
import FarmToolbar from './FarmToolbar';
import FarmInsightsPanel from './FarmInsightsPanel';
import GeocodePreviewModal from './GeocodePreviewModal';
import { mapAPI, farmsAPI } from '../services/api';
import { useData } from '../contexts/DataContext';
import { useModal } from '../contexts/ModalContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { useToast } from '../contexts/ToastContext';

function Farms() {
  const { farms, fields, applications, applicationEvents, updateFarm, deleteFarm, deleteField, loadData } = useData();
  const { openFarmModal, openFieldModal } = useModal();
  const confirm = useConfirm();
  const toast = useToast();
  const [expandedFarms, setExpandedFarms] = useState(new Set());
  const [viewMode, setViewMode] = useState('cards'); // 'cards', 'map', 'split'
  const [selectedFarmId, setSelectedFarmId] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [geocodingFarmId, setGeocodingFarmId] = useState(null);
  const [drawingField, setDrawingField] = useState(null); // { id, name } - field to start drawing for

  // Geocoding preview state
  const [geocodePreview, setGeocodePreview] = useState({
    isOpen: false,
    farm: null,
    result: null,
    isLoading: false,
    error: null
  });

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCounty, setFilterCounty] = useState('');
  const [filterMapped, setFilterMapped] = useState('all'); // 'all' | 'mapped' | 'unmapped'

  // Wrapper functions for modal actions
  const handleNewFarm = () => openFarmModal();
  const handleEditFarm = (farm, autoSave = false) => {
    if (autoSave) {
      updateFarm(farm.id, farm);
    } else {
      openFarmModal(farm);
    }
  };
  const handleDeleteFarm = async (farmId) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this farm?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    const result = await deleteFarm(farmId);
    if (!result.success) {
      toast.error(result.error);
    }
  };
  const handleNewField = (farmId) => openFieldModal(null, farmId);
  const handleEditField = (field) => openFieldModal(field);
  const handleDeleteField = async (fieldId) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this field?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    const result = await deleteField(fieldId);
    if (!result.success) {
      toast.error(result.error);
    }
  };

  // Handle empty data - memoized to prevent dependency issues
  const safeFarms = useMemo(() => farms || [], [farms]);
  const safeFields = useMemo(() => fields || [], [fields]);
  const safeApplications = useMemo(() => applications || [], [applications]);
  const safeApplicationEvents = useMemo(() => applicationEvents || [], [applicationEvents]);

  const toggleFarm = (farmId) => {
    const newExpanded = new Set(expandedFarms);
    if (newExpanded.has(farmId)) {
      newExpanded.delete(farmId);
    } else {
      newExpanded.add(farmId);
    }
    setExpandedFarms(newExpanded);
  };

  const getFarmFields = (farmId) => {
    return safeFields.filter(field => {
      const fieldFarmId = parseInt(field.farm);
      const compareFarmId = parseInt(farmId);
      return fieldFarmId === compareFarmId;
    });
  };

  const getFieldApplicationCount = (fieldId, fieldName) => {
    const legacyCount = safeApplications.filter(app =>
      app.field === fieldId || app.field_name === fieldName
    ).length;
    const eventCount = safeApplicationEvents.filter(evt =>
      evt.field === fieldId
    ).length;
    return legacyCount + eventCount;
  };

  // Get unique counties for filter dropdown
  const uniqueCounties = useMemo(() => {
    const counties = safeFarms.map(f => f.county).filter(Boolean);
    return [...new Set(counties)].sort();
  }, [safeFarms]);

  // Filter farms based on search and filters
  const filteredFarms = useMemo(() => {
    return safeFarms.filter(farm => {
      // Search filter
      const matchesSearch = !searchTerm ||
        farm.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        farm.farm_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        farm.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        farm.county?.toLowerCase().includes(searchTerm.toLowerCase());

      // County filter
      const matchesCounty = !filterCounty || farm.county === filterCounty;

      // Mapping status filter
      const hasCoordsValue = farm.gps_latitude && farm.gps_longitude;
      const matchesMapped = filterMapped === 'all' ||
        (filterMapped === 'mapped' && hasCoordsValue) ||
        (filterMapped === 'unmapped' && !hasCoordsValue);

      return matchesSearch && matchesCounty && matchesMapped;
    });
  }, [safeFarms, searchTerm, filterCounty, filterMapped]);

  // Expand all / collapse all helpers
  const expandAll = () => setExpandedFarms(new Set(filteredFarms.map(f => f.id)));
  const collapseAll = () => setExpandedFarms(new Set());

  // Calculate farm statistics
  const getFarmStats = (farmId) => {
    const farmFields = getFarmFields(farmId);
    const totalAcres = farmFields.reduce((sum, f) => sum + (parseFloat(f.total_acres) || 0), 0);
    const mappedFields = farmFields.filter(f => f.boundary_geojson).length;
    const totalApplications = farmFields.reduce((sum, f) =>
      sum + getFieldApplicationCount(f.id, f.name), 0);

    // Get crop distribution
    const cropAcres = {};
    farmFields.forEach(f => {
      const crop = f.crop_name || f.current_crop || 'Unknown';
      cropAcres[crop] = (cropAcres[crop] || 0) + (parseFloat(f.total_acres) || 0);
    });
    const topCrop = Object.entries(cropAcres).sort((a, b) => b[1] - a[1])[0];

    return {
      totalAcres,
      fieldCount: farmFields.length,
      mappedFields,
      totalApplications,
      topCrop: topCrop ? topCrop[0] : null
    };
  };

  // Handle farm selection from map
  const handleFarmSelect = (farmId) => {
    setSelectedFarmId(farmId);
    setSelectedFieldId(null);
    // Expand the farm
    setExpandedFarms(prev => new Set([...prev, farmId]));
  };

  // Handle field selection from map
  const handleFieldSelect = (fieldId) => {
    setSelectedFieldId(fieldId);
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      setSelectedFarmId(parseInt(field.farm));
      setExpandedFarms(prev => new Set([...prev, parseInt(field.farm)]));
    }
  };

  // Handle boundary update from map
  const handleBoundaryUpdate = async (fieldId, geojson, acres) => {
    console.log('[Farms] handleBoundaryUpdate called:', { fieldId, geojson, acres });
    try {
      const response = await mapAPI.updateFieldBoundary(fieldId, geojson, acres);
      console.log('[Farms] Boundary update response:', response.data);
      if (loadData) loadData();
    } catch (err) {
      console.error('[Farms] Error saving boundary:', err);
      toast.error('Failed to save field boundary');
    }
  };

  // Geocode farm address - opens preview modal
  const handleGeocodeFarm = async (farm) => {
    if (!farm.address && !farm.county) {
      toast.info('Farm needs an address or county to get GPS coordinates');
      return;
    }

    // Open preview modal in loading state
    setGeocodePreview({
      isOpen: true,
      farm: farm,
      result: null,
      isLoading: true,
      error: null
    });
    setGeocodingFarmId(farm.id);

    try {
      // Send address, county, and city for better geocoding
      const response = await mapAPI.geocode({
        address: farm.address || '',
        county: farm.county || '',
        city: farm.city || ''
      });

      if (response.data && response.data.lat) {
        setGeocodePreview(prev => ({
          ...prev,
          result: response.data,
          isLoading: false,
          error: null
        }));
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      const errorData = err.response?.data || {};
      setGeocodePreview(prev => ({
        ...prev,
        isLoading: false,
        error: {
          message: errorData.error || 'Could not find coordinates for this address',
          suggestion: errorData.suggestion,
          triedQueries: errorData.tried_queries
        }
      }));
    } finally {
      setGeocodingFarmId(null);
    }
  };

  // Handle confirming geocoded location from preview modal
  const handleConfirmGeocode = async (locationData) => {
    const farm = geocodePreview.farm;
    if (!farm) return;

    try {
      // Use dedicated endpoint for updating only coordinates
      const response = await farmsAPI.updateCoordinates(
        farm.id,
        locationData.lat,
        locationData.lng
      );

      if (response.data?.success) {
        // Refresh data and close the modal on success
        if (loadData) loadData();
        setGeocodePreview({
          isOpen: false,
          farm: null,
          result: null,
          isLoading: false,
          error: null
        });
      } else {
        toast.error('Failed to save coordinates. Please try again.');
      }
    } catch (err) {
      console.error('Error saving coordinates:', err);
      toast.error('Failed to save coordinates. Please try again.');
    }
  };

  // Close geocode preview modal
  const handleCloseGeocodePreview = () => {
    setGeocodePreview({
      isOpen: false,
      farm: null,
      result: null,
      isLoading: false,
      error: null
    });
  };

  // Stats
  const farmsWithCoords = farms.filter(f => f.gps_latitude && f.gps_longitude).length;
  const fieldsWithBoundaries = fields.filter(f => f.boundary_geojson).length;

  return (
    <div className="space-y-6">
      {/* Toolbar with Header, Search, Filters, and View Controls */}
      <FarmToolbar
        totalFarms={safeFarms.length}
        filteredCount={filteredFarms.length}
        totalFields={safeFields.length}
        mappedFarms={farmsWithCoords}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterCounty={filterCounty}
        onCountyChange={setFilterCounty}
        filterMapped={filterMapped}
        onMappedChange={setFilterMapped}
        counties={uniqueCounties}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        onAddFarm={handleNewFarm}
        showExpandCollapse={filteredFarms.length > 0}
      />

      {/* Insights Panel */}
      {(viewMode === 'cards' || viewMode === 'split') && safeFarms.length > 0 && (
        <FarmInsightsPanel
          farms={safeFarms}
          fields={safeFields}
          applications={safeApplications}
        />
      )}

      {/* Map Hint */}
      {viewMode === 'cards' && farmsWithCoords === 0 && farms.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Add GPS coordinates to see farms on the map</p>
            <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
              Click the <Locate className="w-4 h-4 inline" /> button on a farm to get coordinates from its address, 
              or switch to Map view to see the satellite view.
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={viewMode === 'split' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}>
        
        {/* Map View */}
        {(viewMode === 'map' || viewMode === 'split') && (
          <div className={`relative ${viewMode === 'split' ? 'order-2' : ''}`}>
            <FarmMap
              farms={safeFarms}
              fields={safeFields}
              selectedFarmId={selectedFarmId}
              selectedFieldId={selectedFieldId}
              onFarmSelect={handleFarmSelect}
              onFieldSelect={handleFieldSelect}
              onBoundaryUpdate={handleBoundaryUpdate}
              height={viewMode === 'map' ? '600px' : '500px'}
              drawingField={drawingField}
              onDrawingComplete={() => setDrawingField(null)}
            />

            {/* Tip for fields without boundaries - only show when not drawing */}
            {fieldsWithBoundaries < fields.length && fields.length > 0 && !drawingField && (
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                <strong>Tip:</strong> {fields.length - fieldsWithBoundaries} of {fields.length} fields need boundaries drawn.
                Click on a field marker to draw its boundary.
              </div>
            )}
          </div>
        )}

        {/* Card View */}
        {(viewMode === 'cards' || viewMode === 'split') && (
          <div className={`space-y-4 ${viewMode === 'split' ? 'order-1' : ''}`}>
            {filteredFarms.map(farm => {
              const farmFields = getFarmFields(farm.id);
              const stats = getFarmStats(farm.id);

              return (
                <FarmCard
                  key={farm.id}
                  farm={farm}
                  fields={farmFields}
                  stats={stats}
                  isExpanded={expandedFarms.has(farm.id)}
                  isSelected={selectedFarmId === farm.id}
                  onToggleExpand={toggleFarm}
                  onEdit={handleEditFarm}
                  onDelete={handleDeleteFarm}
                  onAddField={handleNewField}
                  onGeocode={handleGeocodeFarm}
                  isGeocoding={geocodingFarmId === farm.id}
                  selectedFieldId={selectedFieldId}
                  onFieldSelect={handleFieldSelect}
                  onFieldEdit={handleEditField}
                  onFieldDelete={handleDeleteField}
                  onFieldDrawBoundary={(field, farmId) => {
                    // Use split view to keep the card visible while drawing
                    setViewMode('split');
                    setSelectedFieldId(field.id);
                    setSelectedFarmId(farmId);
                    // Ensure farm is expanded
                    setExpandedFarms(prev => new Set([...prev, farmId]));
                    // Small delay to let map render, then trigger drawing
                    setTimeout(() => {
                      setDrawingField({ id: field.id, name: field.name });
                    }, 300);
                  }}
                  getFieldApplicationCount={getFieldApplicationCount}
                />
              );
            })}

            {/* No farms at all */}
            {safeFarms.length === 0 && (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                <Home className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={48} />
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">No farms yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Get started by adding your first farm</p>
                <button
                  onClick={handleNewFarm}
                  className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                >
                  <Plus size={20} />
                  Add Your First Farm
                </button>
              </div>
            )}

            {/* No results from filters */}
            {safeFarms.length > 0 && filteredFarms.length === 0 && (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
                <Search className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={48} />
                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">No farms match your filters</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Try adjusting your search or filter criteria</p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterCounty('');
                    setFilterMapped('all');
                  }}
                  className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
                >
                  <X size={16} />
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Geocode Preview Modal */}
      <GeocodePreviewModal
        isOpen={geocodePreview.isOpen}
        onClose={handleCloseGeocodePreview}
        onConfirm={handleConfirmGeocode}
        farmName={geocodePreview.farm?.name || ''}
        initialResult={geocodePreview.result}
        isLoading={geocodePreview.isLoading}
        error={geocodePreview.error}
        onRetry={() => {
          if (geocodePreview.farm) {
            openFarmModal(geocodePreview.farm);
            handleCloseGeocodePreview();
          }
        }}
      />
    </div>
  );
}

export default Farms;
