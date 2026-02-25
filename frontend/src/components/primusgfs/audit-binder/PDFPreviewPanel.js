import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2,
  Download,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { primusGFSAPI } from '../../../services/api';

/**
 * PDFPreviewPanel -- Right panel of the two-panel PDF editor.
 *
 * Displays the filled PDF (with user overrides applied) in an iframe.
 * Refreshes after each save when refreshKey is incremented by the parent.
 */
const PDFPreviewPanel = ({ docNumber, sectionId, refreshKey }) => {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const prevUrlRef = useRef(null);

  const loadPdf = useCallback(async () => {
    if (!docNumber) return;
    try {
      setLoading(true);
      // Revoke previous blob URL
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = null;
      }
      setPdfUrl(null);

      const response = await primusGFSAPI.getCACManualSectionWithOverrides(
        docNumber,
        sectionId
      );
      const url = URL.createObjectURL(response.data);
      setPdfUrl(url);
      prevUrlRef.current = url;
    } catch (err) {
      console.error('Error loading PDF preview:', err);
      setPdfUrl(null);
    } finally {
      setLoading(false);
    }
  }, [docNumber, sectionId]);

  // Load on mount and when refreshKey changes
  useEffect(() => {
    loadPdf();
  }, [loadPdf, refreshKey]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
      }
    };
  }, []);

  const handleDownload = async () => {
    if (!docNumber) return;
    try {
      setDownloading(true);
      const response = await primusGFSAPI.getCACManualSectionWithOverrides(
        docNumber,
        sectionId
      );
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CAC_Doc_${docNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          PDF Preview
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPdf}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Refresh
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            Download
          </button>
        </div>
      </div>

      {/* PDF iframe */}
      <div className="flex-1 bg-gray-100 dark:bg-gray-900 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : pdfUrl ? (
          <iframe
            src={`${pdfUrl}#navpanes=0&scrollbar=1`}
            title={`CAC Doc ${docNumber} Preview`}
            className="w-full h-full border-0"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 text-center p-4">
            <FileText className="w-12 h-12 mb-2" />
            <p className="text-sm">Could not load PDF preview</p>
            <p className="text-xs mt-1">Click Refresh to try again, or download the PDF directly</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFPreviewPanel;
