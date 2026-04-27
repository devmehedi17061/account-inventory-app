export default function ProcessingOverlay({ active }) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center">
      <div className="bg-white rounded-lg px-6 py-4 shadow-xl flex items-center gap-3">
        <span className="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="font-medium text-ink">Processing…</span>
      </div>
    </div>
  );
}
