// =============================================================================
// PDF UPLOAD MODAL COMPONENT
// Upload packinghouse statement PDFs for AI-powered data extraction
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Upload, FileText, Loader2, AlertCircle,
  CheckCircle, RefreshCw, Eye, PanelLeftClose, PanelLeft,
  ExternalLink, Download, FileIcon
} from 'lucide-react';
import {
  packinghouseStatementsAPI,
  packinghousesAPI,
  poolsAPI,
  fieldsAPI,
  getApiUrl
} from '../../services/api';
import ExtractedDataPreview from './ExtractedDataPreview';

const PDFUploadModal = ({ onClose, onSuccess, defaultPackinghouse = null, existingStatement = null }) => {
  // State for upload
  const [file, setFile] = useState(null);
  const [packinghouses, setPackinghouses] = useState([]);
  const [selectedPackinghouse, setSelectedPackinghouse] = useState(defaultPackinghouse || '');
  const [formatHint, setFormatHint] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // State for extraction
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [statement, setStatement] = useState(existingStatement);
  const [error, setError] = useState('');

  // State for confirmation - if existingStatement is provided, go directly to preview
  const [showPreview, setShowPreview] = useState(!!existingStatement);
  const [pools, setPools] = useState([]);
  const [fields, setFields] = useState([]);
  const [selectedPool, setSelectedPool] = useState('');
  const [selectedField, setSelectedField] = useState('');
  const [editedData, setEditedData] = useState(existingStatement?.extracted_data || null);
  const [confirming, setConfirming] = useState(false);

  // State for PDF side-by-side view
  const [showPdf, setShowPdf] = useState(true);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    fetchPackinghouses();
    fetchFields();
  }, []);

  // Fetch PDF as blob when conditions are met
  // Track the last fetched PDF URL to avoid duplicate fetches
  const [lastFetchedPdfUrl, setLastFetchedPdfUrl] = useState(null);

  useEffect(() => {
    const pdfUrl = statement?.pdf_url;

    // Only fetch if we're in preview mode, showing PDF, have a URL, and haven't fetched this URL yet
    if (showPreview && pdfUrl && showPdf && pdfUrl !== lastFetchedPdfUrl) {
      // Clean up old blob URL if exists
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }

      fetchPdfBlob(pdfUrl);
    }
  }, [showPreview, statement?.pdf_url, showPdf]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, []);

  const fetchPdfBlob = async (pdfUrlPath) => {
    if (!pdfUrlPath) return;

    try {
      setPdfLoading(true);
      setLastFetchedPdfUrl(pdfUrlPath);

      // PDF is now served through our backend proxy endpoint to avoid CORS issues
      // Always include Bearer token for authentication
      const pdfUrl = getApiUrl(pdfUrlPath);
      const token = localStorage.getItem('farm_tracker_access_token');

      console.log('PDF fetch debug:', { pdfUrlPath, pdfUrl, hasToken: !!token });

      const response = await fetch(pdfUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Could not read error');
        console.error('PDF fetch failed:', response.status, response.statusText, errorText);
        throw new Error('Failed to fetch PDF');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      // Add PDF viewer parameters to hide sidebar and toolbar for cleaner view
      setPdfBlobUrl(url + '#toolbar=0&navpanes=0&view=FitH');
    } catch (err) {
      console.error('Error fetching PDF:', err);
      setLastFetchedPdfUrl(null); // Reset so we can retry
    } finally {
      setPdfLoading(false);
    }
  };

  // If existingStatement is provided, set up the packinghouse for pool fetching
  useEffect(() => {
    if (existingStatement?.packinghouse) {
      setSelectedPackinghouse(existingStatement.packinghouse);
    }
  }, [existingStatement]);

  useEffect(() => {
    if (selectedPackinghouse) {
      fetchPools(selectedPackinghouse);
    }
  }, [selectedPackinghouse]);

  const fetchPackinghouses = async () => {
    try {
      const response = await packinghousesAPI.getAll();
      setPackinghouses(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching packinghouses:', err);
    }
  };

  const fetchPools = async (packinghouseId) => {
    try {
      const response = await poolsAPI.getAll({ packinghouse: packinghouseId });
      setPools(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching pools:', err);
    }
  };

  const fetchFields = async () => {
    try {
      const response = await fieldsAPI.getAll();
      setFields(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching fields:', err);
    }
  };

  // Drag and drop handlers
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
        setError('');
      } else {
        setError('Please upload a PDF file');
      }
    }
  }, []);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Please upload a PDF file');
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !selectedPackinghouse) {
      setError('Please select a packinghouse and a PDF file');
      return;
    }

    setUploading(true);
    setExtracting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('pdf_file', file);
      formData.append('packinghouse', selectedPackinghouse);
      if (formatHint) {
        formData.append('packinghouse_format', formatHint);
      }

      const response = await packinghouseStatementsAPI.upload(formData);
      setStatement(response.data);

      if (response.data.status === 'extracted') {
        setShowPreview(true);
        setEditedData(response.data.extracted_data);
      } else if (response.data.status === 'failed') {
        setError(response.data.extraction_error || 'Extraction failed');
      }
    } catch (err) {
      console.error('Error uploading PDF:', err);
      setError(err.response?.data?.error || err.response?.data?.pdf_file?.[0] || 'Upload failed');
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  };

  const handleReprocess = async () => {
    if (!statement) return;

    setExtracting(true);
    setError('');

    try {
      const response = await packinghouseStatementsAPI.reprocess(statement.id, {
        packinghouse_format: formatHint || statement.packinghouse_format
      });
      setStatement(response.data);

      if (response.data.status === 'extracted') {
        setShowPreview(true);
        setEditedData(response.data.extracted_data);
      } else if (response.data.status === 'failed') {
        setError(response.data.extraction_error || 'Extraction failed');
      }
    } catch (err) {
      console.error('Error reprocessing:', err);
      setError(err.response?.data?.error || 'Reprocessing failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleConfirm = async () => {
    if (!statement) {
      setError('No statement to confirm');
      return;
    }

    // For packout/wash reports, field is required
    const isPackout = statement.statement_type === 'packout' ||
                      statement.statement_type === 'wash_report';
    if (isPackout && !selectedField) {
      setError('Please select a field for packout reports');
      return;
    }

    setConfirming(true);
    setError('');

    try {
      const response = await packinghouseStatementsAPI.confirm(statement.id, {
        pool_id: selectedPool || null,  // null triggers auto-create
        field_id: selectedField || null,
        edited_data: editedData
      });

      if (response.data.success) {
        onSuccess && onSuccess(response.data);
        onClose();
      } else {
        setError(response.data.error || 'Confirmation failed');
      }
    } catch (err) {
      console.error('Error confirming:', err);
      setError(err.response?.data?.error || 'Confirmation failed');
    } finally {
      setConfirming(false);
    }
  };

  const handleDataChange = (newData) => {
    setEditedData(newData);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const hasPdf = !!statement?.pdf_url;
  const showPdfPanel = showPreview && showPdf && hasPdf;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl max-h-[95vh] overflow-hidden flex flex-col transition-all duration-300 ${
        showPdfPanel ? 'w-full max-w-[95vw]' : 'w-full max-w-5xl'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            {showPreview ? (
              <>
                <Eye className="w-5 h-5 mr-2 text-green-600" />
                Review Extracted Data
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2 text-green-600" />
                Upload Statement PDF
              </>
            )}
          </h2>
          <div className="flex items-center space-x-2">
            {/* PDF Toggle - only show in preview mode with PDF */}
            {showPreview && hasPdf && (
              <>
                <button
                  onClick={() => setShowPdf(!showPdf)}
                  className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    showPdf
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={showPdf ? 'Hide PDF' : 'Show PDF'}
                >
                  {showPdf ? (
                    <>
                      <PanelLeftClose className="w-4 h-4 mr-1.5" />
                      Hide PDF
                    </>
                  ) : (
                    <>
                      <PanelLeft className="w-4 h-4 mr-1.5" />
                      Show PDF
                    </>
                  )}
                </button>
                <a
                  href={getApiUrl(statement.pdf_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                  title="Open PDF in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* PDF Panel - only in preview mode */}
          {showPdfPanel && (
            <div className="w-1/2 border-r border-gray-200 bg-gray-100 flex flex-col">
              <div className="p-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center text-sm text-gray-600">
                  <FileIcon className="w-4 h-4 mr-2 text-red-500" />
                  <span className="truncate max-w-xs" title={statement?.original_filename}>
                    {statement?.original_filename || 'Source PDF'}
                  </span>
                </div>
                <a
                  href={getApiUrl(statement?.pdf_url)}
                  download
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                  title="Download PDF"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
              <div className="flex-1 bg-gray-200">
                {pdfLoading ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-500 mb-3" />
                    <p className="text-gray-500">Loading PDF...</p>
                  </div>
                ) : pdfBlobUrl ? (
                  <object
                    data={pdfBlobUrl}
                    type="application/pdf"
                    className="w-full h-full"
                  >
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                      <FileIcon className="w-16 h-16 text-gray-400 mb-4" />
                      <p className="text-gray-600 mb-4">PDF preview not available.</p>
                      <a
                        href={getApiUrl(statement?.pdf_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open in New Tab
                      </a>
                    </div>
                  </object>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <FileIcon className="w-16 h-16 text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-4">Unable to load PDF.</p>
                    <a
                      href={getApiUrl(statement?.pdf_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in New Tab
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Main Content Panel */}
          <div className={`flex-1 overflow-y-auto p-4 ${showPdfPanel ? 'w-1/2' : 'w-full'}`}>
          {!showPreview ? (
            // Upload View
            <div className="space-y-4">
              {/* Packinghouse Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Packinghouse *
                  </label>
                  <select
                    value={selectedPackinghouse}
                    onChange={(e) => setSelectedPackinghouse(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    disabled={uploading}
                  >
                    <option value="">Select Packinghouse</option>
                    {packinghouses.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.short_code && `(${p.short_code})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Format Hint (Optional)
                  </label>
                  <select
                    value={formatHint}
                    onChange={(e) => setFormatHint(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    disabled={uploading}
                  >
                    <option value="">Auto-detect</option>
                    <option value="vpoa">Villa Park Orchards (VPOA)</option>
                    <option value="sla">Saticoy Lemon Association (SLA)</option>
                    <option value="mission">Mission Produce</option>
                    <option value="generic">Generic/Other</option>
                  </select>
                </div>
              </div>

              {/* Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-green-500 bg-green-50'
                    : file
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {file ? (
                  <div className="flex items-center justify-center space-x-3">
                    <FileText className="w-10 h-10 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-600 mb-2">
                      Drag and drop your PDF here, or
                    </p>
                    <label className="inline-block">
                      <span className="px-4 py-2 bg-green-600 text-white rounded-lg cursor-pointer hover:bg-green-700 transition-colors">
                        Browse Files
                      </span>
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                    <p className="text-sm text-gray-500 mt-2">
                      PDF files only, max 50MB
                    </p>
                  </>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Extraction Status */}
              {statement && statement.status === 'failed' && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-yellow-800">Extraction Failed</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        {statement.extraction_error}
                      </p>
                      <button
                        onClick={handleReprocess}
                        disabled={extracting}
                        className="mt-2 flex items-center text-sm text-yellow-800 hover:text-yellow-900"
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${extracting ? 'animate-spin' : ''}`} />
                        Try Again
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Preview View
            <div className="space-y-4">
              {/* Pool and Field Selection */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pool
                  </label>
                  <select
                    value={selectedPool}
                    onChange={(e) => setSelectedPool(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Auto-create from PDF</option>
                    {pools.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.commodity})
                      </option>
                    ))}
                  </select>
                  {!selectedPool && (
                    <p className="text-xs text-gray-500 mt-1">
                      A new pool will be created using info extracted from the PDF
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Field/Block {(statement?.statement_type === 'packout' || statement?.statement_type === 'wash_report') && '*'}
                  </label>
                  <select
                    value={selectedField}
                    onChange={(e) => setSelectedField(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">
                      {statement?.statement_type === 'settlement' || statement?.statement_type === 'grower_statement'
                        ? 'Grower Summary (All Blocks)'
                        : 'Select Field'}
                    </option>
                    {fields.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Statement Info */}
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <span className="text-green-800">
                    Detected: <strong>{statement?.statement_type_display || statement?.statement_type}</strong>
                    {' from '}
                    <strong>{statement?.format_display || statement?.packinghouse_format?.toUpperCase()}</strong>
                  </span>
                </div>
                {statement?.extraction_confidence && (
                  <span className="text-sm text-green-700">
                    Confidence: {(statement.extraction_confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {/* Extracted Data Preview */}
              <ExtractedDataPreview
                data={editedData}
                statementType={statement?.statement_type}
                onChange={handleDataChange}
              />

              {/* Error Message */}
              {error && (
                <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>
          )}
          </div>
          {/* End Main Content Panel */}
        </div>
        {/* End Content Flex Container */}

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t border-gray-200 bg-gray-50">
          {showPreview ? (
            <>
              {/* Only show Back button if we came from upload flow, not direct review */}
              {!existingStatement ? (
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Back
                </button>
              ) : (
                <div />
              )}
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirm & Save
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-gray-500">
                Supported: VPOA, SLA statement formats
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !file || !selectedPackinghouse}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {uploading || extracting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {extracting ? 'Extracting...' : 'Uploading...'}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload & Extract
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFUploadModal;
