import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

export default function SignUp() {
  const navigate = useNavigate();
  const { signUp, loading, initializing, error, clearError, user, profile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('caregiver');
  const [elderId, setElderId] = useState('demo-resident');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (profile) {
      navigate('/', { replace: true });
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

      <div className="relative w-full max-w-2xl">
        {/* Logo Section */}
        <div className="mb-10 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white">Create Account</h1>
          <p className="mt-2 text-slate-400">Join the VitalCare health monitoring network.</p>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl sm:p-10 shadow-2xl">
          {error || formError ? (
            <div className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              <div className="flex items-center justify-between gap-4">
                <span>{formError || error}</span>
                <button
                  onClick={() => {
                    clearError();
                    setFormError('');
                  }}
                  className="font-bold hover:text-white transition-colors text-red-300"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}

          <form
            className="grid gap-6 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              setFormError('');

              if (!user && password !== confirmPassword) {
                setFormError('Passwords do not match.');
                return;
              }

              void signUp({ fullName, email: email.trim(), password, role, elderId });
            }}
          >
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Full Name</label>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="John Doe"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Email Address</label>
              <input
                type="email"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={!!user}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Your Role</label>
              <select
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
              >
                <option value="caregiver" className="bg-[#1a2235]">Caregiver</option>
                <option value="elder" className="bg-[#1a2235]">Elder (Resident)</option>
                <option value="admin" className="bg-[#1a2235]">Administrator</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Resident ID</label>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="demo-resident"
                value={elderId}
                onChange={(event) => setElderId(event.target.value)}
                required
              />
            </div>

            {!user && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 ml-1">Password</label>
                  <input
                    type="password"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
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
                    required
                  />
                </div>
              </>
            )}

            <button
              disabled={loading}
              className="md:col-span-2 group relative mt-4 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-4 font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
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
                    {user ? 'Complete Setup' : 'Create Account'}
                    <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </span>
            </button>
          </form>

          <p className="mt-10 text-center text-sm text-slate-500">
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
