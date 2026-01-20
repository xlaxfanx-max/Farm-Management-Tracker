import React, { useState, useCallback } from 'react';
import { Upload, X, Check, AlertTriangle, Loader2, Image, Calendar, Building2 } from 'lucide-react';
import { satelliteImagesAPI, TREE_DETECTION_CONSTANTS } from '../../services/api';

/**
 * SatelliteImageUpload - Drag-and-drop upload component for GeoTIFF imagery
 *
 * Features:
 * - Drag-and-drop file upload
 * - File validation (type, size)
 * - Upload progress display
 * - Metadata input (capture date, source)
 * - Farm selection
 */
const SatelliteImageUpload = ({
  farms = [],
  selectedFarmId = null,
  onUploadComplete,
  onCancel
}) => {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [farmId, setFarmId] = useState(selectedFarmId || '');
  const [captureDate, setCaptureDate] = useState('');
  const [source, setSource] = useState('SkyWatch');
  const [sourceProductId, setSourceProductId] = useState('');

  // File validation
  const validateFile = (file) => {
    const validTypes = ['.tif', '.tiff', '.geotiff'];
    const maxSize = 500 * 1024 * 1024; // 500MB

    const fileName = file.name.toLowerCase();
    const isValidType = validTypes.some(ext => fileName.endsWith(ext));

    if (!isValidType) {
      return 'Invalid file type. Please upload a GeoTIFF file (.tif, .tiff)';
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
      }
    }
  }, []);

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
      }
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!file || !farmId || !captureDate || !source) {
      setError('Please fill in all required fields');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const response = await satelliteImagesAPI.upload(
        file,
        farmId,
        captureDate,
        source,
        sourceProductId
      );

      console.log('[SatelliteImageUpload] Upload successful:', response.data);
      setUploadProgress(100);

      // Immediately call onUploadComplete to trigger tree detection panel
      if (onUploadComplete) {
        onUploadComplete(response.data);
      } else {
        // Only show success state if no callback provided
        setSuccess(true);
      }
    } catch (err) {
      console.error('[SatelliteImageUpload] Upload failed:', err);
      setError(err.response?.data?.detail || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setFile(null);
    setError(null);
    setSuccess(false);
    setUploadProgress(0);
    setCaptureDate('');
    setSourceProductId('');
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <Image className="w-5 h-5 mr-2 text-green-600" />
        Upload Satellite Imagery
      </h3>

      {/* Success State */}
      {success ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h4 className="text-lg font-medium text-gray-900 mb-2">Upload Complete!</h4>
          <p className="text-gray-600 mb-4">Your satellite image has been uploaded and processed.</p>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Upload Another Image
          </button>
        </div>
      ) : (
        <>
          {/* Drop Zone */}
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${dragActive ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'}
              ${file ? 'bg-gray-50' : ''}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input').click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".tif,.tiff"
              onChange={handleFileChange}
              className="hidden"
            />

            {file ? (
              <div className="flex items-center justify-center space-x-3">
                <Image className="w-8 h-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  Drag and drop your GeoTIFF file here, or click to browse
                </p>
                <p className="text-sm text-gray-500">
                  Supports: .tif, .tiff (max 500MB)
                </p>
              </>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Metadata Form */}
          {file && (
            <div className="mt-6 space-y-4">
              {/* Farm Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Farm *
                </label>
                <select
                  value={farmId}
                  onChange={(e) => setFarmId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  disabled={selectedFarmId}
                >
                  <option value="">Select a farm...</option>
                  {farms.map(farm => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Capture Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Capture Date *
                </label>
                <input
                  type="date"
                  value={captureDate}
                  onChange={(e) => setCaptureDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Imagery Source *
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  {TREE_DETECTION_CONSTANTS.IMAGERY_SOURCES.map(src => (
                    <option key={src.value} value={src.value}>
                      {src.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Product ID (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product/Order ID (optional)
                </label>
                <input
                  type="text"
                  value={sourceProductId}
                  onChange={(e) => setSourceProductId(e.target.value)}
                  placeholder="e.g., 25NOV01185851-S3DS-200011317312"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

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

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                {onCancel && (
                  <button
                    onClick={onCancel}
                    disabled={uploading}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleUpload}
                  disabled={uploading || !farmId || !captureDate}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Image
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SatelliteImageUpload;
