import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';
import { authAPI } from '../services/api';
import { Alert, Button, Card, Input, Spinner } from './ui';
import { AuthShell, PasswordToggle } from './Login';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setTokenError('No reset token provided. Please request a new password reset link.');
        setValidating(false);
        return;
      }

      try {
        await authAPI.validateResetToken(token);
        setValidating(false);
      } catch (err) {
        setTokenError(err.response?.data?.error || 'Invalid or expired reset link. Please request a new one.');
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await authAPI.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const backToLogin = (
    <div className="text-center">
      <Link
        to="/login"
        className="inline-flex items-center gap-2 text-sm font-medium text-link hover:text-link-hover transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to login
      </Link>
    </div>
  );

  // Loading state while validating token
  if (validating) {
    return (
      <AuthShell>
        <Spinner size="lg" label="Validating reset link…" />
      </AuthShell>
    );
  }

  // Token error state
  if (tokenError) {
    return (
      <AuthShell title="Invalid reset link" subtitle={tokenError}>
        <Card elevation="floating" padding="lg">
          <div className="space-y-4">
            <Link to="/forgot-password" className="block">
              <Button variant="primary" size="lg" fullWidth>
                Request new reset link
              </Button>
            </Link>
            {backToLogin}
          </div>
        </Card>
      </AuthShell>
    );
  }

  // Success state
  if (success) {
    return (
      <AuthShell
        title="Password reset"
        subtitle="Your password has been changed. You can now sign in with the new one."
      >
        <Card elevation="floating" padding="lg">
          <div className="space-y-5">
            <Alert tone="success" title="All set">
              Your new password is active on this account.
            </Alert>
            <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/login')}>
              Go to login
            </Button>
          </div>
        </Card>
      </AuthShell>
    );
  }

  // Reset password form
  return (
    <AuthShell title="Set new password" subtitle="Enter your new password below.">
      <Card elevation="floating" padding="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <Alert tone="danger">{error}</Alert>}

          <Input
            label="New password"
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            hint="Must be at least 8 characters long"
            leading={<Lock className="h-4 w-4" />}
            trailing={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
          />

          <Input
            label="Confirm new password"
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            leading={<Lock className="h-4 w-4" />}
            trailing={
              <PasswordToggle
                shown={showConfirmPassword}
                onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            }
          />

          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            {loading ? 'Resetting…' : 'Reset password'}
          </Button>

          {backToLogin}
        </form>
      </Card>
    </AuthShell>
  );
}
