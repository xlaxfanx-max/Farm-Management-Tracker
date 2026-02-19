import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Pen,
  RotateCcw,
  Check,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  Bookmark,
} from 'lucide-react';
import { primusGFSAPI, fsmaAPI } from '../../services/api';

/**
 * Signature requirements for each document/page.
 * Matches backend SIGNATURE_REQUIREMENTS.
 */
const SIGNATURE_REQUIREMENTS = {
  '01': [{ page: 9, role: 'coordinator', order: 0, label: 'Food Safety Coordinator' }],
  '04': [
    ...Array.from({ length: 10 }, (_, i) => ({ page: 16, role: 'attendee', order: i, label: `Attendee ${i + 1}` })),
    { page: 16, role: 'coordinator', order: 0, label: 'Food Safety Coordinator' },
  ],
  '05': [
    ...Array.from({ length: 11 }, (_, i) => ({ page: 20, role: 'attendee', order: i, label: `Attendee ${i + 1}` })),
    { page: 20, role: 'coordinator', order: 0, label: 'Food Safety Coordinator' },
  ],
  '09A': [
    { page: 29, role: 'supervisor', order: 0, label: 'Supervisor' },
    { page: 29, role: 'employee', order: 0, label: 'Employee' },
  ],
  '15': [{ page: 47, role: 'coordinator', order: 0, label: 'Food Safety Coordinator' }],
  '17': [{ page: 51, role: 'coordinator', order: 0, label: 'Food Safety Coordinator' }],
  '18': [{ page: 53, role: 'coordinator', order: 0, label: 'Food Safety Coordinator' }],
  '19': [{ page: 56, role: 'coordinator', order: 0, label: 'Food Safety Coordinator' }],
  '22': [{ page: 61, role: 'owner', order: 0, label: 'Property Owner' }],
  '37': [
    ...Array.from({ length: 18 }, (_, i) => ({ page: 109, role: 'attendee', order: i, label: `Attendee ${i + 1}` })),
    { page: 109, role: 'coordinator', order: 0, label: 'Food Safety Coordinator' },
  ],
  '39': [
    { page: 120, role: 'assessor', order: 0, label: 'Assessor' },
    { page: 120, role: 'reviewer', order: 0, label: 'Reviewer' },
  ],
};

/**
 * CACSignaturePage — shows signature requirements for a document,
 * allows signing with canvas-based capture, and submits to API.
 */
const CACSignaturePage = ({ docNumber, pageNumber, seasonYear, onComplete, onCancel }) => {
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signingSlot, setSigningSlot] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [savedSignature, setSavedSignature] = useState(null);

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const requirements = SIGNATURE_REQUIREMENTS[docNumber] || [];

  // Load existing signatures
  const loadSignatures = useCallback(async () => {
    try {
      setLoading(true);
      const response = await primusGFSAPI.getCACSignatures({
        doc_number: docNumber,
        season_year: seasonYear,
      });
      setSignatures(response.data || []);
    } catch (err) {
      console.error('Error loading signatures:', err);
    } finally {
      setLoading(false);
    }
  }, [docNumber, seasonYear]);

  useEffect(() => {
    loadSignatures();
    loadSavedSignature();
  }, [loadSignatures]);

  // Load user's saved signature
  const loadSavedSignature = async () => {
    try {
      const response = await fsmaAPI.getUserSignature();
      if (response.data?.signature_data) {
        setSavedSignature(response.data.signature_data);
      }
    } catch {
      // Not critical
    }
  };

  // Check if a requirement is already signed
  const isSlotSigned = (req) => {
    return signatures.some(
      (s) =>
        s.doc_number === docNumber &&
        s.page_number === req.page &&
        s.signer_role === req.role &&
        s.signer_order === req.order &&
        s.signed
    );
  };

  const getSlotSignature = (req) => {
    return signatures.find(
      (s) =>
        s.doc_number === docNumber &&
        s.page_number === req.page &&
        s.signer_role === req.role &&
        s.signer_order === req.order &&
        s.signed
    );
  };

  // Canvas drawing
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const useSaved = () => {
    if (!savedSignature || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setHasSignature(true);
    };
    img.src = savedSignature;
  };

  // Submit signature
  const handleSubmit = async () => {
    if (!signingSlot || !hasSignature || !signerName.trim()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setSubmitting(true);
      const signatureData = canvas.toDataURL('image/png');
      await primusGFSAPI.signCACPage({
        doc_number: docNumber,
        page_number: signingSlot.page,
        signer_role: signingSlot.role,
        signer_name: signerName.trim(),
        signer_order: signingSlot.order,
        signature_data: signatureData,
      });
      setSigningSlot(null);
      setSignerName('');
      clearCanvas();
      await loadSignatures();
    } catch (err) {
      console.error('Error submitting signature:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  const signedCount = requirements.filter(isSlotSigned).length;
  const allSigned = signedCount === requirements.length && requirements.length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Signatures &mdash; Doc {docNumber}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {signedCount} of {requirements.length} signatures completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {allSigned && (
            <button
              onClick={onComplete}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg"
            >
              <Check className="w-4 h-4" />
              Done
            </button>
          )}
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <X className="w-4 h-4" />
            Back to Preview
          </button>
        </div>
      </div>

      {/* Signature Slots */}
      <div className="grid gap-3">
        {requirements.map((req, idx) => {
          const signed = isSlotSigned(req);
          const sig = getSlotSignature(req);
          const isActive = signingSlot === req;

          return (
            <div
              key={idx}
              className={`border rounded-lg p-4 ${
                signed
                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                  : isActive
                  ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {signed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <Clock className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">
                      {req.label}
                    </div>
                    {signed && sig && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Signed by {sig.signer_name} on{' '}
                        {new Date(sig.signed_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                {!signed && !isActive && (
                  <button
                    onClick={() => {
                      setSigningSlot(req);
                      setHasSignature(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg"
                  >
                    <Pen className="w-3.5 h-3.5" />
                    Sign
                  </button>
                )}
              </div>

              {/* Signing Area */}
              {isActive && (
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Signer Name
                    </label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Full name"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Signature
                    </label>
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white">
                      <canvas
                        ref={canvasRef}
                        width={400}
                        height={120}
                        className="cursor-crosshair w-full"
                        style={{ touchAction: 'none' }}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={clearCanvas}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Clear
                      </button>
                      {savedSignature && (
                        <button
                          onClick={useSaved}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                        >
                          <Bookmark className="w-3 h-3" />
                          Use Saved Signature
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSubmit}
                      disabled={!hasSignature || !signerName.trim() || submitting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Apply Signature
                    </button>
                    <button
                      onClick={() => {
                        setSigningSlot(null);
                        setSignerName('');
                        clearCanvas();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {requirements.length === 0 && (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
          <Pen className="w-10 h-10 mx-auto mb-2" />
          <p>No signatures required for this document</p>
        </div>
      )}
    </div>
  );
};

export default CACSignaturePage;
