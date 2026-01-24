import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  X,
  UserPlus,
  ClipboardList,
  Shield,
  BookOpen,
  AlertTriangle,
  Briefcase,
} from 'lucide-react';
import { fsmaAPI } from '../../services/api';
import SignatureCapture from './SignatureCapture';

/**
 * SafetyMeetingList Component
 *
 * Manages company-wide safety meetings with:
 * - Meeting creation and tracking
 * - Attendee sign-in with signatures
 * - Quarterly compliance monitoring
 * - Topics covered tracking
 */
const SafetyMeetingList = () => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [quarterFilter, setQuarterFilter] = useState('');
  const [complianceStatus, setComplianceStatus] = useState(null);

  // Meeting form state
  const [meetingFormData, setMeetingFormData] = useState({
    meeting_type: 'general_safety',
    meeting_date: new Date().toISOString().split('T')[0],
    meeting_time: '',
    location: '',
    topics_covered: [],
    notes: '',
  });

  // Sign-in form state
  const [signInFormData, setSignInFormData] = useState({
    attendee_name: '',
    signature_data: '',
  });

  const meetingTypes = [
    { value: 'general_safety', label: 'General Safety', icon: Shield },
    { value: 'food_safety', label: 'Food Safety', icon: ClipboardList },
    { value: 'emergency_response', label: 'Emergency Response', icon: AlertTriangle },
    { value: 'new_employee', label: 'New Employee Orientation', icon: UserPlus },
    { value: 'specialized', label: 'Specialized Training', icon: BookOpen },
    { value: 'other', label: 'Other', icon: Briefcase },
  ];

  const commonTopics = [
    'Personal Protective Equipment (PPE)',
    'Hygiene and Handwashing',
    'Chemical Safety and Handling',
    'Food Contact Surface Cleaning',
    'Pest Control Awareness',
    'Allergen Awareness',
    'Emergency Procedures',
    'Injury Reporting',
    'Equipment Safety',
    'Heat Stress Prevention',
    'Worker Rights and Responsibilities',
    'FSMA Produce Safety Rule',
  ];

  const quarters = [
    { value: '1', label: 'Q1 (Jan-Mar)' },
    { value: '2', label: 'Q2 (Apr-Jun)' },
    { value: '3', label: 'Q3 (Jul-Sep)' },
    { value: '4', label: 'Q4 (Oct-Dec)' },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (yearFilter) params.year = yearFilter;
      if (quarterFilter) params.quarter = quarterFilter;

      const response = await fsmaAPI.getSafetyMeetings(params);
      setMeetings(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  }, [yearFilter, quarterFilter]);

  const fetchComplianceStatus = async () => {
    try {
      const response = await fsmaAPI.getQuarterlyMeetingCompliance();
      setComplianceStatus(response.data);
    } catch (error) {
      console.error('Error fetching compliance status:', error);
    }
  };

  useEffect(() => {
    fetchMeetings();
    fetchComplianceStatus();
  }, [fetchMeetings]);

  const handleMeetingInputChange = (e) => {
    const { name, value } = e.target;
    setMeetingFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTopicToggle = (topic) => {
    setMeetingFormData((prev) => {
      const topics = prev.topics_covered.includes(topic)
        ? prev.topics_covered.filter((t) => t !== topic)
        : [...prev.topics_covered, topic];
      return { ...prev, topics_covered: topics };
    });
  };

  const handleMeetingSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMeeting) {
        await fsmaAPI.updateSafetyMeeting(editingMeeting.id, meetingFormData);
      } else {
        await fsmaAPI.createSafetyMeeting(meetingFormData);
      }
      setShowMeetingModal(false);
      resetMeetingForm();
      fetchMeetings();
      fetchComplianceStatus();
    } catch (error) {
      console.error('Error saving meeting:', error);
      alert('Failed to save meeting');
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!selectedMeeting) return;

    try {
      await fsmaAPI.addMeetingAttendee(selectedMeeting.id, signInFormData);
      setShowSignInModal(false);
      resetSignInForm();
      fetchMeetings();
    } catch (error) {
      console.error('Error signing in attendee:', error);
      alert('Failed to sign in attendee');
    }
  };

  const handleDeleteMeeting = async (meetingId) => {
    if (!window.confirm('Are you sure you want to delete this meeting?')) return;
    try {
      await fsmaAPI.deleteSafetyMeeting(meetingId);
      fetchMeetings();
      fetchComplianceStatus();
    } catch (error) {
      console.error('Error deleting meeting:', error);
    }
  };

  const handleRemoveAttendee = async (meetingId, attendeeId) => {
    if (!window.confirm('Remove this attendee from the meeting?')) return;
    try {
      await fsmaAPI.removeMeetingAttendee(meetingId, attendeeId);
      fetchMeetings();
    } catch (error) {
      console.error('Error removing attendee:', error);
    }
  };

  const resetMeetingForm = () => {
    setMeetingFormData({
      meeting_type: 'general_safety',
      meeting_date: new Date().toISOString().split('T')[0],
      meeting_time: '',
      location: '',
      topics_covered: [],
      notes: '',
    });
    setEditingMeeting(null);
  };

  const resetSignInForm = () => {
    setSignInFormData({
      attendee_name: '',
      signature_data: '',
    });
  };

  const openEditMeetingModal = (meeting) => {
    setEditingMeeting(meeting);
    setMeetingFormData({
      meeting_type: meeting.meeting_type,
      meeting_date: meeting.meeting_date,
      meeting_time: meeting.meeting_time || '',
      location: meeting.location || '',
      topics_covered: meeting.topics_covered || [],
      notes: meeting.notes || '',
    });
    setShowMeetingModal(true);
  };

  const openSignInModal = (meeting) => {
    setSelectedMeeting(meeting);
    resetSignInForm();
    setShowSignInModal(true);
  };

  const getMeetingTypeIcon = (type) => {
    const meetingType = meetingTypes.find((mt) => mt.value === type);
    return meetingType ? meetingType.icon : Users;
  };

  const getMeetingTypeLabel = (type) => {
    const meetingType = meetingTypes.find((mt) => mt.value === type);
    return meetingType ? meetingType.label : type;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-6 h-6" />
          Safety Meetings
        </h2>
        <button
          onClick={() => {
            resetMeetingForm();
            setShowMeetingModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Meeting
        </button>
      </div>

      {/* Quarterly Compliance Status */}
      {complianceStatus && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {quarters.map((quarter) => {
            const status = complianceStatus.quarters?.[quarter.value];
            const isCompliant = status?.compliant;
            const meetingsHeld = status?.meetings || 0;

            return (
              <div
                key={quarter.value}
                className={`p-4 rounded-lg border ${
                  isCompliant
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {quarter.label}
                  </span>
                  {isCompliant ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <p
                  className={`text-lg font-semibold ${
                    isCompliant
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {meetingsHeld} Meeting{meetingsHeld !== 1 ? 's' : ''}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div>
          <select
            value={quarterFilter}
            onChange={(e) => setQuarterFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">All Quarters</option>
            {quarters.map((q) => (
              <option key={q.value} value={q.value}>
                {q.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            setYearFilter(new Date().getFullYear().toString());
            setQuarterFilter('');
          }}
          className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Reset Filters
        </button>
      </div>

      {/* Meetings List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No safety meetings found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => {
            const TypeIcon = getMeetingTypeIcon(meeting.meeting_type);
            const isExpanded = expandedId === meeting.id;
            const attendeeCount = meeting.attendees?.length || 0;

            return (
              <div
                key={meeting.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                {/* Main row */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <TypeIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {getMeetingTypeLabel(meeting.meeting_type)}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(meeting.meeting_date).toLocaleDateString()}
                        </span>
                        {meeting.meeting_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {meeting.meeting_time}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {attendeeCount} Attendee{attendeeCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                      Q{meeting.quarter} {meeting.year}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                    {/* Topics Covered */}
                    {meeting.topics_covered?.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                          Topics Covered
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {meeting.topics_covered.map((topic, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Location */}
                    {meeting.location && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
                        <p className="text-gray-900 dark:text-white">{meeting.location}</p>
                      </div>
                    )}

                    {/* Notes */}
                    {meeting.notes && (
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Notes</p>
                        <p className="text-gray-900 dark:text-white">{meeting.notes}</p>
                      </div>
                    )}

                    {/* Attendees */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          Attendees ({attendeeCount})
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openSignInModal(meeting);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded"
                        >
                          <UserPlus className="w-4 h-4" />
                          Add Attendee
                        </button>
                      </div>
                      {meeting.attendees?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {meeting.attendees.map((attendee) => (
                            <div
                              key={attendee.id}
                              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded"
                            >
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {attendee.attendee_name}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveAttendee(meeting.id, attendee.id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                          No attendees signed in yet
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => openEditMeetingModal(meeting)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteMeeting(meeting.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Meeting Modal */}
      {showMeetingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingMeeting ? 'Edit Meeting' : 'New Safety Meeting'}
              </h3>
              <button
                onClick={() => {
                  setShowMeetingModal(false);
                  resetMeetingForm();
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleMeetingSubmit} className="p-6 space-y-6">
              {/* Meeting Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Meeting Type *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {meetingTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() =>
                          setMeetingFormData((prev) => ({
                            ...prev,
                            meeting_type: type.value,
                          }))
                        }
                        className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                          meetingFormData.meeting_type === type.value
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                            : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Meeting Date *
                  </label>
                  <input
                    type="date"
                    name="meeting_date"
                    value={meetingFormData.meeting_date}
                    onChange={handleMeetingInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    name="meeting_time"
                    value={meetingFormData.meeting_time}
                    onChange={handleMeetingInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={meetingFormData.location}
                  onChange={handleMeetingInputChange}
                  placeholder="e.g., Main Office, Training Room"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Topics Covered */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Topics Covered
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {commonTopics.map((topic) => (
                      <label
                        key={topic}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={meetingFormData.topics_covered.includes(topic)}
                          onChange={() => handleTopicToggle(topic)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{topic}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Select all topics that were covered during this meeting
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={meetingFormData.notes}
                  onChange={handleMeetingInputChange}
                  rows={3}
                  placeholder="Additional notes about the meeting..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowMeetingModal(false);
                    resetMeetingForm();
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  {editingMeeting ? 'Update' : 'Create'} Meeting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sign-In Modal */}
      {showSignInModal && selectedMeeting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Attendee Sign-In
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {getMeetingTypeLabel(selectedMeeting.meeting_type)} -{' '}
                  {new Date(selectedMeeting.meeting_date).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowSignInModal(false);
                  resetSignInForm();
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSignIn} className="p-6 space-y-6">
              {/* Attendee Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={signInFormData.attendee_name}
                  onChange={(e) =>
                    setSignInFormData((prev) => ({ ...prev, attendee_name: e.target.value }))
                  }
                  required
                  placeholder="Enter your full name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Signature */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Signature *
                </label>
                <SignatureCapture
                  value={signInFormData.signature_data}
                  onChange={(sig) =>
                    setSignInFormData((prev) => ({ ...prev, signature_data: sig }))
                  }
                  height={120}
                  width={350}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowSignInModal(false);
                    resetSignInForm();
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!signInFormData.attendee_name || !signInFormData.signature_data}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SafetyMeetingList;
