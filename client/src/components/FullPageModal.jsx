import { useEffect } from 'react';

export default function FullPageModal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onEsc = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-stretch justify-stretch p-4">
      <div className="relative bg-white rounded-lg shadow-xl w-full h-full overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-heading text-lg font-semibold text-ink">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}
