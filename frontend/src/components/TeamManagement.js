import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  MoreVertical,
  Trash2,
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Crown,
  X,
  Copy,
  Link,
  ArrowRightLeft,
  Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { companyAPI, rolesAPI, invitationsAPI, authAPI } from '../services/api';
import { useConfirm } from '../contexts/ConfirmContext';
import { useToast } from '../contexts/ToastContext';

// Role badge colors
const ROLE_COLORS = {
  owner: 'bg-sand-200 text-bark-800',
  admin: 'bg-orange-100 text-orange-700',
  manager: 'bg-green-100 text-green-700',
  applicator: 'bg-orange-100 text-orange-800',
  worker: 'bg-cream-100 text-text',
  viewer: 'bg-cream-100 text-bark-600',
  pca: 'bg-green-100 text-green-800',
  accountant: 'bg-yellow-100 text-yellow-800',
};

const ROLE_DESCRIPTIONS = {
  owner: 'Full access including billing and company deletion',
  admin: 'Full operational access, can manage users',
  manager: 'Day-to-day operations, can invite users',
  applicator: 'Record and sign pesticide applications',
  worker: 'View-only access to farms and fields',
  viewer: 'Read-only access to all data',
  pca: 'Pest Control Advisor - can create recommendations',
  accountant: 'Access to financial data and reports',
};

