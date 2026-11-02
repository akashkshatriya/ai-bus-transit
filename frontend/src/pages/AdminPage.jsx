import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../services/api';

export const AdminPage = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // ── Form State ─────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Driver List State ──────────────────────────────────────────────────────
  const [drivers, setDrivers] = useState([]);
  const [isLoadingDrivers, setIsLoadingDrivers] = useState(true);

  const fetchDrivers = useCallback(async () => {
    setIsLoadingDrivers(true);
    try {
      const response = await api.get('/api/v1/admin/drivers');
      setDrivers(response.data);
    } catch (err) {
      console.error('Failed to fetch drivers:', err);
      const msg = err.response?.data?.detail || err.message || 'Failed to load drivers.';
      showToast(msg, 'error');
    } finally {
      setIsLoadingDrivers(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  const handleCreateDriver = async (e) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      showToast('Please enter the driver full name.', 'error');
      return;
    }

    if (!trimmedEmail) {
      showToast('Please enter a valid driver email.', 'error');
      return;
    }

    if (!password || password.length < 8) {
      showToast('Password must be at least 8 characters long.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: trimmedName,
        email: trimmedEmail,
        password: password,
      };

      const response = await api.post('/api/v1/admin/drivers', payload);
      const created = response.data;

      showToast(`Driver account created for ${created.email}.`, 'success');

      // Clear the form and refresh driver list
      setName('');
      setEmail('');
      setPassword('');
      fetchDrivers();
    } catch (err) {
      console.error('Create driver error:', err);
      let msg = 'Failed to create driver account.';
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          msg = err.response.data.detail[0]?.msg || 'Validation failed. Check your input.';
        } else {
          msg = err.response.data.detail;
        }
      } else if (err.message) {
        msg = err.message;
      }
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-cream border border-beige shadow-soft">
        <div>
          <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
            <h1 className="text-xl sm:text-3xl font-heading font-black text-olive-deep">Admin Portal</h1>
            <span className="px-2.5 py-0.5 bg-sage-light border border-primary text-olive-deep rounded-full text-xs font-mono font-semibold uppercase">
              Admin
            </span>
          </div>
          <p className="text-ink-soft text-sm mt-1">
            Welcome back, <span className="font-semibold text-olive-deep">{user?.name || user?.email}</span> — Driver account management &amp; provisioning
          </p>
        </div>
      </div>

      {/* Main Grid: Form on Left, Driver List on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Driver Form */}
        <Card title="Create New Driver">
          <form onSubmit={handleCreateDriver} className="space-y-4">
            <div>
              <label
                htmlFor="driver-name"
                className="block text-xs font-semibold text-olive-deep uppercase tracking-wider mb-1.5"
              >
                Full Name
              </label>
              <input
                id="driver-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-4 py-2.5 bg-field border border-beige rounded-btn text-ink placeholder-ink-soft focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors text-sm shadow-sm"
              />
            </div>

            <div>
              <label
                htmlFor="driver-email"
                className="block text-xs font-semibold text-olive-deep uppercase tracking-wider mb-1.5"
              >
                Driver Email
              </label>
              <input
                id="driver-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="driver@example.com"
                className="w-full px-4 py-2.5 bg-field border border-beige rounded-btn text-ink placeholder-ink-soft focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors text-sm shadow-sm"
              />
            </div>

            <div>
              <label
                htmlFor="driver-password"
                className="block text-xs font-semibold text-olive-deep uppercase tracking-wider mb-1.5"
              >
                Temporary Password
              </label>
              <div className="relative">
                <input
                  id="driver-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full px-4 py-2.5 bg-field border border-beige rounded-btn text-ink placeholder-ink-soft focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/25 transition-colors text-sm shadow-sm pr-16"
                />
                <button
                  type="button"
                  id="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-soft hover:text-olive-deep px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-[11px] text-ink-soft mt-1">Must be at least 8 characters long</p>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                id="create-driver-btn"
                disabled={isSubmitting}
                className="w-full py-3 text-sm font-bold bg-primary hover:bg-primary-hover text-white shadow-soft cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating Driver...</span>
                  </div>
                ) : (
                  'Create Driver'
                )}
              </Button>
            </div>
          </form>
        </Card>

        {/* Existing Drivers List */}
        <Card title={`Existing Drivers (${drivers.length})`}>
          {isLoadingDrivers ? (
            <div className="py-8">
              <LoadingSpinner size="md" message="Loading drivers..." />
            </div>
          ) : drivers.length === 0 ? (
            <div className="text-center py-12 text-ink-soft text-sm">
              <p className="font-semibold text-olive-deep">No drivers registered yet</p>
              <p className="text-xs text-ink-soft mt-1">Use the form to create the first driver account.</p>
            </div>
          ) : (
            <div className="divide-y divide-beige max-h-[460px] overflow-y-auto pr-1">
              {drivers.map((d) => (
                <div key={d.id} className="py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-olive-deep truncate">{d.name}</p>
                    <p className="text-xs text-ink-soft truncate">{d.email}</p>
                  </div>
                  <span className="px-2.5 py-0.5 bg-sage-light border border-primary text-olive-deep rounded-full text-xs font-mono font-semibold uppercase shrink-0">
                    Driver
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminPage;

