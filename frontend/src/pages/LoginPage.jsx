import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { LockIcon } from '../components/Icons';

// Email regex — stricter than just includes('@')
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const LoginPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track whether password field has been touched (for length hint display)
  const [passwordTouched, setPasswordTouched] = useState(false);

  const { login, signup, isAuthenticated, role: userRole, isLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // If already authenticated, redirect to their role dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated && userRole) {
      const targetRoute = userRole === 'driver' ? '/driver' : userRole === 'admin' ? '/admin' : '/passenger';
      navigate(targetRoute, { replace: true });
    }
  }, [isAuthenticated, userRole, isLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Client-side validations
    if (isSignUp && (!name || name.trim().length < 2)) {
      const msg = 'Please provide a valid name (at least 2 characters).';
      setError(msg);
      return;
    }
    if (!email || !EMAIL_RE.test(email.trim())) {
      const msg = 'Please enter a valid email address (e.g. user@example.com).';
      setError(msg);
      return;
    }
    if (!password || password.length < 6) {
      const msg = 'Password must be at least 6 characters.';
      setError(msg);
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignUp) {
        const result = await signup(name.trim(), email.trim(), password);
        showToast(`Welcome, ${result.user?.name || name}! Account created.`, 'success');
        const targetRoute = result.role === 'driver' ? '/driver' : '/passenger';
        navigate(targetRoute, { replace: true });
      } else {
        const result = await login(email.trim(), password);
        showToast(`Welcome back, ${result.user?.name || email}!`, 'success');
        const targetRoute = result.role === 'driver' ? '/driver' : result.role === 'admin' ? '/admin' : '/passenger';
        navigate(targetRoute, { replace: true });
      }
    } catch (err) {
      console.error('Auth error:', err);
      let msg;
      if (err.response && err.response.data && err.response.data.detail) {
        if (Array.isArray(err.response.data.detail)) {
          msg = err.response.data.detail[0]?.msg || 'Validation failed. Check your input.';
        } else {
          msg = err.response.data.detail;
        }
      } else if (err.message) {
        msg = err.message;
      } else {
        msg = 'An unexpected error occurred. Please try again.';
      }
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = (signUpMode) => {
    setIsSignUp(signUpMode);
    setError(null);
    setPasswordTouched(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <LoadingSpinner size="lg" message="Loading..." />
      </div>
    );
  }

  const pwLen = password.length;
  const pwOk = pwLen >= 6;

  return (
    <div
      className="min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #F3F0E8 0%, #E3E7D6 100%)' }}
    >
      {/* Decorative Route Line Background */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1000 700"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        style={{ opacity: 0.12 }}
        aria-hidden="true"
      >
        <path
          d="M 120 180 C 220 220, 280 270, 380 290 C 480 310, 540 400, 640 430 C 740 460, 800 520, 900 550"
          stroke="#566038"
          strokeWidth="3"
          strokeDasharray="6 6"
          strokeLinecap="round"
        />
        <circle cx="120" cy="180" r="7" fill="#566038" />
        <circle cx="120" cy="180" r="3" fill="#F3F0E8" />
        <circle cx="380" cy="290" r="7" fill="#566038" />
        <circle cx="380" cy="290" r="3" fill="#F3F0E8" />
        <circle cx="640" cy="430" r="7" fill="#566038" />
        <circle cx="640" cy="430" r="3" fill="#F3F0E8" />
        <circle cx="900" cy="550" r="7" fill="#566038" />
        <circle cx="900" cy="550" r="3" fill="#F3F0E8" />
      </svg>

      <Card className="w-full max-w-md relative z-10 border border-beige bg-cream shadow-soft">
        {/* Header */}
        <div className="text-center mb-6">
          <LockIcon size={48} className="mx-auto mb-3 shadow-soft" />
          <h2 className="text-2xl font-heading font-black text-olive-deep tracking-tight">
            {isSignUp ? 'Create your Account' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-ink-soft mt-1">
            Real-time transit tracking &amp; ML ETA predictions
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-surface p-1 rounded-xl border border-beige mb-6">
          <button
            type="button"
            id="tab-signin"
            onClick={() => toggleMode(false)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${!isSignUp
              ? 'bg-primary text-white shadow-soft'
              : 'text-ink-soft hover:text-olive-deep'
              }`}
          >
            Sign In
          </button>
          <button
            type="button"
            id="tab-signup"
            onClick={() => toggleMode(true)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${isSignUp
              ? 'bg-primary text-white shadow-soft'
              : 'text-ink-soft hover:text-olive-deep'
              }`}
          >
            Sign Up
          </button>
        </div>

        {/* Inline Error Message Banner */}
        {error && (
          <div
            id="auth-error-banner"
            className="mb-5 p-3 rounded-xl bg-olive-deep border border-olive-deep text-surface text-xs flex items-start space-x-2.5 animate-fadeIn"
          >
            <span className="text-sm leading-none mt-0.5">⚠️</span>
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sign Up Fields */}
          {isSignUp && (
            <div>
              <label
                htmlFor="signup-name"
                className="block text-xs font-semibold text-olive-deep uppercase tracking-wider mb-1.5"
              >
                Full Name
              </label>
              <input
                id="signup-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full px-4 py-2.5 bg-field border border-beige rounded-btn text-ink placeholder-ink-soft focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors text-sm shadow-sm"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-semibold text-olive-deep uppercase tracking-wider mb-1.5"
            >
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-4 py-2.5 bg-field border border-beige rounded-btn text-ink placeholder-ink-soft focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors text-sm shadow-sm"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-semibold text-olive-deep uppercase tracking-wider mb-1.5"
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setPasswordTouched(true)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 bg-field border border-beige rounded-btn text-ink placeholder-ink-soft focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors text-sm shadow-sm"
            />
            {isSignUp && (
              <div className="flex items-center justify-between mt-1">
                <p className="text-[11px] text-ink-soft">Must be at least 6 characters</p>
                {passwordTouched && (
                  <p className={`text-[11px] font-mono font-bold ${pwOk ? 'text-olive-deep' : 'text-ink-soft'}`}>
                    {pwLen}/6 {pwOk ? '✓' : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              id="auth-submit-btn"
              disabled={isSubmitting}
              className="w-full py-3 text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-soft cursor-pointer"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : isSignUp ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </Button>
          </div>
        </form>

        <div className="mt-6 pt-5 border-t border-beige text-center">
          <p className="text-xs text-ink-soft">
            {isSignUp ? 'Already registered?' : "Don't have an account yet?"}{' '}
            <button
              type="button"
              id="auth-toggle-link"
              onClick={() => toggleMode(!isSignUp)}
              className="text-olive-deep hover:text-primary font-semibold transition-colors underline underline-offset-2 ml-1 cursor-pointer"
            >
              {isSignUp ? 'Sign In here' : 'Create one now'}
            </button>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
