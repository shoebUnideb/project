import { Loader2, Trash2, Archive } from 'lucide-react';

export function ConfirmDialog({
  title, message, confirmLabel, variant, loading, onConfirm, onCancel,
}: {
  title: string; message: string; confirmLabel: string;
  variant: 'danger' | 'warning'; loading: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${variant === 'danger' ? 'bg-red-50' : 'bg-amber-50'}`}>
            {variant === 'danger'
              ? <Trash2 size={18} className="text-red-500" />
              : <Archive size={18} className="text-amber-500" />}
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
            <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 text-[13px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`px-4 py-2 text-[13px] font-semibold text-white rounded-xl transition-colors flex items-center gap-2 ${variant === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
            {loading && <Loader2 size={13} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
