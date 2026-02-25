import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Bell,
  Mail,
  Clock,
  Shield,
  CheckCircle2,
  Save,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Calendar,
  Award,
  Users,
  FileText,
  Building,
  MapPin,
} from 'lucide-react';
import { complianceProfileAPI, notificationPreferencesAPI, COMPLIANCE_CONSTANTS } from '../../services/api';

// Toggle Switch Component
const Toggle = ({ enabled, onChange, label, description }) => (
  <div className="flex items-center justify-between py-3">
    <div>
      <p className="font-medium text-gray-900">{label}</p>
      {description && <p className="text-sm text-gray-500">{description}</p>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
        ${enabled ? 'bg-primary' : 'bg-gray-200'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
          ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  </div>
);

// Section Header
const SectionHeader = ({ icon: Icon, title, description }) => (
  <div className="flex items-start gap-3 mb-4">
    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5 text-primary" />
    </div>
    <div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
    </div>
  </div>
);

// Multi-Select Checkbox Group
const CheckboxGroup = ({ options, selected, onChange, columns = 2 }) => (
  <div className={`grid grid-cols-${columns} gap-2`}>
    {options.map(option => (
      <label
        key={option.value}
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
      >
        <input
          type="checkbox"
          checked={selected.includes(option.value)}
          onChange={(e) => {
            if (e.target.checked) {
              onChange([...selected, option.value]);
            } else {
              onChange(selected.filter(v => v !== option.value));
            }
          }}
          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
        />
        <span className="text-sm text-gray-700">{option.label}</span>
      </label>
    ))}
  </div>
);

// Main Component
export default function ComplianceSettings({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  // Compliance Profile State
  const [profile, setProfile] = useState({
    primary_state: 'CA',
    additional_states: [],
    requires_pur_reporting: true,
    requires_wps_compliance: true,
    requires_fsma_compliance: false,
    organic_certified: false,
    globalgap_certified: false,
    buyer_requirements: {},
  });

  // Notification Preferences State
  const [preferences, setPreferences] = useState({
    email_enabled: true,
    email_digest: 'daily',
    notify_deadlines: true,
    notify_licenses: true,
    notify_training: true,
    notify_reports: true,
    deadline_reminder_days: [30, 14, 7, 1],
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, prefsRes] = await Promise.all([
        complianceProfileAPI.get().catch(() => ({ data: null })),
        notificationPreferencesAPI.get().catch(() => ({ data: null })),
      ]);

      if (profileRes.data) {
        setProfile(prev => ({ ...prev, ...profileRes.data }));
      }
      if (prefsRes.data) {
        setPreferences(prev => ({ ...prev, ...prefsRes.data }));
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save profile
  const saveProfile = async () => {
    setSaving(true);
    try {
      await complianceProfileAPI.update(profile);
      setSavedMessage('Compliance profile saved!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setSaving(false);
    }
  };

  // Save preferences
  const savePreferences = async () => {
    setSaving(true);
    try {
      await notificationPreferencesAPI.update(preferences);
      setSavedMessage('Notification preferences saved!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  // US States for dropdown
  const usStates = [
    { value: 'CA', label: 'California' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'FL', label: 'Florida' },
    { value: 'TX', label: 'Texas' },
    { value: 'WA', label: 'Washington' },
    { value: 'OR', label: 'Oregon' },
    { value: 'GA', label: 'Georgia' },
    { value: 'NY', label: 'New York' },
    { value: 'MI', label: 'Michigan' },
    { value: 'NC', label: 'North Carolina' },
  ];

  // Reminder day options
  const reminderDayOptions = [
    { value: 90, label: '90 days' },
    { value: 60, label: '60 days' },
    { value: 30, label: '30 days' },
    { value: 14, label: '14 days' },
    { value: 7, label: '7 days' },
    { value: 3, label: '3 days' },
    { value: 1, label: '1 day' },
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <button onClick={() => onNavigate?.('compliance')} className="hover:text-primary">
              Compliance
            </button>
            <span>/</span>
            <span>Settings</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Settings</h1>
        </div>

        {savedMessage && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-primary rounded-lg">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">{savedMessage}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Profile */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <SectionHeader
            icon={Shield}
            title="Compliance Profile"
            description="Configure your regulatory requirements"
          />

          <div className="space-y-4">
            {/* Primary State */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary State</label>
              <select
                value={profile.primary_state}
                onChange={(e) => setProfile({ ...profile, primary_state: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              >
                {usStates.map(state => (
                  <option key={state.value} value={state.value}>{state.label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Your primary state determines default regulatory requirements</p>
            </div>

            {/* Regulatory Requirements */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">Regulatory Requirements</p>

              <Toggle
                enabled={profile.requires_pur_reporting}
                onChange={(v) => setProfile({ ...profile, requires_pur_reporting: v })}
                label="Pesticide Use Reporting (PUR)"
                description="Required for California pesticide applications"
              />

              <Toggle
                enabled={profile.requires_wps_compliance}
                onChange={(v) => setProfile({ ...profile, requires_wps_compliance: v })}
                label="Worker Protection Standard (WPS)"
                description="EPA requirement for agricultural workers"
              />

              <Toggle
                enabled={profile.requires_fsma_compliance}
                onChange={(v) => setProfile({ ...profile, requires_fsma_compliance: v })}
                label="Food Safety Modernization Act (FSMA)"
                description="FDA food safety requirements"
              />
            </div>

            {/* Certifications */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">Certifications</p>

              <Toggle
                enabled={profile.organic_certified}
                onChange={(v) => setProfile({ ...profile, organic_certified: v })}
                label="USDA Organic Certified"
                description="Track organic compliance requirements"
              />

              <Toggle
                enabled={profile.globalgap_certified}
                onChange={(v) => setProfile({ ...profile, globalgap_certified: v })}
                label="GlobalGAP Certified"
                description="International food safety certification"
              />
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <SectionHeader
            icon={Bell}
            title="Notification Preferences"
            description="Control how and when you receive alerts"
          />

          <div className="space-y-4">
            {/* Email Settings */}
            <div>
              <Toggle
                enabled={preferences.email_enabled}
                onChange={(v) => setPreferences({ ...preferences, email_enabled: v })}
                label="Email Notifications"
                description="Receive compliance alerts via email"
              />

              {preferences.email_enabled && (
                <div className="mt-3 ml-4 pl-4 border-l-2 border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Frequency</label>
                  <select
                    value={preferences.email_digest}
                    onChange={(e) => setPreferences({ ...preferences, email_digest: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="instant">Instant</option>
                    <option value="daily">Daily Digest</option>
                    <option value="weekly">Weekly Digest</option>
                  </select>
                </div>
              )}
            </div>

            {/* Notification Types */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">Notify Me About</p>

              <Toggle
                enabled={preferences.notify_deadlines}
                onChange={(v) => setPreferences({ ...preferences, notify_deadlines: v })}
                label="Compliance Deadlines"
                description="Upcoming and overdue deadlines"
              />

              <Toggle
                enabled={preferences.notify_licenses}
                onChange={(v) => setPreferences({ ...preferences, notify_licenses: v })}
                label="License Expirations"
                description="Expiring licenses and certifications"
              />

              <Toggle
                enabled={preferences.notify_training}
                onChange={(v) => setPreferences({ ...preferences, notify_training: v })}
                label="Training Reminders"
                description="WPS and other training expirations"
              />

              <Toggle
                enabled={preferences.notify_reports}
                onChange={(v) => setPreferences({ ...preferences, notify_reports: v })}
                label="Report Deadlines"
                description="Upcoming report submissions"
              />
            </div>

            {/* Reminder Days */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">Reminder Days</p>
              <p className="text-xs text-gray-500 mb-3">Select when to receive deadline reminders</p>
              <CheckboxGroup
                options={reminderDayOptions}
                selected={preferences.deadline_reminder_days}
                onChange={(v) => setPreferences({ ...preferences, deadline_reminder_days: v })}
                columns={4}
              />
            </div>

            {/* Quiet Hours */}
            <div className="pt-4 border-t border-gray-200">
              <Toggle
                enabled={preferences.quiet_hours_enabled}
                onChange={(v) => setPreferences({ ...preferences, quiet_hours_enabled: v })}
                label="Quiet Hours"
                description="Pause notifications during specific hours"
              />

              {preferences.quiet_hours_enabled && (
                <div className="mt-3 ml-4 pl-4 border-l-2 border-gray-200 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input
                      type="time"
                      value={preferences.quiet_hours_start}
                      onChange={(e) => setPreferences({ ...preferences, quiet_hours_start: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input
                      type="time"
                      value={preferences.quiet_hours_end}
                      onChange={(e) => setPreferences({ ...preferences, quiet_hours_end: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={savePreferences}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-6">
          <SectionHeader
            icon={Settings}
            title="Compliance Modules"
            description="Manage your compliance data"
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <button
              onClick={() => onNavigate?.('compliance-deadlines')}
              className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-green-200 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Deadlines</p>
                <p className="text-xs text-gray-500">Manage deadlines</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate?.('compliance-licenses')}
              className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-green-200 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Licenses</p>
                <p className="text-xs text-gray-500">Certifications</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate?.('compliance-wps')}
              className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-green-200 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-gray-900">WPS</p>
                <p className="text-xs text-gray-500">Training & REI</p>
              </div>
            </button>

            <button
              onClick={() => onNavigate?.('compliance-reports')}
              className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-green-200 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Reports</p>
                <p className="text-xs text-gray-500">PUR, SGMA, etc.</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
