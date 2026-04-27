export default function AIInsights() {
  return (
    <div className="animate-in fade-in duration-500 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-bold text-primary mb-2">AI Health Insights</h1>
          <p className="text-slate-500 font-medium">Personalized data analysis powered by VitalAI</p>
        </div>
        
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow">
          <div className="relative">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
               <span className="material-symbols-outlined text-2xl">watch</span>
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
          </div>
          <div>
            <div className="font-bold text-slate-800">Apple Watch Series 9</div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Synced 2m ago</span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-8 space-y-8">
          
          {/* AI Summary Banner */}
          <div className="bg-gradient-to-br from-primary to-blue-800 rounded-3xl p-8 sm:p-10 text-white relative overflow-hidden shadow-xl group hover:shadow-2xl transition-all">
            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start">
              <div className="flex-1 space-y-6">
                <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-white/10 shadow-sm">
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  Weekly Summary
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
                  "You're making great progress, Elena! Your sleep quality improved by <span className="text-secondary-container">14%</span> this week."
                </h2>
                
                <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/20">
                  <div>
                    <div className="text-white/70 text-xs font-bold uppercase tracking-wider mb-2">Avg. Steps</div>
                    <div className="text-2xl font-black">6,420</div>
                  </div>
                  <div>
                    <div className="text-white/70 text-xs font-bold uppercase tracking-wider mb-2">Resting Heart</div>
                    <div className="text-2xl font-black flex items-baseline gap-1">68 <span className="text-sm font-medium opacity-80">BPM</span></div>
                  </div>
                  <div>
                    <div className="text-white/70 text-xs font-bold uppercase tracking-wider mb-2">Active Mins</div>
                    <div className="text-2xl font-black flex items-baseline gap-1">145 <span className="text-sm font-medium opacity-80">m</span></div>
                  </div>
                </div>
              </div>
              <div className="hidden md:block w-36 h-36 rounded-full border-4 border-white/20 p-2 shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-500">
                <img alt="Activity tracking" className="w-full h-full object-cover rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBH-Oh-RELZGEoLlGTJx-GSbX6e7pNuGHoxxjRAS-qEkop0Ol0AcpWCiSdeM6skTEojFCbWoT7-3PfQhJgKG99-FibjBc5h0fTZ2D92sbE0wAiLXrDeC2Gvxv55s2jvW_jf08rsYgvJ7Y-LY-aByflC3hN1nujgyD-O19v59I3IZmcgsW0nnDqADYsYp1RS3IUvV50Pv1KOByG4wXi6X5xW_oFhlHU3AGrAU8dNIguWyuTCbEEpDyeaR7h-o7K_WDM8cikl0Nnj5g" />
              </div>
            </div>
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
          </div>

          {/* AI Chat Interface */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[500px] overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm border border-blue-200">
                  <span className="material-symbols-outlined">smart_toy</span>
                </div>
                <div>
                    <span className="font-bold text-slate-800 block">VitalAI Companion</span>
                    <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Online
                    </span>
                </div>
              </div>
              <button className="text-slate-400 hover:text-primary transition-colors p-2 bg-white rounded-full border border-slate-200 shadow-sm">
                 <span className="material-symbols-outlined">more_vert</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
              <div className="flex gap-4 max-w-[85%]">
                <div className="w-8 h-8 shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                  <span className="material-symbols-outlined text-sm">smart_toy</span>
                </div>
                <div className="bg-white border border-slate-100 shadow-sm p-4 rounded-2xl rounded-tl-none text-slate-700 text-sm leading-relaxed">
                  Good afternoon, Elena! I noticed your heart rate was a bit elevated during your walk today. How are you feeling right now?
                </div>
              </div>
              
              <div className="flex flex-row-reverse gap-4 ml-auto max-w-[85%]">
                <div className="w-8 h-8 shrink-0 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shadow-sm border-2 border-white">E</div>
                <div className="bg-primary text-white p-4 rounded-2xl rounded-tr-none text-sm leading-relaxed shadow-sm">
                  I'm feeling okay, just a little tired. I think I might have pushed myself too much.
                </div>
              </div>
              
              <div className="flex gap-4 max-w-[85%]">
                <div className="w-8 h-8 shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                  <span className="material-symbols-outlined text-sm">smart_toy</span>
                </div>
                <div className="bg-white border border-slate-100 shadow-sm p-4 rounded-2xl rounded-tl-none text-slate-700 text-sm leading-relaxed space-y-3">
                  <p>That makes sense. Your recovery data suggests a bit of rest would be beneficial.</p>
                  <p>Would you like me to schedule a 15-minute guided breathing session to help you relax?</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-white border-t border-slate-100">
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-inner">
                <input type="text" placeholder="Message VitalAI..." className="flex-1 border-none focus:ring-0 text-slate-700 bg-transparent py-2 outline-none text-sm" />
                <button className="w-10 h-10 rounded-full bg-white text-slate-500 hover:text-primary hover:bg-slate-100 transition-colors flex items-center justify-center shadow-sm border border-slate-200">
                  <span className="material-symbols-outlined text-sm">mic</span>
                </button>
                <button className="w-10 h-10 rounded-full bg-primary text-white hover:bg-blue-800 active:scale-95 transition-all flex items-center justify-center shadow-md">
                  <span className="material-symbols-outlined text-sm">send</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="lg:col-span-4 space-y-6">
          <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest px-2">Today's Suggestions</h3>
          
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>directions_walk</span>
              </div>
              <span className="bg-orange-100/50 text-orange-700 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-orange-200/50">High Impact</span>
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-800 mb-2">Light Exercise</h4>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">A gentle 10-minute stretch could help with your lower back stiffness today.</p>
            </div>
            <button className="w-full py-3.5 bg-slate-50 hover:bg-slate-100 text-primary font-bold rounded-xl transition-colors border border-slate-200 shadow-sm flex items-center justify-center gap-2 active:scale-95">
              Start Session
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>water_drop</span>
              </div>
              <span className="bg-blue-100/50 text-blue-700 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border border-blue-200/50">Daily Goal</span>
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-800 mb-2">Hydration Check</h4>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">You've reached 60% of your water goal. Time for a glass of water!</p>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner">
              <div className="bg-blue-500 h-full w-[60%] relative overflow-hidden">
                 <div className="absolute inset-0 bg-white/20 w-full animate-pulse"></div>
              </div>
            </div>
            <button className="w-full py-3.5 bg-secondary hover:bg-green-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95">
              Log 250ml
            </button>
          </div>

          <div className="bg-gradient-to-br from-secondary-container to-[#bace99] p-6 rounded-3xl shadow-sm space-y-4 border border-secondary/20 relative overflow-hidden">
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                <span className="font-black uppercase tracking-wider text-secondary text-[10px] bg-white/40 px-2 py-0.5 rounded-sm">Clinical Insight</span>
                </div>
                <p className="text-secondary text-sm font-medium italic leading-relaxed">
                "Consistent light activity has been shown to reduce joint inflammation in similar profiles by 22%."
                </p>
            </div>
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-8xl text-white/20">psychology</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
