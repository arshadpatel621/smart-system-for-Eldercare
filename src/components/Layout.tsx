import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEldercare } from '../context/EldercareContext';
import { getRoleNavItems } from '../lib/access';

async function triggerEmergency(
  navigate: ReturnType<typeof useNavigate>,
  createSafetyEvent: ReturnType<typeof useEldercare>['createSafetyEvent'],
) {
  await createSafetyEvent({
    type: 'sos',
    severity: 'critical',
    occurredAt: new Date().toISOString(),
    location: 'Dashboard navigation',
    note: 'Emergency SOS triggered from layout control.',
    resolved: false,
  });
  navigate('/emergency');
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, logout } = useAuth();
  const {
    derivedAlerts,
    storageMode,
    enableBrowserNotifications,
    error,
    refresh,
    createSafetyEvent,
    loading,
  } = useEldercare();
  const activeAlerts = derivedAlerts.filter((alert) => !alert.acknowledged);
  const visibleNavItems = getRoleNavItems(role);

  const bottomNavPaths = ['/', '/health', '/camera', '/notifications'];
  const bottomNavItems = visibleNavItems
    .filter((item) => bottomNavPaths.includes(item.path))
    .sort((a, b) => bottomNavPaths.indexOf(a.path) - bottomNavPaths.indexOf(b.path));

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      {/* TopAppBar */}
      <header className="bg-white dark:bg-slate-900 text-blue-900 dark:text-blue-400 font-public-sans antialiased docked full-width top-0 border-b border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center w-full px-6 py-3 sticky z-40">
        <div className="flex items-center gap-4">
          <span className="text-xl font-bold tracking-tight text-blue-900 dark:text-blue-50">
            VitalCare Professional
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => void triggerEmergency(navigate, createSafetyEvent)}
              className="p-2 cursor-pointer active:opacity-70 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors rounded-full relative"
              title="Notifications"
            >
              <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">
                notifications
              </span>
              {activeAlerts.length > 0 ? (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-error rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                  {activeAlerts.length}
                </span>
              ) : null}
            </button>
            <button
              onClick={() => void enableBrowserNotifications()}
              className="p-2 cursor-pointer active:opacity-70 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors rounded-full"
              title="Enable Notifications"
            >
              <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">
                contact_support
              </span>
            </button>
          </div>
          <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-on-surface leading-tight">
                {profile?.fullName ?? 'User'}
              </p>
              <p className="text-[11px] text-slate-500 font-medium uppercase">
                {role} | {storageMode}
              </p>
            </div>
            <button
              onClick={() => navigate('/account')}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm border-2 border-white shadow-md transition hover:scale-105"
              title="My Account"
            >
              {(profile?.fullName ?? 'U')
                .split(' ')
                .map((w) => w[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </button>
          </div>
          {profile?.uid === 'guest-user' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  await logout();
                  navigate('/login');
                }}
                className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform"
              >
                Create Account
              </button>
            </div>
          ) : (
            <button
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span className="hidden sm:inline">Sign out</span>
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs font-medium text-amber-900">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button
              onClick={() => void refresh()}
              className="underline font-bold text-amber-950 hover:text-amber-700"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 relative">
        {/* Desktop Navigation Drawer */}
        <aside className="hidden md:flex flex-col w-64 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 space-y-1 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto shrink-0">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Navigation
          </div>
          {visibleNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  className="material-symbols-outlined text-xl"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-20 md:pb-8 max-w-7xl mx-auto w-full">
          {loading && (
            <div className="mb-4 text-xs font-bold text-blue-600 animate-pulse">
              Syncing latest eldercare data...
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Bottom Navigation Bar for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-around items-center py-2 px-4 z-40">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-colors ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span
                className="material-symbols-outlined text-2xl"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
