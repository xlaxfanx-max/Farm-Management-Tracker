// =============================================================================
// STATEMENT LIST COMPONENT
// Display uploaded packinghouse statements with status and actions
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  FileText, Upload, Search, Filter, Eye, Trash2,
  CheckCircle, AlertCircle, Loader2, Clock, RefreshCw,
  Download, ExternalLink
} from 'lucide-react';
import { packinghouseStatementsAPI } from '../../services/api';
import UnifiedUploadModal from './BatchUploadModal';

const STATUS_BADGES = {
  uploaded: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Uploaded' },
  extracting: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Extracting' },
  extracted: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Ready for Review' },
  review: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'In Review' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
  failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
};

const TYPE_LABELS = {
  packout: 'Packout',
  settlement: 'Settlement',
  wash_report: 'Wash Report',
  grower_statement: 'Grower Statement',
};

const StatementList = ({ packinghouseId = null }) => {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState(null);

  useEffect(() => {
    fetchStatements();
  }, [packinghouseId, statusFilter, typeFilter]);

  const fetchStatements = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (packinghouseId) params.packinghouse = packinghouseId;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.statement_type = typeFilter;

      const response = await packinghouseStatementsAPI.getAll(params);
      setStatements(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching statements:', err);
      setError('Failed to load statements');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (statement) => {
    const isProcessed = statement.status === 'completed';
    const warningMessage = isProcessed
      ? `Are you sure you want to delete "${statement.original_filename}"?\n\nWARNING: This will also delete the associated settlement/packout report and all related data (grade lines, deductions). This action cannot be undone.`
      : `Are you sure you want to delete "${statement.original_filename}"?`;

    if (!window.confirm(warningMessage)) return;

    try {
      await packinghouseStatementsAPI.delete(statement.id);
      setStatements(prev => prev.filter(s => s.id !== statement.id));
    } catch (err) {
      console.error('Error deleting statement:', err);
      alert('Failed to delete statement');
    }
  };

  const handleUploadSuccess = () => {
    fetchStatements();
    setShowUploadModal(false);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredStatements = statements.filter(s =>
    searchTerm === '' ||
    s.original_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.packinghouse_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const StatusBadge = ({ status }) => {
    const badge = STATUS_BADGES[status] || STATUS_BADGES.uploaded;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {status === 'extracting' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
        {status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
        {status === 'failed' && <AlertCircle className="w-3 h-3 mr-1" />}
        {badge.label}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-green-600" />
            Uploaded Statements
          </h2>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload PDFs
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-48">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search files..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Statuses</option>
            <option value="uploaded">Uploaded</option>
            <option value="extracting">Extracting</option>
            <option value="extracted">Ready for Review</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Types</option>
            <option value="packout">Packout</option>
            <option value="settlement">Settlement</option>
            <option value="wash_report">Wash Report</option>
            <option value="grower_statement">Grower Statement</option>
          </select>

          <button
            onClick={fetchStatements}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
            <span className="ml-2 text-gray-600">Loading statements...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8 text-red-600">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        ) : filteredStatements.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No statements found</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-3 text-green-600 hover:text-green-700 text-sm"
            >
              Upload your first statement
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3 font-medium">File</th>
                  <th className="pb-3 font-medium">Packinghouse</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Pool</th>
                  <th className="pb-3 font-medium">Uploaded</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStatements.map((statement) => (
                  <tr key={statement.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900 truncate max-w-48" title={statement.original_filename}>
                            {statement.original_filename}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(statement.file_size_bytes)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="text-sm text-gray-900">
                        {statement.packinghouse_short_code || statement.packinghouse_name}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="text-sm text-gray-700">
                        {TYPE_LABELS[statement.statement_type] || statement.statement_type || '-'}
                      </span>
                    </td>
                    <td className="py-3">
                      <StatusBadge status={statement.status} />
                    </td>
                    <td className="py-3">
                      <span className="text-sm text-gray-600">
                        {statement.pool_name || '-'}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="text-sm text-gray-600">
                        {formatDate(statement.created_at)}
                      </div>
                      {statement.uploaded_by_name && (
                        <div className="text-xs text-gray-400">
                          by {statement.uploaded_by_name}
                        </div>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end space-x-2">
                        {statement.pdf_url && (
                          <a
                            href={statement.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="View PDF"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {statement.status === 'extracted' && (
                          <button
                            onClick={() => setSelectedStatement(statement)}
                            className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                            title="Review & Confirm"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {statement.status === 'failed' && (
                          <button
                            onClick={() => {/* Could trigger reprocess */}}
                            className="p-1.5 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded"
                            title="Retry Extraction"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(statement)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title={statement.status === 'completed' ? "Delete (includes settlement/packout data)" : "Delete"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal (handles 1 or multiple files) */}
      {showUploadModal && (
        <UnifiedUploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={handleUploadSuccess}
          defaultPackinghouse={packinghouseId}
        />
      )}

      {/* Review Modal - same modal in review mode */}
      {selectedStatement && (
        <UnifiedUploadModal
          onClose={() => setSelectedStatement(null)}
          onSuccess={() => {
            setSelectedStatement(null);
            fetchStatements();
          }}
          defaultPackinghouse={selectedStatement.packinghouse}
          existingStatement={selectedStatement}
        />
      )}
    </div>
  );
};

export default StatementList;
