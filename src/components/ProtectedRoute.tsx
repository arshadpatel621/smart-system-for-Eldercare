import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

export default function ProtectedRoute({ allowedRoles }: { allowedRoles: UserRole[] }) {
  const { profile, initializing, role } = useAuth();
  const location = useLocation();

  // Wait for Firebase to restore the previous session before making any routing decision
  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1d]">
        <div className="text-center">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto" />
          <p className="mt-5 text-lg font-medium text-blue-100/50 animate-pulse">
            Initializing VitalCare...
          </p>
        </div>
      </div>
    );
  }

  // FIX 4: Not logged in → redirect to /login, preserving the intended destination
  if (!profile) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Logged in but wrong role → unauthorized page
  if (!allowedRoles.includes(role!)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
