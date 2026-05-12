import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

export default function SignUp() {
  const navigate = useNavigate();
  const { signUp, loading, error, clearError, profile } = useAuth();
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-2xl rounded-[32px] bg-white p-8 shadow-2xl sm:p-10">
        <h1 className="text-4xl font-black text-primary">Create account</h1>
        <p className="mt-2 text-sm text-slate-500">Set the user role and connect the account to the correct elder record.</p>

        {error || formError ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-center justify-between gap-4">
              <span>{formError || error}</span>
              <button
                onClick={() => {
                  clearError();
                  setFormError('');
                }}
                className="font-bold"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}

        <form
          className="mt-6 grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            setFormError('');

            if (password !== confirmPassword) {
              setFormError('Passwords do not match.');
              return;
            }

            void signUp({ fullName, email, password, role, elderId });
          }}
        >
          <input className="rounded-2xl border border-slate-200 px-4 py-3 md:col-span-2" placeholder="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <input type="email" className="rounded-2xl border border-slate-200 px-4 py-3 md:col-span-2" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} />
          <select className="rounded-2xl border border-slate-200 px-4 py-3" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            <option value="admin">Admin</option>
            <option value="caregiver">Caregiver</option>
            <option value="elder">Elder</option>
          </select>
          <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Assigned elder ID" value={elderId} onChange={(event) => setElderId(event.target.value)} />
          <input type="password" className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <input type="password" className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          <button disabled={loading} className="rounded-2xl bg-primary px-4 py-3 font-bold text-white md:col-span-2 disabled:opacity-60">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-500">
          Already have an account? <Link to="/login" className="font-bold text-primary">Login</Link>
        </p>
      </div>
    </div>
  );
}
