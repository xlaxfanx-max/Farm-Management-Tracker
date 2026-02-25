import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileImage, CheckCircle2, AlertTriangle } from 'lucide-react';
import { treeSurveyAPI } from '../../services/api';

const ACCEPTED_TYPES = ['.tif', '.tiff'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const SurveyUploadForm = ({ fieldId, onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [captureDate, setCaptureDate] = useState('');
  const [source, setSource] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const inputRef = useRef(null);

  const validateFile = (f) => {
    if (!f) return 'No file selected.';
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext)) {
      return 'Invalid file type. Please upload a GeoTIFF (.tif, .tiff) file.';
    }
    if (f.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`;
    }
    return null;
  };

  const handleFileSelect = (f) => {
    setError(null);
    setSuccess(false);
    const validationError = validateFile(f);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }
    setFile(f);
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
    setSuccess(false);
    setUploadProgress(0);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!file || !fieldId) return;

    setUploading(true);
    setError(null);
    setSuccess(false);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('image_file', file);
    formData.append('field', fieldId);
    if (captureDate) formData.append('capture_date', captureDate);
    if (source.trim()) formData.append('source', source.trim());

    // Start a simulated progress indicator while the upload runs.
    // The treeSurveyAPI.upload function handles the multipart post internally.
    const progressTimer = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 10 : prev));
    }, 500);

    try {
      const res = await treeSurveyAPI.upload(formData);
      clearInterval(progressTimer);
      setSuccess(true);
      setFile(null);
      setCaptureDate('');
      setSource('');
      setUploadProgress(100);
      if (inputRef.current) inputRef.current.value = '';
      if (onUploadComplete) {
        onUploadComplete(res.data);
      }
    } catch (err) {
      clearInterval(progressTimer);
      console.error('Upload failed:', err);
      const data = err.response?.data;
      let message = 'Upload failed. Please try again.';
      if (data) {
        if (typeof data === 'string') {
          message = data;
        } else if (data.detail) {
          message = data.detail;
        } else if (data.image_file) {
          message = Array.isArray(data.image_file) ? data.image_file[0] : data.image_file;
        } else if (data.non_field_errors) {
          message = Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors;
        } else {
          // Show first validation error from any field
          const firstKey = Object.keys(data)[0];
          if (firstKey) {
            const val = data[firstKey];
            message = `${firstKey}: ${Array.isArray(val) ? val[0] : val}`;
          }
        }
      }
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Upload size={18} />
          Upload Survey Image
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Drag and Drop Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-green-400 bg-green-50'
              : file
              ? 'border-green-300 bg-green-50'
              : 'border-slate-300 hover:border-slate-400 bg-slate-50'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".tif,.tiff"
            onChange={handleInputChange}
            className="hidden"
            disabled={uploading}
          />

          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileImage size={24} className="text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium text-slate-800 truncate max-w-[200px]">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
              </div>
              {!uploading && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            <>
              <Upload size={32} className="text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600">
                Drag and drop a GeoTIFF file here, or click to browse
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supported: .tif, .tiff (max {formatFileSize(MAX_FILE_SIZE)})
              </p>
            </>
          )}
        </div>

        {/* Upload Progress Bar */}
        {uploading && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Capture Date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Capture Date
          </label>
          <input
            type="date"
            value={captureDate}
            onChange={(e) => setCaptureDate(e.target.value)}
            disabled={uploading}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-slate-100"
          />
        </div>

        {/* Source */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Image Source
          </label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g., DJI Phantom 4 RTK, Sentinel-2"
            disabled={uploading}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-slate-100"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="flex items-start gap-2 p-3 bg-primary-light border border-green-200 rounded-lg">
            <CheckCircle2 size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-primary">
              Image uploaded successfully. Select the survey and run detection to find trees.
            </p>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? (
            <>
              <RefreshCwSpin />
              Uploading...
            </>
          ) : (
            <>
              <Upload size={18} />
              Upload Image
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Small inline spinning icon for the upload button
const RefreshCwSpin = () => (
  <svg
    className="animate-spin h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

export default SurveyUploadForm;
