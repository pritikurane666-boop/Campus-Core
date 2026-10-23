import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../store/authContext';
import { authApi } from '../../api/endpoints';
import { TotpInput } from '../../components/TotpInput';
import { TotpSetupResponse } from '../../types';
import { ShieldCheck, Smartphone, Copy, AlertCircle, Loader2, Check } from 'lucide-react';

type Step = 'loading' | 'scan' | 'confirm' | 'error';

export const TotpSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { pendingTotp } = useAuth();

  const [step, setStep] = useState<Step>('loading');
  const [setupData, setSetupData] = useState<TotpSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // Guard: if there's no pending challenge, push back to login
  useEffect(() => {
    if (!pendingTotp || !pendingTotp.requiresSetup) {
      navigate('/login', { replace: true });
      return;
    }

    authApi
      .totp2faSetup(pendingTotp.challengeId)
      .then((data) => {
        setSetupData(data);
        setStep('scan');
      })
      .catch((err) => {
        setError(
          err?.response?.data?.message ||
          'Failed to start 2FA setup. Your session may have expired. Please log in again.'
        );
        setStep('error');
      });
  }, [pendingTotp, navigate]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingTotp || code.length !== 6) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await authApi.totp2faConfirm(pendingTotp.challengeId, code);
      // Navigate to recovery codes page — pass codes via location state
      navigate('/auth/2fa/recovery-codes', {
        state: {
          recoveryCodes: res.recoveryCodes,
          authResponse: {
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            expiresAt: res.expiresAt,
            user: res.user,
          },
        },
        replace: true,
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyKey = async () => {
    if (!setupData?.base32Key) return;
    await navigator.clipboard.writeText(setupData.base32Key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 text-center border border-slate-200 dark:border-slate-800">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Setup Failed</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full py-2.5 px-4 text-sm font-semibold rounded-xl text-white bg-primary-600 hover:bg-primary-700 transition-all"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

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
          Set Up Two-Factor Authentication
        </h1>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-8">
          Scan the QR code with Google Authenticator or Microsoft Authenticator
        </p>

        <div className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">

          {/* Step indicator */}
          <div className="flex border-b border-slate-100 dark:border-slate-800">
            {['Scan QR', 'Enter Code'].map((label, i) => (
              <div
                key={i}
                className={`flex-1 py-3 text-center text-xs font-semibold transition-colors ${
                  (i === 0 && step === 'scan') || (i === 1 && step === 'confirm')
                    ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50/50 dark:bg-primary-900/10'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {i + 1}. {label}
              </div>
            ))}
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-rose-600 dark:text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {step === 'scan' && setupData && (
              <div className="space-y-6">
                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <QRCodeSVG
                      value={setupData.otpAuthUri}
                      size={200}
                      level="M"
                      includeMargin={false}
                      aria-label="TOTP QR Code — scan with your authenticator app"
                    />
                  </div>
                </div>

                {/* Manual key */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowManual(!showManual)}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {showManual ? 'Hide' : 'Can\'t scan? Enter manually'}
                  </button>
                  {showManual && (
                    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between gap-3 border border-slate-200 dark:border-slate-700">
                      <code className="text-xs font-mono text-slate-800 dark:text-slate-200 break-all select-all">
                        {setupData.base32Key}
                      </code>
                      <button
                        type="button"
                        onClick={copyKey}
                        className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                        aria-label="Copy key"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <p>After scanning, your app will show a 6-digit code that refreshes every 30 seconds.</p>
                </div>

                <button
                  type="button"
                  onClick={() => { setError(null); setStep('confirm'); }}
                  className="w-full py-2.5 px-4 text-sm font-semibold rounded-xl text-white bg-primary-600 hover:bg-primary-700 transition-all shadow-md shadow-primary-500/20"
                >
                  I've Scanned It →
                </button>
              </div>
            )}

            {step === 'confirm' && (
              <form onSubmit={handleConfirm} className="space-y-6">
                <div className="text-center space-y-2">
                  <Smartphone className="w-10 h-10 text-primary-500 mx-auto" />
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                    Enter the 6-digit code from your authenticator app to confirm setup
                  </p>
                </div>

                <TotpInput
                  value={code}
                  onChange={setCode}
                  disabled={isSubmitting}
                  autoFocus
                  id="totp-confirm-code"
                />

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setError(null); setStep('scan'); setCode(''); }}
                    className="flex-1 py-2.5 px-4 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={code.length !== 6 || isSubmitting}
                    className="flex-1 py-2.5 px-4 text-sm font-semibold rounded-xl text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 transition-all shadow-md shadow-primary-500/20"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
                      </span>
                    ) : 'Confirm & Enable 2FA'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Security tip */}
        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          🔒 The QR code is generated locally — your secret is never sent to any third-party service.
        </p>
      </div>
    </div>
  );
};
