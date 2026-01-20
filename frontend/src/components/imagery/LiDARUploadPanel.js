import React, { useState, useCallback } from 'react';
import { Upload, X, Check, AlertTriangle, Loader2, FileText, Calendar, MapPin } from 'lucide-react';
import { lidarDatasetsAPI, LIDAR_CONSTANTS } from '../../services/api';

/**
 * LiDARUploadPanel - Upload and process LiDAR point cloud files
 *
 * Features:
 * - Drag-and-drop LAZ/LAS file upload
 * - File validation (type, size)
 * - Upload progress display
 * - Metadata input (capture date, source)
 * - Field selection for processing
 * - Processing status display
 */
const LiDARUploadPanel = ({
  fields = [],
  selectedFieldId = null,
  onUploadComplete,
  onProcessingComplete,
  onCancel
}) => {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [uploadedDataset, setUploadedDataset] = useState(null);

  // Form state
  const [fieldId, setFieldId] = useState(selectedFieldId || '');
  const [datasetName, setDatasetName] = useState('');
  const [captureDate, setCaptureDate] = useState('');
  const [source, setSource] = useState('NOAA');

  // File validation
  const validateFile = (file) => {
    const validExtensions = ['.laz', '.las'];
    const maxSize = 500 * 1024 * 1024; // 500MB

    const fileName = file.name.toLowerCase();
    const isValidType = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidType) {
      return 'Invalid file type. Please upload a LAZ or LAS point cloud file.';
    }

    if (file.size > maxSize) {
      return `File too large. Maximum size is 500MB (file is ${(file.size / 1024 / 1024).toFixed(1)}MB)`;
    }

    return null;
  };

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validationError = validateFile(droppedFile);
      if (validationError) {
        setError(validationError);
      } else {
        setFile(droppedFile);
        // Auto-set name from filename if empty
        if (!datasetName) {
          const baseName = droppedFile.name.replace(/\.(laz|las)$/i, '');
          setDatasetName(baseName);
        }
      }
    }
  }, [datasetName]);

  // Handle file input change
  const handleFileChange = (e) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const validationError = validateFile(selectedFile);
      if (validationError) {
        setError(validationError);
      } else {
        setFile(selectedFile);
        if (!datasetName) {
          const baseName = selectedFile.name.replace(/\.(laz|las)$/i, '');
          setDatasetName(baseName);
        }
      }
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!file || !fieldId || !datasetName || !source) {
      setError('Please fill in all required fields');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('field', fieldId);
      formData.append('name', datasetName);
      formData.append('source', source);
      if (captureDate) {
        formData.append('capture_date', captureDate);
      }

      const response = await lidarDatasetsAPI.upload(formData);

      console.log('[LiDARUploadPanel] Upload successful:', response.data);
      setUploadProgress(100);
      setUploadedDataset(response.data);
      setSuccess(true);

      if (onUploadComplete) {
        onUploadComplete(response.data);
      }
    } catch (err) {
      console.error('[LiDARUploadPanel] Upload failed:', err);
      setError(err.response?.data?.detail || err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Handle processing
  const handleProcess = async () => {
    if (!uploadedDataset) return;

    setProcessing(true);
    setError(null);

    try {
      const response = await lidarDatasetsAPI.process(uploadedDataset.id, {
        field_ids: [parseInt(fieldId)],
        processing_type: 'FULL',
      });

      console.log('[LiDARUploadPanel] Processing started:', response.data);

      if (onProcessingComplete) {
        onProcessingComplete(response.data);
      }
    } catch (err) {
      console.error('[LiDARUploadPanel] Processing failed:', err);
      setError(err.response?.data?.detail || err.response?.data?.error || err.message || 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setFile(null);
    setError(null);
    setSuccess(false);
    setUploadProgress(0);
    setUploadedDataset(null);
    setDatasetName('');
    setCaptureDate('');
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Upload LiDAR Data
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Success State */}
      {success && uploadedDataset && (
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">Upload Complete!</h4>
          <p className="text-sm text-gray-600 mb-4">
            {uploadedDataset.name} has been uploaded successfully.
          </p>
          {uploadedDataset.point_count && (
            <p className="text-sm text-gray-500 mb-4">
              {uploadedDataset.point_count.toLocaleString()} points detected
            </p>
          )}
          <div className="flex justify-center space-x-3">
            <button
              onClick={handleProcess}
              disabled={processing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
            >
              {processing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Detect Trees
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Upload Another
            </button>
          </div>
        </div>
      )}

      {/* Upload Form */}
      {!success && (
        <>
          {/* Drag and Drop Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive
                ? 'border-green-500 bg-green-50'
                : file
                ? 'border-green-300 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex items-center justify-center">
                <FileText className="w-8 h-8 text-green-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="ml-4 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-1">
                  Drag and drop your LiDAR file here, or{' '}
                  <label className="text-green-600 hover:text-green-700 cursor-pointer font-medium">
                    browse
                    <input
                      type="file"
                      className="hidden"
                      accept=".laz,.las"
                      onChange={handleFileChange}
                    />
                  </label>
                </p>
                <p className="text-sm text-gray-500">LAZ or LAS files up to 500MB</p>
              </>
            )}
          </div>

          {/* Form Fields */}
          <div className="mt-4 space-y-4">
            {/* Field Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin className="w-4 h-4 inline mr-1" />
                Field *
              </label>
              <select
                value={fieldId}
                onChange={(e) => setFieldId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Select a field...</option>
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name} ({field.farm_name || 'Unknown Farm'})
                  </option>
                ))}
              </select>
            </div>

            {/* Dataset Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dataset Name *
              </label>
              <input
                type="text"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder="e.g., NOAA 2024 LiDAR"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* Source */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Source *
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {LIDAR_CONSTANTS.SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Capture Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Capture Date (optional)
              </label>
              <input
                type="date"
                value={captureDate}
                onChange={(e) => setCaptureDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Uploading...</span>
                <span className="text-sm text-gray-600">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex justify-end space-x-3">
            {onCancel && (
              <button
                onClick={onCancel}
                disabled={uploading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleUpload}
              disabled={!file || !fieldId || !datasetName || uploading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload LiDAR
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default LiDARUploadPanel;
