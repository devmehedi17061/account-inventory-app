import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'Dashboard', icon: 'fa-tachometer-alt' },
  { to: '/inventory', label: 'Inventory', icon: 'fa-boxes-stacked' },
  { to: '/suppliers', label: 'Suppliers', icon: 'fa-truck' },
  { to: '/customers', label: 'Customers', icon: 'fa-users' },
  { to: '/purchases', label: 'Purchases', icon: 'fa-file-invoice-dollar' },
  { to: '/sales', label: 'Sales', icon: 'fa-chart-line' },
  { to: '/receipts', label: 'Receipts', icon: 'fa-receipt' },
  { to: '/payments', label: 'Payments', icon: 'fa-credit-card' },
  { to: '/reports', label: 'Reports', icon: 'fa-chart-pie' },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-sidebar text-white min-h-screen flex flex-col">
      <div className="px-5 py-6 flex items-center gap-3 border-b border-sidebarMuted">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-white text-sidebar">
          <i className="fa-solid fa-warehouse" />
        </span>
        <h1 className="font-heading font-semibold text-lg leading-tight">
          AIC Inventory<br />App
        </h1>
      </div>
      <nav className="flex-1 py-4">
        {items.map(it => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-accent text-white font-semibold'
                  : 'text-slate-200 hover:bg-sidebarMuted'
              }`
            }
          >
            <i className={`fa-solid ${it.icon} w-5 text-center`} />
            <span>{it.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => {
            // Logout placeholder — actual auth not in scope for this build.
            window.location.reload();
          }}
          className="w-full text-left flex items-center gap-3 px-5 py-3 text-sm text-slate-200 hover:bg-sidebarMuted"
        >
          <i className="fa-solid fa-arrow-right-from-bracket w-5 text-center" />
          <span>Logout</span>
        </button>
      </nav>
    </aside>
  );
}
