import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onEsc = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;

  const widthClass =
    size === 'sm' ? 'max-w-sm' :
    size === 'md' ? 'max-w-lg' :
    size === 'lg' ? 'max-w-2xl' :
    size === 'xl' ? 'max-w-4xl' : 'max-w-lg';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-lg shadow-xl w-full ${widthClass} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="font-heading text-lg font-semibold text-ink">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
