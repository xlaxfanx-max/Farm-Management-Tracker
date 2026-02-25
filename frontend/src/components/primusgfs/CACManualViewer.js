import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  Pen,
  Loader2,
  BookOpen,
  RefreshCw,
  ExternalLink,
  Search,
  ChevronRight,
  ChevronLeft,
  SkipForward,
  X,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';
import CACSignaturePage from './CACSignaturePage';

// Map CAC document numbers -> PrimusGFS tab IDs for "Edit Data" links
const DOC_TAB_MAP = {
  '01': 'profile',
  '02': 'org-roles',
  '03': 'committee',
  '04': 'training-matrix',
  '05': 'mgmt-review',
  '06': 'documents',
  '07': 'audits',
  '08': 'corrective-actions',
  '09': 'non-conformance',
  '10': 'pre-season',
  '11': 'field-risk',
  '12': 'land',
  '13': 'perimeter',
  '14': 'suppliers',
  '15': 'supplier-verify',
  '16': 'chemical-inv',
  '17': 'pest-control',
  '18': 'sanitation',
  '19': 'sanitation-maint',
  '20': 'calibration',
  '21': 'pre-harvest',
  '22': 'training-sessions',
  '23': 'food-defense',
  '24': 'food-fraud',
  '25': 'emergency',
  '26': 'recalls',
  '27': 'product-holds',
};

/**
 * Compute a per-document completion score (0-1) based on data + signatures.
 */
const getDocScore = (doc) => {
  if (!doc) return 0;
  let score = doc.has_data ? 0.5 : 0;
  if (doc.signatures_required > 0) {
    score += 0.5 * (doc.signatures_completed / doc.signatures_required);
  } else if (doc.has_data) {
    score = 1; // No signatures needed and has data = complete
  }
  return score;
};

/**
 * CACManualViewer -- browse, edit, sign, and download the
 * filled CAC Food Safety Manual V5.0 PDF.
 *
 * Left sidebar: searchable document list with completion bars & badges.
 * Main area: embedded interactive PDF viewer (Chrome/browser native)
 *            for the selected document section -- fields are editable.
 * Actions: download section PDF, download full manual, sign pages,
 *          quick-navigate to next incomplete or next unsigned document.
 */
