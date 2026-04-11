export function ToastContainer({ toasts, onRemove }) {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-md ${colors[t.type]} animate-slide-in`}
        >
          <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/50 text-xs font-bold">
            {icons[t.type]}
          </span>
          <span className="text-sm flex-1">{t.message}</span>
          <button
            onClick={() => onRemove(t.id)}
            className="flex-shrink-0 text-current opacity-50 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
