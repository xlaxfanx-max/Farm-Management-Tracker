// =============================================================================
// PUR UPLOAD STEP — Drag & drop PDF upload with parsing progress
// =============================================================================

import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Loader2, AlertCircle, X } from 'lucide-react';
import { purImportAPI } from '../../services/api';

export default function PURUploadStep({ onComplete }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile);
      setError('');
    } else {
      setError('Please upload a PDF file');
    }
  }, []);

  const handleFileSelect = useCallback((e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setError('');
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await purImportAPI.upload(formData);
      const result = response.data;

      if (result.report_count === 0) {
        setError('No PUR reports found in this PDF. Make sure it is a TELUS Agronomy Product Use Report.');
        return;
      }

      onComplete(result);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to parse PDF';
      setError(msg);
    } finally {
      setUploading(false);
    }
  }, [file, onComplete]);

  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="p-8">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          dragActive ? 'border-blue-400 bg-blue-50' :
          file ? 'border-green-300 bg-green-50' :
          'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        {!file ? (
          <>
            <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="text-lg font-medium text-gray-700 mb-1">
              Drop a PUR PDF here
            </p>
            <p className="text-sm text-gray-500 mb-4">
              TELUS Agronomy Product Use Report PDFs (single or multi-page)
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Browse Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </>
        ) : (
          <div className="flex items-center justify-center gap-4">
            <FileText className="w-10 h-10 text-green-600" />
            <div className="text-left">
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={handleRemoveFile}
              className="p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Upload button */}
      {file && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Parsing PDF...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload & Parse
              </>
            )}
          </button>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">What to expect</h3>
        <ul className="text-sm text-gray-500 space-y-1">
          <li>- Multi-page PDFs with multiple PUR reports are supported</li>
          <li>- Each report will be parsed into a separate application event</li>
          <li>- Products are matched to your existing inventory by EPA reg #</li>
          <li>- Fields are matched by PUR site ID if previously mapped</li>
          <li>- You can review and edit all data before importing</li>
        </ul>
      </div>
    </div>
  );
}
