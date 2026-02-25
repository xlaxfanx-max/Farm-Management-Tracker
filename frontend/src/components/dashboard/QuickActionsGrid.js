import React from 'react';
import {
  Wheat,
  Sprout,
  Droplet,
  FileText
} from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

/**
 * 4 prominent quick-action buttons for the most common operations.
 */
function QuickActionsGrid({ onNavigate }) {
  const {
    openApplicationModal,
    openWaterTestModal,
    openQuickHarvestModal,
  } = useModal();

  const actions = [
    {
      id: 'application',
      label: 'New Application',
      icon: Sprout,
      onClick: () => openApplicationModal(),
    },
    {
      id: 'harvest',
      label: 'Log Harvest',
      icon: Wheat,
      onClick: () => openQuickHarvestModal(),
    },
    {
      id: 'water-test',
      label: 'Water Test',
      icon: Droplet,
      onClick: () => openWaterTestModal(),
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileText,
      onClick: () => onNavigate?.('reports'),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={action.onClick}
          className="
            bg-surface-raised dark:bg-gray-800
            border border-border dark:border-gray-700
            hover:border-primary dark:hover:border-primary
            rounded-lg px-4 py-4
            flex flex-col items-center justify-center gap-2.5
            transition-all hover:shadow-md
            min-h-[80px]
            focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1
            group
          "
        >
          <action.icon className="w-5 h-5 text-text-secondary dark:text-gray-400 group-hover:text-primary transition-colors" />
          <span className="text-sm font-medium text-text dark:text-gray-200 group-hover:text-primary transition-colors">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
}

export default QuickActionsGrid;