export default function TeamManagement() {
  const { currentCompany, user, isOwnerOrAdmin } = useAuth();
  const confirmDialog = useConfirm();
  const toast = useToast();
  // Debug logging
  console.log('TeamManagement - currentCompany:', currentCompany);
  console.log('TeamManagement - isOwnerOrAdmin():', isOwnerOrAdmin());
  console.log('TeamManagement - role_codename:', currentCompany?.role_codename);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Check if current user is owner
  const isOwner = currentCompany?.role_codename === 'owner';

  useEffect(() => {
    if (currentCompany?.id) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [currentCompany]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load each API separately to identify which one fails
      let membersData = [];
      let invitationsData = [];
      let rolesData = [];
      try {
        const membersRes = await companyAPI.members(currentCompany.id);
        membersData = membersRes.data.results || membersRes.data || [];
      } catch (err) {
        console.error('Error loading members:', err);
      }
      try {
        const invitationsRes = await invitationsAPI.list();
        invitationsData = invitationsRes.data.results || invitationsRes.data || [];
      } catch (err) {
        console.error('Error loading invitations:', err);
      }
      try {
        const rolesRes = await rolesAPI.available();
        rolesData = rolesRes.data.results || rolesRes.data || [];
      } catch (err) {
        console.error('Error loading roles:', err);
      }
      setMembers(membersData);
      setInvitations(invitationsData);
      setRoles(rolesData);
    } catch (err) {
      console.error('Error loading team data:', err);
      setError('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    const ok = await confirmDialog({ title: 'Are you sure?', message: 'Are you sure you want to remove this team member?', confirmLabel: 'Remove', variant: 'danger' });
    if (!ok) return;

    try {
      await companyAPI.removeMember(currentCompany.id, memberId);
      await loadData();
      setActiveDropdown(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleRevokeInvitation = async (invitationId) => {
    try {
      await invitationsAPI.revoke(invitationId);
      await loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to revoke invitation');
    }
  };

  const handleResendInvitation = async (invitationId) => {
    try {
      await invitationsAPI.resend(invitationId);
      toast.success('Invitation resent successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resend invitation');
    }
  };

  const handleUpdateRole = async (memberId, newRoleId) => {
    try {
      await companyAPI.updateMember(currentCompany.id, memberId, { role: newRoleId });
      await loadData();
      setShowEditRoleModal(false);
      setSelectedMember(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleTransferOwnership = async (newOwnerId) => {
    try {
      await companyAPI.transferOwnership(currentCompany.id, newOwnerId);
      setShowTransferModal(false);
      setSelectedMember(null);
      // Reload page to refresh user context with new role
      window.location.reload();
    } catch (err) {
      throw err; // Let the modal handle the error display
    }
  };

  const pendingInvitations = invitations.filter(inv => inv.status === 'pending');

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl text-heading">Team Management</h1>
          <p className="text-bark-600 mt-1">
            Manage team members and their access to {currentCompany?.name}
          </p>
        </div>
        {isOwnerOrAdmin() && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Invite Member
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-danger-bg border border-danger/25 rounded-card flex items-center gap-2 text-danger">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-raised rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Users className="w-5 h-5 text-link" />
            </div>
            <div>
              <p className="text-2xl font-bold text-heading">{members.length}</p>
              <p className="text-sm text-bark-600">Team Members</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-raised rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Mail className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-heading">{pendingInvitations.length}</p>
              <p className="text-sm text-bark-600">Pending Invitations</p>
            </div>
          </div>
        </div>

        <div className="bg-surface-raised rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-heading">{roles.length}</p>
              <p className="text-sm text-bark-600">Available Roles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members List */}
      <div className="bg-surface-raised rounded-lg border mb-6">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg text-heading">Team Members</h2>
        </div>

        <div className="divide-y">
          {members.length === 0 ? (
            <div className="px-6 py-8 text-center text-text-secondary">
              No team members yet. Invite someone to get started!
            </div>
          ) : (
            members.map((member) => (
              <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-cream-50">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-white font-medium">
                      {member.user?.first_name?.[0] || member.user?.email?.[0]?.toUpperCase() || '?'}
                      {member.user?.last_name?.[0] || ''}
                    </span>
                  </div>
                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-heading">
                        {member.user?.first_name} {member.user?.last_name}
                        {member.user?.id === user?.id && (
                          <span className="text-text-secondary text-sm ml-2">(You)</span>
                        )}
                      </p>
                      {member.role?.codename === 'owner' && (
                        <Crown className="w-4 h-4 text-yellow-600" />
                      )}
                    </div>
                    <p className="text-sm text-text-secondary">{member.user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Role Badge */}
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    ROLE_COLORS[member.role?.codename] || 'bg-cream-100 text-text'
                  }`}>
                    {member.role?.name}
                  </span>
                  {/* Transfer Ownership Button (only for owner viewing other members) */}
                  {isOwner && member.user?.id !== user?.id && member.role?.codename !== 'owner' && (
                    <button
                      onClick={() => {
                        setSelectedMember(member);
                        setShowTransferModal(true);
                      }}
                      className="p-2 hover:bg-sand-200 rounded-lg text-text-secondary hover:text-bark-700"
                      title="Transfer ownership to this member"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>
                  )}

                  {/* Actions Dropdown */}
                  {isOwnerOrAdmin() && member.user?.id !== user?.id && member.role?.codename !== 'owner' && (
                    <div className="relative">
                      <button
                        onClick={() => setActiveDropdown(activeDropdown === member.id ? null : member.id)}
                        className="p-2 hover:bg-cream-100 rounded-lg"
                      >
                        <MoreVertical className="w-5 h-5 text-text-secondary" />
                      </button>

                      {activeDropdown === member.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-surface-raised border rounded-card shadow-lg z-10 py-1">
                          <button
                            onClick={() => {
                              setSelectedMember(member);
                              setShowEditRoleModal(true);
                              setActiveDropdown(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-bark-700 hover:bg-cream-50"
                          >
                            <Edit className="w-4 h-4" />
                            Change Role
                          </button>
                          {isOwner && (
                            <button
                              onClick={() => {
                                setSelectedMember(member);
                                setShowTransferModal(true);
                                setActiveDropdown(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-bark-700 hover:bg-cream-100"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                              Transfer Ownership
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-danger-bg"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <div className="bg-surface-raised rounded-lg border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg text-heading">Pending Invitations</h2>
          </div>

          <div className="divide-y">
            {pendingInvitations.map((invitation) => (
              <div key={invitation.id} className="px-6 py-4 flex items-center justify-between hover:bg-cream-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-sand-200 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-text-secondary" />
                  </div>

                  <div>
                    <p className="font-medium text-heading">{invitation.email}</p>
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <Clock className="w-4 h-4" />
                      Expires {new Date(invitation.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    ROLE_COLORS[invitation.role?.codename] || 'bg-cream-100 text-text'
                  }`}>
                    {invitation.role?.name}
                  </span>
                  {isOwnerOrAdmin() && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const link = `${window.location.origin}/?invite=${invitation.token}`;
                          navigator.clipboard.writeText(link);
                          toast.success('Invite link copied to clipboard!');
                        }}
                        className="p-2 hover:bg-orange-100 rounded-lg text-text-secondary hover:text-link"
                        title="Copy invite link"
                      >
                        <Link className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleResendInvitation(invitation.id)}
                        className="p-2 hover:bg-cream-100 rounded-lg text-text-secondary hover:text-bark-700"
                        title="Resend invitation"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRevokeInvitation(invitation.id)}
                        className="p-2 hover:bg-danger-bg rounded-lg text-text-secondary hover:text-danger"
                        title="Revoke invitation"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          roles={roles}
          onClose={() => setShowInviteModal(false)}
          onSuccess={() => {
            setShowInviteModal(false);
            loadData();
          }}
        />
      )}

      {/* Edit Role Modal */}
      {showEditRoleModal && selectedMember && (
        <EditRoleModal
          member={selectedMember}
          roles={roles}
          onClose={() => {
            setShowEditRoleModal(false);
            setSelectedMember(null);
          }}
          onSave={handleUpdateRole}
        />
      )}

      {/* Transfer Ownership Modal */}
      {showTransferModal && selectedMember && (
        <TransferOwnershipModal
          member={selectedMember}
          companyName={currentCompany?.name}
          onClose={() => {
            setShowTransferModal(false);
            setSelectedMember(null);
          }}
          onConfirm={() => handleTransferOwnership(selectedMember.user.id)}
        />
      )}

      {/* Click outside to close dropdown */}
      {activeDropdown && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setActiveDropdown(null)}
        />
      )}
    </div>
  );
}


// =============================================================================
// INVITE MODAL
// =============================================================================

function InviteModal({ roles, onClose, onSuccess }) {
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Set default role to 'worker' or first available
    const defaultRole = roles.find(r => r.codename === 'worker') || roles[0];
    if (defaultRole) {
      setRoleId(defaultRole.id);
    }
  }, [roles]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.invite(email, roleId, message);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-raised rounded-card shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            <h2 className="text-lg">Invite Team Member</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-bark-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-danger-bg border border-danger/25 rounded-card flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" />
              <span className="text-danger text-sm">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-border-strong rounded-card bg-surface-raised focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="colleague@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">
              Role *
            </label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full px-4 py-2 border border-border-strong rounded-card bg-surface-raised focus:ring-2 focus:ring-primary focus:border-transparent"
              required
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {roleId && (
              <p className="mt-1 text-xs text-text-secondary">
                {ROLE_DESCRIPTIONS[roles.find(r => r.id === parseInt(roleId))?.codename] || ''}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">
              Personal Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-2 border border-border-strong rounded-card bg-surface-raised focus:ring-2 focus:ring-primary focus:border-transparent"
              rows={3}
              placeholder="Welcome to the team!"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border-strong rounded-card text-bark-700 hover:bg-cream-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// =============================================================================
// EDIT ROLE MODAL
// =============================================================================

function EditRoleModal({ member, roles, onClose, onSave }) {
  const [selectedRoleId, setSelectedRoleId] = useState(member.role?.id || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSave(member.id, selectedRoleId);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-raised rounded-card shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg">Change Role</h2>
          <button onClick={onClose} className="text-text-muted hover:text-bark-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-cream-50 rounded-lg">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-medium">
                {member.user?.first_name?.[0] || member.user?.email?.[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium">{member.user?.first_name} {member.user?.last_name}</p>
              <p className="text-sm text-text-secondary">{member.user?.email}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-bark-700 mb-2">
              Select New Role
            </label>
            <div className="space-y-2">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedRoleId === role.id
                      ? 'border-primary bg-primary-light'
                      : 'border-border hover:bg-cream-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role.id}
                    checked={selectedRoleId === role.id}
                    onChange={(e) => setSelectedRoleId(parseInt(e.target.value))}
                    className="mt-1 text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="font-medium text-heading">{role.name}</p>
                    <p className="text-sm text-text-secondary">
                      {ROLE_DESCRIPTIONS[role.codename] || ''}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border-strong rounded-card text-bark-700 hover:bg-cream-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectedRoleId === member.role?.id}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// =============================================================================
// TRANSFER OWNERSHIP MODAL
// =============================================================================

function TransferOwnershipModal({ member, companyName, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (confirmText !== 'TRANSFER') {
      setError('Please type TRANSFER to confirm');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onConfirm();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to transfer ownership');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-raised rounded-card shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg text-heading">Transfer Ownership</h3>
              <p className="text-sm text-text-secondary">This action cannot be undone</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-danger-bg border border-danger/25 rounded-card flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                <span className="text-danger text-sm">{error}</span>
              </div>
            )}

            <div className="p-4 bg-orange-50 border border-orange-200 rounded-card">
              <p className="text-sm text-orange-800">
                <strong>Warning:</strong> You are about to transfer ownership of{' '}
                <strong>{companyName}</strong> to{' '}
                <strong>{member.user.first_name} {member.user.last_name}</strong> ({member.user.email}).
              </p>
              <ul className="mt-3 text-sm text-orange-700 space-y-1">
                <li>• You will become an Admin</li>
                <li>• {member.user.first_name || 'The new owner'} will have full control</li>
                <li>• Only the new owner can reverse this</li>
              </ul>
            </div>

            <div>
              <label className="block text-sm font-medium text-bark-700 mb-2">
                Type <strong>TRANSFER</strong> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                className="w-full px-4 py-2 border border-border-strong rounded-card bg-surface-raised focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="TRANSFER"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="p-6 border-t border-border flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-border-strong rounded-card text-bark-700 hover:bg-cream-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || confirmText !== 'TRANSFER'}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Transferring...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  Transfer Ownership
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