const CACManualViewer = ({ onTabChange }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const docListRef = useRef(null);
  const searchInputRef = useRef(null);

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

  // Sorted document list
  const docList = useMemo(() => {
    const documents = status?.documents || {};
    return Object.entries(documents).sort(([a], [b]) => {
      const na = parseFloat(a.replace(/[A-Za-z]/g, '.5'));
      const nb = parseFloat(b.replace(/[A-Za-z]/g, '.5'));
      return na - nb;
    });
  }, [status]);

  // Filtered document list based on search
  const filteredDocList = useMemo(() => {
    if (!searchQuery.trim()) return docList;
    const q = searchQuery.toLowerCase().trim();
    return docList.filter(([docNum, doc]) => {
      return (
        docNum.toLowerCase().includes(q) ||
        doc.title.toLowerCase().includes(q)
      );
    });
  }, [docList, searchQuery]);

  // Auto-select first incomplete document on initial load
  useEffect(() => {
    if (docList.length > 0 && !selectedDoc && !loading) {
      // Find first doc without data, or first doc with incomplete signatures
      const firstIncomplete = docList.find(
        ([, doc]) => !doc.has_data || (doc.signatures_required > 0 && doc.signatures_completed < doc.signatures_required)
      );
      if (firstIncomplete) {
        handleSelectDoc(firstIncomplete[0]);
      } else if (docList.length > 0) {
        handleSelectDoc(docList[0][0]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docList, loading]);

  // Completion stats
  const completionStats = useMemo(() => {
    if (!docList.length) return { complete: 0, needsData: 0, needsSig: 0, total: 0 };
    let complete = 0;
    let needsData = 0;
    let needsSig = 0;
    docList.forEach(([, doc]) => {
      const score = getDocScore(doc);
      if (score >= 1) {
        complete++;
      } else if (!doc.has_data) {
        needsData++;
      } else {
        needsSig++;
      }
    });
    return { complete, needsData, needsSig, total: docList.length };
  }, [docList]);

  // Load section PDF for interactive viewing
  const loadSectionPdf = useCallback(async (docNumber) => {
    try {
      setPdfLoading(true);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      const response = await primusGFSAPI.getCACManualSection(docNumber);
      const url = URL.createObjectURL(response.data);
      setPdfUrl(url);
    } catch (err) {
      console.error('Error loading section PDF:', err);
      setPdfUrl(null);
    } finally {
      setPdfLoading(false);
    }
  }, []);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  // Select a document and load its PDF
  const handleSelectDoc = (docNumber) => {
    setSelectedDoc(docNumber);
    setShowSignature(false);
    loadSectionPdf(docNumber);

    // Scroll selected doc into view in sidebar
    setTimeout(() => {
      const el = document.getElementById(`cac-doc-${docNumber}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  // Navigate to next/previous document
  const navigateDoc = (direction) => {
    if (!selectedDoc || !filteredDocList.length) return;
    const currentIdx = filteredDocList.findIndex(([num]) => num === selectedDoc);
    let nextIdx;
    if (direction === 'next') {
      nextIdx = currentIdx < filteredDocList.length - 1 ? currentIdx + 1 : 0;
    } else {
      nextIdx = currentIdx > 0 ? currentIdx - 1 : filteredDocList.length - 1;
    }
    handleSelectDoc(filteredDocList[nextIdx][0]);
  };

  // Jump to next incomplete document
  const jumpToNextIncomplete = () => {
    const currentIdx = selectedDoc
      ? docList.findIndex(([num]) => num === selectedDoc)
      : -1;

    // Search from current position forward, wrapping around
    for (let i = 1; i <= docList.length; i++) {
      const idx = (currentIdx + i) % docList.length;
      const [docNum, doc] = docList[idx];
      if (!doc.has_data || (doc.signatures_required > 0 && doc.signatures_completed < doc.signatures_required)) {
        handleSelectDoc(docNum);
        setSearchQuery(''); // Clear search so user can see it in context
        return;
      }
    }
  };

  // Jump to next unsigned document
  const jumpToNextUnsigned = () => {
    const currentIdx = selectedDoc
      ? docList.findIndex(([num]) => num === selectedDoc)
      : -1;

    for (let i = 1; i <= docList.length; i++) {
      const idx = (currentIdx + i) % docList.length;
      const [docNum, doc] = docList[idx];
      if (doc.signatures_required > 0 && doc.signatures_completed < doc.signatures_required) {
        handleSelectDoc(docNum);
        setSearchQuery('');
        return;
      }
    }
  };

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      // Don't capture when typing in search
      if (e.target.tagName === 'INPUT') return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        navigateDoc('next');
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        navigateDoc('prev');
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
          searchInputRef.current?.blur();
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDoc, filteredDocList, searchQuery]
  );

  useEffect(() => {
    const el = docListRef.current;
    if (el) {
      el.addEventListener('keydown', handleKeyDown);
      return () => el.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  // Download section PDF (save to disk)
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

  // After signing, refresh status + PDF
  const handleSignatureComplete = () => {
    setShowSignature(false);
    loadStatus();
    if (selectedDoc) {
      loadSectionPdf(selectedDoc);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
  const selectedDocData = selectedDoc ? documents[selectedDoc] : null;
  const selectedDocScore = selectedDocData ? getDocScore(selectedDocData) : 0;

  // Find current position in list for prev/next display
  const currentDocIdx = selectedDoc ? filteredDocList.findIndex(([n]) => n === selectedDoc) : -1;

  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100vh - 180px)', minHeight: '500px' }}
      ref={docListRef}
      tabIndex={-1}
    >
      {/* Compact header row */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              CAC Food Safety Manual V5.0
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {status?.season_year} Season &mdash;{' '}
              {Math.round((status?.overall_completeness || 0) * 100)}% complete &mdash;{' '}
              {status?.overall_signatures?.completed || 0}/{status?.overall_signatures?.required || 0} signatures
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick-jump buttons */}
          <button
            onClick={jumpToNextIncomplete}
            title="Jump to next document that needs data"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Next Incomplete
          </button>
          <button
            onClick={jumpToNextUnsigned}
            title="Jump to next document that needs signatures"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30"
          >
            <Pen className="w-3.5 h-3.5" />
            Next Unsigned
          </button>
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Download Full Manual
          </button>
        </div>
      </div>

      {/* Main Layout -- fills all remaining height */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Left Sidebar -- Document List */}
        {!sidebarCollapsed ? (
          <div className="w-64 flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col min-h-0">
            {/* Sidebar header: stats strip */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Documents
                </h3>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="Collapse sidebar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Completion summary bar */}
              <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 mb-2">
                {completionStats.total > 0 && (
                  <>
                    <div
                      className="bg-green-500 rounded-full transition-all duration-300"
                      style={{ width: `${(completionStats.complete / completionStats.total) * 100}%` }}
                      title={`${completionStats.complete} complete`}
                    />
                    <div
                      className="bg-amber-400 rounded-full transition-all duration-300"
                      style={{ width: `${(completionStats.needsSig / completionStats.total) * 100}%` }}
                      title={`${completionStats.needsSig} need signatures`}
                    />
                  </>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  {completionStats.complete} done
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  {completionStats.needsSig} sign
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" />
                  {completionStats.needsData} todo
                </span>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='Search docs (or press "/")'
                  className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable doc list */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
              {filteredDocList.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500">
                  No documents match &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                filteredDocList.map(([docNum, doc]) => {
                  const score = getDocScore(doc);
                  const isComplete = score >= 1;
                  const isSelected = selectedDoc === docNum;

                  return (
                    <button
                      key={docNum}
                      id={`cac-doc-${docNum}`}
                      onClick={() => handleSelectDoc(docNum)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        isSelected
                          ? 'bg-primary-light dark:bg-green-900/20 border-l-2 border-primary'
                          : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-0.5 w-6 flex-shrink-0">
                          {docNum}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm font-medium truncate ${
                              isComplete
                                ? 'text-primary dark:text-green-400'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {doc.title}
                          </div>

                          {/* Mini progress bar */}
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isComplete
                                    ? 'bg-green-500'
                                    : score > 0
                                    ? 'bg-amber-400'
                                    : 'bg-gray-300 dark:bg-gray-500'
                                }`}
                                style={{ width: `${Math.max(score * 100, score > 0 ? 5 : 0)}%` }}
                              />
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {doc.has_data ? (
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                              ) : (
                                <AlertCircle className="w-3 h-3 text-gray-400" />
                              )}
                              {doc.signatures_required > 0 && (
                                <span
                                  className={`text-xs font-medium ${
                                    doc.signatures_completed >= doc.signatures_required
                                      ? 'text-primary dark:text-green-400'
                                      : 'text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  <Pen className="w-2.5 h-2.5 inline" />{' '}
                                  {doc.signatures_completed}/{doc.signatures_required}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* Collapsed sidebar -- just a thin strip */
          <div className="w-8 flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col items-center py-2">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content -- fills remaining width and height */}
        <div className="flex-1 min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex flex-col">
          {!selectedDoc ? (
            <div className="flex flex-col items-center justify-center flex-1 text-gray-400 dark:text-gray-500">
              <FileText className="w-16 h-16 mb-4" />
              <p className="text-lg">Select a document to view</p>
              <p className="text-sm mt-1">
                Choose from the list on the left to open an editable PDF
              </p>
            </div>
          ) : showSignature ? (
            <CACSignaturePage
              docNumber={selectedDoc}
              pageNumber={selectedDocData?.pages?.[0]}
              seasonYear={status?.season_year}
              onComplete={handleSignatureComplete}
              onCancel={() => setShowSignature(false)}
            />
          ) : (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Toolbar */}
              <div className="flex items-center flex-wrap gap-y-1 justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0 mr-2 overflow-hidden">
                  {/* Prev/Next buttons */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => navigateDoc('prev')}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                      title="Previous document (Up arrow)"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigateDoc('next')}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                      title="Next document (Down arrow)"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    Doc {selectedDoc}: {selectedDocData?.title}
                  </span>

                  {/* Inline completion indicator */}
                  {selectedDocScore >= 1 ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-primary dark:text-green-400 bg-primary-light dark:bg-green-900/20 rounded whitespace-nowrap">
                      <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> Complete
                    </span>
                  ) : !selectedDocData?.has_data ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded whitespace-nowrap">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" /> Needs Data
                    </span>
                  ) : selectedDocData?.signatures_required > 0 &&
                    selectedDocData?.signatures_completed < selectedDocData?.signatures_required ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded whitespace-nowrap">
                      <Pen className="w-3 h-3 flex-shrink-0" /> Needs Signatures
                    </span>
                  ) : null}

                  {/* Doc position (e.g. "3 of 27") */}
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                    {currentDocIdx >= 0 ? `${currentDocIdx + 1} of ${filteredDocList.length}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
                  {onTabChange && DOC_TAB_MAP[selectedDoc] && (
                    <button
                      onClick={() => onTabChange(DOC_TAB_MAP[selectedDoc])}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Edit Data
                    </button>
                  )}
                  {selectedDocData?.signatures_required > 0 && (
                    <button
                      onClick={() => setShowSignature(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg"
                    >
                      <Pen className="w-3.5 h-3.5" />
                      Sign ({selectedDocData.signatures_completed}/{selectedDocData.signatures_required})
                    </button>
                  )}
                  <button
                    onClick={handleDownloadSection}
                    disabled={downloading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
              </div>

              {/* Embedded PDF Viewer -- fully interactive with editable fields */}
              <div className="flex-1 bg-gray-100 dark:bg-gray-900 min-h-0">
                {pdfLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  </div>
                ) : pdfUrl ? (
                  <iframe
                    src={`${pdfUrl}#navpanes=0&scrollbar=1`}
                    title={`CAC Manual Doc ${selectedDoc}`}
                    className="w-full h-full border-0"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-2" />
                    <p>Could not load PDF</p>
                    <p className="text-sm mt-1">Try downloading the section instead</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CACManualViewer;
