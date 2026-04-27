export default function CareTeam() {
  return (
    <div className="animate-in fade-in duration-500 w-full max-w-7xl mx-auto">
      <header className="mb-10">
        <h1 className="font-display text-4xl font-bold text-primary mb-2">Care Team & Access</h1>
        <p className="font-body-md text-on-surface-variant max-w-2xl">Manage your specialized care network, medical permissions, and document access from one secure dashboard.</p>
      </header>

      <div className="grid grid-cols-12 gap-8">
        {/* Care Team Section */}
        <div className="col-span-12 xl:col-span-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-on-surface">Your Care Circle</h2>
            <button className="flex items-center gap-2 text-primary font-bold hover:underline transition-all">
              <span className="material-symbols-outlined">person_add</span>
              Add Professional
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Profile Card 1 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md hover:-translate-y-1 flex flex-col items-center text-center group">
              <div className="relative mb-4">
                <img alt="Dr. Sarah Smith" className="w-24 h-24 rounded-full border-4 border-slate-50 object-cover shadow-sm group-hover:border-primary-container transition-colors" src="https://lh3.googleusercontent.com/aida-public/AB6AXuASOCY8bfTefWwtL5rL8urnbPFMU0Izc6sRbIioCbrBMq2RsEZYHt2waNPpHU9KliKL8Q2sNTdGvF6a21sQ9jvAWKSw0hrR1vIvA9djCjd1D4EQh_pIeaW1dd9hfdzrgMbMYI4gwz7jPHMIu58j27yRnc_XqYby5Gv0wPx5eQb_50ixJvt4YfzwNw4e7Ac_iwivgrY-dNEbHrcisWo2kkKeix8xP2k2G9_IZE0ge515g1ErJVVwdqARV4sZ95F3VMhZjLlUeS5fMg" />
                <span className="absolute bottom-1 -right-2 bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border border-white">Primary</span>
              </div>
              <h3 className="text-xl font-bold text-primary mb-1">Dr. Sarah Smith</h3>
              <p className="text-slate-500 text-sm font-medium mb-6">Primary Physician</p>
              <div className="flex w-full gap-3 mt-auto">
                <button className="flex-1 bg-primary hover:bg-blue-800 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm">
                  <span className="material-symbols-outlined text-sm">call</span> Call
                </button>
                <button className="flex-1 border-2 border-primary/20 hover:border-primary text-primary py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-sm">chat</span> Msg
                </button>
              </div>
            </div>

            {/* Profile Card 2 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md hover:-translate-y-1 flex flex-col items-center text-center group">
              <div className="relative mb-4">
                <img alt="Emily Johnson" className="w-24 h-24 rounded-full border-4 border-slate-50 object-cover shadow-sm group-hover:border-primary-container transition-colors" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDwuGzSktmzSEQAtIec11fX_dUa-5Hr43EwZktjTbSjnQhIeKHfSLFF1BEVxKY8rl8n4vAX-i-SmMFe9wHg-_3RBaaG-Taj7yutYQCTbP1nZARXKTbXyPkl-Isask20OEKr8VDJg-ifDC9J2QNw0nU1-hM4NMl2Vr4JQrx3aG_OMGfYBIpWV438Oj1PO_NExWxRJUKnEt5S7uf-lIlErsTVfvmHHfN6WhS2PW72i9XHkRfNQuMAnfEefwXyKxc8n5Pkh1-AK-OvXA" />
                <span className="absolute bottom-1 -right-2 bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border border-white">Family</span>
              </div>
              <h3 className="text-xl font-bold text-primary mb-1">Emily Johnson</h3>
              <p className="text-slate-500 text-sm font-medium mb-6">Daughter / Caregiver</p>
              <div className="flex w-full gap-3 mt-auto">
                <button className="flex-1 bg-primary hover:bg-blue-800 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm">
                  <span className="material-symbols-outlined text-sm">call</span> Call
                </button>
                <button className="flex-1 border-2 border-primary/20 hover:border-primary text-primary py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-sm">chat</span> Msg
                </button>
              </div>
            </div>

            {/* Profile Card 3 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md hover:-translate-y-1 flex flex-col items-center text-center group">
              <div className="relative mb-4">
                <img alt="Marcus Chen" className="w-24 h-24 rounded-full border-4 border-slate-50 object-cover shadow-sm group-hover:border-primary-container transition-colors" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAFIdLB-36DgUYw6_NpCDSF6Cr0Mz2UaGa5erQ4z3FuWEeTAcQkfleO6KkFLOeWlOnKE17_CAhht0mqn8rZs-4Y7TO81CJ2Oendkdk0L6qVBleSynMOJVrm5pkBBFeNz9EBjSVE6na_JUb45uk_C4c735FK5kHYKL_9TJLK6F3_s0tmpgcQku3W5fOKkDBr4sK8AjXeAJpBFxfdb2pnu8KHM0uBy7bsYgR1Outt7w6DMPreOAHh9d9YOaM-rOJHlZaHe3giApxRIg" />
                <span className="absolute bottom-1 -right-2 bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border border-white">Nurse</span>
              </div>
              <h3 className="text-xl font-bold text-primary mb-1">Marcus Chen</h3>
              <p className="text-slate-500 text-sm font-medium mb-6">Home Care Nurse</p>
              <div className="flex w-full gap-3 mt-auto">
                <button className="flex-1 bg-primary hover:bg-blue-800 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm">
                  <span className="material-symbols-outlined text-sm">call</span> Call
                </button>
                <button className="flex-1 border-2 border-primary/20 hover:border-primary text-primary py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-sm">chat</span> Msg
                </button>
              </div>
            </div>
          </div>

          {/* Medical Reports List */}
          <section className="mt-12 bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
              <h2 className="text-2xl font-bold text-on-surface">Medical Reports</h2>
              <button className="bg-secondary hover:bg-green-700 text-white px-6 py-2.5 rounded-full text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm">
                <span className="material-symbols-outlined">upload</span> Upload New
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Report Item */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all group">
                <div className="flex items-center gap-5 mb-4 sm:mb-0">
                  <div className="w-14 h-14 bg-blue-50 group-hover:bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 transition-colors">
                    <span className="material-symbols-outlined">description</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">Bi-Weekly Vital Stats Review</h4>
                    <p className="text-sm font-medium text-slate-500">Aug 14, 2023 • PDF • 2.4 MB</p>
                  </div>
                </div>
                <div className="flex gap-2 self-end sm:self-auto">
                  <button className="p-2.5 text-slate-400 hover:text-primary hover:bg-white rounded-full transition-all border border-transparent hover:border-slate-200 hover:shadow-sm">
                    <span className="material-symbols-outlined">visibility</span>
                  </button>
                  <button className="p-2.5 text-slate-400 hover:text-primary hover:bg-white rounded-full transition-all border border-transparent hover:border-slate-200 hover:shadow-sm">
                    <span className="material-symbols-outlined">download</span>
                  </button>
                </div>
              </div>

              {/* Report Item */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all group">
                <div className="flex items-center gap-5 mb-4 sm:mb-0">
                  <div className="w-14 h-14 bg-blue-50 group-hover:bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 transition-colors">
                    <span className="material-symbols-outlined">ecg_heart</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">Cardiology Consultation Summary</h4>
                    <p className="text-sm font-medium text-slate-500">July 28, 2023 • PDF • 1.8 MB</p>
                  </div>
                </div>
                <div className="flex gap-2 self-end sm:self-auto">
                  <button className="p-2.5 text-slate-400 hover:text-primary hover:bg-white rounded-full transition-all border border-transparent hover:border-slate-200 hover:shadow-sm">
                    <span className="material-symbols-outlined">visibility</span>
                  </button>
                  <button className="p-2.5 text-slate-400 hover:text-primary hover:bg-white rounded-full transition-all border border-transparent hover:border-slate-200 hover:shadow-sm">
                    <span className="material-symbols-outlined">download</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Side Panel: Permissions & Actions */}
        <div className="col-span-12 xl:col-span-4 space-y-8">
          {/* Permissions Section */}
          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200 shadow-inner">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <span className="material-symbols-outlined text-sm">lock_open</span>
              </div>
              <h2 className="text-xl font-bold text-slate-800">Access Permissions</h2>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="pr-4">
                  <h4 className="font-bold text-slate-800 mb-1">Health Data Sharing</h4>
                  <p className="text-xs font-medium text-slate-500 leading-relaxed">Allow providers to view live vitals</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between border-t border-slate-200 pt-6">
                <div className="pr-4">
                  <h4 className="font-bold text-slate-800 mb-1">Live Location Sharing</h4>
                  <p className="text-xs font-medium text-slate-500 leading-relaxed">Visibility for emergency responders</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between border-t border-slate-200 pt-6">
                <div className="pr-4">
                  <h4 className="font-bold text-slate-800 mb-1">Medication Logs</h4>
                  <p className="text-xs font-medium text-slate-500 leading-relaxed">Share daily adherence routine</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
            
            <button className="w-full mt-10 py-3 border-2 border-primary/20 hover:border-primary bg-white text-primary font-bold rounded-xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
              Update Audit Log
            </button>
          </div>

          {/* Upcoming Reviews Card */}
          <div className="bg-gradient-to-br from-primary to-blue-900 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden group">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                 <h3 className="text-2xl font-bold">Next Case Review</h3>
                 <span className="material-symbols-outlined animate-bounce">video_camera_front</span>
              </div>
              <p className="text-blue-100 text-sm mb-8 leading-relaxed">Scheduled with full care team to discuss Q3 goals.</p>
              
              <div className="flex items-center gap-4 mb-8 bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined">calendar_today</span>
                </div>
                <div>
                  <p className="font-bold text-lg">August 22, 2023</p>
                  <p className="text-sm text-blue-200 font-medium">10:00 AM - 11:30 AM</p>
                </div>
              </div>
              
              <button className="w-full bg-white text-primary py-3.5 rounded-xl font-bold active:scale-95 hover:bg-blue-50 transition-all shadow-lg flex items-center justify-center gap-2">
                 <span className="material-symbols-outlined">videocam</span> Join Video Bridge
              </button>
            </div>
            <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
