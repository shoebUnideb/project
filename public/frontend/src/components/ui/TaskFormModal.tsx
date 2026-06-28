import { useState } from 'react';
import { X, Calendar, Clock, FileText, Bell } from 'lucide-react';
import { personalTasksApi } from '../../api/personalTasks';
import type { PersonalTask } from '../../types';

const REMINDER_OPTIONS = [
  { value: '',    label: 'No reminder' },
  { value: '0',   label: 'At time of event' },
  { value: '15',  label: '15 minutes before' },
  { value: '30',  label: '30 minutes before' },
  { value: '60',  label: '1 hour before' },
  { value: '120', label: '2 hours before' },
  { value: '1440',label: '1 day before' },
];

interface Props {
  initialDate?: string;
  task?: PersonalTask;
  onSaved: () => void;
  onClose: () => void;
}

export default function TaskFormModal({ initialDate, task, onSaved, onClose }: Props) {
  const [title,          setTitle]          = useState(task?.title ?? '');
  const [date,           setDate]           = useState(task?.date ?? initialDate ?? '');
  const [startTime,      setStartTime]      = useState(task?.start_time?.slice(0, 5) ?? '');
  const [endTime,        setEndTime]        = useState(task?.end_time?.slice(0, 5) ?? '');
  const [description,    setDescription]    = useState(task?.description ?? '');
  const [reminderOffset, setReminderOffset] = useState(
    task?.reminder_offset != null ? String(task.reminder_offset) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const isEdit = !!task;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) { setError('Title and date are required.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload: Partial<PersonalTask> = {
        title:           title.trim(),
        date,
        start_time:      startTime || null,
        end_time:        endTime   || null,
        description:     description.trim(),
        reminder_offset: reminderOffset !== '' ? Number(reminderOffset) : null,
      };
      if (isEdit) {
        await personalTasksApi.update(task.id, { ...payload, reminder_sent: false });
      } else {
        await personalTasksApi.create(payload);
      }
      onSaved();
      onClose();
    } catch {
      setError('Failed to save task. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-[14px] font-bold text-gray-900">
            {isEdit ? 'Edit task' : 'New personal task'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">Title *</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What do you need to do?"
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">
              <span className="flex items-center gap-1.5"><Calendar size={11} /> Date *</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Start + End time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">
                <span className="flex items-center gap-1.5"><Clock size={11} /> Start time</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">End time</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">
              <span className="flex items-center gap-1.5"><FileText size={11} /> Notes</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Reminder */}
          <div>
            <label className="block text-[11.5px] font-semibold text-gray-500 mb-1">
              <span className="flex items-center gap-1.5"><Bell size={11} /> Reminder</span>
            </label>
            <select
              value={reminderOffset}
              onChange={e => setReminderOffset(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              {REMINDER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {reminderOffset !== '' && !startTime && (
              <p className="text-[11px] text-amber-500 mt-1">Set a start time to receive a reminder.</p>
            )}
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[12.5px] font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-[12.5px] font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
