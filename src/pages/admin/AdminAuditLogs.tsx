export default function AdminAuditLogs() {
  const auditLogs = [
    { id: '1', user: 'Admin User', action: 'Created relationship link', resource: 'relationships/rel-1', time: '10 mins ago', result: 'Success' },
    { id: '2', user: 'Caregiver Demo', action: 'Connected to Elder ELD-7K4P92', resource: 'users/caregiver-uid', time: '1 hour ago', result: 'Success' },
    { id: '3', user: 'System', action: 'Device status ping', resource: 'devices/dev-watch-1', time: '2 hours ago', result: 'Success' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <header>
        <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
          Admin Portal
        </span>
        <h1 className="text-3xl font-bold text-slate-900">Platform Audit Trail</h1>
        <p className="text-sm text-slate-500 mt-1">Immutable record of administrative actions and authorization events.</p>
      </header>

      <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
        <h2 className="text-xl font-bold text-slate-900">Audit Activity Log</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Target Resource</th>
                <th className="p-3.5">Result</th>
                <th className="p-3.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3.5 font-bold text-slate-900">{log.user}</td>
                  <td className="p-3.5">{log.action}</td>
                  <td className="p-3.5 font-mono text-slate-500">{log.resource}</td>
                  <td className="p-3.5 font-bold text-emerald-600">{log.result}</td>
                  <td className="p-3.5 text-slate-400">{log.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
