import React from 'react';
import {
  Droplets,
  Wheat,
  Sprout,
  FileText,
  Leaf,
  Droplet
} from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

/**
 * Quick actions grid for the dashboard - provides fast access to common operations
 */
function QuickActionsGrid({ onNavigate }) {
  const {
    openApplicationModal,
    openWaterTestModal,
    openQuickHarvestModal,
    openNutrientAppModal
  } = useModal();

  const actions = [
    {
      id: 'irrigation',
      label: 'Record Irrigation',
      icon: Droplets,
      color: 'blue',
      onClick: () => onNavigate?.('water')
    },
    {
      id: 'harvest',
      label: 'Quick Harvest',
      icon: Wheat,
      color: 'amber',
      onClick: () => openQuickHarvestModal()
    },
    {
      id: 'application',
      label: 'New Application',
      icon: Sprout,
      color: 'green',
      onClick: () => openApplicationModal()
    },
    {
      id: 'water-test',
      label: 'Water Test',
      icon: Droplet,
      color: 'cyan',
      onClick: () => openWaterTestModal()
    },
    {
      id: 'nutrient',
      label: 'Nutrient App',
      icon: Leaf,
      color: 'emerald',
      onClick: () => openNutrientAppModal()
    },
    {
      id: 'reports',
      label: 'View Reports',
      icon: FileText,
      color: 'purple',
      onClick: () => onNavigate?.('reports')
    }
  ];

  const colorClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    green: 'bg-green-600 hover:bg-green-700 text-white',
    amber: 'bg-amber-500 hover:bg-amber-600 text-white',
    cyan: 'bg-cyan-600 hover:bg-cyan-700 text-white',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    purple: 'bg-purple-600 hover:bg-purple-700 text-white',
    orange: 'bg-orange-500 hover:bg-orange-600 text-white'
  };

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={action.onClick}
          className={`
            ${colorClasses[action.color]}
            rounded-lg px-3 py-4
            flex flex-col items-center justify-center gap-2
            transition-all hover:shadow-lg transform hover:-translate-y-0.5
            min-h-[80px]
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${action.color}-500
          `}
        >
          <action.icon className="w-6 h-6" />
          <span className="text-xs font-medium text-center leading-tight">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

export default QuickActionsGrid;
