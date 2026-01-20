import React, { useState, useMemo } from 'react';
import {
  Clock,
  FileSignature,
  Droplet,
  Wheat,
  Leaf,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Filter
} from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';

/**
 * Unified task list combining tasks from all modules
 */
function UnifiedTaskList({
  applications = [],
  waterSources = [],
  harvests = [],
  fields = [],
  onTaskClick,
  maxItems = 8
}) {
  const [filter, setFilter] = useState('all'); // all, today, week

  // Build unified task list from all modules
  const allTasks = useMemo(() => {
    const tasks = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Pending application signatures
    applications
      .filter(a => a.status === 'pending_signature')
      .forEach(app => {
        tasks.push({
          id: `app-sig-${app.id}`,
          type: 'signature',
          module: 'applications',
          icon: FileSignature,
          title: 'Application Needs Signature',
          description: `${app.field_name || 'Unknown Field'} - ${app.product_name || 'Unknown Product'}`,
          date: new Date(app.application_date),
          priority: 'high',
          data: app
        });
      });

    // Applications ready for PUR
    applications
      .filter(a => a.status === 'complete' && !a.submitted_to_pur)
      .forEach(app => {
        tasks.push({
          id: `app-pur-${app.id}`,
          type: 'pur_submission',
          module: 'reports',
          icon: FileSignature,
          title: 'Ready for PUR Submission',
          description: `${app.field_name || 'Unknown Field'} - ${app.product_name || 'Unknown Product'}`,
          date: new Date(app.application_date),
          priority: 'medium',
          data: app
        });
      });

    // Overdue water tests
    waterSources
      .filter(ws => {
        if (!ws.active || !ws.test_frequency || !ws.last_test_date) return false;
        const lastTest = new Date(ws.last_test_date);
        const daysSinceTest = Math.floor((now - lastTest) / (1000 * 60 * 60 * 24));
        return daysSinceTest > ws.test_frequency;
      })
      .forEach(ws => {
        const lastTest = new Date(ws.last_test_date);
        const daysSinceTest = Math.floor((now - lastTest) / (1000 * 60 * 60 * 24));
        const daysOverdue = daysSinceTest - ws.test_frequency;

        tasks.push({
          id: `water-test-${ws.id}`,
          type: 'water_test',
          module: 'water',
          icon: Droplet,
          title: 'Water Test Overdue',
          description: `${ws.name} - ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`,
          date: lastTest,
          priority: 'high',
          data: ws
        });
      });

    // Water tests due soon
    waterSources
      .filter(ws => {
        if (!ws.active || !ws.test_frequency || !ws.last_test_date) return false;
        const lastTest = new Date(ws.last_test_date);
        const daysSinceTest = Math.floor((now - lastTest) / (1000 * 60 * 60 * 24));
        const daysRemaining = ws.test_frequency - daysSinceTest;
        return daysRemaining > 0 && daysRemaining <= 7;
      })
      .forEach(ws => {
        const lastTest = new Date(ws.last_test_date);
        const daysSinceTest = Math.floor((now - lastTest) / (1000 * 60 * 60 * 24));
        const daysRemaining = ws.test_frequency - daysSinceTest;

        tasks.push({
          id: `water-due-${ws.id}`,
          type: 'water_test_due',
          module: 'water',
          icon: Droplet,
          title: 'Water Test Due Soon',
          description: `${ws.name} - due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`,
          date: new Date(lastTest.getTime() + ws.test_frequency * 24 * 60 * 60 * 1000),
          priority: 'low',
          data: ws
        });
      });

    // Active harvests that may need attention
    harvests
      .filter(h => h.status === 'in_progress')
      .forEach(harvest => {
        tasks.push({
          id: `harvest-${harvest.id}`,
          type: 'harvest_active',
          module: 'harvests',
          icon: Wheat,
          title: 'Active Harvest',
          description: `${harvest.field_name || 'Unknown Field'} - ${harvest.crop_name || 'Harvest'}`,
          date: new Date(harvest.start_date || harvest.created_at),
          priority: 'medium',
          data: harvest
        });
      });

    // Sort by priority then date
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    tasks.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.date - a.date;
    });

    return tasks;
  }, [applications, waterSources, harvests]);

  // Apply filter
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    switch (filter) {
      case 'today':
        return allTasks.filter(t => t.date <= new Date(today.getTime() + 24 * 60 * 60 * 1000));
      case 'week':
        return allTasks.filter(t => t.date <= weekFromNow);
      default:
        return allTasks;
    }
  }, [allTasks, filter]);

  const displayTasks = filteredTasks.slice(0, maxItems);

  const formatDate = (date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffDays = Math.floor((taskDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
    if (diffDays < 7) return `In ${diffDays} days`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-amber-600';
      case 'low': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Tasks & Actions
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-1 text-xs rounded ${filter === 'all' ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('today')}
            className={`px-2 py-1 text-xs rounded ${filter === 'today' ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Today
          </button>
          <button
            onClick={() => setFilter('week')}
            className={`px-2 py-1 text-xs rounded ${filter === 'week' ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            This Week
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="divide-y divide-gray-100">
        {displayTasks.length === 0 ? (
          <div className="p-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">All caught up!</p>
            <p className="text-xs text-gray-500 mt-1">No pending tasks</p>
          </div>
        ) : (
          displayTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onTaskClick?.(task.module, task)}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${getPriorityColor(task.priority)}`}>
                  <task.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                    <StatusBadge status={task.priority} size="xs" />
                  </div>
                  <p className="text-xs text-gray-600 truncate">{task.description}</p>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1 flex-shrink-0">
                  <Calendar className="w-3 h-3" />
                  {formatDate(task.date)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer - Show more */}
      {filteredTasks.length > maxItems && (
        <div className="px-4 py-2 border-t border-gray-100 text-center">
          <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
            View all {filteredTasks.length} tasks →
          </button>
        </div>
      )}
    </div>
  );
}

export default UnifiedTaskList;
