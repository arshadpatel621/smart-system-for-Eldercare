import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import { getDashboardPathForRole, roleAccess } from './lib/access';

const Layout = lazy(() => import('./components/Layout'));

// ELDER PORTAL PAGES
const ElderDashboard = lazy(() => import('./pages/elder/ElderDashboard'));
const ElderLiveMonitor = lazy(() => import('./pages/elder/ElderLiveMonitor'));
const ElderDevices = lazy(() => import('./pages/elder/ElderDevices'));
const ElderAIInsights = lazy(() => import('./pages/elder/ElderAIInsights'));
const ElderCareTeam = lazy(() => import('./pages/elder/ElderCareTeam'));
const ElderEmergency = lazy(() => import('./pages/elder/ElderEmergency'));

// CAREGIVER PORTAL PAGES
const CaregiverDashboard = lazy(() => import('./pages/caregiver/CaregiverDashboard'));
const CaregiverElders = lazy(() => import('./pages/caregiver/CaregiverElders'));
const CaregiverHealth = lazy(() => import('./pages/caregiver/CaregiverHealth'));
const CaregiverLiveMonitor = lazy(() => import('./pages/caregiver/CaregiverLiveMonitor'));
const CaregiverDevices = lazy(() => import('./pages/caregiver/CaregiverDevices'));
const CaregiverRoutine = lazy(() => import('./pages/caregiver/CaregiverRoutine'));
const CaregiverCareTeam = lazy(() => import('./pages/caregiver/CaregiverCareTeam'));
const CaregiverAIInsights = lazy(() => import('./pages/caregiver/CaregiverAIInsights'));
const CaregiverEmergency = lazy(() => import('./pages/caregiver/CaregiverEmergency'));

// ADMIN PORTAL PAGES
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminResidents = lazy(() => import('./pages/admin/AdminResidents'));
const AdminRelationships = lazy(() => import('./pages/admin/AdminRelationships'));
const AdminDeviceRegistry = lazy(() => import('./pages/admin/AdminDeviceRegistry'));
const AdminSystemMonitoring = lazy(() => import('./pages/admin/AdminSystemMonitoring'));
const AdminAIAnalytics = lazy(() => import('./pages/admin/AdminAIAnalytics'));
const AdminIncidents = lazy(() => import('./pages/admin/AdminIncidents'));
const AdminAuditLogs = lazy(() => import('./pages/admin/AdminAuditLogs'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));

// SHARED OPERATIONAL PAGES
const HealthMonitor = lazy(() => import('./pages/HealthMonitor'));
const Routine = lazy(() => import('./pages/Routine'));
const CareTeam = lazy(() => import('./pages/CareTeam'));
const AIInsights = lazy(() => import('./pages/AIInsights'));
const ResidentProfile = lazy(() => import('./pages/ResidentProfile'));
const AccountProfile = lazy(() => import('./pages/AccountProfile'));
const LiveMonitor = lazy(() => import('./pages/LiveMonitor'));
const DeviceManagement = lazy(() => import('./pages/DeviceManagement'));
const Notifications = lazy(() => import('./pages/Notifications'));
const EmergencyCenter = lazy(() => import('./pages/EmergencyCenter'));
const Settings = lazy(() => import('./pages/Settings'));
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

function IndexRedirect() {
  const { profile } = useAuth();
  return <Navigate to={getDashboardPathForRole(profile?.role)} replace />;
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
            <Route index element={<IndexRedirect />} />

            {/* ELDER PORTAL ROUTES */}
            <Route element={<ProtectedRoute allowedRoles={['elder', 'admin']} />}>
              <Route path="elder/dashboard" element={withSuspense(<ElderDashboard />)} />
              <Route path="elder/health" element={withSuspense(<HealthMonitor />)} />
              <Route path="elder/live-monitor" element={withSuspense(<ElderLiveMonitor />)} />
              <Route path="elder/devices" element={withSuspense(<ElderDevices />)} />
              <Route path="elder/routine" element={withSuspense(<Routine />)} />
              <Route path="elder/ai-insights" element={withSuspense(<ElderAIInsights />)} />
              <Route path="elder/care-team" element={withSuspense(<ElderCareTeam />)} />
              <Route path="elder/notifications" element={withSuspense(<Notifications />)} />
              <Route path="elder/emergency" element={withSuspense(<ElderEmergency />)} />
              <Route path="elder/account" element={withSuspense(<AccountProfile />)} />
              <Route path="elder/settings" element={withSuspense(<Settings />)} />
            </Route>

            {/* CAREGIVER PORTAL ROUTES */}
            <Route element={<ProtectedRoute allowedRoles={['caregiver', 'admin']} />}>
              <Route path="caregiver/dashboard" element={withSuspense(<CaregiverDashboard />)} />
              <Route path="caregiver/elders" element={withSuspense(<CaregiverElders />)} />
              <Route path="caregiver/health" element={withSuspense(<CaregiverHealth />)} />
              <Route path="caregiver/live-monitor" element={withSuspense(<CaregiverLiveMonitor />)} />
              <Route path="caregiver/devices" element={withSuspense(<CaregiverDevices />)} />
              <Route path="caregiver/routine" element={withSuspense(<CaregiverRoutine />)} />
              <Route path="caregiver/care-team" element={withSuspense(<CaregiverCareTeam />)} />
              <Route path="caregiver/ai-insights" element={withSuspense(<CaregiverAIInsights />)} />
              <Route path="caregiver/notifications" element={withSuspense(<Notifications />)} />
              <Route path="caregiver/emergency" element={withSuspense(<CaregiverEmergency />)} />
              <Route path="caregiver/account" element={withSuspense(<AccountProfile />)} />
              <Route path="caregiver/settings" element={withSuspense(<Settings />)} />
            </Route>

            {/* ADMIN PORTAL ROUTES */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="admin/dashboard" element={withSuspense(<AdminDashboard />)} />
              <Route path="admin/users" element={withSuspense(<AdminUsers />)} />
              <Route path="admin/residents" element={withSuspense(<AdminResidents />)} />
              <Route path="admin/relationships" element={withSuspense(<AdminRelationships />)} />
              <Route path="admin/devices" element={withSuspense(<AdminDeviceRegistry />)} />
              <Route path="admin/monitoring" element={withSuspense(<AdminSystemMonitoring />)} />
              <Route path="admin/ai" element={withSuspense(<AdminAIAnalytics />)} />
              <Route path="admin/incidents" element={withSuspense(<AdminIncidents />)} />
              <Route path="admin/audit" element={withSuspense(<AdminAuditLogs />)} />
              <Route path="admin/settings" element={withSuspense(<AdminSettings />)} />
              <Route path="admin/account" element={withSuspense(<AccountProfile />)} />
            </Route>

            {/* SHARED COMPATIBILITY ALIASES */}
            <Route path="health" element={withSuspense(<HealthMonitor />)} />
            <Route path="routine" element={withSuspense(<Routine />)} />
            <Route path="insights" element={withSuspense(<AIInsights />)} />
            <Route path="camera" element={withSuspense(<LiveMonitor />)} />
            <Route path="devices" element={withSuspense(<DeviceManagement />)} />
            <Route path="notifications" element={withSuspense(<Notifications />)} />
            <Route path="profile" element={withSuspense(<ResidentProfile />)} />
            <Route path="account" element={withSuspense(<AccountProfile />)} />
            <Route path="settings" element={withSuspense(<Settings />)} />
            <Route path="team" element={withSuspense(<CareTeam />)} />
          </Route>

          <Route path="/emergency" element={withSuspense(<EmergencyCenter />)} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
