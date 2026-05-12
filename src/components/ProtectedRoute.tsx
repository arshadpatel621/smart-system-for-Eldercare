import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

export default function ProtectedRoute({ allowedRoles }: { allowedRoles: UserRole[] }) {
  const location = useLocation();
  const { user, profile, loading, role } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Checking account access...</div>;
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!allowedRoles.includes(role!)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
