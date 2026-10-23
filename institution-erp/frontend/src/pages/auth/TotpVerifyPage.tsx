import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../store/authContext';
import { authApi } from '../../api/endpoints';
import { TotpInput } from '../../components/TotpInput';
import { ShieldCheck, AlertCircle, Loader2, KeyRound, ChevronDown, ChevronUp } from 'lucide-react';

export const TotpVerifyPage: React.FC = () => {
  const navigate = useNavigate();
  const { pendingTotp, setAuthFromResponse } = useAuth();

  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);

  // Guard
  useEffect(() => {
    if (!pendingTotp || pendingTotp.requiresSetup) {
      navigate('/login', { replace: true });
    }
  }, [pendingTotp, navigate]);

  if (!pendingTotp) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingTotp) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const payload = useRecovery
        ? { recoveryCode: recoveryCode.trim().toUpperCase(), trustDevice }
        : { code, trustDevice };

      const res = await authApi.totp2faVerify(pendingTotp.challengeId, payload);
      setAuthFromResponse(res);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = useRecovery ? recoveryCode.trim().length >= 6 : code.length === 6;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Header */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
            <ShieldCheck className="w-8 h-8" />
          </div>
        </div>
        <h1 className="text-center text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
          Two-Factor Verification
        </h1>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-8">
          Enter the 6-digit code from your authenticator app
        </p>

        <div className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-rose-600 dark:text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {!useRecovery ? (
              <>
                {/* TOTP code boxes */}
                <TotpInput
                  value={code}
                  onChange={setCode}
                  disabled={isSubmitting}
                  autoFocus
                  id="totp-verify-code"
                />

                {/* Trust device */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Trust this device for 30 days
                  </span>
                </label>
              </>
            ) : (
              <>
                {/* Recovery code input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Recovery Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                      placeholder="XXXXXXXX"
                      className="block w-full pl-9 pr-3 py-2.5 text-sm font-mono tracking-widest bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-slate-900 dark:text-slate-100"
                      maxLength={12}
                      autoComplete="off"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Each recovery code can only be used once.</p>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="w-full py-2.5 px-4 text-sm font-semibold rounded-xl text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 transition-all shadow-md shadow-primary-500/20 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
              ) : 'Verify'}
            </button>
          </form>

          {/* Recovery code toggle */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => { setUseRecovery(!useRecovery); setError(null); setCode(''); setRecoveryCode(''); }}
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              {useRecovery ? (
                <><ChevronUp className="w-3.5 h-3.5" /> Use authenticator app instead</>
              ) : (
                <><ChevronDown className="w-3.5 h-3.5" /> Use a recovery code instead</>
              )}
            </button>
          </div>
        </div>

        {/* Back to login */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-4">
          <Link to="/login" className="hover:text-primary-600 dark:hover:text-primary-400">
            ← Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};
