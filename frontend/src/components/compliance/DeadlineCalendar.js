import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  List,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Filter,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { complianceDeadlinesAPI, COMPLIANCE_CONSTANTS } from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';

// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Get days until deadline
const getDaysUntil = (dateString) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(dateString);
  deadline.setHours(0, 0, 0, 0);
  return Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
};

// Status badge component
const StatusBadge = ({ status }) => {
  const styles = {
    overdue: 'bg-danger-bg text-danger',
    due_soon: 'bg-yellow-200 text-yellow-700',
    upcoming: 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-primary',
  };

  const labels = {
    overdue: 'Overdue',
    due_soon: 'Due Soon',
    upcoming: 'Upcoming',
    completed: 'Completed',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.upcoming}`}>
      {labels[status] || status}
    </span>
  );
};

// Category badge
const CategoryBadge = ({ category }) => {
  const styles = {
    reporting: 'bg-sand-200 text-bark-700',
    training: 'bg-orange-100 text-orange-700',
    testing: 'bg-green-100 text-green-700',
    renewal: 'bg-yellow-200 text-yellow-700',
    inspection: 'bg-green-100 text-primary',
    other: 'bg-cream-100 text-bark-700',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[category] || styles.other}`}>
      {category?.replace('_', ' ').toUpperCase()}
    </span>
  );
};

