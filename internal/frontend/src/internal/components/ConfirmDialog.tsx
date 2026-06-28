interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm p-6">
        <h3 className="text-[15px] font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-[13px] text-gray-500 leading-relaxed mb-5">{message}</p>
        <div className="flex items-center gap-2.5 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-[13px] font-semibold text-gray-600 hover:bg-gray-100 rounded-xl disabled:opacity-60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-[13px] font-semibold text-white rounded-xl disabled:opacity-60 transition-colors ${
              danger
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-teal-500 hover:bg-teal-600'
            }`}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
