import { AlertTriangle, CheckCircle } from 'lucide-react';

export const formatCurrency = (value) => {
  if (!value) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
};

export const formatNumber = (value) => {
  if (!value) return '0';
  return new Intl.NumberFormat('en-US').format(value);
};

export const getStatusBadge = (status, phiCompliant) => {
  const statusColors = {
    'in_progress': 'bg-yellow-100 text-yellow-800',
    'complete': 'bg-blue-100 text-blue-800',
    'verified': 'bg-green-100 text-green-800'
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || 'bg-gray-100'}`}>
        {status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
      {phiCompliant === false && (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1">
          <AlertTriangle size={12} /> PHI Warning
        </span>
      )}
      {phiCompliant === true && (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1">
          <CheckCircle size={12} /> PHI OK
        </span>
      )}
    </div>
  );
};
