import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signInWithGoogle, enableGuestMode, loading, initializing, error, clearError, user, profile } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleRole, setGoogleRole] = useState<UserRole>('caregiver');
  const [googleElderId, setGoogleElderId] = useState('demo-resident');

  useEffect(() => {
    if (user && !profile) {
      // User is logged in but has no profile, redirect to signup to complete it
      navigate('/signup', { replace: true });
    } else if (profile) {
      const target = (location.state as { from?: string } | null)?.from || '/';
      navigate(target, { replace: true });
    }
  }, [user, profile, navigate, location.state]);

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
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px]" />

      <div className="relative w-full max-w-md">
        {/* Logo Section */}
        <div className="mb-10 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white">VitalCare</h1>
          <p className="mt-2 text-slate-400">Intelligent Elder Care Monitoring</p>
        </div>

        {/* Main Card */}
        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl sm:p-10 shadow-2xl">
          <h2 className="text-2xl font-bold text-white">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-400">Please enter your details to sign in.</p>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <div className="flex items-center justify-between gap-4">
                <span>{error}</span>
                <button onClick={clearError} className="font-bold hover:text-white transition-colors text-red-300">Close</button>
              </div>
            </div>
          ) : null}

          <form
            className="mt-8 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void signIn({ email: email.trim(), password });
            }}
          >
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
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
                    Sign In
                    <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </span>
            </button>
          </form>

          <div className="my-8 flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            <div className="h-px flex-1 bg-white/10" />
            <span>Alternative Access</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={enableGuestMode}
              className="flex items-center justify-center gap-3 rounded-2xl bg-white/10 px-4 py-4 font-bold text-white transition-all hover:bg-white/20 active:scale-[0.98]"
            >
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Quick Access (No Login)
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void signInWithGoogle({ role: googleRole, elderId: googleElderId })}
              className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 font-bold text-white transition-all hover:bg-white/10 disabled:opacity-60"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google Account
            </button>
          </div>

          <p className="mt-10 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/signup" className="font-bold text-blue-500 hover:text-blue-400 transition-colors">
              Create Account
            </Link>
          </p>
        </div>

        {/* Footer Info */}
        <p className="mt-8 text-center text-xs text-slate-600">
          &copy; 2026 VitalCare Systems. Protected by end-to-end encryption.
        </p>
      </div>
    </div>
  );
}
