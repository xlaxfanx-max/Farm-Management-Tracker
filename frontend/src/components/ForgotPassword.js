import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { authAPI } from '../services/api';
import { Alert, Button, Card, Input } from './ui';
import { AuthShell } from './Login';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reset email. Please try again.');
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

  if (success) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`If an account exists for ${email}, a password reset link is on its way.`}
      >
        <Card elevation="floating" padding="lg">
          <div className="space-y-5">
            <Alert tone="success" title="Email sent">
              The reset link expires in 24 hours. Check your spam folder if you don't see it.
            </Alert>

            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setSuccess(false);
                setEmail('');
              }}
            >
              Try a different email
            </Button>

            {backToLogin}
          </div>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email address and we'll send you a link to reset your password."
    >
      <Card elevation="floating" padding="lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <Alert tone="danger">{error}</Alert>}

          <Input
            label="Email address"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            leading={<Mail className="h-4 w-4" />}
          />

          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>

          {backToLogin}
        </form>
      </Card>
    </AuthShell>
  );
}
