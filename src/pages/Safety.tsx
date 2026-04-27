import { useNavigate } from 'react-router-dom';

export default function Safety() {
  const navigate = useNavigate();

  return (
    <div className="animate-in fade-in duration-500 bg-surface min-h-screen pb-24">
      {/* TopAppBar for SOS (simplified) */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 sticky top-0 z-40 flex items-center gap-4">
         <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <span className="material-symbols-outlined text-slate-600">arrow_back</span>
         </button>
         <h1 className="text-xl font-bold text-error">Emergency Protocol</h1>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-12">
        {/* Hero SOS Section */}
        <section className="flex flex-col items-center justify-center text-center py-10 space-y-8">
          <div className="relative group cursor-pointer">
            <div className="absolute inset-0 bg-error/30 rounded-full animate-ping opacity-75"></div>
            <button className="relative w-64 h-64 md:w-80 md:h-80 bg-error text-white rounded-full flex flex-col items-center justify-center shadow-[0_0_40px_rgba(186,26,26,0.4)] hover:bg-red-700 hover:scale-105 transition-all active:scale-95 z-10 border-8 border-white/20">
              <span className="material-symbols-outlined text-8xl mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
              <span className="text-5xl font-black tracking-wider leading-none">SOS</span>
            </button>
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-slate-800">Hold for 3 seconds to alert help</h2>
            <p className="text-lg text-slate-500 max-w-lg mx-auto">Professional care team and emergency services will be notified immediately with your precise location.</p>
          </div>
        </section>

        {/* Configuration Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fall Detection Toggle */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center text-orange-600">
                <span className="material-symbols-outlined text-3xl">falling</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 mb-1">Fall Detection</h3>
                <p className="text-sm font-medium text-slate-500">AI-powered active monitoring</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-14 h-8 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-secondary"></div>
            </label>
          </div>

          {/* Rapid Access Contacts */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">Emergency Contacts</h3>
              <button className="text-primary font-bold text-sm hover:underline">Manage All</button>
            </div>
            <div className="flex -space-x-3 overflow-hidden p-2">
              <img alt="Contact 1" className="inline-block h-14 w-14 rounded-full ring-4 ring-white object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDTLvCwZvBfCTOgwqHAHkkDa47vI3JIyIfWZppP0sdY4qSHiFaninjkB4DP2yCE4PJL3_BIMV9PRVZ2jChTBb-P0tvoX8ileC89JKiA9hvYvzL9Mf_vGmn3TNrurDebYm7mwMYfvUJkgV-BDvLezqiQFPvsUmHZFgciRsOafZIaqZoXuEmLPf_7uo3zJ374Ypc6Q9cLTf8i2o_BvdS9xz1IXGum1TvbYXhCYnqQe20GoTS1gX9AhwViFbFhToJHLtXCpxgxFDLmbA" />
              <img alt="Contact 2" className="inline-block h-14 w-14 rounded-full ring-4 ring-white object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDABtJmbZR-JHAU6fV-g7ojUEWoh3YD1oOjTo6YT97xOhEQlsgnPfBc9dK-vVyCQQQyXd7RYf_LOr0PkNc_-49e73qVU-Y3BqtyTRO4gnsOXzSLQxmHCyH4WPR865nbPjE0sJ8Fq4bqt2FaM7PDwmOgd8uuuzdRmrDYaOO9LeERTJhc6qeEGjvSIFGuvbRJEsXT_1cIOnMNJ738mC03qS-JTMeh-y7vs5L2Diio5dPhKYuWGNF6du7XC0qxsQof5e9XszEJrcKTdA" />
              <img alt="Contact 3" className="inline-block h-14 w-14 rounded-full ring-4 ring-white object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDizk7ngr2ZKsOnjLmABqPAlP6mGx5xhBq7A89EI9LJJnaB2YpMCS9JPW-2XDtRYXdOWUpU-I_sYbohO6Tg1RlFwRGi2dQBJCMgwK5y4dmnpc4xBaugquMo7E6bvIup1FntJFwJ0emsYpvsNTADJR7AzypJ_0uGElWx60wKp9AlLNAgO2LIom4GiQu4E7pUVVe-_D_lthbG_M7UXWUah3tCwmvrwtyf0cNlTy33iEO9H6GO8aT-y1RUh5uw-rDv_UGVdX76VvAQug" />
              <div className="h-14 w-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer ring-4 ring-white z-10">
                <span className="material-symbols-outlined">add</span>
              </div>
            </div>
          </div>
        </div>

        {/* Safety History Feed */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800">Safety History</h2>
            <span className="px-4 py-1.5 bg-blue-50 text-primary rounded-full text-sm font-bold border border-blue-100">Last 30 Days</span>
          </div>
          
          <div className="space-y-4">
            {/* Alert Card: Critical */}
            <div className="bg-red-50 border border-red-100 p-6 rounded-2xl flex flex-col sm:flex-row items-start gap-5 transition-all hover:shadow-md">
              <div className="w-14 h-14 bg-error rounded-full flex items-center justify-center text-white shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div className="flex-1 w-full">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                  <h4 className="text-lg font-bold text-red-900">Potential Fall Detected</h4>
                  <span className="text-sm font-bold text-red-700/70 bg-red-100 px-3 py-1 rounded-full w-fit">Oct 24, 08:12 AM</span>
                </div>
                <p className="text-red-800/80 mb-4 text-sm leading-relaxed">Movement pattern indicated a stumble in the Living Room. Response was automatically initiated but cancelled by resident after 15 seconds.</p>
                <div className="flex flex-wrap gap-3">
                  <button className="px-5 py-2.5 bg-error text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-sm">View Incident Log</button>
                  <button className="px-5 py-2.5 bg-white text-error rounded-lg text-sm font-bold border border-error/20 hover:bg-red-50 transition-colors">Dismiss</button>
                </div>
              </div>
            </div>

            {/* Alert Card: Warning */}
            <div className="bg-orange-50 border border-orange-100 p-6 rounded-2xl flex flex-col sm:flex-row items-start gap-5 transition-all hover:shadow-md">
              <div className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-2xl">monitor_heart</span>
              </div>
              <div className="flex-1 w-full">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                  <h4 className="text-lg font-bold text-orange-900">Irregular Heart Rate</h4>
                  <span className="text-sm font-bold text-orange-700/70 bg-orange-100 px-3 py-1 rounded-full w-fit">Oct 22, 11:45 PM</span>
                </div>
                <p className="text-orange-800/80 mb-4 text-sm leading-relaxed">Resting heart rate exceeded 110 BPM for 5 minutes during sleep period. Resident notified of minor anomaly.</p>
                <div className="flex flex-wrap gap-3">
                  <button className="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors shadow-sm">Review Metrics</button>
                </div>
              </div>
            </div>

            {/* Alert Card: Success */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col sm:flex-row items-start gap-5 transition-all hover:shadow-md">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 shrink-0 border border-slate-200">
                <span className="material-symbols-outlined text-2xl">check_circle</span>
              </div>
              <div className="flex-1 w-full">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                  <h4 className="text-lg font-bold text-slate-800">Safety Check Completed</h4>
                  <span className="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full w-fit">Oct 20, 09:00 AM</span>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed">Routine morning check-in successful. All sensors and wearable devices calibrated and connected.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
