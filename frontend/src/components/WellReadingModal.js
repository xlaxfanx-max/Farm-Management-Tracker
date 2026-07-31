import React, { useState, useEffect } from 'react';
import { Gauge, Save, AlertCircle, Info } from 'lucide-react';
import api from '../services/api';
import Modal from './ui/Modal';
import FormField, { inputClasses, selectClasses, textareaClasses } from './ui/FormField';

const emptyForm = (wellId) => ({
  water_source: wellId || '',
  reading_date: new Date().toISOString().split('T')[0],
  reading_time: new Date().toTimeString().slice(0, 5),
  meter_reading: '',
  reading_type: 'manual',
  pump_hours: '',
  water_level_ft: '',
  recorded_by: '',
  notes: '',
  meter_rollover: '',
  domestic_extraction_af: '',
});

const WellReadingModal = ({ isOpen, onClose, reading, wellId, wellName, onSave }) => {
  const [formData, setFormData] = useState(emptyForm(wellId));
  const [waterSourceInfo, setWaterSourceInfo] = useState(null);
  const [previousReading, setPreviousReading] = useState(null);
  const [calculatedExtraction, setCalculatedExtraction] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (wellId) {
      setFormData((prev) => ({ ...prev, water_source: wellId }));
      fetchPreviousReading(wellId);
      fetchWaterSourceInfo(wellId);
    }
  }, [wellId]);

  const fetchWaterSourceInfo = async (waterSourceId) => {
    try {
      const response = await api.get(`/water-sources/${waterSourceId}/`);
      setWaterSourceInfo(response.data);
    } catch (err) {
      console.error('Error fetching water source info:', err);
      setWaterSourceInfo(null);
    }
  };

  const fetchPreviousReading = async (waterSourceId) => {
    try {
      const response = await api.get('/well-readings/', { params: { water_source: waterSourceId } });
      if (response.data && response.data.length > 0) {
        setPreviousReading(response.data[0]);
      } else {
        setPreviousReading(null);
      }
    } catch (err) {
      console.error('Error fetching previous reading:', err);
      setPreviousReading(null);
    }
  };

  useEffect(() => {
    if (reading) {
      setFormData({
        water_source: reading.water_source,
        reading_date: reading.reading_date,
        reading_time: reading.reading_time || '',
        meter_reading: reading.meter_reading,
        reading_type: reading.reading_type || 'manual',
        pump_hours: reading.pump_hours || '',
        water_level_ft: reading.water_level_ft || '',
        recorded_by: reading.recorded_by || '',
        notes: reading.notes || '',
        meter_rollover: reading.meter_rollover || '',
        domestic_extraction_af: reading.domestic_extraction_af || '',
      });
    } else {
      setFormData(emptyForm(wellId));
    }
    setErrors({});
    setCalculatedExtraction(null);
  }, [reading, isOpen, wellId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if ((name === 'meter_reading' || name === 'meter_rollover') && previousReading) {
      const currentReading = name === 'meter_reading' ? value : formData.meter_reading;
      const rolloverValue = name === 'meter_rollover' ? value : formData.meter_rollover;

      if (currentReading) {
        const current = parseFloat(currentReading);
        const previous = parseFloat(previousReading.meter_reading);

        if (rolloverValue) {
          const rollover = parseFloat(rolloverValue);
          const usage = rollover - previous + current;
          setCalculatedExtraction(usage >= 0 ? usage.toFixed(4) : null);
        } else if (current > previous) {
          setCalculatedExtraction((current - previous).toFixed(4));
        } else if (current === previous) {
          setCalculatedExtraction('0');
        } else {
          setCalculatedExtraction(null);
        }
      }
    }

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.water_source) newErrors.water_source = 'Water source is required';
    if (!formData.reading_date) newErrors.reading_date = 'Reading date is required';
    if (!formData.meter_reading) {
      newErrors.meter_reading = 'Meter reading is required';
    } else if (isNaN(parseFloat(formData.meter_reading))) {
      newErrors.meter_reading = 'Must be a valid number';
    }

    if (previousReading && formData.meter_reading && !formData.meter_rollover) {
      const current = parseFloat(formData.meter_reading);
      const previous = parseFloat(previousReading.meter_reading);
      if (current < previous && formData.reading_type !== 'initial') {
        newErrors.meter_reading = `Reading is less than previous (${previous}). Specify a rollover value if meter rolled over, or use "Initial Reading" if meter was replaced.`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const cleanData = { ...formData };
      const textFields = ['recorded_by', 'notes', 'reading_type'];
      Object.keys(cleanData).forEach((key) => {
        if (cleanData[key] === '' && !textFields.includes(key)) {
          cleanData[key] = null;
        }
      });

      if (reading?.id) {
        await api.put(`/well-readings/${reading.id}/`, cleanData);
      } else {
        await api.post('/well-readings/', cleanData);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving reading:', err);
      setErrors(err.response?.data || { general: 'Failed to save reading' });
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-button border border-border-strong text-bark-700 hover:bg-cream-50"
      >
        Cancel
      </button>
      <button aria-label="Save"
        type="submit"
        form="well-reading-form"
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-button bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {loading ? 'Saving…' : reading ? 'Update Reading' : 'Save Reading'}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={reading ? 'Edit Reading' : 'Add Meter Reading'}
      subtitle={wellName}
      icon={Gauge}
      size="md"
      footer={footer}
    >
      <form id="well-reading-form" onSubmit={handleSubmit} className="space-y-4">
        {errors.general && (
          <div
            className="p-3 bg-danger-bg border border-danger/25 rounded-card flex items-center gap-2 text-danger"
            role="alert"
          >
            <AlertCircle className="w-5 h-5" />
            {errors.general}
          </div>
        )}

        {previousReading && (
          <div className="bg-cream-50 border border-border rounded-card p-3">
            <div className="flex items-center gap-2 text-sm text-bark-600 mb-1">
              <Info className="w-4 h-4" />
              Previous Reading
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">{previousReading.reading_date}</span>
              <span className="font-medium text-heading">{previousReading.meter_reading}</span>
            </div>
            {previousReading.extraction_acre_feet && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-text-secondary">Extraction:</span>
                <span className="text-green-600">
                  {previousReading.extraction_acre_feet.toFixed(4)} AF
                </span>
              </div>
            )}
            {previousReading.total_fee && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-text-secondary">Total Fee:</span>
                <span className="text-primary">${parseFloat(previousReading.total_fee).toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {reading?.total_fee && (
          <div className="bg-primary-light border border-green-200 rounded-card p-3">
            <div className="flex items-center gap-2 text-sm text-primary mb-2 font-medium">
              Calculated Fees
            </div>
            <div className="space-y-1 text-sm">
              {reading.base_fee && (
                <div className="flex justify-between">
                  <span className="text-bark-600">Base Fee:</span>
                  <span className="font-medium text-heading">
                    ${parseFloat(reading.base_fee).toFixed(2)}
                  </span>
                </div>
              )}
              {reading.gsp_fee && (
                <div className="flex justify-between">
                  <span className="text-bark-600">GSP Fee:</span>
                  <span className="font-medium text-heading">
                    ${parseFloat(reading.gsp_fee).toFixed(2)}
                  </span>
                </div>
              )}
              {reading.domestic_fee && (
                <div className="flex justify-between">
                  <span className="text-bark-600">Domestic Fee:</span>
                  <span className="font-medium text-heading">
                    ${parseFloat(reading.domestic_fee).toFixed(2)}
                  </span>
                </div>
              )}
              {reading.fixed_fee && (
                <div className="flex justify-between">
                  <span className="text-bark-600">Fixed Fee:</span>
                  <span className="font-medium text-heading">
                    ${parseFloat(reading.fixed_fee).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-green-200">
                <span className="text-bark-700 font-medium">Total:</span>
                <span className="font-bold text-primary">
                  ${parseFloat(reading.total_fee).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Reading Date" htmlFor="wr-date" required error={errors.reading_date}>
            <input
              id="wr-date"
              type="date"
              name="reading_date"
              value={formData.reading_date}
              onChange={handleChange}
              className={inputClasses}
            />
          </FormField>

          <FormField label="Time" htmlFor="wr-time">
            <input
              id="wr-time"
              type="time"
              name="reading_time"
              value={formData.reading_time}
              onChange={handleChange}
              className={inputClasses}
            />
          </FormField>
        </div>

        <FormField label="Meter Reading" htmlFor="wr-meter" required error={errors.meter_reading}>
          <input
            id="wr-meter"
            type="number"
            name="meter_reading"
            value={formData.meter_reading}
            onChange={handleChange}
            step="0.0001"
            placeholder="Enter totalizer reading"
            className={inputClasses}
          />
          {calculatedExtraction && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-card">
              <div className="flex justify-between text-sm">
                <span className="text-green-700">Estimated Extraction:</span>
                <span className="font-medium text-green-800">
                  {calculatedExtraction} units
                </span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                Final calculation will apply multiplier and unit conversion
              </p>
            </div>
          )}
        </FormField>

        <FormField
          label="Reading Type"
          htmlFor="wr-type"
          hint={
            formData.reading_type === 'initial'
              ? 'Initial readings reset the meter baseline — no extraction will be calculated from previous reading.'
              : undefined
          }
        >
          <select
            id="wr-type"
            name="reading_type"
            value={formData.reading_type}
            onChange={handleChange}
            className={selectClasses}
          >
            <option value="manual">Manual Reading</option>
            <option value="ami_automatic">AMI Automatic</option>
            <option value="estimated">Estimated</option>
            <option value="initial">Initial Reading (Meter Replacement)</option>
            <option value="final">Final Reading</option>
          </select>
        </FormField>

        <FormField
          label="Meter Rollover Value"
          htmlFor="wr-rollover"
          hint="If the meter rolled over (reset to 0), enter the max value it reached before reset"
        >
          <input
            id="wr-rollover"
            type="number"
            name="meter_rollover"
            value={formData.meter_rollover}
            onChange={handleChange}
            step="0.0001"
            placeholder="e.g., 1000000 if meter reset at 1M"
            className={inputClasses}
          />
        </FormField>

        {waterSourceInfo?.domestic_rate && (
          <FormField
            label="Domestic Extraction (AF)"
            htmlFor="wr-domestic"
            hint={`Domestic rate: $${waterSourceInfo.domestic_rate}/AF. Leave blank for full irrigation rate.`}
          >
            <input
              id="wr-domestic"
              type="number"
              name="domestic_extraction_af"
              value={formData.domestic_extraction_af}
              onChange={handleChange}
              step="0.0001"
              placeholder="Portion used for domestic purposes"
              className={inputClasses}
            />
          </FormField>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Pump Hours" htmlFor="wr-pump">
            <input
              id="wr-pump"
              type="number"
              name="pump_hours"
              value={formData.pump_hours}
              onChange={handleChange}
              step="0.1"
              placeholder="Hour meter reading"
              className={inputClasses}
            />
          </FormField>

          <FormField label="Water Level (ft)" htmlFor="wr-level">
            <input
              id="wr-level"
              type="number"
              name="water_level_ft"
              value={formData.water_level_ft}
              onChange={handleChange}
              step="0.1"
              placeholder="Depth to water"
              className={inputClasses}
            />
          </FormField>
        </div>

        <FormField label="Recorded By" htmlFor="wr-by">
          <input
            id="wr-by"
            type="text"
            name="recorded_by"
            value={formData.recorded_by}
            onChange={handleChange}
            placeholder="Your name"
            className={inputClasses}
          />
        </FormField>

        <FormField label="Notes" htmlFor="wr-notes">
          <textarea
            id="wr-notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={2}
            placeholder="Any observations or notes…"
            className={textareaClasses}
          />
        </FormField>
      </form>
    </Modal>
  );
};

export default WellReadingModal;
