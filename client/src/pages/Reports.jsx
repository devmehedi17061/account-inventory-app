import { useEffect, useState } from 'react';
import { api, notifyError } from '../api/client.js';

export default function Reports() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/reports/summary').then(setData).catch(notifyError); }, []);

  return (
    <div>
      <h2 className="text-2xl font-heading font-semibold text-ink">Reports</h2>
      <p className="text-slate-500 mb-4">Snapshot counts across all modules</p>

      {!data ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(data.counts).map(([k, v]) => (
            <div key={k} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <div className="text-xs uppercase font-semibold text-slate-500 tracking-wide">{labelize(k)}</div>
              <div className="text-2xl font-heading font-semibold text-ink mt-1">{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-white border border-slate-200 rounded-lg p-5 text-sm text-slate-600">
        <p>Detailed report layouts (P&L, aged receivables/payables, inventory aging, etc.) can be added here as requirements are finalized. The dashboard already covers sales/purchase trends, top customers, and category/location breakdowns.</p>
      </div>
    </div>
  );
}

function labelize(k) {
  return k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
}
