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
  owner: 'bg-purple-100 text-purple-800',
  admin: 'bg-blue-100 text-blue-800',
  manager: 'bg-green-100 text-green-800',
  applicator: 'bg-orange-100 text-orange-800',
  worker: 'bg-gray-100 text-gray-800',
  viewer: 'bg-gray-100 text-gray-600',
  pca: 'bg-teal-100 text-teal-800',
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage team members and their access to {currentCompany?.name}
          </p>
        </div>
        
        {isOwnerOrAdmin() && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Invite Member
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{members.length}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Team Members</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Mail className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{pendingInvitations.length}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pending Invitations</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{roles.length}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Available Roles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 mb-6">
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Team Members</h2>
        </div>

        <div className="divide-y dark:divide-gray-700">
          {members.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
              No team members yet. Invite someone to get started!
            </div>
          ) : (
            members.map((member) => (
              <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium">
                      {member.user?.first_name?.[0] || member.user?.email?.[0]?.toUpperCase() || '?'}
                      {member.user?.last_name?.[0] || ''}
                    </span>
                  </div>
                  
                  {/* Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {member.user?.first_name} {member.user?.last_name}
                        {member.user?.id === user?.id && (
                          <span className="text-gray-500 dark:text-gray-400 text-sm ml-2">(You)</span>
                        )}
                      </p>
                      {member.role?.codename === 'owner' && (
                        <Crown className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{member.user?.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Role Badge */}
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    ROLE_COLORS[member.role?.codename] || 'bg-gray-100 text-gray-800'
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
                      className="p-2 hover:bg-purple-100 rounded-lg text-gray-500 hover:text-purple-600"
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
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      </button>

                      {activeDropdown === member.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg z-10 py-1">
                          <button
                            onClick={() => {
                              setSelectedMember(member);
                              setShowEditRoleModal(true);
                              setActiveDropdown(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
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
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-purple-600 hover:bg-purple-50"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                              Transfer Ownership
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
          <div className="px-6 py-4 border-b dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pending Invitations</h2>
          </div>

          <div className="divide-y dark:divide-gray-700">
            {pendingInvitations.map((invitation) => (
              <div key={invitation.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </div>

                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{invitation.email}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <Clock className="w-4 h-4" />
                      Expires {new Date(invitation.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    ROLE_COLORS[invitation.role?.codename] || 'bg-gray-100 text-gray-800'
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
                        className="p-2 hover:bg-blue-100 rounded-lg text-gray-500 hover:text-blue-600"
                        title="Copy invite link"
                      >
                        <Link className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleResendInvitation(invitation.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                        title="Resend invitation"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRevokeInvitation(invitation.id)}
                        className="p-2 hover:bg-red-100 rounded-lg text-gray-500 hover:text-red-600"
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 className="text-lg font-semibold dark:text-white">Invite Team Member</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="colleague@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role *
            </label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {roleId && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {ROLE_DESCRIPTIONS[roles.find(r => r.id === parseInt(roleId))?.codename] || ''}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Personal Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={3}
              placeholder="Welcome to the team!"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold dark:text-white">Change Role</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-white font-medium">
                {member.user?.first_name?.[0] || member.user?.email?.[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium dark:text-white">{member.user?.first_name} {member.user?.last_name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{member.user?.email}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select New Role
            </label>
            <div className="space-y-2">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedRoleId === role.id
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role.id}
                    checked={selectedRoleId === role.id}
                    onChange={(e) => setSelectedRoleId(parseInt(e.target.value))}
                    className="mt-1 text-green-600 focus:ring-green-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{role.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
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
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectedRoleId === member.role?.id}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transfer Ownership</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
              </div>
            )}

            <div className="p-4 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                <strong>Warning:</strong> You are about to transfer ownership of{' '}
                <strong>{companyName}</strong> to{' '}
                <strong>{member.user.first_name} {member.user.last_name}</strong> ({member.user.email}).
              </p>
              <ul className="mt-3 text-sm text-orange-700 dark:text-orange-300 space-y-1">
                <li>• You will become an Admin</li>
                <li>• {member.user.first_name || 'The new owner'} will have full control</li>
                <li>• Only the new owner can reverse this</li>
              </ul>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type <strong>TRANSFER</strong> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="TRANSFER"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
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
