import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../store/authContext';
import { Shield, Lock, Mail, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const { adminLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await adminLogin(email, password);
      navigate('/dashboard/admin', { replace: true });
    } catch (err: any) {
      let msg = 'Invalid administrator credentials.';
      if (!err.response) {
        msg = 'Unable to connect to backend API. Please verify server connectivity.';
      } else if (err.response.status === 403) {
        msg = err.response?.data?.message || 'Access restricted. Only Principal/Administrator accounts can use direct bypass.';
      } else if (err.response.status === 401) {
        msg = err.response?.data?.message || 'Invalid administrator email or password.';
      } else if (err.response.status === 423) {
        msg = err.response?.data?.message || 'Account locked due to failed attempts. Try again later.';
      } else {
        msg = err.response?.data?.message || err.response?.data?.detail || 'An unexpected error occurred during login.';
      }
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative backdrop gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-500/10 via-primary-600/10 to-transparent blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-amber-500/20 ring-1 ring-white/20">
            <Shield className="w-7 h-7" />
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            2FA Bypass • Direct Admin Portal
          </span>
        </div>

        <h2 className="mt-3 text-center text-2xl font-bold tracking-tight text-white">
          Administrator Sign In
        </h2>
        <p className="mt-2 text-center text-xs text-slate-400">
          Direct authentication for Principal & System Administrators
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-800/90 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-700/80">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-800/80 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Administrator Email
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@gmail.com"
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-5 h-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400 focus:ring-offset-slate-900 disabled:opacity-50 transition-all duration-150 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  Authenticating...
                </>
              ) : (
                'Sign In as Administrator'
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-700/80 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Standard Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
