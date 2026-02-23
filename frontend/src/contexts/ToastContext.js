import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ToastContainer } from '../components/ui/Toast';

const ToastContext = createContext(null);

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message, duration) => {
    const id = ++nextId;
    const dur = duration ?? (type === 'error' ? 6000 : 4000);
    setToasts((prev) => [...prev.slice(-4), { id, type, message, duration: dur }]);
    return id;
  }, []);

  // Stable object that delegates to the latest addToast via ref
  const addRef = useRef(addToast);
  addRef.current = addToast;

  const stableToast = useRef({
    success: (msg, dur) => addRef.current('success', msg, dur),
    error: (msg, dur) => addRef.current('error', msg, dur),
    warning: (msg, dur) => addRef.current('warning', msg, dur),
    info: (msg, dur) => addRef.current('info', msg, dur),
  }).current;

  return (
    <ToastContext.Provider value={stableToast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export default ToastContext;
