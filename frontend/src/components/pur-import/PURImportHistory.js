// =============================================================================
// PUR IMPORT HISTORY — Browse past import batches and their reports
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, ChevronDown, ChevronRight, Loader2, Calendar,
  Package, MapPin, Eye, AlertCircle, Pencil,
} from 'lucide-react';
import { purImportAPI, applicationEventsAPI } from '../../services/api';
import { useModal } from '../../contexts/ModalContext';

export default function PURImportHistory() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [batchEvents, setBatchEvents] = useState({});
  const [loadingDetail, setLoadingDetail] = useState(null);

  const { openApplicationModal, applicationModal } = useModal();
  const editingBatchRef = useRef(null);

  // Load batches on mount
  useEffect(() => {
    let mounted = true;
    purImportAPI.getBatches()
      .then(res => {
        if (mounted) setBatches(res.data);
      })
      .catch(err => {
        if (mounted) setError(err.response?.data?.error || 'Failed to load import history');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const handleToggleBatch = useCallback(async (batchId) => {
    if (expandedBatch === batchId) {
      setExpandedBatch(null);
      return;
    }

    setExpandedBatch(batchId);

    // Load detail if not cached
    if (!batchEvents[batchId]) {
      setLoadingDetail(batchId);
      try {
        const res = await purImportAPI.getBatchDetail(batchId);
        setBatchEvents(prev => ({ ...prev, [batchId]: res.data }));
      } catch (err) {
        setBatchEvents(prev => ({ ...prev, [batchId]: [] }));
      } finally {
        setLoadingDetail(null);
      }
    }
  }, [expandedBatch, batchEvents]);

  // Re-fetch a single batch's detail to refresh after edits
  const refreshBatch = useCallback(async (batchId) => {
    try {
      const res = await purImportAPI.getBatchDetail(batchId);
      setBatchEvents(prev => ({ ...prev, [batchId]: res.data }));
    } catch {
      // silently keep stale data
    }
  }, []);

  // When the application modal closes, refresh the batch that was being edited
  const prevModalOpen = useRef(false);
  useEffect(() => {
    if (prevModalOpen.current && !applicationModal.isOpen && editingBatchRef.current) {
      refreshBatch(editingBatchRef.current);
      editingBatchRef.current = null;
    }
    prevModalOpen.current = applicationModal.isOpen;
  }, [applicationModal.isOpen, refreshBatch]);

  const handleEditReport = useCallback(async (evt, batchId) => {
    try {
      const res = await applicationEventsAPI.get(evt.id);
      editingBatchRef.current = batchId;
      openApplicationModal(res.data);
    } catch {
      alert('Failed to load report for editing');
    }
  }, [openApplicationModal]);

  const handleViewPdf = useCallback(async (batchId, filename) => {
    try {
      const res = await purImportAPI.getBatchPdf(batchId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Clean up after a delay to allow the tab to load
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      alert('Failed to load PDF');
    }
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-border p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-3" />
        <p className="text-sm text-text-secondary">Loading import history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-border p-8">
        <div className="flex items-center gap-2 text-danger">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-border p-12 text-center">
        <FileText className="w-12 h-12 text-sand-300 mx-auto mb-3" />
        <p className="text-text-secondary">No import history yet.</p>
        <p className="text-sm text-text-muted mt-1">
          Import a PUR PDF to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-heading">Import History</h2>
        <p className="text-sm text-text-secondary mt-0.5">
          {batches.length} import{batches.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="divide-y divide-border">
        {batches.map(batch => {
          const isExpanded = expandedBatch === batch.batch_id;
          const events = batchEvents[batch.batch_id] || [];
          const isLoading = loadingDetail === batch.batch_id;

          return (
            <div key={batch.batch_id}>
              {/* Batch row */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-cream-50 transition-colors"
                onClick={() => handleToggleBatch(batch.batch_id)}
              >
                {isExpanded
                  ? <ChevronDown className="w-5 h-5 text-text-muted flex-shrink-0" />
                  : <ChevronRight className="w-5 h-5 text-text-muted flex-shrink-0" />
                }

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-text-muted" />
                    <span className="font-medium text-heading truncate">
                      {batch.filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-0.5 text-sm text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(batch.created_at).toLocaleDateString()} {new Date(batch.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {batch.created_by && (
                      <span>by {batch.created_by}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 text-xs font-medium bg-orange-50 text-orange-700 rounded-full">
                    {batch.event_count} report{batch.event_count !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleViewPdf(batch.batch_id, batch.filename); }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-bark-600 bg-cream-100 rounded-full hover:bg-sand-200"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View PDF
                  </button>
                </div>
              </div>

              {/* Expanded batch detail */}
              {isExpanded && (
                <div className="px-4 pb-4 pl-12">
                  {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-text-secondary py-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading reports...
                    </div>
                  ) : events.length === 0 ? (
                    <p className="text-sm text-text-muted py-3">No reports found for this batch.</p>
                  ) : (
                    <div className="space-y-2">
                      {events.map(evt => (
                        <div
                          key={evt.id}
                          className="flex items-center justify-between p-3 bg-cream-50 rounded-lg text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs text-text-muted">
                              PUR {evt.pur_number || '-'}
                            </span>
                            <span className="text-bark-700">
                              {evt.date_started
                                ? new Date(evt.date_started).toLocaleDateString()
                                : '-'}
                            </span>
                            <span className="flex items-center gap-1 text-bark-600">
                              <MapPin className="w-3.5 h-3.5" />
                              {evt.farm_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-text-secondary">
                            <span className="flex items-center gap-1">
                              <Package className="w-3.5 h-3.5" />
                              {evt.products.length} product{evt.products.length !== 1 ? 's' : ''}
                            </span>
                            {evt.commodity_name && (
                              <span className="text-xs">{evt.commodity_name}</span>
                            )}
                            <span className="text-xs">
                              {evt.treated_area_acres} ac
                            </span>
                            <button
                              onClick={() => handleEditReport(evt, batch.batch_id)}
                              className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-yellow-700 bg-yellow-100 rounded hover:bg-yellow-200 transition-colors"
                              title="Edit report"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
