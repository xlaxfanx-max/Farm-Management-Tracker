import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { Alert, Button, Card, Input, Spinner } from './ui';
import { AuthShell, PasswordToggle } from './Login';

function InvitationSummary({ invitation }) {
  return (
    <dl className="mb-6 p-4 bg-surface-sunken rounded-card text-sm">
      <div className="flex gap-2">
        <dt className="font-semibold text-bark-700">Email</dt>
        <dd className="text-text-secondary">{invitation.email}</dd>
      </div>
      <div className="flex gap-2 mt-1">
        <dt className="font-semibold text-bark-700">Invited by</dt>
        <dd className="text-text-secondary">{invitation.invited_by}</dd>
      </div>
    </dl>
  );
}

export default function AcceptInvitation({ token, onComplete }) {
  const { login, logout, isAuthenticated, user } = useAuth();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingPassword, setExistingPassword] = useState('');
  const [existingSubmitting, setExistingSubmitting] = useState(false);

  useEffect(() => {
    validateInvitation();
  }, [token]);

  const validateInvitation = async () => {
    try {
      const response = await authAPI.validateInvitation(token);
      setInvitation(response.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setError('This invitation link is invalid or has expired.');
      } else {
        setError(err.response?.data?.error || 'Failed to validate invitation');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);

    try {
      const response = await authAPI.acceptInvitation(
        token,
        formData.password,
        formData.firstName,
        formData.lastName
      );
      setSuccess(true);
      // Auto-login after a short delay
      setTimeout(async () => {
        const loginResult = await login(invitation.email, formData.password);
        if (loginResult.success) {
          onComplete?.();
        }
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  const acceptExistingInvitation = async () => {
    setExistingSubmitting(true);
    setError('');

    try {
      await authAPI.acceptInvitationExisting(token);
      setSuccess(true);
      setTimeout(() => {
        onComplete?.();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to accept invitation');
    } finally {
      setExistingSubmitting(false);
    }
  };

  const handleExistingLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!existingPassword) {
      setError('Password is required');
      return;
    }

    setExistingSubmitting(true);
    const loginResult = await login(invitation.email, existingPassword);

    if (!loginResult.success) {
      setExistingSubmitting(false);
      return;
    }

    try {
      await authAPI.acceptInvitationExisting(token);
      setSuccess(true);
      setTimeout(() => {
        onComplete?.();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to accept invitation');
    } finally {
      setExistingSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <AuthShell>
        <Spinner size="lg" label="Validating invitation…" />
      </AuthShell>
    );
  }

  // Error state (invalid/expired invitation)
  if (error && !invitation) {
    return (
      <AuthShell title="Invalid invitation" subtitle={error}>
        <Card elevation="floating" padding="lg">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => { window.location.href = '/'; }}
          >
            Go to login
          </Button>
        </Card>
      </AuthShell>
    );
  }

  // Success state
  if (success) {
    return (
      <AuthShell title="Welcome to the team" subtitle="Your account is ready.">
        <Card elevation="floating" padding="lg">
          <Alert tone="success" title="Account created">
            Signing you in…
          </Alert>
        </Card>
      </AuthShell>
    );
  }

  if (invitation?.existing_user) {
    const invitedEmail = invitation.email?.toLowerCase();
    const currentEmail = user?.email?.toLowerCase();
    const isInvitedUser = isAuthenticated && invitedEmail && invitedEmail === currentEmail;

    return (
      <AuthShell
        title={`Join ${invitation.company_name}`}
        subtitle={`You've been invited as ${invitation.role_name || invitation.role}.`}
      >
        <Card elevation="floating" padding="lg">
          {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

          <InvitationSummary invitation={invitation} />

          {!isAuthenticated && (
            <form onSubmit={handleExistingLogin} className="space-y-5">
              <Input
                label="Password"
                type="password"
                name="existingPassword"
                value={existingPassword}
                onChange={(e) => setExistingPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <Button type="submit" variant="primary" size="lg" fullWidth loading={existingSubmitting}>
                {existingSubmitting ? 'Signing in…' : 'Sign in and accept'}
              </Button>
            </form>
          )}

          {isAuthenticated && !isInvitedUser && (
            <div className="space-y-4">
              <p className="text-sm text-text-secondary">
                You're signed in as {user?.email}. Sign in as {invitation.email} to accept.
              </p>
              <Button variant="secondary" size="lg" fullWidth onClick={logout}>
                Sign out
              </Button>
            </div>
          )}

          {isInvitedUser && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={acceptExistingInvitation}
              loading={existingSubmitting}
            >
              {existingSubmitting ? 'Accepting…' : 'Accept invitation'}
            </Button>
          )}

          <p className="mt-6 text-center text-sm text-text-secondary">
            Need to create a new account instead?{' '}
            <Button variant="link" size="sm" className="px-0" onClick={() => { window.location.href = '/'; }}>
              Go to sign in
            </Button>
          </p>
        </Card>
      </AuthShell>
    );
  }

  // Invitation form
  return (
    <AuthShell
      title={`Join ${invitation.company_name}`}
      subtitle={`You've been invited as ${invitation.role_name || invitation.role}.`}
    >
      <Card elevation="floating" padding="lg">
        {error && <Alert tone="danger" className="mb-5">{error}</Alert>}

        <InvitationSummary invitation={invitation} />

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First name"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="John"
            />
            <Input
              label="Last name"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Smith"
            />
          </div>

          <Input
            label="Create password"
            required
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            minLength={8}
            hint="Must be at least 8 characters"
            trailing={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
          />

          <Input
            label="Confirm password"
            required
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="••••••••"
          />

          <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
            {submitting ? 'Creating account…' : 'Accept invitation and join'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <Button variant="link" size="sm" className="px-0" onClick={() => { window.location.href = '/'; }}>
            Sign in instead
          </Button>
        </p>
      </Card>
    </AuthShell>
  );
}
