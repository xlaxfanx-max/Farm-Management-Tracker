import React, { useState, useMemo } from 'react';
import {
  Clock,
  FileSignature,
  Droplet,
  Wheat,
  Leaf,
  CheckCircle2,
  Calendar,
  ArrowRight
} from 'lucide-react';

/**
 * Unified task list combining tasks from all modules, with inline action buttons.
 */
function UnifiedTaskList({
  applications = [],
  applicationEvents = [],
  waterSources = [],
  harvests = [],
  fields = [],
  onTaskClick,
  maxItems = 6
}) {
  const [filter, setFilter] = useState('all');

  const allTasks = useMemo(() => {
    const tasks = [];
    const now = new Date();

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
          cta: 'Sign',
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
          cta: 'Submit',
          data: app
        });
      });

    // Overdue water tests
    waterSources
      .filter(ws => {
        if (!ws.active || !ws.test_frequency || !ws.last_test_date) return false;
        const daysSinceTest = Math.floor((now - new Date(ws.last_test_date)) / 86400000);
        return daysSinceTest > ws.test_frequency;
      })
      .forEach(ws => {
        const daysSinceTest = Math.floor((now - new Date(ws.last_test_date)) / 86400000);
        const daysOverdue = daysSinceTest - ws.test_frequency;
        tasks.push({
          id: `water-test-${ws.id}`,
          type: 'water_test',
          module: 'water',
          icon: Droplet,
          title: 'Water Test Overdue',
          description: `${ws.name} - ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`,
          date: new Date(ws.last_test_date),
          priority: 'high',
          cta: 'Log Test',
          data: ws
        });
      });

    // Water tests due soon
    waterSources
      .filter(ws => {
        if (!ws.active || !ws.test_frequency || !ws.last_test_date) return false;
        const daysSinceTest = Math.floor((now - new Date(ws.last_test_date)) / 86400000);
        const remaining = ws.test_frequency - daysSinceTest;
        return remaining > 0 && remaining <= 7;
      })
      .forEach(ws => {
        const daysSinceTest = Math.floor((now - new Date(ws.last_test_date)) / 86400000);
        const remaining = ws.test_frequency - daysSinceTest;
        tasks.push({
          id: `water-due-${ws.id}`,
          type: 'water_test_due',
          module: 'water',
          icon: Droplet,
          title: 'Water Test Due Soon',
          description: `${ws.name} - due in ${remaining} day${remaining !== 1 ? 's' : ''}`,
          date: new Date(new Date(ws.last_test_date).getTime() + ws.test_frequency * 86400000),
          priority: 'low',
          cta: 'Schedule',
          data: ws
        });
      });

    // Draft application events
    applicationEvents
      .filter(evt => evt.pur_status === 'draft')
      .forEach(evt => {
        tasks.push({
          id: `evt-draft-${evt.id}`,
          type: 'pur_draft',
          module: 'reports',
          icon: FileSignature,
          title: 'PUR Event Draft',
          description: `${evt.farm_name || 'Unknown Farm'} - ${(evt.tank_mix_items || []).length} product${(evt.tank_mix_items || []).length !== 1 ? 's' : ''}`,
          date: new Date(evt.date_started),
          priority: 'medium',
          cta: 'Review',
          data: evt
        });
      });

    // Active harvests
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
          cta: 'View',
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
  }, [applications, applicationEvents, waterSources, harvests]);

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekFromNow = new Date(today.getTime() + 7 * 86400000);

    switch (filter) {
      case 'today':
        return allTasks.filter(t => t.date <= new Date(today.getTime() + 86400000));
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
    const diffDays = Math.floor((taskDate - today) / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < -1) return `${Math.abs(diffDays)}d ago`;
    if (diffDays < 7) return `In ${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPriorityDot = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-amber-500';
      case 'low': return 'bg-blue-400';
      default: return 'bg-gray-400';
    }
  };

  const filterBtn = (value, label) => (
    <button
      onClick={() => setFilter(value)}
      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
        filter === value
          ? 'bg-primary-light text-primary dark:bg-primary/20 dark:text-green-400 font-medium'
          : 'text-text-secondary dark:text-gray-400 hover:bg-surface-sunken dark:hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-surface-raised dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-text dark:text-white text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-text-secondary dark:text-gray-400" />
          Tasks & Actions
        </h3>
        <div className="flex items-center gap-1">
          {filterBtn('all', 'All')}
          {filterBtn('today', 'Today')}
          {filterBtn('week', 'Week')}
        </div>
      </div>

      {/* Task List */}
      <div className="divide-y divide-border/50 dark:divide-gray-700/50">
        {displayTasks.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-text dark:text-gray-200">All caught up!</p>
            <p className="text-xs text-text-muted dark:text-gray-500 mt-1">No pending tasks</p>
          </div>
        ) : (
          displayTasks.map((task) => (
            <div
              key={task.id}
              className="px-4 py-3 hover:bg-surface-sunken dark:hover:bg-gray-700/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                {/* Priority dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityDot(task.priority)}`} />

                {/* Icon */}
                <task.icon className="w-4 h-4 text-text-muted dark:text-gray-500 flex-shrink-0" />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text dark:text-gray-200 truncate">{task.title}</p>
                  <p className="text-xs text-text-muted dark:text-gray-500 truncate">{task.description}</p>
                </div>

                {/* Date */}
                <span className="text-xs text-text-muted dark:text-gray-500 flex-shrink-0 hidden sm:flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(task.date)}
                </span>

                {/* Inline CTA */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTaskClick?.(task.module, task);
                  }}
                  className="
                    inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                    text-primary dark:text-green-400
                    bg-primary-light dark:bg-primary/10
                    hover:bg-primary hover:text-white dark:hover:bg-primary dark:hover:text-white
                    transition-colors flex-shrink-0
                    opacity-0 group-hover:opacity-100 sm:opacity-100
                  "
                >
                  {task.cta || 'View'}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {filteredTasks.length > maxItems && (
        <div className="px-4 py-2.5 border-t border-border dark:border-gray-700 text-center">
          <button className="text-xs text-primary dark:text-green-400 hover:text-primary-hover font-medium">
            View all {filteredTasks.length} tasks
          </button>
        </div>
      )}
    </div>
  );
}

export default React.memo(UnifiedTaskList);
