export default function Dashboard() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* SOS Banner */}
      <div className="bg-error text-white p-4 rounded-2xl flex items-center justify-between clinical-shadow">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-2 rounded-xl">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          </div>
          <div>
            <h2 className="font-headline-md text-white">Emergency Response Active</h2>
            <p className="text-white/80 text-sm">Rapid assistance protocols are ready for instant activation.</p>
          </div>
        </div>
        <button className="bg-white text-error font-bold px-6 py-2 rounded-full hover:bg-slate-100 transition-colors">
          View Protocols
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Risk Score Widget */}
        <div className="col-span-12 lg:col-span-4 bg-white p-8 rounded-2xl clinical-shadow border border-slate-100 flex flex-col justify-between overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="text-slate-500 font-label-md uppercase tracking-widest mb-1">Health Stability</h3>
            <p className="font-headline-lg text-primary">Risk Score</p>
          </div>
          
          <div className="my-6 flex items-center justify-center relative z-10">
            <div className="relative flex items-center justify-center">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle className="text-slate-100" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeWidth="12"></circle>
                <circle className="text-secondary" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeDasharray="440" strokeDashoffset="374" strokeWidth="12" strokeLinecap="round"></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black text-primary">15</span>
                <span className="text-xs font-bold text-secondary uppercase tracking-tighter">Low Risk</span>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-slate-500 leading-relaxed relative z-10">Patient is demonstrating 94% stability over the last 72 hours. No immediate interventions required.</p>
          <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-secondary/10 rounded-full blur-3xl"></div>
        </div>

        {/* Summary Health Cards Cluster */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Heart Rate */}
          <div className="bg-white p-6 rounded-2xl clinical-shadow border border-slate-100 flex items-center gap-6 hover:-translate-y-1 transition-transform">
            <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
            </div>
            <div>
              <p className="text-slate-500 font-label-md uppercase">Heart Rate</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-primary">72</span>
                <span className="text-slate-400 font-bold">BPM</span>
              </div>
              <span className="text-secondary text-xs font-bold flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-sm">trending_flat</span> Steady
              </span>
            </div>
          </div>

          {/* Blood Pressure */}
          <div className="bg-white p-6 rounded-2xl clinical-shadow border border-slate-100 flex items-center gap-6 hover:-translate-y-1 transition-transform">
            <div className="w-16 h-16 rounded-2xl bg-primary-container/10 flex items-center justify-center text-primary-container">
              <span className="material-symbols-outlined text-3xl">blood_pressure</span>
            </div>
            <div>
              <p className="text-slate-500 font-label-md uppercase">Blood Pressure</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-primary">120/80</span>
                <span className="text-slate-400 font-bold">mmHg</span>
              </div>
              <span className="text-secondary text-xs font-bold flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-sm">check_circle</span> Optimal
              </span>
            </div>
          </div>

          {/* Activity */}
          <div className="bg-white p-6 rounded-2xl clinical-shadow border border-slate-100 flex items-center gap-6 hover:-translate-y-1 transition-transform">
            <div className="w-16 h-16 rounded-2xl bg-secondary-container/30 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-3xl">directions_walk</span>
            </div>
            <div className="flex-1">
              <p className="text-slate-500 font-label-md uppercase">Activity</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-primary">4,820</span>
                <span className="text-slate-400 font-bold">Steps</span>
              </div>
              <div className="mt-2 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-secondary h-full w-[65%] rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Next Reminder */}
          <div className="bg-gradient-to-br from-primary to-blue-900 text-white p-6 rounded-2xl clinical-shadow flex flex-col justify-between relative overflow-hidden group">
            <div className="relative z-10">
                <div className="flex justify-between items-start">
                <div>
                    <p className="text-white/70 font-label-md uppercase text-xs tracking-wider">Next Medication</p>
                    <h4 className="text-xl font-bold mt-1">Lisinopril • 10mg</h4>
                </div>
                <div className="bg-white/10 p-2 rounded-lg">
                    <span className="material-symbols-outlined text-white">schedule</span>
                </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                <span className="text-white/90 font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                    Due: 14:30 PM
                </span>
                <button className="bg-secondary text-primary font-black px-6 py-2 rounded-xl text-sm hover:brightness-110 transition-all active:scale-95">
                    Taken
                </button>
                </div>
            </div>
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
          </div>
        </div>

        {/* Secondary Actions Section */}
        <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
          {/* Book Caregiver Box */}
          <div className="group cursor-pointer bg-surface-container-low p-1 rounded-3xl border border-transparent hover:border-primary-container transition-all">
            <div className="bg-white p-8 rounded-[22px] flex items-center gap-8 shadow-sm">
              <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-lg">
                <img alt="Caregiver profile" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBwpJlfmkk0IzVAln9gcwVyWi9F6nUBcjjpafd86iqeK1WSFma9RygttlFDy8fZpMdol_9kdJ2CTmSLiQtzlPFpUbV4vyU6AnH2siKRjFrQEln79nY_FV5mgc5rf3IFaSdXxkXS43d6Bta2j5hNbiVCspFIlvLdHA_-tSRduDRogQKi7lvkAkNvOksBTCQfjhMwVvgjqRtmYKMGu91WCtLtHrVb1NUa4B45HAIhS2hiiXXM3NCsXwFpeeEzX0IgtUJrYp2Eo3CBcQ" />
              </div>
              <div className="flex-1">
                <h3 className="text-primary font-headline-md">Book Specialized Care</h3>
                <p className="text-slate-500 mt-1 mb-4 text-sm">On-demand support for physical therapy, meals, or companionship.</p>
                <div className="flex items-center text-primary-container font-bold text-sm gap-2">
                  <span>Schedule Now</span>
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </div>
              </div>
            </div>
          </div>

          {/* Voice Assistant Box */}
          <div className="group cursor-pointer bg-secondary-container/20 p-1 rounded-3xl border border-transparent hover:border-secondary transition-all">
            <div className="bg-white p-8 rounded-[22px] flex items-center gap-8 shadow-sm">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center text-white shadow-lg shadow-secondary/20 relative overflow-hidden">
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                <span className="material-symbols-outlined text-5xl relative z-10 group-hover:scale-110 transition-transform">mic</span>
              </div>
              <div className="flex-1">
                <h3 className="text-primary font-headline-md">Voice Assistant</h3>
                <p className="text-slate-500 mt-1 mb-4 text-sm">Hands-free control for patient logging and status updates.</p>
                <div className="flex items-center text-secondary font-bold text-sm gap-2">
                  <span>Start Session</span>
                  <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
