import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import HealthMonitor from './pages/HealthMonitor';
import Routine from './pages/Routine';
import Safety from './pages/Safety';
import CareTeam from './pages/CareTeam';
import AIInsights from './pages/AIInsights';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="health" element={<HealthMonitor />} />
          <Route path="routine" element={<Routine />} />
          <Route path="team" element={<CareTeam />} />
          <Route path="insights" element={<AIInsights />} />
        </Route>
        <Route path="/sos" element={<Safety />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
