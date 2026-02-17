// =============================================================================
// UNIFIED PDF UPLOAD MODAL
// Upload one or multiple packinghouse statement PDFs with auto-matching
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Upload, FileText, Loader2, AlertCircle,
  CheckCircle, ChevronDown, ChevronRight, Trash2,
  Building, MapPin, Eye, PanelLeftClose, PanelLeft,
  ExternalLink, Download, FileIcon
} from 'lucide-react';
import {
  packinghouseStatementsAPI,
  packinghousesAPI,
  farmsAPI,
  fieldsAPI,
  poolsAPI,
  getApiUrl
} from '../../services/api';
import ExtractedDataPreview from './ExtractedDataPreview';

const UnifiedUploadModal = ({ onClose, onSuccess, defaultPackinghouse = null, existingStatement = null }) => {
  // State for upload
  const [files, setFiles] = useState([]);
  const [packinghouses, setPackinghouses] = useState([]);
  const [selectedPackinghouse, setSelectedPackinghouse] = useState(defaultPackinghouse || '');
  const [formatHint, setFormatHint] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // State for extraction results
  const [uploading, setUploading] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [error, setError] = useState('');

  // State for confirmation
  const [farms, setFarms] = useState([]);
  const [fields, setFields] = useState([]);
  const [pools, setPools] = useState([]);
  const [statementOverrides, setStatementOverrides] = useState({});
  const [expandedStatements, setExpandedStatements] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [saveMappings, setSaveMappings] = useState(true);
  const [confirmWarnings, setConfirmWarnings] = useState(null);

  // State for single file detailed view
  const [showPdf, setShowPdf] = useState(true);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [editedData, setEditedData] = useState(null);

  // If existingStatement provided, go directly to review mode
  useEffect(() => {
    if (existingStatement) {
      setBatchResult({
        total: 1,
        success_count: 1,
        failed_count: 0,
        statements: [{
          id: existingStatement.id,
          filename: existingStatement.original_filename,
          status: existingStatement.status,
          statement_type: existingStatement.statement_type,
          extraction_confidence: existingStatement.extraction_confidence,
          auto_match: existingStatement.auto_match_result || {},
          needs_review: true,
          extracted_data: existingStatement.extracted_data,
          pdf_url: existingStatement.pdf_url
        }]
      });
      setEditedData(existingStatement.extracted_data);
      setSelectedPackinghouse(existingStatement.packinghouse);
      setExpandedStatements({ [existingStatement.id]: true });

      // Initialize overrides from existing assignments first, then auto-match
      const autoMatch = existingStatement.auto_match_result || {};

      // Derive farm_id from the statement's assigned field if available
      let farmId = autoMatch.farm?.id || null;
      let fieldId = existingStatement.field || autoMatch.field?.id || null;
      if (fieldId && fields.length > 0) {
        const matchedField = fields.find(f => f.id === fieldId);
        if (matchedField) {
          farmId = matchedField.farm;
        }
      }

      setStatementOverrides({
        [existingStatement.id]: {
          farm_id: farmId,
          field_id: fieldId,
          pool_id: existingStatement.pool || null,
          skip: false
        }
      });
    }
  }, [existingStatement, fields]);

  useEffect(() => {
    fetchPackinghouses();
    fetchFarms();
    fetchFields();
  }, []);

  useEffect(() => {
    if (selectedPackinghouse) {
      fetchPools(selectedPackinghouse);
    }
  }, [selectedPackinghouse]);

  // Fetch PDF blob for single file preview
  useEffect(() => {
    const pdfUrl = batchResult?.statements?.[0]?.pdf_url;
    if (!pdfUrl || !showPdf || batchResult?.statements?.length !== 1) {
      return;
    }

    let cancelled = false;
    let objectUrl = null;

    const fetchPdf = async () => {
      try {
        setPdfLoading(true);

        // PDF is now served through our backend proxy endpoint to avoid CORS issues
        const token = localStorage.getItem('farm_tracker_access_token');
        const response = await fetch(getApiUrl(pdfUrl), {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch PDF');
        const blob = await response.blob();

        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          // Add PDF viewer parameters to hide sidebar and toolbar for cleaner view
          setPdfBlobUrl(objectUrl + '#toolbar=0&navpanes=0&view=FitH');
        }
      } catch (err) {
        console.error('Error fetching PDF:', err);
      } finally {
        if (!cancelled) {
          setPdfLoading(false);
        }
      }
    };

    fetchPdf();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [batchResult?.statements?.[0]?.pdf_url, showPdf, batchResult?.statements?.length]);

  // Cleanup pdfBlobUrl on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  const fetchPackinghouses = async () => {
    try {
      const response = await packinghousesAPI.getAll();
      setPackinghouses(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching packinghouses:', err);
    }
  };

  const fetchFarms = async () => {
    try {
      const response = await farmsAPI.getAll();
      setFarms(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching farms:', err);
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

  const fetchPools = async (packinghouseId) => {
    try {
      const response = await poolsAPI.getAll({ packinghouse: packinghouseId });
      setPools(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching pools:', err);
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        f => f.type === 'application/pdf'
      );
      if (droppedFiles.length > 0) {
        setFiles(prev => [...prev, ...droppedFiles].slice(0, 20));
        setError('');
      } else {
        setError('Please upload PDF files only');
      }
    }
  }, []);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files).filter(
        f => f.type === 'application/pdf'
      );
      if (selectedFiles.length > 0) {
        setFiles(prev => [...prev, ...selectedFiles].slice(0, 20));
        setError('');
      } else {
        setError('Please upload PDF files only');
      }
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!files.length) {
      setError('Please select at least one PDF file');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      // Packinghouse is now optional - only include if selected
      if (selectedPackinghouse) {
        formData.append('packinghouse', selectedPackinghouse);
      }
      if (formatHint) {
        formData.append('packinghouse_format', formatHint);
      }
      files.forEach(file => {
        formData.append('files[]', file);
      });

      const response = await packinghouseStatementsAPI.batchUpload(formData);
      setBatchResult(response.data);

      // Initialize overrides with auto-matched values
      const overrides = {};
      const expanded = {};
      response.data.statements.forEach(stmt => {
        if (stmt.id) {
          overrides[stmt.id] = {
            farm_id: stmt.auto_match?.farm?.id || null,
            field_id: stmt.auto_match?.field?.id || null,
            pool_id: null,
            packinghouse_id: stmt.packinghouse_id || stmt.detected_packinghouse?.id || null,
            skip: false
          };
          // Auto-expand statements that need review or if single file
          if (stmt.needs_review || response.data.statements.length === 1) {
            expanded[stmt.id] = true;
          }
        }
      });
      setStatementOverrides(overrides);
      setExpandedStatements(expanded);

      // For single file, set edited data
      if (response.data.statements.length === 1 && response.data.statements[0].status === 'extracted') {
        setEditedData(response.data.statements[0].extracted_data);
      }

    } catch (err) {
      console.error('Error uploading PDFs:', err);
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmAll = async () => {
    if (!batchResult) return;

    setConfirming(true);
    setError('');

    try {
      // For single file with edited data, use the single confirm endpoint
      if (isSingleFileMode && editedData) {
        const stmt = batchResult.statements[0];
        const override = statementOverrides[stmt.id] || {};

        const response = await packinghouseStatementsAPI.confirm(stmt.id, {
          pool_id: override.pool_id || null,
          field_id: override.field_id || null,
          farm_id: override.farm_id || null,
          edited_data: editedData,
          save_mappings: saveMappings
        });

        // Show warnings if any, otherwise close immediately
        if (response.data?.warnings?.length > 0) {
          setConfirmWarnings(response.data.warnings);
          onSuccess && onSuccess(response.data);
        } else {
          onSuccess && onSuccess(response.data);
          onClose();
        }
        return;
      }

      // For multiple files, use batch confirm
      const statements = batchResult.statements
        .filter(s => s.id && s.status === 'extracted')
        .map(s => ({
          id: s.id,
          packinghouse_id: statementOverrides[s.id]?.packinghouse_id || s.packinghouse_id || null,
          farm_id: statementOverrides[s.id]?.farm_id || null,
          field_id: statementOverrides[s.id]?.field_id || null,
          pool_id: statementOverrides[s.id]?.pool_id || null,
          skip: statementOverrides[s.id]?.skip || false
        }));

      const response = await packinghouseStatementsAPI.batchConfirm({
        statements,
        save_mappings: saveMappings
      });

      onSuccess && onSuccess(response.data);
      onClose();
    } catch (err) {
      console.error('Error confirming:', err);
      setError(err.response?.data?.error || 'Confirmation failed');
    } finally {
      setConfirming(false);
    }
  };

  const updateOverride = (statementId, field, value) => {
    setStatementOverrides(prev => ({
      ...prev,
      [statementId]: {
        ...prev[statementId],
        [field]: value
      }
    }));
  };

  const toggleExpanded = (statementId) => {
    setExpandedStatements(prev => ({
      ...prev,
      [statementId]: !prev[statementId]
    }));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.85) return 'text-green-600 bg-green-100';
    if (confidence >= 0.5) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getFieldsForFarm = (farmId) => {
    return fields.filter(f => f.farm === parseInt(farmId));
  };

  // Determine if we're in single file mode (for detailed preview)
  const isSingleFileMode = batchResult && batchResult.statements.length === 1 && ['extracted', 'completed'].includes(batchResult.statements[0].status);
  const singleStatement = isSingleFileMode ? batchResult.statements[0] : null;
  const showPdfPanel = isSingleFileMode && showPdf && singleStatement?.pdf_url;

  // =========================================================================
  // RENDER: File Selection View
  // =========================================================================
  if (!batchResult) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Upload className="w-5 h-5 mr-2 text-green-600" />
              Upload Statement PDFs
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Packinghouse Selection - Now Optional */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Packinghouse
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <select
                  value={selectedPackinghouse}
                  onChange={(e) => setSelectedPackinghouse(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  disabled={uploading}
                >
                  <option value="">Auto-detect from PDF</option>
                  {packinghouses.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.short_code && `(${p.short_code})`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to auto-detect from each PDF
                </p>
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
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive
                  ? 'border-green-500 bg-green-50'
                  : files.length > 0
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Upload className="w-10 h-10 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600 mb-2">
                Drag and drop PDF{files.length === 0 ? '(s)' : ''} here, or
              </p>
              <label className="inline-block">
                <span className="px-4 py-2 bg-green-600 text-white rounded-lg cursor-pointer hover:bg-green-700 transition-colors">
                  Browse Files
                </span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
              <p className="text-sm text-gray-500 mt-2">
                Upload 1-20 PDFs (max 50MB each)
              </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-3">
                    <div className="flex items-center space-x-3">
                      <FileText className="w-8 h-8 text-red-500" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 text-gray-400 hover:text-red-500"
                      disabled={uploading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center p-4 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-500">
              {files.length} file{files.length !== 1 ? 's' : ''} selected
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
                disabled={uploading || !files.length}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload & Extract
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Post-Confirmation Warnings
  // =========================================================================
  if (confirmWarnings) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-amber-500" />
              Statement Saved with Warnings
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-600">
              The statement was saved successfully, but the following discrepancies were detected between the header totals and the grade line breakdown. The grade line totals were used.
            </p>
            {confirmWarnings.map((warning, idx) => (
              <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span className="text-sm text-amber-800">{warning}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end p-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Single File Detailed Review (with PDF side-by-side)
  // =========================================================================
  if (isSingleFileMode) {
    const stmt = singleStatement;
    const override = statementOverrides[stmt.id] || {};

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className={`bg-white rounded-lg shadow-xl max-h-[95vh] overflow-hidden flex flex-col transition-all duration-300 ${
          showPdfPanel ? 'w-full max-w-[95vw]' : 'w-full max-w-4xl'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Eye className="w-5 h-5 mr-2 text-green-600" />
              Review Extracted Data
            </h2>
            <div className="flex items-center space-x-2">
              {stmt.pdf_url && (
                <>
                  <button
                    onClick={() => setShowPdf(!showPdf)}
                    className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      showPdf
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {showPdf ? (
                      <><PanelLeftClose className="w-4 h-4 mr-1.5" />Hide PDF</>
                    ) : (
                      <><PanelLeft className="w-4 h-4 mr-1.5" />Show PDF</>
                    )}
                  </button>
                  <a
                    href={stmt.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </>
              )}
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* PDF Panel */}
            {showPdfPanel && (
              <div className="w-1/2 border-r border-gray-200 bg-gray-100 flex flex-col">
                <div className="p-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-600">
                    <FileIcon className="w-4 h-4 mr-2 text-red-500" />
                    <span className="truncate max-w-xs">{stmt.filename}</span>
                  </div>
                  <a href={stmt.pdf_url} download className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded">
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
                    <object data={pdfBlobUrl} type="application/pdf" className="w-full h-full">
                      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                        <FileIcon className="w-16 h-16 text-gray-400 mb-4" />
                        <p className="text-gray-600 mb-4">PDF preview not available.</p>
                        <a href={stmt.pdf_url} target="_blank" rel="noopener noreferrer"
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
                          <ExternalLink className="w-4 h-4 mr-2" />Open in New Tab
                        </a>
                      </div>
                    </object>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                      <FileIcon className="w-16 h-16 text-gray-400 mb-4" />
                      <a href={stmt.pdf_url} target="_blank" rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
                        <ExternalLink className="w-4 h-4 mr-2" />Open in New Tab
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main Content */}
            <div className={`flex-1 overflow-y-auto p-4 ${showPdfPanel ? 'w-1/2' : 'w-full'}`}>
              {/* Farm/Field/Pool Selection */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Farm</label>
                  <select
                    value={override.farm_id || ''}
                    onChange={(e) => {
                      updateOverride(stmt.id, 'farm_id', e.target.value ? parseInt(e.target.value) : null);
                      updateOverride(stmt.id, 'field_id', null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">-- Select Farm --</option>
                    {farms.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  {stmt.auto_match?.farm && (
                    <p className="text-xs text-gray-500 mt-1">
                      Suggested: {stmt.auto_match.farm.name} ({(stmt.auto_match.confidence * 100).toFixed(0)}%)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Field/Block
                    <span className="text-gray-400 font-normal ml-1">(optional)</span>
                  </label>
                  <select
                    value={override.field_id || ''}
                    onChange={(e) => updateOverride(stmt.id, 'field_id', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    disabled={!override.farm_id}
                  >
                    <option value="">All Fields (Combined)</option>
                    {override.farm_id && getFieldsForFarm(override.farm_id).map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pool</label>
                  <select
                    value={override.pool_id || ''}
                    onChange={(e) => updateOverride(stmt.id, 'pool_id', e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Auto-create from PDF</option>
                    {pools.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.commodity})</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Leave empty to auto-create</p>
                </div>
              </div>

              {/* Statement Info */}
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <span className="text-green-800">
                    Detected: <strong>{stmt.statement_type}</strong>
                  </span>
                </div>
                {stmt.extraction_confidence && (
                  <span className="text-sm text-green-700">
                    Confidence: {(stmt.extraction_confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {/* Editable Extracted Data */}
              {editedData && (
                <ExtractedDataPreview
                  data={editedData}
                  statementType={stmt.statement_type}
                  onChange={setEditedData}
                />
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 mt-4">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center p-4 border-t border-gray-200 bg-gray-50">
            {!existingStatement ? (
              <button
                onClick={() => { setBatchResult(null); setEditedData(null); setPdfBlobUrl(null); }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Back
              </button>
            ) : <div />}
            <div className="flex items-center space-x-3">
              <label className="flex items-center text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={saveMappings}
                  onChange={(e) => setSaveMappings(e.target.checked)}
                  className="mr-2 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                Remember this match
              </label>
              <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
                Cancel
              </button>
              <button
                onClick={handleConfirmAll}
                disabled={confirming}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {confirming ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : existingStatement?.status === 'completed' ? (
                  <><CheckCircle className="w-4 h-4 mr-2" />Update & Save</>
                ) : (
                  <><CheckCircle className="w-4 h-4 mr-2" />Confirm & Save</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Multiple Files Review
  // =========================================================================
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
            Review Batch Results
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Summary */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-sm">
              <span className="text-gray-600">Total: <strong>{batchResult.total}</strong></span>
              <span className="text-green-600">Extracted: <strong>{batchResult.success_count}</strong></span>
              <span className="text-red-600">Failed: <strong>{batchResult.failed_count}</strong></span>
            </div>
            <label className="flex items-center text-sm text-gray-600">
              <input
                type="checkbox"
                checked={saveMappings}
                onChange={(e) => setSaveMappings(e.target.checked)}
                className="mr-2 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              Learn from confirmations
            </label>
          </div>
        </div>

        {/* Statement List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {batchResult.statements.map((stmt, index) => (
            <div
              key={stmt.id || index}
              className={`border rounded-lg overflow-hidden ${
                stmt.status === 'failed'
                  ? 'border-red-200 bg-red-50'
                  : statementOverrides[stmt.id]?.skip
                  ? 'border-gray-200 bg-gray-50 opacity-60'
                  : 'border-gray-200'
              }`}
            >
              {/* Statement Header */}
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => stmt.id && toggleExpanded(stmt.id)}
              >
                <div className="flex items-center space-x-3">
                  {stmt.id ? (
                    expandedStatements[stmt.id] ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <FileText className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{stmt.filename}</p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{stmt.statement_type || 'Unknown type'}</span>
                      {stmt.detected_packinghouse && (
                        <span className={`px-1.5 py-0.5 rounded ${
                          stmt.detected_packinghouse.auto_detected && stmt.detected_packinghouse.confidence > 0
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {stmt.detected_packinghouse.short_code || stmt.detected_packinghouse.name}
                          {stmt.detected_packinghouse.auto_detected && ' (auto)'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {stmt.status === 'extracted' && stmt.auto_match && (
                    <div className="flex items-center space-x-2">
                      {stmt.auto_match.farm && (
                        <span className="flex items-center text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          <Building className="w-3 h-3 mr-1" />{stmt.auto_match.farm.name}
                        </span>
                      )}
                      {stmt.auto_match.field && (
                        <span className="flex items-center text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                          <MapPin className="w-3 h-3 mr-1" />{stmt.auto_match.field.name}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded ${getConfidenceColor(stmt.auto_match.confidence)}`}>
                        {(stmt.auto_match.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                  {stmt.status === 'failed' && <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">Failed</span>}
                  {stmt.needs_review && stmt.status !== 'failed' && <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">Review</span>}
                  {!stmt.packinghouse_id && stmt.status === 'extracted' && <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">No Packinghouse</span>}
                  {stmt.id && stmt.status === 'extracted' && (
                    <label className="flex items-center text-xs text-gray-500" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={statementOverrides[stmt.id]?.skip || false}
                        onChange={(e) => updateOverride(stmt.id, 'skip', e.target.checked)}
                        className="mr-1 rounded border-gray-300"
                      />
                      Skip
                    </label>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {stmt.id && expandedStatements[stmt.id] && stmt.status === 'extracted' && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-200 bg-white">
                  {/* Detected Packinghouse Info */}
                  {stmt.detected_packinghouse?.auto_detected && (
                    <div className={`text-xs mb-3 p-2 rounded ${
                      stmt.detected_packinghouse.confidence > 0
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-yellow-50 text-yellow-700'
                    }`}>
                      {stmt.detected_packinghouse.confidence > 0 ? (
                        <>Auto-detected: <strong>{stmt.detected_packinghouse.name}</strong> ({stmt.detected_packinghouse.match_reason})</>
                      ) : (
                        <>Could not auto-detect packinghouse. Detected name: "{stmt.detected_packinghouse.name}"</>
                      )}
                    </div>
                  )}
                  {stmt.auto_match?.match_reason && (
                    <p className="text-xs text-gray-500 mb-3">Match reason: {stmt.auto_match.match_reason}</p>
                  )}
                  <div className="grid grid-cols-3 gap-4">
                    {/* Packinghouse Selection (for override or when not detected) */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Packinghouse
                        {!stmt.packinghouse_id && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <select
                        value={statementOverrides[stmt.id]?.packinghouse_id || stmt.packinghouse_id || ''}
                        onChange={(e) => updateOverride(stmt.id, 'packinghouse_id', e.target.value ? parseInt(e.target.value) : null)}
                        className={`w-full px-2 py-1.5 text-sm border rounded focus:ring-2 focus:ring-green-500 ${
                          !stmt.packinghouse_id && !statementOverrides[stmt.id]?.packinghouse_id
                            ? 'border-orange-300 bg-orange-50'
                            : 'border-gray-300'
                        }`}
                        disabled={statementOverrides[stmt.id]?.skip}
                      >
                        <option value="">-- Select Packinghouse --</option>
                        {packinghouses.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.short_code && `(${p.short_code})`}
                          </option>
                        ))}
                      </select>
                      {stmt.detected_packinghouse?.suggestions?.length > 0 && !stmt.packinghouse_id && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {stmt.detected_packinghouse.suggestions.slice(0, 3).map((s, i) => (
                            <button
                              key={i}
                              onClick={() => updateOverride(stmt.id, 'packinghouse_id', s.id)}
                              className="text-xs px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded"
                            >
                              {s.short_code || s.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Farm</label>
                      <select
                        value={statementOverrides[stmt.id]?.farm_id || ''}
                        onChange={(e) => {
                          updateOverride(stmt.id, 'farm_id', e.target.value ? parseInt(e.target.value) : null);
                          updateOverride(stmt.id, 'field_id', null);
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                        disabled={statementOverrides[stmt.id]?.skip}
                      >
                        <option value="">-- Select Farm --</option>
                        {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Field/Block (optional)</label>
                      <select
                        value={statementOverrides[stmt.id]?.field_id || ''}
                        onChange={(e) => updateOverride(stmt.id, 'field_id', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                        disabled={statementOverrides[stmt.id]?.skip || !statementOverrides[stmt.id]?.farm_id}
                      >
                        <option value="">All Fields (Combined)</option>
                        {statementOverrides[stmt.id]?.farm_id && getFieldsForFarm(statementOverrides[stmt.id].farm_id).map(f => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {stmt.auto_match?.suggestions && stmt.auto_match.suggestions.length > 1 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-700 mb-1">Other suggestions:</p>
                      <div className="flex flex-wrap gap-2">
                        {stmt.auto_match.suggestions.slice(1, 4).map((s, i) => (
                          <button
                            key={i}
                            onClick={() => updateOverride(stmt.id, 'farm_id', s.farm_id)}
                            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                          >
                            {s.farm_name} ({(s.score * 100).toFixed(0)}%)
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {stmt.status === 'failed' && stmt.extraction_error && (
                <div className="px-4 pb-3 text-xs text-red-600">{stmt.extraction_error}</div>
              )}
            </div>
          ))}

          {error && (
            <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-5 h-5 mr-2" /><span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => { setBatchResult(null); setStatementOverrides({}); setExpandedStatements({}); }}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            Back
          </button>
          <div className="flex space-x-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">Cancel</button>
            <button
              onClick={handleConfirmAll}
              disabled={confirming || batchResult.success_count === 0}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {confirming ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Confirming...</>
              ) : (
                <><CheckCircle className="w-4 h-4 mr-2" />Confirm All ({batchResult.success_count - Object.values(statementOverrides).filter(o => o.skip).length})</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedUploadModal;
