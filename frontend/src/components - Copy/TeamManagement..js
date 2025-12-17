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
  RefreshCw,
  Crown,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { companyAPI, rolesAPI, invitationsAPI, authAPI } from '../services/api';

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
  
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);

  useEffect(() => {
    if (currentCompany) {
      loadData();
    }
  }, [currentCompany]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, invitationsRes, rolesRes] = await Promise.all([
        companyAPI.members(currentCompany.id),
        invitationsAPI.list(),
        rolesAPI.available(),
      ]);
      
      setMembers(membersRes.data.results || membersRes.data || []);
      setInvitations(invitationsRes.data.results || invitationsRes.data || []);
      setRoles(rolesRes.data.results || rolesRes.data || []);
    } catch (err) {
      console.error('Error loading team data:', err);
      setError('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this team member?')) {
      return;
    }
    
    try {
      await companyAPI.removeMember(currentCompany.id, memberId);
      await loadData();
      setActiveDropdown(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const handleRevokeInvitation = async (invitationId) => {
    try {
      await invitationsAPI.revoke(invitationId);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to revoke invitation');
    }
  };

  const handleResendInvitation = async (invitationId) => {
    try {
      await invitationsAPI.resend(invitationId);
      alert('Invitation resent successfully');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to resend invitation');
    }
  };

  const handleUpdateRole = async (memberId, newRoleId) => {
    try {
      await companyAPI.updateMember(currentCompany.id, memberId, { role: newRoleId });
      await loadData();
      setShowEditRoleModal(false);
      setSelectedMember(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update role');
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
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-600 mt-1">
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
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{members.length}</p>
              <p className="text-sm text-gray-600">Team Members</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Mail className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingInvitations.length}</p>
              <p className="text-sm text-gray-600">Pending Invitations</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{roles.length}</p>
              <p className="text-sm text-gray-600">Available Roles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members List */}
      <div className="bg-white rounded-lg border mb-6">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
        </div>
        
        <div className="divide-y">
          {members.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No team members yet. Invite someone to get started!
            </div>
          ) : (
            members.map((member) => (
              <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
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
                      <p className="font-medium text-gray-900">
                        {member.user?.first_name} {member.user?.last_name}
                        {member.user?.id === user?.id && (
                          <span className="text-gray-500 text-sm ml-2">(You)</span>
                        )}
                      </p>
                      {member.role?.codename === 'owner' && (
                        <Crown className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{member.user?.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Role Badge */}
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    ROLE_COLORS[member.role?.codename] || 'bg-gray-100 text-gray-800'
                  }`}>
                    {member.role?.name}
                  </span>
                  
                  {/* Actions Dropdown */}
                  {isOwnerOrAdmin() && member.user?.id !== user?.id && member.role?.codename !== 'owner' && (
                    <div className="relative">
                      <button
                        onClick={() => setActiveDropdown(activeDropdown === member.id ? null : member.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-500" />
                      </button>
                      
                      {activeDropdown === member.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg z-10 py-1">
                          <button
                            onClick={() => {
                              setSelectedMember(member);
                              setShowEditRoleModal(true);
                              setActiveDropdown(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Edit className="w-4 h-4" />
                            Change Role
                          </button>
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
        <div className="bg-white rounded-lg border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Pending Invitations</h2>
          </div>
          
          <div className="divide-y">
            {pendingInvitations.map((invitation) => (
              <div key={invitation.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-gray-500" />
                  </div>
                  
                  <div>
                    <p className="font-medium text-gray-900">{invitation.email}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold">Invite Team Member</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="colleague@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
            {roleId && (
              <p className="mt-1 text-xs text-gray-500">
                {ROLE_DESCRIPTIONS[roles.find(r => r.id === parseInt(roleId))?.codename] || ''}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Personal Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={3}
              placeholder="Welcome to the team!"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Change Role</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-white font-medium">
                {member.user?.first_name?.[0] || member.user?.email?.[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-medium">{member.user?.first_name} {member.user?.last_name}</p>
              <p className="text-sm text-gray-500">{member.user?.email}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select New Role
            </label>
            <div className="space-y-2">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedRoleId === role.id 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-gray-200 hover:bg-gray-50'
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
                    <p className="font-medium text-gray-900">{role.name}</p>
                    <p className="text-sm text-gray-500">
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
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
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
