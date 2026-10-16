import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardPathForRole } from '../lib/access';
import type { UserRole } from '../types/auth';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signInWithGoogle, enableGuestMode, loading, initializing, error, clearError, user, profile, resetPassword, hasFirebaseConfig, isAuthAvailable } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleMismatchNotice, setRoleMismatchNotice] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [resetSending, setResetSending] = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleMismatchNotice(null);
    clearError();
    try {
      await signIn({ email: email.trim(), password });
    } catch {
      // Error is caught and surfaced through AuthContext.error
    }
  };

  const handleGoogleSignIn = async () => {
    if (!selectedRole) return;
    clearError();
    setRoleMismatchNotice(null);
    try {
      await signInWithGoogle({ role: selectedRole });
    } catch {
      // Error is caught and surfaced through AuthContext.error
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address.');
      return;
    }
    setResetSending(true);
    setForgotStatus(null);
    setForgotError(null);
    try {
      await resetPassword(forgotEmail.trim());
      setForgotStatus(`A password reset link has been sent to ${forgotEmail.trim()}. Check your inbox.`);
    } catch (err: any) {
      setForgotError(err.message || 'Failed to send password reset link.');
    } finally {
      setResetSending(false);
    }
  };

  useEffect(() => {
    if (user && !profile) {
      // User is logged in but has no profile, redirect to signup to complete it
      navigate('/signup', { replace: true });
    } else if (profile) {
      if (selectedRole && profile.role !== selectedRole) {
        setRoleMismatchNotice(
          `Notice: Your account is registered as ${profile.role.toUpperCase()}. Redirecting to your authorized dashboard...`
        );
        const timer = setTimeout(() => {
          const target = getDashboardPathForRole(profile.role);
          navigate(target, { replace: true });
        }, 1500);
        return () => clearTimeout(timer);
      } else {
        const fromState = (location.state as { from?: string } | null)?.from;
        const target = fromState && fromState !== '/login' ? fromState : getDashboardPathForRole(profile.role);
        navigate(target, { replace: true });
      }
    }
  }, [user, profile, selectedRole, navigate, location.state]);

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1d]">
        <div className="text-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-6 text-xl font-medium text-blue-100/60 animate-pulse">Initializing VitalCare...</p>
        </div>
      </div>
    );
  }

  const roleCardData = [
    {
      role: 'elder' as UserRole,
      title: 'Elder',
      emoji: '👴',
      description: 'Access your personal care dashboard',
      badgeColor: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-300',
    },
    {
      role: 'caregiver' as UserRole,
      title: 'Caregiver',
      emoji: '👥',
      description: 'Manage connected elders',
      badgeColor: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30 text-blue-300',
    },
    {
      role: 'admin' as UserRole,
      title: 'Admin',
      emoji: '🛡️',
      description: 'Manage the system',
      badgeColor: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-300',
    },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0f1d] px-4 py-12 font-['Inter',sans-serif]">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />

      <div className="relative w-full max-w-4xl">
        {/* Header Section */}
        <div className="mb-10 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white">VitalCare</h1>
          <p className="mt-2 text-slate-400">Intelligent Elder Care Platform</p>
        </div>

        {/* Role Selection Screen */}
        {!selectedRole ? (
          <div>
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-white">Select Your Access Portal</h2>
              <p className="mt-1 text-sm text-slate-400">Choose your role to proceed to authentication</p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {roleCardData.map((card) => (
                <div
                  key={card.role}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/50 hover:bg-white/10 hover:shadow-2xl hover:shadow-blue-500/10"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-4xl">{card.emoji}</span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-gradient-to-r ${card.badgeColor}`}>
                        {card.title}
                      </span>
                    </div>

                    <h3 className="mt-6 text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                      {card.description}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      clearError();
                      setSelectedRole(card.role);
                    }}
                    className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3.5 font-bold text-white shadow-lg shadow-blue-600/20 transition-all group-hover:from-blue-500 group-hover:to-indigo-500 active:scale-[0.98]"
                  >
                    <span>Continue</span>
                    <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <p className="mt-10 text-center text-sm text-slate-500">
              Need an account?{' '}
              <Link to="/signup" className="font-bold text-blue-500 hover:text-blue-400 transition-colors">
                Create Account
              </Link>
            </p>
          </div>
        ) : (
          /* Single Reusable Login Form */
          <div className="mx-auto max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl sm:p-10 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => {
                  setSelectedRole(null);
                  clearError();
                  setRoleMismatchNotice(null);
                }}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Change Role
              </button>

              <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-400">
                {selectedRole} portal
              </span>
            </div>

            <h2 className="text-2xl font-bold text-white capitalize">{selectedRole} Sign In</h2>
            <p className="mt-1 text-sm text-slate-400">Enter your credentials to access your account.</p>

            {/* Local / Firebase status banner if Firebase is not configured */}
            {!hasFirebaseConfig && (
              <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
                <div className="flex items-center gap-2 font-bold text-amber-200">
                  <svg className="h-4 w-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Local Demo Mode Active</span>
                </div>
                <p className="mt-1 text-slate-300 leading-relaxed">
                  Firebase keys are not loaded in the current browser session. Use <strong>Quick Guest Access</strong> below to explore all features with sample data, or verify your <code>.env</code> file and restart Vite.
                </p>
              </div>
            )}

            {roleMismatchNotice && (
              <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                {roleMismatchNotice}
              </div>
            )}

            {error ? (
              <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <div className="flex items-center justify-between gap-4">
                  <span>{error}</span>
                  <button onClick={clearError} className="font-bold hover:text-white transition-colors text-red-300">
                    Close
                  </button>
                </div>
              </div>
            ) : null}

            <form
              className="mt-6 space-y-4"
              onSubmit={handleEmailSignIn}
            >
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Email Address</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="username"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotStatus(null);
                      setForgotError(null);
                      setShowForgotModal(true);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              <button
                disabled={loading}
                className="group relative mt-4 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-4 font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
              >
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In as {selectedRole}
                      <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </span>
              </button>
            </form>

            <div className="my-6 flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              <div className="h-px flex-1 bg-white/10" />
              <span>Alternative</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => enableGuestMode(selectedRole)}
                className="flex items-center justify-center gap-3 rounded-2xl bg-white/10 px-4 py-3.5 font-bold text-white transition-all hover:bg-white/20 active:scale-[0.98]"
              >
                <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Guest Access ({selectedRole})
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 font-bold text-white transition-all hover:bg-white/10 disabled:opacity-60"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign In with Google
              </button>
            </div>

            <p className="mt-8 text-center text-sm text-slate-500">
              Don't have an account?{' '}
              <Link to="/signup" className="font-bold text-blue-500 hover:text-blue-400 transition-colors">
                Create Account
              </Link>
            </p>
          </div>
        )}

        {/* Forgot Password Modal */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0e1628] p-7 shadow-2xl space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Reset Password</h3>
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="rounded-full p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-sm text-slate-400">
                Enter your registered email address and we'll send you an official Firebase link to reset your password.
              </p>

              {forgotStatus && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-300">
                  {forgotStatus}
                </div>
              )}

              {forgotError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-300">
                  {forgotError}
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 ml-1">Email Address</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={resetSending}
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-colors disabled:opacity-50"
                  >
                    {resetSending ? 'Sending Link...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <p className="mt-8 text-center text-xs text-slate-600">
          &copy; 2026 VitalCare Systems. Encrypted &amp; Secure.
        </p>
      </div>
    </div>
  );
}
