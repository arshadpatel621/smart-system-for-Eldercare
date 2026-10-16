import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardPathForRole } from '../lib/access';
import type { PublicUserRole } from '../types/auth';

export default function SignUp() {
  const navigate = useNavigate();
  const { signUp, loading, initializing, error, clearError, user, profile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<PublicUserRole>('caregiver');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (profile) {
      const target = getDashboardPathForRole(profile.role);
      navigate(target, { replace: true });
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (user && !fullName) {
      setFullName(user.displayName || '');
      setEmail(user.email || '');
    }
  }, [user]);

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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0f1d] px-4 py-12 font-['Inter',sans-serif]">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[120px]" />

      <div className="relative w-full max-w-xl">
        {/* Logo Section */}
        <div className="mb-10 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white">Create Account</h1>
          <p className="mt-2 text-slate-400">Join the VitalCare elder care network.</p>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl sm:p-10 shadow-2xl">
          {error || formError ? (
            <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <div className="flex items-start justify-between gap-4">
                <span className="whitespace-pre-line leading-relaxed">{formError || error}</span>
                <button
                  onClick={() => {
                    clearError();
                    setFormError('');
                  }}
                  className="font-bold hover:text-white transition-colors text-red-300 shrink-0 mt-0.5"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}

          <form
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              setFormError('');

              if (!user && password !== confirmPassword) {
                setFormError('Passwords do not match.');
                return;
              }

              try {
                await signUp({ fullName, email: email.trim(), password, role });
              } catch {
                // Handled via AuthContext error
              }
            }}
          >
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Full Name</label>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="e.g. Eleanor Vance"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Email Address</label>
              <input
                type="email"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                disabled={!!user}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Account Role</label>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setRole('elder')}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                    role === 'elder'
                      ? 'border-blue-500 bg-blue-500/20 text-white font-bold'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <span className="text-3xl mb-1">👴</span>
                  <span className="text-sm font-semibold">Elder</span>
                  <span className="text-[10px] text-slate-400">Gets unique Elder ID</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('caregiver')}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                    role === 'caregiver'
                      ? 'border-blue-500 bg-blue-500/20 text-white font-bold'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  <span className="text-3xl mb-1">👥</span>
                  <span className="text-sm font-semibold">Caregiver</span>
                  <span className="text-[10px] text-slate-400">Connects to Elders</span>
                </button>
              </div>
            </div>

            {role === 'elder' && (
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 text-xs text-blue-300">
                ℹ️ A unique shareable <strong>Elder ID</strong> (e.g. <code>ELD-7K4P92</code>) will automatically be generated for your account. You can share this ID with your caregiver to connect your care dashboard.
              </div>
            )}

            {!user && (
              <div className="grid gap-4 md:grid-cols-2 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Password</label>
                  <input
                    type="password"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Confirm Password</label>
                  <input
                    type="password"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
            )}

            <button
              disabled={loading}
              className="group relative mt-4 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-4 font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            >
              <span className="relative flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {user ? 'Saving Profile...' : 'Creating Account...'}
                  </>
                ) : (
                  <>
                    {user ? 'Complete Setup' : `Register as ${role === 'elder' ? 'Elder' : 'Caregiver'}`}
                    <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </span>
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-blue-500 hover:text-blue-400 transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
