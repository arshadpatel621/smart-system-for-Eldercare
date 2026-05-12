import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { roleAccess } from './lib/access';

const Layout = lazy(() => import('./components/Layout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const HealthMonitor = lazy(() => import('./pages/HealthMonitor'));
const Routine = lazy(() => import('./pages/Routine'));
const Safety = lazy(() => import('./pages/Safety'));
const CareTeam = lazy(() => import('./pages/CareTeam'));
const AIInsights = lazy(() => import('./pages/AIInsights'));
const ResidentProfile = lazy(() => import('./pages/ResidentProfile'));
const LiveMonitor = lazy(() => import('./pages/LiveMonitor'));
const Settings = lazy(() => import('./pages/Settings'));
const Support = lazy(() => import('./pages/Support'));
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));

function withSuspense(element: ReactNode) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Loading...</div>}>
      {element}
    </Suspense>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={withSuspense(<Login />)} />
        <Route path="/signup" element={withSuspense(<SignUp />)} />
        <Route path="/unauthorized" element={withSuspense(<Unauthorized />)} />

        <Route element={<ProtectedRoute allowedRoles={roleAccess.all} />}>
          <Route path="/" element={withSuspense(<Layout />)}>
            <Route index element={withSuspense(<Dashboard />)} />
            <Route path="health" element={withSuspense(<HealthMonitor />)} />
            <Route path="routine" element={withSuspense(<Routine />)} />
            <Route path="insights" element={withSuspense(<AIInsights />)} />
            <Route path="profile" element={withSuspense(<ResidentProfile />)} />
            <Route path="settings" element={withSuspense(<Settings />)} />
            <Route path="support" element={withSuspense(<Support />)} />
            <Route element={<ProtectedRoute allowedRoles={roleAccess.careTeam} />}>
              <Route path="team" element={withSuspense(<CareTeam />)} />
              <Route path="camera" element={withSuspense(<LiveMonitor />)} />
            </Route>
          </Route>
          <Route path="/sos" element={withSuspense(<Safety />)} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
