import { useState, type FormEvent } from 'react';
import { X, Upload, Link, FileText, Layers } from 'lucide-react';
import { workspacesApi } from '../../api/workspaces';
import { ApiError } from '../../api/apiClient';
import apiClient from '../../api/apiClient';
import type { WorkspaceResource } from '../../types';

type ResourceType = 'file' | 'link' | 'note';

const CATEGORIES = [
  { value: 'documents',     label: 'Documents' },
  { value: 'presentations', label: 'Presentations' },
  { value: 'guides',        label: 'Guides' },
  { value: 'links',         label: 'Links' },
  { value: 'other',         label: 'Other' },
] as const;

interface Props {
  workspaceId: number;
  onClose: () => void;
  onAdded: (r: WorkspaceResource) => void;
}

const TYPE_ICONS: Record<ResourceType, React.ReactNode> = {
  file: <Upload size={14} />,
  link: <Link size={14} />,
  note: <FileText size={14} />,
};

export default function AddResourceModal({ workspaceId, onClose, onAdded }: Props) {
  const [type, setType]           = useState<ResourceType>('link');
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [url, setUrl]             = useState('');
  const [body, setBody]           = useState('');
  const [file, setFile]           = useState<File | null>(null);
  const [isTemplate, setIsTemplate] = useState(false);
  const [category, setCategory]   = useState<string>('links');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  const handleTypeChange = (t: ResourceType) => {
    setType(t);
    if (t === 'link') setCategory('links');
    else if (t === 'note') setCategory('guides');
    else setCategory('documents');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiClient.initCsrf();
      let payload: FormData | object;
      if (type === 'file' && file) {
        const fd = new FormData();
        fd.append('resource_type', type);
        fd.append('title', title.trim());
        fd.append('description', description.trim());
        fd.append('file', file);
        fd.append('is_template', String(isTemplate));
        fd.append('category', category);
        payload = fd;
      } else {
        payload = {
          resource_type: type,
          title: title.trim(),
          description: description.trim(),
          url: url.trim(),
          body: body.trim(),
          is_template: isTemplate,
          category,
        };
      }
      const resource = await workspacesApi.addResource(workspaceId, payload);
      onAdded(resource);
    } catch (err) {
      if (err instanceof ApiError) {
        const d = err.data as Record<string, string | string[]>;
        setError(String((Array.isArray(d.detail) ? d.detail[0] : d.detail) ?? 'Failed to add resource.'));
      } else {
        setError('Server error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-3.5 py-2.5 text-[13.5px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-gray-300 transition bg-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[16px] font-bold text-gray-900">Add Resource</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">Share material with all workspace members</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700">
            {error}
          </div>
        )}

        {/* Type selector */}
        <div className="flex gap-2 mb-5">
          {(['link', 'file', 'note'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => handleTypeChange(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold rounded-lg border transition-colors capitalize ${
                type === t
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
              }`}
            >
              {TYPE_ICONS[t]} {t}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input type="text" required value={title} onChange={e => setTitle(e.target.value)}
              placeholder={type === 'link' ? 'e.g. IELTS Study Guide' : type === 'file' ? 'e.g. SOP Template' : 'e.g. Grammar Tips'}
              className={inputCls} />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Description</label>
            <input type="text" value={description} onChange={e => setDesc(e.target.value)}
              placeholder="Brief description" className={inputCls} />
          </div>

          {/* Category */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className={inputCls + ' cursor-pointer'}>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {type === 'link' && (
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                URL <span className="text-red-500">*</span>
              </label>
              <input type="url" required value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://" className={inputCls} />
            </div>
          )}

          {type === 'file' && (
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                File <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(max 50 MB)</span>
              </label>
              <input type="file" required onChange={e => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-[13px] text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 file:text-[12px] file:font-semibold cursor-pointer" />
            </div>
          )}

          {type === 'note' && (
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
                Content <span className="text-red-500">*</span>
              </label>
              <textarea rows={5} required value={body} onChange={e => setBody(e.target.value)}
                placeholder="Write your note here…"
                className={inputCls + ' resize-none'} />
            </div>
          )}

          {/* Template toggle */}
          <label className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors">
            <input
              type="checkbox"
              checked={isTemplate}
              onChange={e => setIsTemplate(e.target.checked)}
              className="mt-0.5 accent-amber-600"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <Layers size={13} className="text-amber-600" />
                <p className="text-[12.5px] font-semibold text-amber-800">Mark as template</p>
              </div>
              <p className="text-[11.5px] text-amber-700 mt-0.5">Students will see a "Download template" button to use this as a starting point.</p>
            </div>
          </label>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:text-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-lg shadow-sm transition-colors">
              {loading ? 'Adding…' : 'Add resource'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
