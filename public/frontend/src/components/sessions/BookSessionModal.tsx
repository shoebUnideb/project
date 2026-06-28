import { useState } from 'react';
import { X, Calendar, Clock, Video } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { sessionsApi } from '../../api/sessions';
import { useApi } from '../../hooks/useApi';
import type { AvailabilitySlot, MentorSession } from '../../types';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface Props {
  mentorId: number;
  mentorName: string;
  onClose: () => void;
  onBooked: (s: MentorSession) => void;
}

function nextDateForDay(dayOfWeek: number): string {
  const today = new Date();
  const current = today.getDay() === 0 ? 6 : today.getDay() - 1; // convert Sun=0 to Mon=0
  let diff = dayOfWeek - current;
  if (diff <= 0) diff += 7;
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  return target.toISOString().slice(0, 10);
}

export default function BookSessionModal({ mentorId, mentorName, onClose, onBooked }: Props) {
  const { data: slots } = useApi(() => sessionsApi.getSlots(mentorId), [mentorId]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [selectedDate, setSelectedDate]  = useState('');
  const [title, setTitle]               = useState('Mentorship session');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  const availableSlots = slots ?? [];

  const book = async () => {
    if (!selectedSlot || !selectedDate) { setError('Pick a date and time slot.'); return; }
    setSaving(true);
    setError('');
    try {
      await apiClient.initCsrf();
      const sess = await sessionsApi.book({
        mentor_id:  mentorId,
        date:       selectedDate,
        start_time: selectedSlot.start_time,
        end_time:   selectedSlot.end_time,
        title,
      });
      onBooked(sess);
    } catch {
      setError('Failed to book session. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-[14px] font-bold text-gray-900">Book a session with {mentorName}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Session title */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Session topic</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2.5 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Pick a slot */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                <Clock size={10} className="inline mr-1" /> Available slots
              </label>
              {availableSlots.length === 0 ? (
                <p className="text-[12px] text-gray-400 italic">This mentor has not set availability yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {availableSlots.map(slot => (
                    <button
                      key={slot.id}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setSelectedDate(nextDateForDay(slot.day_of_week));
                      }}
                      className={[
                        'px-3 py-2.5 text-[12px] rounded-lg border text-left transition-colors',
                        selectedSlot?.id === slot.id
                          ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600',
                      ].join(' ')}
                    >
                      <p className="font-medium">{DAY_NAMES[slot.day_of_week]}</p>
                      <p className="text-[11px] text-gray-500">{slot.start_time} – {slot.end_time}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date picker */}
            {selectedSlot && (
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                  <Calendar size={10} className="inline mr-1" /> Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}

            {error && <p className="text-[12px] text-red-500">{error}</p>}
          </div>

          <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-[13px] text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button
              onClick={book}
              disabled={saving || !selectedSlot || !selectedDate}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-lg"
            >
              <Video size={14} /> {saving ? 'Booking…' : 'Book session'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
