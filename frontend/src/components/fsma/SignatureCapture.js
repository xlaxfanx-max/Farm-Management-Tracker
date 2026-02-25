import React, { useRef, useState, useEffect } from 'react';
import { Pen, RotateCcw, Check, Bookmark } from 'lucide-react';
import { fsmaAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

/**
 * SignatureCapture Component
 *
 * A reusable canvas-based signature capture component with:
 * - Touch and mouse support
 * - Load saved signature option
 * - Save signature to user profile
 * - Clear and re-sign functionality
 * - Export as base64 PNG
 */
const SignatureCapture = ({
  value,
  onChange,
  showSavedOption = true,
  height = 150,
  width = 400,
  strokeColor = '#000000',
  strokeWidth = 2,
  disabled = false,
}) => {
  const toast = useToast();
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [useSaved, setUseSaved] = useState(false);
  const [savedSignature, setSavedSignature] = useState(null);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Load saved signature on mount
  useEffect(() => {
    if (showSavedOption) {
      loadSavedSignature();
    }
  }, [showSavedOption]);

  // Initialize canvas when value changes externally
  useEffect(() => {
    if (value && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        setHasSignature(true);
      };
      img.src = value;
    }
  }, []);

  const loadSavedSignature = async () => {
    try {
      setLoadingSaved(true);
      const response = await fsmaAPI.getUserSignature();
      if (response.data && response.data.signature_data) {
        setSavedSignature(response.data.signature_data);
      }
    } catch (error) {
      // No saved signature, that's fine
      console.debug('No saved signature found');
    } finally {
      setLoadingSaved(false);
    }
  };

  const getCoordinates = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (event.touches && event.touches[0]) {
      return {
        x: (event.touches[0].clientX - rect.left) * scaleX,
        y: (event.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (event) => {
    if (disabled || useSaved) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(event);

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (event) => {
    if (!isDrawing || disabled || useSaved) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(event);

    ctx.lineTo(x, y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Export signature as base64
    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL('image/png');
    onChange(signatureData);
  };

  const clearSignature = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setUseSaved(false);
    onChange('');
  };

  const toggleUseSaved = () => {
    if (!savedSignature || disabled) return;

    if (!useSaved) {
      // Apply saved signature
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasSignature(true);
        onChange(savedSignature);
      };
      img.src = savedSignature;
      setUseSaved(true);
    } else {
      // Clear and allow manual signing
      clearSignature();
    }
  };

  const saveCurrentSignature = async () => {
    if (!hasSignature) return;

    const canvas = canvasRef.current;
    const signatureData = canvas.toDataURL('image/png');

    try {
      await fsmaAPI.saveUserSignature(signatureData);
      setSavedSignature(signatureData);
      toast.success('Signature saved successfully!');
    } catch (error) {
      console.error('Error saving signature:', error);
      toast.error('Failed to save signature');
    }
  };

  return (
    <div className="space-y-2">
      {/* Canvas container */}
      <div
        className={`relative border-2 rounded-lg ${
          disabled
            ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800'
            : useSaved
            ? 'border-green-300 dark:border-green-700 bg-primary-light dark:bg-green-900/20'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
        }`}
        style={{ width: 'fit-content' }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className={`touch-none ${disabled ? 'cursor-not-allowed' : useSaved ? 'cursor-default' : 'cursor-crosshair'}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />

        {/* Placeholder text when empty */}
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-gray-400 dark:text-gray-500">
              <Pen className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Sign here</p>
            </div>
          </div>
        )}

        {/* Saved signature indicator */}
        {useSaved && (
          <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
            Using saved signature
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={clearSignature}
          disabled={disabled || !hasSignature}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Clear
        </button>

        {showSavedOption && (
          <>
            {savedSignature && (
              <button
                type="button"
                onClick={toggleUseSaved}
                disabled={disabled}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  useSaved
                    ? 'text-primary dark:text-green-300 bg-green-100 dark:bg-green-900/40'
                    : 'text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Check className="w-4 h-4" />
                {useSaved ? 'Using Saved' : 'Use Saved Signature'}
              </button>
            )}

            {hasSignature && !useSaved && (
              <button
                type="button"
                onClick={saveCurrentSignature}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                Save for Later
              </button>
            )}

            {loadingSaved && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Loading saved signature...
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SignatureCapture;
