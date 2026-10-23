import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/authContext';
import { AuthResponse } from '../../types';
import { ShieldCheck, Copy, Download, Printer, Check } from 'lucide-react';

interface LocationState {
  recoveryCodes: string[];
  authResponse: AuthResponse;
}

export const RecoveryCodesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuthFromResponse } = useAuth();
  const [isSaved, setIsSaved] = useState(false);

  const state = location.state as LocationState | null;

  // Retrieve recovery codes from location.state or sessionStorage fallback
  const recoveryCodes: string[] = state?.recoveryCodes || (() => {
    try {
      const stored = sessionStorage.getItem('temp_recovery_codes');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  })();

  const authResponse: AuthResponse | null = state?.authResponse || (() => {
    try {
      const stored = sessionStorage.getItem('temp_auth_response');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  // Guard: require codes to be passed via location state or sessionStorage
  useEffect(() => {
    if (!recoveryCodes || recoveryCodes.length === 0) {
      if (!localStorage.getItem('erp_access_token')) {
        navigate('/login', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [recoveryCodes, navigate]);

  if (!recoveryCodes || recoveryCodes.length === 0) return null;

  const copyAll = async () => {
    const text = recoveryCodes.join('\n');
    await navigator.clipboard.writeText(text);
  };

  const download = () => {
    const text = [
      'CampusCore ERP — Emergency Recovery Codes',
      '==========================================',
      'Keep these codes safe. Each code can only be used once.',
      'If you lose access to your authenticator app, use one of these to sign in.',
      '',
      ...recoveryCodes.map((c, i) => `${String(i + 1).padStart(2, '0')}. ${c}`),
      '',
      `Generated: ${new Date().toLocaleString()}`,
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campuscore-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>Recovery Codes — CampusCore</title>
      <style>body{font-family:monospace;padding:32px;max-width:480px;} h2{margin-bottom:8px;} ul{list-style:none;padding:0;} li{padding:6px 0;font-size:18px;border-bottom:1px solid #eee;} footer{margin-top:24px;font-size:12px;color:#888;}</style>
      </head><body>
      <h2>CampusCore — Recovery Codes</h2>
      <p style="font-size:13px;color:#666;">Each code can only be used once. Store securely.</p>
      <ul>${recoveryCodes.map((c, i) => `<li>${String(i + 1).padStart(2, '0')}. ${c}</li>`).join('')}</ul>
      <footer>Generated ${new Date().toLocaleString()}</footer>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  const handleContinue = () => {
    if (authResponse) {
      setAuthFromResponse(authResponse);
    }
    try {
      sessionStorage.removeItem('temp_recovery_codes');
      sessionStorage.removeItem('temp_auth_response');
    } catch {
      // Ignore
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Header */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg">
            <ShieldCheck className="w-8 h-8" />
          </div>
        </div>
        <h1 className="text-center text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
          2FA Enabled! Save Your Recovery Codes
        </h1>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-6">
          These codes are shown <strong>only once</strong>. If you lose your phone, use one of these to sign in.
        </p>

        <div className="bg-white dark:bg-slate-900 shadow-xl rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6">
          {/* Warning */}
          <div className="mb-5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 text-xs">
            ⚠️ Store these codes somewhere safe (e.g., a password manager). They will not be shown again.
            Each code can only be used once.
          </div>

          {/* Codes grid */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            {recoveryCodes.map((code, i) => (
              <div
                key={i}
                className="font-mono text-sm font-semibold text-center py-2.5 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 select-all tracking-widest"
              >
                {code}
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={copyAll}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" /> Copy All
            </button>
            <button
              type="button"
              onClick={download}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </button>
            <button
              type="button"
              onClick={print}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 mb-5 cursor-pointer select-none">
            <input
              type="checkbox"
              id="codes-saved"
              checked={isSaved}
              onChange={(e) => setIsSaved(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
            />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              I have saved my recovery codes in a secure location.
            </span>
          </label>

          <button
            id="continue-btn"
            type="button"
            disabled={!isSaved}
            onClick={handleContinue}
            className="w-full py-2.5 px-4 text-sm font-semibold rounded-xl text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-primary-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4" /> Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
