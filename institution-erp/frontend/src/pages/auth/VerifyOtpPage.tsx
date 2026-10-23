import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/authContext';
import { authApi } from '../../api/endpoints';
import { TotpInput } from '../../components/TotpInput';
import { Mail, AlertCircle, ArrowLeft, Loader2, CheckCircle2, RotateCw } from 'lucide-react';

export const VerifyOtpPage: React.FC = () => {
  const { pendingOtp, setAuthFromResponse, clearPendingOtp } = useAuth();
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const isSuccessRef = useRef(false);

  // Redirect to login only if user arrived here without a pending challenge and isn't logging in
  useEffect(() => {
    const hasToken = !!localStorage.getItem('erp_access_token');
    if (!pendingOtp && !isSuccessRef.current && !hasToken) {
      navigate('/login', { replace: true });
    }
  }, [pendingOtp, navigate]);

  // 60-second resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingOtp) return;
    if (code.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await authApi.verifyOtp({
        challengeId: pendingOtp.challengeId,
        code,
      });

      isSuccessRef.current = true;
      setAuthFromResponse(res);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Verification failed. The code may be incorrect or expired.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!pendingOtp || cooldown > 0 || isResending) return;

    setError(null);
    setResendStatus(null);
    setIsResending(true);

    try {
      const res = await authApi.resendOtp(pendingOtp.challengeId);
      setResendStatus(res.message || 'A new verification code has been sent to your email.');
      setCooldown(60);
      setCode('');
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Failed to resend verification code. Please wait and try again.';
      setError(msg);
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToLogin = () => {
    clearPendingOtp();
    navigate('/login');
  };

  if (!pendingOtp && !isSuccessRef.current) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-primary-500/20">
            <Mail className="w-7 h-7" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Enter Verification Code
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
          We've sent a 6-digit code to{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {pendingOtp?.emailMasked || 'your registered email'}
          </span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 border border-slate-200/80 dark:border-slate-800">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {resendStatus && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-700 dark:text-emerald-300">{resendStatus}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                6-Digit Security Code
              </label>
              <TotpInput
                value={code}
                onChange={(val) => {
                  setCode(val);
                  if (error) setError(null);
                  if (val.length === 6) {
                    // Auto-submit when all 6 digits entered
                    setTimeout(() => {
                      handleSubmit();
                    }, 50);
                  }
                }}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || code.length !== 6}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify & Sign In'
              )}
            </button>
          </form>

          {/* Resend actions */}
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Didn't receive the email? Check your spam folder or
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || isResending}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
            </button>
          </div>

          {/* Back to login */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleBackToLogin}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Sign in with another account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