// Deadline row for list view
const DeadlineRow = ({ deadline, onComplete, onEdit, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);
  const daysUntil = getDaysUntil(deadline.due_date);

  return (
    <div className="flex items-center justify-between p-4 border-b border-border hover:bg-cream-50 transition-colors">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <button
          onClick={() => deadline.status !== 'completed' && onComplete(deadline.id)}
          disabled={deadline.status === 'completed'}
          className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
            ${deadline.status === 'completed'
              ? 'bg-green-500 border-primary text-white'
              : 'border-border-strong hover:border-primary'
            }`}
        >
          {deadline.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={` truncate ${deadline.status === 'completed' ? 'text-text-muted line-through' : 'text-heading'}`}>
              {deadline.name}
            </h3>
            <CategoryBadge category={deadline.category} />
          </div>
          {deadline.description && (
            <p className="text-sm text-text-secondary truncate">{deadline.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 ml-4">
        <div className="text-right">
          <p className="text-sm font-medium text-heading">{formatDate(deadline.due_date)}</p>
          {deadline.status !== 'completed' && (
            <p className={`text-xs ${daysUntil < 0 ? 'text-danger' : daysUntil <= 7 ? 'text-yellow-600' : 'text-text-secondary'}`}>
              {daysUntil < 0 ? `${Math.abs(daysUntil)} days overdue` : daysUntil === 0 ? 'Due today' : `${daysUntil} days left`}
            </p>
          )}
        </div>

        <StatusBadge status={deadline.status} />

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-text-muted hover:text-bark-600 rounded"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-36 bg-surface-raised border border-border rounded-card shadow-lg z-20 py-1">
                <button
                  onClick={() => { onEdit(deadline); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-bark-700 hover:bg-cream-50 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                {deadline.status !== 'completed' && (
                  <button
                    onClick={() => { onComplete(deadline.id); setShowMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-bark-700 hover:bg-cream-50 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Complete
                  </button>
                )}
                <button
                  onClick={() => { onDelete(deadline.id); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-danger hover:bg-danger-bg flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Calendar day cell
const CalendarDay = ({ date, deadlines, isCurrentMonth, isToday, onClick }) => {
  const dayDeadlines = deadlines.filter(d => {
    const deadlineDate = new Date(d.due_date);
    return deadlineDate.getDate() === date.getDate() &&
           deadlineDate.getMonth() === date.getMonth() &&
           deadlineDate.getFullYear() === date.getFullYear();
  });

  return (
    <div
      onClick={onClick}
      className={`min-h-[100px] p-2 border-b border-r border-border cursor-pointer hover:bg-cream-50 transition-colors
        ${!isCurrentMonth ? 'bg-cream-50' : 'bg-surface-raised'}
        ${isToday ? 'ring-2 ring-inset ring-primary' : ''}`}
    >
      <span className={`text-sm font-medium ${!isCurrentMonth ? 'text-text-muted' : isToday ? 'text-primary' : 'text-heading'}`}>
        {date.getDate()}
      </span>
      <div className="mt-1 space-y-1">
        {dayDeadlines.slice(0, 3).map(deadline => (
          <div
            key={deadline.id}
            className={`text-xs px-1.5 py-0.5 rounded truncate
              ${deadline.status === 'overdue' ? 'bg-danger-bg text-danger' :
                deadline.status === 'completed' ? 'bg-green-100 text-primary' :
                'bg-orange-100 text-orange-700'}`}
          >
            {deadline.name}
          </div>
        ))}
        {dayDeadlines.length > 3 && (
          <div className="text-xs text-text-secondary px-1">+{dayDeadlines.length - 3} more</div>
        )}
      </div>
    </div>
  );
};

// Deadline Form Modal
const DeadlineModal = ({ deadline, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: deadline?.name || '',
    description: deadline?.description || '',
    category: deadline?.category || 'reporting',
    due_date: deadline?.due_date || '',
    frequency: deadline?.frequency || 'once',
    warning_days: deadline?.warning_days || 14,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData, deadline?.id);
      onClose();
    } catch (error) {
      console.error('Failed to save deadline:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-surface-raised rounded-card shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg text-heading">
            {deadline ? 'Edit Deadline' : 'Add Deadline'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-bark-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              placeholder="e.g., Monthly PUR Report"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              rows={2}
              placeholder="Optional description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Category *</label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              >
                {COMPLIANCE_CONSTANTS.DEADLINE_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Due Date *</label>
              <input
                type="date"
                required
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Frequency</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              >
                {COMPLIANCE_CONSTANTS.DEADLINE_FREQUENCIES.map(freq => (
                  <option key={freq.value} value={freq.value}>{freq.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Warning Days</label>
              <input
                type="number"
                min={1}
                max={90}
                value={formData.warning_days}
                onChange={(e) => setFormData({ ...formData, warning_days: parseInt(e.target.value) || 14 })}
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-bark-700 hover:bg-cream-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : deadline ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Component
export default function DeadlineCalendar({ onNavigate }) {
  const confirm = useConfirm();
  const [view, setView] = useState('list'); // 'list' or 'calendar'
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(null);
  const [filter, setFilter] = useState('all'); // all, overdue, due_soon, upcoming, completed
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch deadlines
  const fetchDeadlines = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter !== 'all') {
        params.status = filter;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      const response = await complianceDeadlinesAPI.getAll(params);
      setDeadlines(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to fetch deadlines:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, searchQuery]);

  useEffect(() => {
    fetchDeadlines();
  }, [fetchDeadlines]);

  // Handle complete
  const handleComplete = async (id) => {
    try {
      await complianceDeadlinesAPI.complete(id);
      fetchDeadlines();
    } catch (error) {
      console.error('Failed to complete deadline:', error);
    }
  };

  // Handle save
  const handleSave = async (data, id) => {
    if (id) {
      await complianceDeadlinesAPI.update(id, data);
    } else {
      await complianceDeadlinesAPI.create(data);
    }
    fetchDeadlines();
  };

  // Handle delete
  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this deadline?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await complianceDeadlinesAPI.delete(id);
      fetchDeadlines();
    } catch (error) {
      console.error('Failed to delete deadline:', error);
    }
  };

  // Handle edit
  const handleEdit = (deadline) => {
    setEditingDeadline(deadline);
    setShowModal(true);
  };

  // Calendar helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // Add days from previous month to fill first week
    const startDay = firstDay.getDay();
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month, -i),
        isCurrentMonth: false,
      });
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Add days from next month to complete last week
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const today = new Date();
  const isToday = (date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const calendarDays = getDaysInMonth(currentMonth);

  // Stats
  const stats = {
    overdue: deadlines.filter(d => d.status === 'overdue').length,
    due_soon: deadlines.filter(d => d.status === 'due_soon').length,
    upcoming: deadlines.filter(d => d.status === 'upcoming').length,
    completed: deadlines.filter(d => d.status === 'completed').length,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
            <button onClick={() => onNavigate?.('compliance')} className="hover:text-primary">
              Compliance
            </button>
            <span>/</span>
            <span>Deadlines</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDeadlines}
            className="p-2 text-bark-600 hover:bg-cream-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setEditingDeadline(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Deadline
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-danger-bg border border-danger/20 rounded-card p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-danger" />
            <span className="text-2xl font-bold text-danger">{stats.overdue}</span>
          </div>
          <p className="text-sm text-danger mt-1">Overdue</p>
        </div>
        <div className="bg-yellow-100 border border-yellow-200 rounded-card p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <span className="text-2xl font-bold text-yellow-600">{stats.due_soon}</span>
          </div>
          <p className="text-sm text-yellow-700 mt-1">Due Soon</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-card p-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-link" />
            <span className="text-2xl font-bold text-link">{stats.upcoming}</span>
          </div>
          <p className="text-sm text-orange-700 mt-1">Upcoming</p>
        </div>
        <div className="bg-primary-light border border-green-100 rounded-card p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold text-primary">{stats.completed}</span>
          </div>
          <p className="text-sm text-primary mt-1">Completed</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-surface-raised border border-border rounded-card mb-6">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            {/* View Toggle */}
            <div className="flex items-center bg-cream-100 rounded-lg p-1">
              <button
                onClick={() => setView('list')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${view === 'list' ? 'bg-surface-raised text-heading shadow-sm' : 'text-bark-600 hover:text-heading'}`}
              >
                <List className="w-4 h-4" /> List
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${view === 'calendar' ? 'bg-surface-raised text-heading shadow-sm' : 'text-bark-600 hover:text-heading'}`}
              >
                <Calendar className="w-4 h-4" /> Calendar
              </button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-muted" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border-0 bg-transparent text-sm font-medium text-bark-700 focus:ring-0 cursor-pointer"
              >
                <option value="all">All Deadlines</option>
                <option value="overdue">Overdue</option>
                <option value="due_soon">Due Soon</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search deadlines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-border-strong rounded-card text-sm focus:ring-2 focus:ring-primary focus:border-primary w-64"
            />
          </div>
        </div>

        {/* Calendar Month Navigation */}
        {view === 'calendar' && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-1 text-bark-600 hover:bg-cream-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg text-heading">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-1 text-bark-600 hover:bg-cream-100 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-text-muted animate-spin" />
        </div>
      ) : view === 'list' ? (
        <div className="bg-surface-raised border border-border rounded-card overflow-hidden">
          {deadlines.length > 0 ? (
            deadlines.map(deadline => (
              <DeadlineRow
                key={deadline.id}
                deadline={deadline}
                onComplete={handleComplete}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <div className="py-12 px-6">
              {/* Auto-population hint banner */}
              <div className="max-w-xl mx-auto mb-6 bg-green-50 border border-green-200 rounded-card p-4 flex gap-3">
                <span className="text-2xl flex-shrink-0">🗓️</span>
                <div>
                  <p className="text-sm font-semibold text-green-800">Deadlines auto-generate on first visit</p>
                  <p className="text-xs text-green-600 mt-0.5">
                    Common recurring deadlines (monthly PUR, quarterly water tests, annual licenses) will be
                    pre-populated automatically the first time you visit the Compliance Hub.
                    You can then add, edit, or remove any deadline.
                  </p>
                </div>
              </div>
              <div className="text-center text-text-secondary">
                <Calendar className="w-10 h-10 mx-auto mb-3 text-text-muted" />
                <p className="font-medium">No deadlines found</p>
                <p className="text-sm mt-1 mb-4">Try changing your filters, or add your first deadline below</p>
                <button
                  onClick={() => { setEditingDeadline(null); setShowModal(true); }}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
                >
                  Add Deadline
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface-raised border border-border rounded-card overflow-hidden">
          {/* Calendar Header */}
          <div className="grid grid-cols-7 border-b border-border">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="px-2 py-3 text-center text-sm font-medium text-bark-700 bg-cream-50">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => (
              <CalendarDay
                key={index}
                date={day.date}
                deadlines={deadlines}
                isCurrentMonth={day.isCurrentMonth}
                isToday={isToday(day.date)}
                onClick={() => {
                  setEditingDeadline({ due_date: day.date.toISOString().split('T')[0] });
                  setShowModal(true);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <DeadlineModal
          deadline={editingDeadline}
          onClose={() => { setShowModal(false); setEditingDeadline(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
