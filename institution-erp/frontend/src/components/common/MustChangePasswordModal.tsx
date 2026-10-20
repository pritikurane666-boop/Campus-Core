import React, { useState } from 'react';
import { useAuth } from '../../store/authContext';
import { authApi } from '../../api/endpoints';
import { ShieldCheck, KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, Check } from 'lucide-react';

export const MustChangePasswordModal: React.FC = () => {
  const { user, clearMustChangePassword, logout } = useAuth();
  const [selectedOption, setSelectedOption] = useState<'keep' | 'change'>('keep');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Password setup complete! Unlocking your portal session...');

  if (!user?.mustChangePassword) return null;

  const handleKeepPassword = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await authApi.keepPassword();
      setSuccessMessage('Current password retained! Unlocking your portal...');
      setSuccess(true);
      setTimeout(() => {
        clearMustChangePassword(res);
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to retain current password. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authApi.changePassword({ currentPassword, newPassword });
      setSuccessMessage('Password successfully updated! Unlocking your portal...');
      setSuccess(true);
      setTimeout(() => {
        clearMustChangePassword(res);
      }, 1200);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Failed to update password. Please check your current password.'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform animate-scale-in">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 via-primary-600 to-indigo-700 text-white flex items-center gap-3.5">
          <div className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-sm shadow-inner">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight">First-Time Login Security Setup</h3>
            <p className="text-xs text-indigo-100">Welcome to Campus Core, {user.fullName}</p>
          </div>
        </div>

        <div className="p-6">
          {success ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto animate-bounce" />
              <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Setup Complete!
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {successMessage}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
                You are logging in with your default assigned credentials. You have the choice to <strong>keep your current password</strong> or <strong>create a new password</strong>.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-rose-600 dark:text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Two Options Selector */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => setSelectedOption('keep')}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                    selectedOption === 'keep'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="inline-flex p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                      <Check className="w-4 h-4" />
                    </span>
                    {selectedOption === 'keep' && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Keep Current Password</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Continue with your assigned password
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOption('change')}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                    selectedOption === 'change'
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="inline-flex p-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                      <KeyRound className="w-4 h-4" />
                    </span>
                    {selectedOption === 'change' && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Create New Password</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Set a personal custom password
                  </p>
                </button>
              </div>

              {/* View 1: Keep Password Option */}
              {selectedOption === 'keep' && (
                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 space-y-3 animate-fade-in">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                      You are confirming to keep your existing assigned password. You will use this same password for all future logins. You can still change it anytime from your profile settings.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleKeepPassword}
                    disabled={isSubmitting}
                    className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? 'Confirming...' : (
                      <>
                        Keep My Password & Continue to Portal
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* View 2: Change Password Option */}
              {selectedOption === 'change' && (
                <form onSubmit={handleChangePassword} className="space-y-3 animate-fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Current / Assigned Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrent ? 'text' : 'password'}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter password you logged in with"
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 pr-9 text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNew ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 pr-9 text-slate-900 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword}
                    className="w-full py-2.5 px-4 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {isSubmitting ? 'Updating...' : (
                      <>
                        Set New Password & Continue
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Sign out fallback footer */}
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Signed in as <strong className="text-slate-600 dark:text-slate-300">{user.email}</strong></span>
                <button
                  type="button"
                  onClick={logout}
                  className="font-medium text-rose-500 hover:text-rose-600 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
