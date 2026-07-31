import React, { useState, useEffect } from 'react';
import { Gauge, Save, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';
import Modal from './ui/Modal';
import FormField, { inputClasses } from './ui/FormField';

const BatchReadingModal = ({ isOpen, onClose, wells, onSave }) => {
  const [readingDate, setReadingDate] = useState(new Date().toISOString().split('T')[0]);
  const [recordedBy, setRecordedBy] = useState('');
  const [readings, setReadings] = useState({});
  const [previousReadings, setPreviousReadings] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [savedCount, setSavedCount] = useState(0);
  const [expandedWell, setExpandedWell] = useState(null);

  useEffect(() => {
    if (isOpen && wells?.length > 0) {
      fetchPreviousReadings();
      const initialReadings = {};
      wells.forEach((well) => {
        initialReadings[well.id] = {
          meter_reading: '',
          pump_hours: '',
          water_level_ft: '',
          notes: '',
        };
      });
      setReadings(initialReadings);
      setSavedCount(0);
      setErrors({});
    }
  }, [isOpen, wells]);

  const fetchPreviousReadings = async () => {
    setLoading(true);
    try {
      const prevReadings = {};
      await Promise.all(
        wells.map(async (well) => {
          try {
            const response = await api.get('/well-readings/', {
              params: { water_source: well.id, limit: 1 },
            });
            if (response.data?.length > 0) {
              prevReadings[well.id] = response.data[0];
            }
          } catch (err) {
            console.error(`Error fetching reading for well ${well.id}:`, err);
          }
        })
      );
      setPreviousReadings(prevReadings);
    } finally {
      setLoading(false);
    }
  };

  const handleReadingChange = (wellId, field, value) => {
    setReadings((prev) => ({
      ...prev,
      [wellId]: { ...prev[wellId], [field]: value },
    }));

    if (errors[wellId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[wellId];
        return newErrors;
      });
    }
  };

  const calculateExtraction = (wellId, currentReading) => {
    const prev = previousReadings[wellId];
    if (!prev || !currentReading) return null;
    const current = parseFloat(currentReading);
    const previous = parseFloat(prev.meter_reading);
    if (isNaN(current) || isNaN(previous)) return null;
    if (current < previous) return null;
    return (current - previous).toFixed(4);
  };

  const getDaysSinceLastReading = (wellId) => {
    const prev = previousReadings[wellId];
    if (!prev) return null;
    const lastDate = new Date(prev.reading_date);
    const today = new Date();
    const diffTime = Math.abs(today - lastDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getReadingStatus = (wellId) => {
    const days = getDaysSinceLastReading(wellId);
    if (days === null) return { status: 'new', label: 'No readings', color: 'gray' };
    if (days > 90) return { status: 'overdue', label: `${days} days ago`, color: 'red' };
    if (days > 30) return { status: 'due', label: `${days} days ago`, color: 'yellow' };
    return { status: 'current', label: `${days} days ago`, color: 'green' };
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const newErrors = {};
    let successCount = 0;

    for (const well of wells) {
      const reading = readings[well.id];
      if (!reading?.meter_reading) continue;

      const current = parseFloat(reading.meter_reading);
      const prev = previousReadings[well.id];

      if (isNaN(current)) {
        newErrors[well.id] = 'Invalid number';
        continue;
      }

      if (prev && current < parseFloat(prev.meter_reading)) {
        newErrors[well.id] = 'Reading is less than previous. Use individual entry for rollover.';
        continue;
      }

      try {
        await api.post('/well-readings/', {
          water_source: well.id,
          reading_date: readingDate,
          meter_reading: reading.meter_reading,
          reading_type: 'manual',
          pump_hours: reading.pump_hours || null,
          water_level_ft: reading.water_level_ft || null,
          recorded_by: recordedBy || null,
          notes: reading.notes || null,
        });
        successCount++;
      } catch (err) {
        console.error(`Error saving reading for well ${well.id}:`, err);
        newErrors[well.id] = err.response?.data?.detail || 'Failed to save';
      }
    }

    setErrors(newErrors);
    setSavedCount(successCount);
    setSaving(false);

    if (Object.keys(newErrors).length === 0 && successCount > 0) {
      setTimeout(() => {
        onSave();
        onClose();
      }, 1000);
    }
  };

  const filledCount = Object.values(readings).filter((r) => r?.meter_reading).length;

  const statusColorClasses = {
    red: 'bg-danger',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
    gray: 'bg-bark-400',
  };

  const statusBadgeClasses = {
    red: 'bg-danger-bg text-danger',
    yellow: 'bg-yellow-100 text-yellow-700',
    green: 'bg-green-100 text-primary',
    gray: 'bg-cream-100 text-bark-600',
  };

  const footer = (
    <>
      <div className="flex-1 text-sm text-text-secondary">
        {filledCount > 0 ? (
          <span className="text-green-600 font-medium">
            {filledCount} reading{filledCount > 1 ? 's' : ''} ready to save
          </span>
        ) : (
          <span>Enter meter readings above</span>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-button border border-border-strong text-bark-700 hover:bg-cream-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSaveAll}
        disabled={saving || filledCount === 0}
        className="flex items-center gap-2 px-6 py-2 rounded-button bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Save className="w-5 h-5" />
        {saving ? 'Saving…' : `Save ${filledCount} Reading${filledCount !== 1 ? 's' : ''}`}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Batch Meter Readings"
      subtitle="Enter readings for multiple wells at once"
      icon={Gauge}
      size="xl"
      footer={footer}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 mb-4 border-b border-border">
        <FormField label="Reading Date" htmlFor="br-date" required>
          <input
            id="br-date"
            type="date"
            value={readingDate}
            onChange={(e) => setReadingDate(e.target.value)}
            className={inputClasses}
          />
        </FormField>
        <FormField label="Recorded By" htmlFor="br-by">
          <input
            id="br-by"
            type="text"
            value={recordedBy}
            onChange={(e) => setRecordedBy(e.target.value)}
            placeholder="Your name"
            className={inputClasses}
          />
        </FormField>
        <div className="flex items-end">
          <div className="bg-surface border border-border rounded-lg px-4 py-2 w-full">
            <div className="text-sm text-text-secondary">Wells to record</div>
            <div className="text-xl font-bold text-green-600">
              {filledCount} / {wells?.length || 0}
            </div>
          </div>
        </div>
      </div>

      {savedCount > 0 && (
        <div className="mb-4 p-3 bg-primary-light border border-green-200 rounded-lg flex items-center gap-2 text-primary">
          <CheckCircle className="w-5 h-5" />
          Successfully saved {savedCount} reading{savedCount > 1 ? 's' : ''}!
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <span className="ml-3 text-text-secondary">Loading well data…</span>
        </div>
      ) : (
        <div className="space-y-3">
          {wells?.map((well) => {
            const prev = previousReadings[well.id];
            const reading = readings[well.id] || {};
            const extraction = calculateExtraction(well.id, reading.meter_reading);
            const status = getReadingStatus(well.id);
            const error = errors[well.id];
            const isExpanded = expandedWell === well.id;

            return (
              <div
                key={well.id}
                className={`border rounded-xl overflow-hidden transition-all ${
                  error
                    ? 'border-danger/40 bg-danger-bg'
                    : reading.meter_reading
                    ? 'border-green-300 bg-green-50'
                    : 'border-border bg-surface-raised'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${statusColorClasses[status.color]}`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-heading truncate">
                          {well.well_name || well.name}
                        </h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${statusBadgeClasses[status.color]}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary truncate">
                        {well.farm_name} {well.gsa && `• ${well.gsa.toUpperCase()}`}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0 w-32">
                      <div className="text-xs text-text-secondary">Previous</div>
                      <div className="font-medium text-bark-700">
                        {prev ? parseFloat(prev.meter_reading).toLocaleString() : '-'}
                      </div>
                    </div>

                    <div className="flex-shrink-0 w-40">
                      <input
                        type="number"
                        value={reading.meter_reading || ''}
                        onChange={(e) =>
                          handleReadingChange(well.id, 'meter_reading', e.target.value)
                        }
                        placeholder="New reading"
                        step="0.01"
                        className={`${inputClasses} text-right font-mono ${
                          error ? 'border-danger' : ''
                        }`}
                      />
                    </div>

                    <div className="text-right flex-shrink-0 w-24">
                      <div className="text-xs text-text-secondary">Extraction</div>
                      <div
                        className={`font-medium ${
                          extraction
                            ? 'text-green-600'
                            : 'text-text-muted'
                        }`}
                      >
                        {extraction ? `${extraction} AF` : '-'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedWell(isExpanded ? null : well.id)}
                      className="p-2 text-text-muted hover:text-bark-600 hover:bg-cream-100 rounded-lg"
                      aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {error && (
                    <div className="mt-2 flex items-center gap-2 text-danger text-sm">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-border bg-cream-50">
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <FormField label="Pump Hours" htmlFor={`br-pump-${well.id}`}>
                        <input
                          id={`br-pump-${well.id}`}
                          type="number"
                          value={reading.pump_hours || ''}
                          onChange={(e) =>
                            handleReadingChange(well.id, 'pump_hours', e.target.value)
                          }
                          placeholder="Hour meter"
                          step="0.1"
                          className={inputClasses}
                        />
                      </FormField>
                      <FormField label="Water Level (ft)" htmlFor={`br-level-${well.id}`}>
                        <input
                          id={`br-level-${well.id}`}
                          type="number"
                          value={reading.water_level_ft || ''}
                          onChange={(e) =>
                            handleReadingChange(well.id, 'water_level_ft', e.target.value)
                          }
                          placeholder="Depth to water"
                          step="0.1"
                          className={inputClasses}
                        />
                      </FormField>
                      <FormField label="Notes" htmlFor={`br-notes-${well.id}`}>
                        <input
                          id={`br-notes-${well.id}`}
                          type="text"
                          value={reading.notes || ''}
                          onChange={(e) =>
                            handleReadingChange(well.id, 'notes', e.target.value)
                          }
                          placeholder="Any observations"
                          className={inputClasses}
                        />
                      </FormField>
                    </div>

                    {extraction && well.base_extraction_rate && (
                      <div className="mt-3 p-3 bg-surface-raised rounded-lg border border-border">
                        <div className="text-xs font-medium text-text-secondary mb-2">
                          Estimated Fees
                        </div>
                        <div className="flex gap-4 text-sm">
                          {well.base_extraction_rate && (
                            <div>
                              <span className="text-text-secondary">Base: </span>
                              <span className="font-medium text-heading">
                                ${(
                                  parseFloat(extraction) *
                                  parseFloat(well.base_extraction_rate)
                                ).toFixed(2)}
                              </span>
                            </div>
                          )}
                          {well.gsp_rate && (
                            <div>
                              <span className="text-text-secondary">GSP: </span>
                              <span className="font-medium text-heading">
                                ${(
                                  parseFloat(extraction) * parseFloat(well.gsp_rate)
                                ).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

export default BatchReadingModal;
