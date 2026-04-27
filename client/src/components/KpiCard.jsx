export default function KpiCard({ icon, title, value }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 px-4 py-3 min-h-[100px] flex flex-col">
      <div className="flex items-center gap-2 text-ink">
        <i className={`fa-solid ${icon} text-sm`} />
        <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
      </div>
      <div className="mt-2 text-lg font-heading font-semibold text-ink leading-tight break-words">
        {value}
      </div>
    </div>
  );
}
