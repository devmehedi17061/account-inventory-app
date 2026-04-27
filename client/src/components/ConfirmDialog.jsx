import Modal from './Modal.jsx';

export default function ConfirmDialog({ open, title = 'Confirm', message, onConfirm, onCancel, confirmLabel = 'Confirm' }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <p className="text-sm text-slate-700">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
