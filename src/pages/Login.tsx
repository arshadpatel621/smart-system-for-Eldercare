import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signInWithGoogle, loading, error, clearError, profile } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleRole, setGoogleRole] = useState<UserRole>('caregiver');
  const [googleElderId, setGoogleElderId] = useState('demo-resident');
  const [googleFullName, setGoogleFullName] = useState('');

  useEffect(() => {
    if (profile) {
      const target = (location.state as { from?: string } | null)?.from || '/';
      navigate(target, { replace: true });
    }
  }, [profile, navigate, location.state]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-2xl lg:grid-cols-[1.1fr_0.9fr]">
        <div className="bg-primary p-10 text-white">
          <p className="text-sm uppercase tracking-[0.3em] text-blue-100">VitalCare Access</p>
          <h1 className="mt-4 text-4xl font-black">Secure elder care login</h1>
          <p className="mt-4 max-w-md text-blue-100">
            Admins, caregivers, and elders use one secure sign-in flow. Your role controls what screens and records you can access.
          </p>
        </div>

        <div className="p-8 sm:p-10">
          <h2 className="text-3xl font-bold text-primary">Login</h2>
          <p className="mt-2 text-sm text-slate-500">Use email/password or Google sign-in.</p>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex items-center justify-between gap-4">
                <span>{error}</span>
                <button onClick={clearError} className="font-bold">Close</button>
              </div>
            </div>
          ) : null}

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void signIn({ email, password });
            }}
          >
            <input
              type="email"
              placeholder="Email address"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              disabled={loading}
              className="w-full rounded-2xl bg-primary px-4 py-3 font-bold text-white disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            <span>Google sign-in</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="space-y-3">
            <input
              placeholder="Full name for new Google accounts"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={googleFullName}
              onChange={(event) => setGoogleFullName(event.target.value)}
            />
            <select
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={googleRole}
              onChange={(event) => setGoogleRole(event.target.value as UserRole)}
            >
              <option value="admin">Admin</option>
              <option value="caregiver">Caregiver</option>
              <option value="elder">Elder</option>
            </select>
            <input
              placeholder="Assigned elder ID"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3"
              value={googleElderId}
              onChange={(event) => setGoogleElderId(event.target.value)}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => void signInWithGoogle({ role: googleRole, elderId: googleElderId, fullName: googleFullName })}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 font-bold text-slate-700 disabled:opacity-60"
            >
              Continue with Google
            </button>
          </div>

          <p className="mt-6 text-sm text-slate-500">
            New account? <Link to="/signup" className="font-bold text-primary">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
