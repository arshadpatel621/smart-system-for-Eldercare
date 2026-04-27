export default function HealthMonitor() {
  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-bold text-primary mb-2">Health Monitor</h1>
        <p className="font-body-md text-on-surface-variant">Real-time physiological tracking for Resident 402B</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* SpO2 Section (Hero Card) */}
        <div className="md:col-span-8 bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-container flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary font-label-lg">
              <span className="material-symbols-outlined">bloodtype</span>
              Blood Oxygen (SpO2)
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-black text-primary tracking-tighter">98</span>
              <span className="text-2xl font-bold text-on-surface-variant">%</span>
            </div>
            <div className="flex items-center gap-2 bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full w-fit font-label-md">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Optimal Range
            </div>
          </div>
          <div className="hidden sm:block w-48 h-32 relative">
            <svg className="w-full h-full text-secondary" viewBox="0 0 100 40">
              <path d="M0 35 Q 20 5, 40 30 T 80 15 T 100 25" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3"></path>
            </svg>
            <div className="absolute -bottom-2 right-0 text-[10px] uppercase font-bold text-slate-400">7-Day Consistency</div>
          </div>
        </div>

        {/* Daily Steps */}
        <div className="md:col-span-4 bg-secondary-container/30 rounded-xl p-6 border border-secondary-container/50 flex flex-col justify-between hover:-translate-y-1 transition-transform">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-secondary-container rounded-lg text-secondary">
              <span className="material-symbols-outlined">directions_walk</span>
            </div>
            <div className="text-right">
              <span className="block text-secondary font-display text-2xl font-bold">6,432</span>
              <span className="block text-on-secondary-container text-sm font-bold uppercase">of 8,000 steps</span>
            </div>
          </div>
          <div className="mt-6">
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div className="bg-secondary h-3 rounded-full" style={{ width: '80%' }}></div>
            </div>
            <p className="mt-2 text-sm font-bold text-secondary">80% of daily goal met</p>
          </div>
        </div>

        {/* Blood Pressure History */}
        <div className="md:col-span-8 bg-surface-container-lowest rounded-xl p-6 border border-surface-container shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-primary">Blood Pressure History</h3>
            <div className="flex gap-2 bg-slate-50 p-1 rounded-lg">
              <button className="bg-white shadow-sm px-4 py-1.5 rounded-md text-primary text-sm font-bold">Week</button>
              <button className="hover:bg-slate-100 px-4 py-1.5 rounded-md text-slate-500 text-sm font-bold transition-colors">Month</button>
            </div>
          </div>
          <div className="h-64 bg-slate-50 rounded-xl flex items-end justify-between px-8 py-4 border-b-2 border-slate-200">
            {/* Mock Bars for Chart */}
            {[60, 65, 70, 55, 62].map((height, i) => (
              <div key={i} className="w-12 bg-primary-container/20 rounded-t-lg relative group cursor-help transition-all hover:bg-primary-container/30" style={{ height: `${height}%` }}>
                <div className="absolute inset-x-0 bottom-0 bg-primary-container rounded-t-lg" style={{ height: `${height + 20}%` }}></div>
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-primary text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg">
                  120/80
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 px-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span>
          </div>
        </div>

        {/* Sleep Quality Card */}
        <div className="md:col-span-4 bg-primary-container rounded-xl p-6 text-white overflow-hidden relative shadow-md">
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center gap-2 font-bold mb-4 text-on-primary-container">
                <span className="material-symbols-outlined">dark_mode</span>
                Sleep Quality
              </div>
              <div className="space-y-1">
                <span className="text-5xl font-black block">8h 15m</span>
                <span className="text-on-primary-container text-sm font-bold">Deep Sleep Efficiency: 88%</span>
              </div>
            </div>
            <div className="mt-8">
              <div className="flex gap-1 h-8 items-end">
                <div className="w-full bg-on-primary-container/20 h-4 rounded-sm hover:h-5 transition-all"></div>
                <div className="w-full bg-on-primary-container/50 h-6 rounded-sm hover:h-7 transition-all"></div>
                <div className="w-full bg-white h-8 rounded-sm hover:h-9 transition-all"></div>
                <div className="w-full bg-on-primary-container/60 h-5 rounded-sm hover:h-6 transition-all"></div>
                <div className="w-full bg-on-primary-container/30 h-3 rounded-sm hover:h-4 transition-all"></div>
              </div>
              <p className="mt-3 text-[12px] font-medium text-blue-200">Last cycle: 10:45 PM - 7:00 AM</p>
            </div>
          </div>
          <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
        </div>

        {/* Nutrition and Hydration */}
        <div className="md:col-span-12 bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <span className="material-symbols-outlined text-primary text-3xl">restaurant</span>
            <h3 className="text-2xl font-bold text-primary">Nutrition & Hydration</h3>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12">
            {/* Water Intake */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <span className="block font-bold text-primary mb-1">Water Intake</span>
                  <span className="text-2xl font-bold">1.8 <span className="text-sm font-medium text-slate-400">/ 2.5 Liters</span></span>
                </div>
                <div className="text-primary-container bg-surface-container-low p-3 rounded-xl">
                  <span className="material-symbols-outlined">water_drop</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
                <div className="bg-blue-500 h-full rounded-full relative overflow-hidden" style={{ width: '72%' }}>
                   <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
                </div>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-500">
                <span>72% of target</span>
                <span className="text-blue-600">+2 glasses needed</span>
              </div>
            </div>

            {/* Calorie Monitor */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <span className="block font-bold text-primary mb-1">Daily Calories</span>
                  <span className="text-2xl font-bold">1,420 <span className="text-sm font-medium text-slate-400">/ 1,800 kcal</span></span>
                </div>
                <div className="text-secondary bg-secondary-container/50 p-3 rounded-xl">
                  <span className="material-symbols-outlined">monitoring</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden shadow-inner">
                <div className="bg-secondary h-full rounded-full" style={{ width: '78%' }}></div>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-500">
                <span>78% consumed</span>
                <span className="text-secondary">High Protein Focus</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
