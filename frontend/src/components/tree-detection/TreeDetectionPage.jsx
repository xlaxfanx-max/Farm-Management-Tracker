import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Trees, ChevronDown, RefreshCw, Calendar, Layers, AlertTriangle, Search } from 'lucide-react';
import { treeSurveyAPI } from '../../services/api';
import { useData } from '../../contexts/DataContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import SurveyUploadForm from './SurveyUploadForm';
import SurveyResultsPanel from './SurveyResultsPanel';
import TreeMap from './TreeMap';

const POLL_INTERVAL = 3000;

const TreeDetectionPage = () => {
  const { farms, fields } = useData();
  const confirm = useConfirm();

  const [selectedFarm, setSelectedFarm] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [surveys, setSurveys] = useState([]);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [trees, setTrees] = useState([]);
  const [healthSummary, setHealthSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingTrees, setLoadingTrees] = useState(false);
  const [error, setError] = useState(null);

  const pollRef = useRef(null);

  // Fields filtered by selected farm
  const filteredFields = selectedFarm
    ? fields.filter((f) => String(f.farm) === String(selectedFarm))
    : [];

  // Currently selected field object
  const activeField = fields.find((f) => String(f.id) === String(selectedField)) || null;

  // Load surveys when field changes
  const loadSurveys = useCallback(async () => {
    if (!selectedField) {
      setSurveys([]);
      setSelectedSurvey(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await treeSurveyAPI.getAll({ field: selectedField });
      const data = res.data.results || res.data || [];
      setSurveys(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load surveys:', err);
      setError('Failed to load surveys. Please try again.');
      setSurveys([]);
    } finally {
      setLoading(false);
    }
  }, [selectedField]);

  useEffect(() => {
    loadSurveys();
    setSelectedSurvey(null);
    setTrees([]);
    setHealthSummary(null);
  }, [loadSurveys]);

  // Load tree data and health summary when survey is selected
  const loadSurveyDetails = useCallback(async (survey) => {
    if (!survey || survey.status === 'pending' || survey.status === 'processing') return;
    setLoadingTrees(true);
    try {
      const [treesRes, healthRes] = await Promise.all([
        treeSurveyAPI.getTrees(survey.id),
        treeSurveyAPI.getHealthSummary(survey.id),
      ]);
      setTrees(treesRes.data.results || treesRes.data || []);
      setHealthSummary(healthRes.data);
    } catch (err) {
      console.error('Failed to load survey details:', err);
      setTrees([]);
      setHealthSummary(null);
    } finally {
      setLoadingTrees(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSurvey && selectedSurvey.status === 'completed') {
      loadSurveyDetails(selectedSurvey);
    } else {
      setTrees([]);
      setHealthSummary(null);
    }
  }, [selectedSurvey, loadSurveyDetails]);

  // Polling for processing surveys
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (surveyId) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await treeSurveyAPI.get(surveyId);
          const updated = res.data;
          if (updated.status !== 'processing') {
            stopPolling();
            setSelectedSurvey(updated);
            // Refresh surveys list to reflect status change
            loadSurveys();
          }
        } catch (err) {
          console.error('Polling error:', err);
          stopPolling();
        }
      }, POLL_INTERVAL);
    },
    [stopPolling, loadSurveys]
  );

  // Clean up polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Handle detection trigger
  const handleRunDetection = async (survey) => {
    try {
      setError(null);
      await treeSurveyAPI.detect(survey.id);
      const updated = { ...survey, status: 'processing' };
      setSelectedSurvey(updated);
      // Update survey in list
      setSurveys((prev) =>
        prev.map((s) => (s.id === survey.id ? updated : s))
      );
      startPolling(survey.id);
    } catch (err) {
      console.error('Failed to start detection:', err);
      setError('Failed to start tree detection. Please try again.');
    }
  };

  // Handle upload completion
  const handleUploadComplete = (newSurvey) => {
    loadSurveys();
    if (newSurvey) {
      setSelectedSurvey(newSurvey);
    }
  };

  // Handle survey deletion
  const handleDeleteSurvey = async (surveyId) => {
    const ok = await confirm({
      title: 'Are you sure?',
      message: 'Are you sure you want to delete this survey?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await treeSurveyAPI.delete(surveyId);
      if (selectedSurvey && selectedSurvey.id === surveyId) {
        setSelectedSurvey(null);
        setTrees([]);
        setHealthSummary(null);
      }
      loadSurveys();
    } catch (err) {
      console.error('Failed to delete survey:', err);
      setError('Failed to delete survey.');
    }
  };

  // Handle farm change
  const handleFarmChange = (e) => {
    setSelectedFarm(e.target.value);
    setSelectedField('');
    setSelectedSurvey(null);
    setSurveys([]);
    setTrees([]);
    setHealthSummary(null);
    stopPolling();
  };

  // Handle field change
  const handleFieldChange = (e) => {
    setSelectedField(e.target.value);
    setSelectedSurvey(null);
    setTrees([]);
    setHealthSummary(null);
    stopPolling();
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Pending' },
      processing: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Processing' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
      failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
    };
    const c = config[status] || config.pending;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
        {c.label}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Trees className="text-green-600" size={28} />
          Tree Detection
        </h1>
        <p className="text-slate-600 mt-1">
          Upload aerial imagery and detect individual trees with health analysis
        </p>
      </div>

      {/* Farm/Field Selectors */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Farm
            </label>
            <div className="relative">
              <select
                value={selectedFarm}
                onChange={handleFarmChange}
                className="w-full px-3 py-2 pr-8 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="">Select a farm...</option>
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Field
            </label>
            <div className="relative">
              <select
                value={selectedField}
                onChange={handleFieldChange}
                disabled={!selectedFarm}
                className="w-full px-3 py-2 pr-8 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none bg-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">
                  {selectedFarm ? 'Select a field...' : 'Select a farm first'}
                </option>
                {filteredFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name} ({field.total_acres} acres)
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            &times;
          </button>
        </div>
      )}

      {/* No field selected state */}
      {!selectedField && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Search size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            Select a Farm and Field
          </h3>
          <p className="text-slate-500">
            Choose a farm and field above to view surveys or upload new imagery for tree detection.
          </p>
        </div>
      )}

      {/* Field selected: Upload + Survey List */}
      {selectedField && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Upload + Survey List */}
          <div className="lg:col-span-1 space-y-6">
            {/* Upload Form */}
            <SurveyUploadForm
              fieldId={selectedField}
              onUploadComplete={handleUploadComplete}
            />

            {/* Surveys List */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Layers size={18} />
                  Surveys
                </h3>
                <button
                  onClick={loadSurveys}
                  disabled={loading}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                  title="Refresh surveys"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              {loading && surveys.length === 0 ? (
                <div className="p-8 text-center">
                  <RefreshCw size={24} className="animate-spin text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">Loading surveys...</p>
                </div>
              ) : surveys.length === 0 ? (
                <div className="p-8 text-center">
                  <Trees size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">No surveys yet</p>
                  <p className="text-slate-400 text-xs mt-1">
                    Upload an image above to get started
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {surveys.map((survey) => (
                    <button
                      key={survey.id}
                      onClick={() => setSelectedSurvey(survey)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                        selectedSurvey?.id === survey.id
                          ? 'bg-green-50 border-l-2 border-green-500'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {survey.filename || survey.original_filename || `Survey #${survey.id}`}
                        </span>
                        {getStatusBadge(survey.status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {survey.capture_date && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(survey.capture_date).toLocaleDateString()}
                          </span>
                        )}
                        {survey.tree_count != null && survey.tree_count > 0 && (
                          <span className="flex items-center gap-1">
                            <Trees size={12} />
                            {survey.tree_count} trees
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column: Results + Map */}
          <div className="lg:col-span-2 space-y-6">
            {selectedSurvey ? (
              <>
                {/* Survey action bar */}
                <div className="bg-white rounded-lg shadow-sm px-4 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">
                      {selectedSurvey.filename ||
                        selectedSurvey.original_filename ||
                        `Survey #${selectedSurvey.id}`}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedSurvey.source && `Source: ${selectedSurvey.source}`}
                      {selectedSurvey.capture_date &&
                        ` | Captured: ${new Date(selectedSurvey.capture_date).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(selectedSurvey.status === 'pending' ||
                      selectedSurvey.status === 'failed') && (
                      <button
                        onClick={() => handleRunDetection(selectedSurvey)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Search size={14} />
                        Run Detection
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteSurvey(selectedSurvey.id)}
                      className="px-3 py-1.5 text-red-600 text-sm border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Results Panel */}
                <SurveyResultsPanel
                  survey={selectedSurvey}
                  healthSummary={healthSummary}
                />

                {/* Tree Map */}
                {selectedSurvey.status === 'completed' && (
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200">
                      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Trees size={18} className="text-green-600" />
                        Tree Map
                      </h3>
                    </div>
                    <TreeMap
                      trees={trees}
                      field={activeField}
                      loading={loadingTrees}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <Layers size={48} className="text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  Select a Survey
                </h3>
                <p className="text-slate-500">
                  Choose a survey from the list or upload new imagery to begin tree detection.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TreeDetectionPage;
