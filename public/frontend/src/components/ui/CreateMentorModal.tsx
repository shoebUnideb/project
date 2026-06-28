import { useState, type FormEvent } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { usersApi, type CreateMentorPayload } from '../../api/users';
import { ApiError } from '../../api/apiClient';
import apiClient from '../../api/apiClient';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const empty: CreateMentorPayload & { password: string } = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  password: '',
};

export default function CreateMentorModal({ onClose, onCreated }: Props) {
  const [form, setForm]     = useState(empty);
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      await apiClient.initCsrf();
      await usersApi.create(form);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as Record<string, string | string[]>;
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(data)) {
          flat[k] = Array.isArray(v) ? v[0] : v;
        }
        setErrors(flat);
      } else {
        setErrors({ non_field_errors: 'Server error. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full px-3.5 py-2.5 text-[13.5px] bg-white border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-gray-300 transition ${
      errors[field] ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[16px] font-bold text-gray-900">Create Mentor Account</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Account will be pending until you approve it.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {errors.non_field_errors && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700">
            {errors.non_field_errors}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">First name</label>
              <input type="text" value={form.first_name} onChange={set('first_name')}
                placeholder="Jane" className={inputClass('first_name')} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">Last name</label>
              <input type="text" value={form.last_name} onChange={set('last_name')}
                placeholder="Doe" className={inputClass('last_name')} />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
              Username <span className="text-red-500">*</span>
            </label>
            <input type="text" required value={form.username} onChange={set('username')}
              placeholder="e.g. mentor_jane" className={inputClass('username')} />
            {errors.username && <p className="mt-1 text-[12px] text-red-600">{errors.username}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input type="email" required value={form.email} onChange={set('email')}
              placeholder="jane@example.com" className={inputClass('email')} />
            {errors.email && <p className="mt-1 text-[12px] text-red-600">{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1.5">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} required value={form.password}
                onChange={set('password')} placeholder="••••••••"
                className={`${inputClass('password')} pr-10`} />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-[12px] text-red-600">{errors.password}</p>}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:text-gray-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-lg shadow-sm transition-colors">
              {loading ? 'Creating…' : 'Create mentor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
