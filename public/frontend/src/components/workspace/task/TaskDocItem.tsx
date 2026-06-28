import { useState } from 'react';
import { Paperclip, Trash2, Eye, EyeOff } from 'lucide-react';

export function fileKind(url: string): 'image' | 'pdf' | 'other' {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'other';
}

export function DocItem({
  title, fileUrl, onDelete,
}: { title: string; fileUrl: string; onDelete?: () => void }) {
  const [preview, setPreview] = useState(false);
  const kind = fileKind(fileUrl);
  const canPreview = kind !== 'other';

  return (
    <div className="text-[12px]">
      <div className="flex items-center gap-2">
        <Paperclip size={11} className="text-primary-400 shrink-0" />
        <a href={fileUrl} target="_blank" rel="noreferrer"
          className="flex-1 text-primary-600 hover:underline truncate">{title}</a>
        {canPreview && (
          <button
            onClick={() => setPreview(p => !p)}
            className="text-gray-400 hover:text-primary-600 transition-colors"
            title={preview ? 'Hide preview' : 'Preview'}
          >
            {preview ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition-colors">
            <Trash2 size={12} />
          </button>
        )}
      </div>
      {preview && kind === 'image' && (
        <div className="mt-2 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
          <img src={fileUrl} alt={title} className="max-h-64 w-full object-contain" />
        </div>
      )}
      {preview && kind === 'pdf' && (
        <div className="mt-2 rounded-xl overflow-hidden border border-gray-100">
          <iframe src={fileUrl} title={title} className="w-full h-64" />
        </div>
      )}
    </div>
  );
}
