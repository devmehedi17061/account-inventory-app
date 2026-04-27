export default function Topbar() {
  return (
    <header className="bg-white h-14 border-b border-slate-200 flex items-center justify-end px-6 gap-4">
      <button type="button" className="text-slate-600 hover:text-ink relative" title="Notifications">
        <i className="fa-regular fa-bell" />
      </button>
      <button type="button" className="text-slate-600 hover:text-ink" title="Settings">
        <i className="fa-solid fa-gear" />
      </button>
      <button type="button" className="text-slate-600 hover:text-ink" title="Account">
        <i className="fa-regular fa-user" />
      </button>
    </header>
  );
}
