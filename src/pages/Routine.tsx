export default function Routine() {
  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-primary mb-2">Daily Routine & Well-being</h1>
        <p className="text-on-surface-variant">Manage your day with precision and clinical care.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Mood Tracker Section */}
        <section className="md:col-span-12 lg:col-span-4 bg-white rounded-xl shadow-sm p-6 border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-blue-900">How are you feeling?</h2>
              <span className="material-symbols-outlined text-slate-400">info</span>
            </div>
            <p className="text-sm text-slate-500 mb-8">Record your mood to help the care team monitor your well-being trends.</p>
          </div>
          
          <div className="grid grid-cols-5 gap-2">
            <button className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-surface-container-low transition-colors group">
              <span className="material-symbols-outlined text-4xl text-slate-300 group-hover:text-error transition-colors">sentiment_very_dissatisfied</span>
              <span className="text-[10px] font-bold uppercase text-slate-400">Poor</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-surface-container-low transition-colors group">
              <span className="material-symbols-outlined text-4xl text-slate-300 group-hover:text-orange-500 transition-colors">sentiment_dissatisfied</span>
              <span className="text-[10px] font-bold uppercase text-slate-400">Unwell</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface-container text-primary-container ring-2 ring-primary-container/20 hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>sentiment_neutral</span>
              <span className="text-[10px] font-bold uppercase">Neutral</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-surface-container-low transition-colors group">
              <span className="material-symbols-outlined text-4xl text-slate-300 group-hover:text-secondary transition-colors">sentiment_satisfied</span>
              <span className="text-[10px] font-bold uppercase text-slate-400">Good</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-surface-container-low transition-colors group">
              <span className="material-symbols-outlined text-4xl text-slate-300 group-hover:text-green-600 transition-colors">sentiment_very_satisfied</span>
              <span className="text-[10px] font-bold uppercase text-slate-400">Great</span>
            </button>
          </div>
        </section>

        {/* Today's Routine Timeline */}
        <section className="md:col-span-12 lg:col-span-8 bg-white rounded-xl shadow-sm p-6 border border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <h2 className="text-2xl font-bold text-blue-900">Today's Routine</h2>
            <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-low rounded-full">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
              <span className="text-sm font-bold text-secondary">2 of 5 Tasks Completed</span>
            </div>
          </div>
          
          <div className="relative space-y-6 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
            
            {/* Routine Item: Breakfast (Done) */}
            <div className="relative pl-12 flex items-start gap-4 group">
              <div className="absolute left-0 w-10 h-10 rounded-full bg-secondary text-white flex items-center justify-center z-10 shadow-sm group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <div className="flex-1 bg-surface-container-low border border-secondary/20 p-4 rounded-xl flex justify-between items-center transition-all hover:shadow-md">
                <div>
                  <h3 className="font-bold text-secondary mb-1">Breakfast</h3>
                  <p className="text-sm text-slate-500 font-medium">Completed at 8:30 AM</p>
                </div>
                <div className="w-14 h-14 rounded-lg overflow-hidden opacity-80 border border-slate-200">
                  <img alt="Healthy breakfast" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCZQ8NyjbNtKq7I6xa2zoPRZjn_qB02rSVK7N-3PQW8Z102G_CbmA7r78ZRnpyuSncxDqQsF3nuIPp9BwpslTIeYUGXAVLL9MXChR7ZTD2P0YrERr7AyXOhFnlIPZ43oukWdmF5h1bOvv_Q85thRAThaJgZexnqsHkGm6ewJjnzSVWLeSS28cXsow0IH9yZCxOe1x2jtbxIvtVS9_4qwB6Bnan5deOtkQ0eN8U-qLAwvHqSP7onutjlICAN4hb99KDciL3vFkGIdQ" />
                </div>
              </div>
            </div>

            {/* Routine Item: Morning Medication (Take button) */}
            <div className="relative pl-12 flex items-start gap-4 group">
              <div className="absolute left-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center z-10 border-4 border-white shadow-sm group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-xl">medical_services</span>
              </div>
              <div className="flex-1 bg-white border border-primary/20 p-5 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 shadow-md ring-1 ring-primary/5">
                <div>
                  <h3 className="font-bold text-primary text-lg mb-1">Morning Medication</h3>
                  <p className="text-sm font-medium text-error flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      Scheduled for 10:00 AM (Overdue)
                  </p>
                </div>
                <button className="px-6 py-2.5 bg-primary hover:bg-blue-800 text-white font-bold rounded-lg text-sm active:scale-95 transition-all shadow-md">
                  Take Now
                </button>
              </div>
            </div>

            {/* Routine Item: Afternoon Walk (Pending) */}
            <div className="relative pl-12 flex items-start gap-4 group">
              <div className="absolute left-0 w-10 h-10 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center z-10 border-4 border-white group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-xl">directions_walk</span>
              </div>
              <div className="flex-1 bg-slate-50 border border-slate-100 p-4 rounded-xl flex justify-between items-center opacity-80 hover:opacity-100 transition-opacity">
                <div>
                  <h3 className="font-bold text-slate-700 mb-1">Afternoon Walk</h3>
                  <p className="text-sm text-slate-500 font-medium">Scheduled for 4:00 PM</p>
                </div>
                <div className="px-3 py-1 bg-slate-200 text-slate-600 rounded text-xs font-bold uppercase tracking-wider">
                  Upcoming
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Health Summary Micro-Bento */}
        <section className="md:col-span-12 flex flex-col md:flex-row gap-6">
          <div className="flex-1 bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-5 hover:-translate-y-1 transition-transform">
            <div className="w-14 h-14 rounded-full bg-secondary-container/30 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-3xl">water_drop</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase">Hydration</span>
              <p className="text-2xl font-bold text-blue-900">1.2L <span className="text-sm font-normal text-slate-500">/ 2.0L</span></p>
            </div>
          </div>
          
          <div className="flex-1 bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-5 hover:-translate-y-1 transition-transform">
            <div className="w-14 h-14 rounded-full bg-primary-fixed/30 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-3xl">bedtime</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase">Sleep Quality</span>
              <p className="text-2xl font-bold text-blue-900">7h 42m <span className="text-sm font-normal text-slate-500">Deep</span></p>
            </div>
          </div>
          
          <div className="flex-1 bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex items-center gap-5 hover:-translate-y-1 transition-transform">
            <div className="w-14 h-14 rounded-full bg-error-container/30 flex items-center justify-center text-error">
              <span className="material-symbols-outlined text-3xl">heart_check</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase">Avg. Heart Rate</span>
              <p className="text-2xl font-bold text-blue-900">72 <span className="text-sm font-normal text-slate-500">BPM</span></p>
            </div>
          </div>
        </section>
      </div>

      {/* Floating Action Button */}
      <button className="fixed bottom-24 right-6 lg:bottom-12 lg:right-12 w-16 h-16 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center group hover:bg-blue-800 active:scale-90 transition-all z-40">
        <span className="material-symbols-outlined text-3xl transition-transform group-hover:rotate-90">add</span>
        <div className="absolute right-full mr-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg font-bold text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Add New Reminder
        </div>
      </button>
    </div>
  );
}
