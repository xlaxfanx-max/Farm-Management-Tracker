import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import { Alert, Button, Card, Checkbox, IconButton, Input } from './ui';

// =============================================================================
// SHARED AUTH CHROME
// =============================================================================

export function AuthShell({ eyebrow = 'Farm operations', title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="finch-eyebrow mb-2">{eyebrow}</p>
          <p className="font-display text-5xl text-heading leading-none">
            Finch<span className="text-primary">.</span>
          </p>
          {title && <h1 className="font-display text-card-title text-heading mt-5">{title}</h1>}
          {subtitle && <p className="text-text-secondary mt-1">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function PasswordToggle({ shown, onToggle }) {
  return (
    <IconButton
      icon={shown ? EyeOff : Eye}
      label={shown ? 'Hide password' : 'Show password'}
      variant="ghost"
      size="sm"
      onClick={onToggle}
    />
  );
}

// =============================================================================
// LOGIN COMPONENT
// =============================================================================

export default function Login() {
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [remember, setRemember] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setLocalError(result.error);
    }

    setLoading(false);
  };

  const displayError = localError || error;

  return (
    <AuthShell subtitle="Sign in to your account">
      <Card elevation="floating" padding="lg">
        {displayError && (
          <Alert tone="danger" className="mb-5">
            {displayError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Email address"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            trailing={<PasswordToggle shown={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
          />

          <div className="flex items-center justify-between">
            <Checkbox
              label="Remember me"
              name="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <a
              href="/forgot-password"
              className="text-sm text-link hover:text-link-hover font-medium"
            >
              Forgot password?
            </a>
          </div>

          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Need an account? Contact your administrator to receive an invitation.
        </p>
      </Card>

      <p className="mt-6 text-center text-xs text-text-muted">
        Blocks, water, harvest and compliance in one place.
      </p>
    </AuthShell>
  );
}

// =============================================================================
// REGISTER COMPONENT
// =============================================================================

export function Register({ onSwitchToLogin }) {
  const { register, error } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    companyName: '',
    phone: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [step, setStep] = useState(1);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    const result = await register({
      email: formData.email,
      password: formData.password,
      first_name: formData.firstName,
      last_name: formData.lastName,
      company_name: formData.companyName,
      phone: formData.phone,
    });

    if (!result.success) {
      if (typeof result.error === 'object') {
        const messages = Object.entries(result.error)
          .map(([field, msg]) => `${field}: ${msg}`)
          .join(', ');
        setLocalError(messages);
      } else {
        setLocalError(result.error);
      }
    }

    setLoading(false);
  };

  const displayError = localError || error;

  return (
    <AuthShell title="Create account" subtitle="Start managing your grove operations">
      {/* Progress steps */}
      <div className="flex items-center justify-center mb-6">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
          step >= 1 ? 'bg-primary text-white' : 'bg-sand-200 text-bark-600'
        }`}>1</div>
        <div className={`w-16 h-1 ${step >= 2 ? 'bg-primary' : 'bg-sand-200'}`} />
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
          step >= 2 ? 'bg-primary text-white' : 'bg-sand-200 text-bark-600'
        }`}>2</div>
      </div>

      <Card elevation="floating" padding="lg">
        {displayError && (
          <Alert tone="danger" className="mb-5">
            {displayError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 1 ? (
            <>
              <h3 className="font-display text-card-title text-heading mb-4">Company information</h3>

              <Input
                label="Company/farm name"
                required
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder="Smith Family Farms"
              />

              <Input
                label="Phone number"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="(555) 123-4567"
              />

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => setStep(2)}
                disabled={!formData.companyName}
              >
                Continue
              </Button>
            </>
          ) : (
            <>
              <h3 className="font-display text-card-title text-heading mb-4">Your information</h3>

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
                label="Email address"
                required
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
              />

              <Input
                label="Password"
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

              <div className="flex gap-3">
                <Button variant="secondary" size="lg" className="flex-1" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" variant="primary" size="lg" className="flex-1" loading={loading}>
                  {loading ? 'Creating…' : 'Create account'}
                </Button>
              </div>
            </>
          )}
        </form>

        {onSwitchToLogin && (
          <p className="mt-6 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Button variant="link" size="sm" onClick={onSwitchToLogin} className="px-0">
              Sign in
            </Button>
          </p>
        )}
      </Card>
    </AuthShell>
  );
}
