import React, { useState } from 'react';
import { KeyRound, ShieldAlert, Copy, Check, Eye, EyeOff, Printer, X, User, Mail, Hash } from 'lucide-react';

export interface CredentialSlipData {
  title?: string;
  fullName: string;
  role: string;
  identifier: string;
  email: string;
  temporaryPassword?: string;
  mustChangePassword?: boolean;
  generatedAtUtc?: string;
}

interface CredentialSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CredentialSlipData | null;
}

export const CredentialSlipModal: React.FC<CredentialSlipModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const [showPassword, setShowPassword] = useState(true);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  if (!isOpen || !data) return null;

  const tempPassword = data.temporaryPassword || '••••••••';

  const handleCopyPassword = () => {
    if (data.temporaryPassword) {
      navigator.clipboard.writeText(data.temporaryPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2500);
    }
  };

  const handleCopyAll = () => {
    const slipText = [
      '========================================',
      'CAMPUS CORE ERP - CREDENTIAL SLIP',
      '========================================',
      `Full Name:          ${data.fullName}`,
      `Role:               ${data.role}`,
      `Institutional ID:   ${data.identifier}`,
      `Login Email:        ${data.email}`,
      `Temporary Password: ${data.temporaryPassword || 'N/A'}`,
      '----------------------------------------',
      'NOTICE: You must change your temporary password upon first login.',
      'Login Portal URL:   /login',
      '========================================',
    ].join('\n');

    navigator.clipboard.writeText(slipText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-600 to-indigo-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-sm">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">
                {data.title || 'Confidential Credential Slip'}
              </h3>
              <p className="text-xs text-indigo-100">
                Single-issuance credentials &bull; Role: {data.role}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Security Alert Banner */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">One-Time Temporary Password</p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                For zero-trust security compliance, this password is not stored in plaintext and will not be displayed again. Please print or copy this slip now and hand it securely to the account holder.
              </p>
            </div>
          </div>

          {/* User Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <div>
              <span className="text-slate-400 flex items-center gap-1 font-medium">
                <User className="w-3.5 h-3.5" /> Account Holder:
              </span>
              <p className="mt-0.5 font-bold text-slate-900 dark:text-slate-100 text-sm">
                {data.fullName}
              </p>
            </div>
            <div>
              <span className="text-slate-400 flex items-center gap-1 font-medium">
                <Hash className="w-3.5 h-3.5" /> Identifier:
              </span>
              <p className="mt-0.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {data.identifier || 'N/A'}
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 flex items-center gap-1 font-medium">
                <Mail className="w-3.5 h-3.5" /> Login Email / Username:
              </span>
              <p className="mt-0.5 font-mono font-semibold text-slate-800 dark:text-slate-200">
                {data.email}
              </p>
            </div>
          </div>

          {/* Temporary Password Box */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Temporary Password (CSPRNG)
            </label>
            <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800">
              <span className="font-mono text-sm sm:text-base font-bold text-indigo-950 dark:text-indigo-200 tracking-wider">
                {showPassword ? tempPassword : '••••••••••••••••'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition"
                  title="Copy password"
                >
                  {copiedPassword ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
            🔐 Policy Enforcement: The user will be required to create a new permanent password immediately upon login.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'Slip Copied!' : 'Copy Full Slip'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
