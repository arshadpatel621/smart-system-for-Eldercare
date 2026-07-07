import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

export default function ProtectedRoute({ allowedRoles }: { allowedRoles: UserRole[] }) {
  const { profile, initializing, role } = useAuth();

  if (initializing) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Checking account access...</div>;
  }

  // Guest Mode is the default, so we no longer redirect to login.
  if (!profile) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500 font-medium">Preparing VitalCare Workspace...</div>;
  }

  if (!allowedRoles.includes(role!)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
