import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import HealthMonitor from './pages/HealthMonitor';
import Routine from './pages/Routine';
import Safety from './pages/Safety';
import CareTeam from './pages/CareTeam';
import AIInsights from './pages/AIInsights';
import ResidentProfile from './pages/ResidentProfile';
import LiveMonitor from './pages/LiveMonitor';
import Settings from './pages/Settings';
import Support from './pages/Support';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Unauthorized from './pages/Unauthorized';
import { roleAccess } from './lib/access';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route element={<ProtectedRoute allowedRoles={roleAccess.all} />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="health" element={<HealthMonitor />} />
            <Route path="routine" element={<Routine />} />
            <Route path="insights" element={<AIInsights />} />
            <Route path="profile" element={<ResidentProfile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="support" element={<Support />} />
            <Route element={<ProtectedRoute allowedRoles={roleAccess.careTeam} />}>
              <Route path="team" element={<CareTeam />} />
              <Route path="camera" element={<LiveMonitor />} />
            </Route>
          </Route>
          <Route path="/sos" element={<Safety />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
