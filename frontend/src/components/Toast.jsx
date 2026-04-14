import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

export function ToastContainer({ toasts, onRemove }) {
  const config = {
    success: {
      icon: CheckCircle2,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    error: {
      icon: XCircle,
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
    },
    info: {
      icon: Info,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4">
      {toasts.map(t => {
        const style = config[t.type] || config.info;
        const Icon = style.icon;

        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg ${style.bg} ${style.border} ${style.text} animate-slide-in transition-all`}
          >
            <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg ${style.iconBg}`}>
              <Icon className={`w-5 h-5 ${style.iconColor}`} />
            </div>
            <span className="text-sm flex-1 font-medium leading-5 pt-1.5">{t.message}</span>
            <button
              onClick={() => onRemove(t.id)}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors -mr-1 -mt-1"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 opacity-50 hover:opacity-100" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
