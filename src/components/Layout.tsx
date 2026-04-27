import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  { path: '/', icon: 'dashboard', label: 'Dashboard' },
  { path: '/health', icon: 'monitor_heart', label: 'Health Monitor' },
  { path: '/routine', icon: 'event_repeat', label: 'Routine' },
  { path: '/team', icon: 'group', label: 'Care Team' },
  { path: '/insights', icon: 'psychology', label: 'AI Insights' },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      {/* TopAppBar */}
      <header className="bg-white dark:bg-slate-900 text-blue-900 dark:text-blue-400 font-public-sans antialiased docked full-width top-0 border-b border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center w-full px-6 py-3 sticky z-40">
        <div className="flex items-center gap-4">
          <span className="text-xl font-bold tracking-tight text-blue-900 dark:text-blue-50">VitalCare Professional</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button className="p-2 cursor-pointer active:opacity-70 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors rounded-full relative">
              <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>
            </button>
            <button className="p-2 cursor-pointer active:opacity-70 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors rounded-full">
              <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">contact_support</span>
            </button>
          </div>
          <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
             <div className="text-right hidden sm:block">
                 <p className="text-sm font-bold text-on-surface leading-tight">Dr. Elena Fisher</p>
                 <p className="text-[11px] text-slate-500 font-medium">Head Caregiver</p>
             </div>
             <img alt="Provider profile picture" className="w-10 h-10 rounded-full border-2 border-primary-container object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDKjjpygMLIvlxxoF4SuBTMKXjVGKA10zLMG8i-Qq3Mc1dzEmxESVWdmsdCPZPJ9j3FuWbg2txwmtcEDFZdJB8pRlphyODud-nWGcU1CiYJlMz2vj51WENlfpmR0xEm_h5OEluzOpuot56xbRrHOOKQ3UZN6UWqD8WsS_-RTiQZ2f9eJBWXQwfDxm-Q2DQaigIqGp3xSylw3Q1wWrtv28Tnn7j_dCQ_vE_k4hehKBs3ybyHhQpI5x7OHaQ0ApuCxb4CPDwGPeML5w" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 relative">
        {/* SideNavBar (Desktop) */}
        <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full z-30 bg-slate-50 dark:bg-slate-950 w-64 border-r border-slate-200 dark:border-slate-800 transition-all duration-200 ease-in-out pt-[72px]">
          <div className="p-6">
             <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-sm">clinical_notes</span>
                </div>
                <span className="text-lg font-black text-blue-900 dark:text-blue-100">Resident Care</span>
             </div>
             <p className="text-xs text-slate-500 ml-11 uppercase tracking-widest font-bold">High Priority Monitor</p>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-public-sans text-sm font-medium ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 border-r-4 border-blue-900 dark:border-blue-400'
                      : 'text-slate-600 dark:text-slate-400 hover:text-blue-900 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }`}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="p-4 space-y-4">
            <button 
                onClick={() => navigate('/sos')}
                className="w-full py-4 px-4 bg-[#b91c1c] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-red-800 active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                emergency
              </span>
              EMERGENCY SOS
            </button>
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-1">
              <button className="w-full flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-blue-900 text-sm font-medium transition-colors">
                <span className="material-symbols-outlined">settings</span>
                Settings
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-blue-900 text-sm font-medium transition-colors">
                <span className="material-symbols-outlined">help</span>
                Support
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 p-6 lg:p-10 pb-24 lg:pb-10 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* BottomNavBar (Mobile) */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-safe pt-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] rounded-t-2xl">
         {navItems.slice(0, 2).map((item) => {
             const isActive = location.pathname === item.path;
             return (
                 <NavLink
                     key={item.path}
                     to={item.path}
                     className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-transform duration-150 active:scale-90 ${
                         isActive ? 'text-blue-900 dark:text-blue-100 bg-blue-50 dark:bg-blue-900/60' : 'text-slate-400 dark:text-slate-500'
                     }`}
                 >
                     <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
                     <span className="font-public-sans text-[10px] font-bold uppercase tracking-wider mt-1">{item.label.split(' ')[0]}</span>
                 </NavLink>
             );
         })}
         
         <NavLink to="/sos" className="flex flex-col items-center justify-center text-[#b91c1c] active:scale-90 transition-transform duration-150 -translate-y-4 relative z-10">
             <div className="bg-error p-4 rounded-full shadow-lg shadow-error/40 border-4 border-white dark:border-slate-900 flex items-center justify-center">
                 <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
             </div>
             <span className="font-public-sans text-[10px] font-bold uppercase tracking-wider mt-1 text-error">SOS</span>
         </NavLink>

         {navItems.slice(2, 4).map((item) => {
             const isActive = location.pathname === item.path;
             return (
                 <NavLink
                     key={item.path}
                     to={item.path}
                     className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-transform duration-150 active:scale-90 ${
                         isActive ? 'text-blue-900 dark:text-blue-100 bg-blue-50 dark:bg-blue-900/60' : 'text-slate-400 dark:text-slate-500'
                     }`}
                 >
                     <span className="material-symbols-outlined" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
                     <span className="font-public-sans text-[10px] font-bold uppercase tracking-wider mt-1">{item.label.split(' ')[0]}</span>
                 </NavLink>
             );
         })}
      </nav>
    </div>
  );
}
