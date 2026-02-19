import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Pen,
  Eye,
  Loader2,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';
import CACSignaturePage from './CACSignaturePage';

/**
 * CACManualViewer — browse, preview, sign, and download the
 * filled CAC Food Safety Manual V5.0 PDF.
 *
 * Left sidebar: document list with completion/signature badges.
 * Main area: PNG page previews for the selected document.
 * Actions: download section PDF, download full manual, sign pages.
 */
const CACManualViewer = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(null);
  const [showSignature, setShowSignature] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Load completion status
  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await primusGFSAPI.getCACManualStatus();
      setStatus(response.data);
    } catch (err) {
      console.error('Error loading CAC manual status:', err);
      setError('Failed to load CAC manual status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Load page preview
  const loadPreview = useCallback(async (docNumber, page) => {
    try {
      setPreviewLoading(true);
      setPreviewUrl(null);
      const response = await primusGFSAPI.getCACManualPreview(docNumber, page);
      const url = URL.createObjectURL(response.data);
      setPreviewUrl(url);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error loading preview:', err);
      setPreviewUrl(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  // Clean up blob URLs
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Select a document and show first page
  const handleSelectDoc = (docNumber) => {
    setSelectedDoc(docNumber);
    setShowSignature(false);
    const doc = status?.documents?.[docNumber];
    if (doc?.pages?.length > 0) {
      loadPreview(docNumber, doc.pages[0]);
    }
  };

  // Navigate pages within a document
  const handlePageNav = (direction) => {
    if (!selectedDoc || !status) return;
    const pages = status.documents[selectedDoc]?.pages || [];
    const idx = pages.indexOf(currentPage);
    const nextIdx = idx + direction;
    if (nextIdx >= 0 && nextIdx < pages.length) {
      loadPreview(selectedDoc, pages[nextIdx]);
    }
  };

  // Download section PDF
  const handleDownloadSection = async () => {
    if (!selectedDoc) return;
    try {
      setDownloading(true);
      const response = await primusGFSAPI.getCACManualSection(selectedDoc);
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CAC_Manual_Doc${selectedDoc}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading section:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Download full manual
  const handleDownloadFull = async () => {
    try {
      setDownloading(true);
      const response = await primusGFSAPI.getCACManualFull();
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'CAC_Food_Safety_Manual_V5_Filled.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading full manual:', err);
    } finally {
      setDownloading(false);
    }
  };

  // After signing, refresh status + preview
  const handleSignatureComplete = () => {
    setShowSignature(false);
    loadStatus();
    if (selectedDoc && currentPage) {
      loadPreview(selectedDoc, currentPage);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
        {error}
      </div>
    );
  }

  const documents = status?.documents || {};
  const docList = Object.entries(documents).sort(([a], [b]) => {
    // Sort numerically, with letter suffixes after
    const na = parseFloat(a.replace(/[A-Za-z]/g, '.5'));
    const nb = parseFloat(b.replace(/[A-Za-z]/g, '.5'));
    return na - nb;
  });

  const selectedDocData = selectedDoc ? documents[selectedDoc] : null;
  const selectedPages = selectedDocData?.pages || [];
  const pageIdx = selectedPages.indexOf(currentPage);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-green-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              CAC Food Safety Manual V5.0
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {status?.season_year} Season &mdash;{' '}
              {Math.round((status?.overall_completeness || 0) * 100)}% data complete &mdash;{' '}
              {status?.overall_signatures?.completed || 0}/{status?.overall_signatures?.required || 0} signatures
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadStatus}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={handleDownloadFull}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Download Full Manual
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-gray-600 dark:text-gray-400">Overall Data Completeness</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {Math.round((status?.overall_completeness || 0) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${(status?.overall_completeness || 0) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex gap-4" style={{ minHeight: '600px' }}>
        {/* Left Sidebar — Document List */}
        <div className="w-72 flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-y-auto" style={{ maxHeight: '700px' }}>
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Documents</h3>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {docList.map(([docNum, doc]) => (
              <button
                key={docNum}
                onClick={() => handleSelectDoc(docNum)}
                className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  selectedDoc === docNum ? 'bg-green-50 dark:bg-green-900/20 border-l-2 border-green-500' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-0.5 w-6 flex-shrink-0">
                    {docNum}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {doc.title}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {doc.has_data ? (
                        <span className="inline-flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-3 h-3" /> Data
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-xs text-gray-400">
                          <AlertCircle className="w-3 h-3" /> No data
                        </span>
                      )}
                      {doc.signatures_required > 0 && (
                        <span className={`inline-flex items-center gap-0.5 text-xs ${
                          doc.signatures_completed >= doc.signatures_required
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          <Pen className="w-3 h-3" />
                          {doc.signatures_completed}/{doc.signatures_required}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {!selectedDoc ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <FileText className="w-16 h-16 mb-4" />
              <p className="text-lg">Select a document to preview</p>
              <p className="text-sm mt-1">Choose from the list on the left</p>
            </div>
          ) : showSignature ? (
            <CACSignaturePage
              docNumber={selectedDoc}
              pageNumber={currentPage}
              seasonYear={status?.season_year}
              onComplete={handleSignatureComplete}
              onCancel={() => setShowSignature(false)}
            />
          ) : (
            <div className="flex flex-col h-full">
              {/* Toolbar */}
              <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Doc {selectedDoc}: {selectedDocData?.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedDocData?.signatures_required > 0 && (
                    <button
                      onClick={() => setShowSignature(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg"
                    >
                      <Pen className="w-3.5 h-3.5" />
                      Sign Page
                    </button>
                  )}
                  <button
                    onClick={handleDownloadSection}
                    disabled={downloading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Section
                  </button>
                </div>
              </div>

              {/* Page Preview */}
              <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
                {previewLoading ? (
                  <Loader2 className="w-10 h-10 animate-spin text-green-600" />
                ) : previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`Page ${currentPage}`}
                    className="max-w-full max-h-full shadow-lg rounded"
                    style={{ maxHeight: 'calc(100vh - 320px)' }}
                  />
                ) : (
                  <div className="text-gray-400 dark:text-gray-500 text-center">
                    <Eye className="w-12 h-12 mx-auto mb-2" />
                    <p>Preview not available</p>
                    <p className="text-sm mt-1">PyMuPDF may not be installed on the server</p>
                  </div>
                )}
              </div>

              {/* Page Navigation */}
              {selectedPages.length > 1 && (
                <div className="flex items-center justify-center gap-4 p-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handlePageNav(-1)}
                    disabled={pageIdx <= 0}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {currentPage} ({pageIdx + 1} of {selectedPages.length})
                  </span>
                  <button
                    onClick={() => handlePageNav(1)}
                    disabled={pageIdx >= selectedPages.length - 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CACManualViewer;
