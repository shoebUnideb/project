import { useState } from 'react';
import { Plus, Trash2, Clock } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { sessionsApi } from '../../api/sessions';
import { useApiList } from '../../hooks/useApi';
import type { AvailabilitySlot } from '../../types';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function AvailabilityManager() {
  const { data: slots, refetch } = useApiList(sessionsApi.getSlots);
  const [day, setDay]    = useState(0);
  const [start, setStart] = useState('09:00');
  const [end, setEnd]     = useState('10:00');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const addSlot = async () => {
    if (!start || !end || start >= end) return;
    setAdding(true);
    try {
      await apiClient.initCsrf();
      await sessionsApi.addSlot({ day_of_week: day, start_time: start, end_time: end });
      refetch();
      setShowForm(false);
    } finally {
      setAdding(false);
    }
  };

  const removeSlot = async (id: number) => {
    await apiClient.initCsrf();
    await sessionsApi.deleteSlot(id);
    refetch();
  };

  const grouped = DAY_NAMES.reduce<Record<number, AvailabilitySlot[]>>((acc, _, i) => {
    acc[i] = slots.filter(s => s.day_of_week === i);
    return acc;
  }, {} as Record<number, AvailabilitySlot[]>);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-gray-400" />
          <span className="text-[12px] text-gray-500">Set when you're available for 1:1 sessions</span>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <Plus size={12} /> Add slot
        </button>
      </div>

      {showForm && (
        <div className="flex items-end gap-2 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Day</label>
            <select
              value={day}
              onChange={e => setDay(Number(e.target.value))}
              className="px-2.5 py-2 text-[12px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {DAY_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">From</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)}
              className="px-2.5 py-2 text-[12px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">To</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)}
              className="px-2.5 py-2 text-[12px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <button
            onClick={addSlot}
            disabled={adding}
            className="px-3 py-2 text-[12px] font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-lg"
          >
            {adding ? '…' : 'Add'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {DAY_NAMES.map((name, i) => (
          grouped[i].length > 0 ? (
            <div key={i} className="flex items-center gap-3">
              <span className="w-24 text-[12px] font-medium text-gray-500">{name}</span>
              <div className="flex flex-wrap gap-1.5">
                {grouped[i].map(slot => (
                  <div key={slot.id} className="flex items-center gap-1 px-2.5 py-1 bg-primary-50 border border-primary-100 rounded-lg text-[11.5px] text-primary-700">
                    {slot.start_time} – {slot.end_time}
                    <button onClick={() => removeSlot(slot.id)} className="ml-0.5 text-primary-400 hover:text-red-500">
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        ))}
        {slots.length === 0 && !showForm && (
          <p className="text-[12px] text-gray-400 italic">No availability set yet.</p>
        )}
      </div>
    </div>
  );
}
