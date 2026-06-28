import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Pencil, Trash2, Check } from 'lucide-react';
import { useApiList } from '../../hooks/useApi';
import { sessionsApi } from '../../api/sessions';
import { personalTasksApi } from '../../api/personalTasks';
import TaskFormModal from './TaskFormModal';
import type { PersonalTask } from '../../types';

interface CalEvent {
  label: string;
  type: 'session' | 'task';
  time?: string;
  sub?: string;
  task?: PersonalTask;
}

const DAY_LABELS  = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function toDateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function CalendarCard() {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(
    toDateKey(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showForm,  setShowForm]  = useState(false);
  const [editTask,  setEditTask]  = useState<PersonalTask | undefined>();

  const { data: sessions }     = useApiList(sessionsApi.list);
  const { data: tasks, refetch: refetchTasks } = useApiList(personalTasksApi.list);

  // Build event map
  const eventMap = new Map<string, CalEvent[]>();
  const push = (key: string, evt: CalEvent) => {
    if (!eventMap.has(key)) eventMap.set(key, []);
    eventMap.get(key)!.push(evt);
  };

  sessions.forEach(s => {
    if (s.status === 'cancelled') return;
    push(s.date, {
      label: s.title || 'Session',
      type: 'session',
      time: s.start_time ? formatTime(s.start_time) : undefined,
      sub: `${s.mentor?.first_name ?? ''} ${s.mentor?.last_name ?? ''}`.trim() || undefined,
    });
  });

  tasks.forEach(t =>
    push(t.date, {
      label: t.title,
      type: 'task',
      time: t.start_time ? formatTime(t.start_time) : undefined,
      sub: t.description || undefined,
      task: t,
    } as CalEvent & { task: PersonalTask })
  );

  // Grid
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const prevMonth = () => viewMonth === 0 ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0)) : setViewMonth(m => m + 1);

  const selectedEvents = selectedKey ? (eventMap.get(selectedKey) ?? []) : [];
  const selectedDate   = selectedKey ? new Date(selectedKey + 'T00:00:00') : null;

  const handleDelete = async (id: number) => {
    await personalTasksApi.delete(id);
    setConfirmDeleteId(null);
    refetchTasks();
  };

  const handleToggleDone = async (t: PersonalTask) => {
    await personalTasksApi.update(t.id, { is_done: !t.is_done });
    refetchTasks();
  };

  return (
    <>
      <div className="bg-white border border-[#e0e0e0] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <CalendarDays size={15} className="text-gray-500" />
            <p className="text-[14px] font-bold text-gray-900">Calendar</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"><ChevronLeft size={15} /></button>
            <span className="text-[13px] font-semibold text-gray-700 w-32 text-center">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"><ChevronRight size={15} /></button>
          </div>
        </div>

        <div className="p-4">
          {/* Day labels */}
          <div className="grid grid-cols-7 mb-2">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-[11.5px] font-semibold text-gray-400 py-1.5">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const key         = toDateKey(viewYear, viewMonth, day);
              const isToday     = key === todayKey;
              const isSelected  = key === selectedKey;
              const evts        = eventMap.get(key) ?? [];
              const hasSession  = evts.some(e => e.type === 'session');
              const hasTask     = evts.some(e => e.type === 'task');

              return (
                <button
                  key={key}
                  onClick={() => setSelectedKey(isSelected ? null : key)}
                  className={[
                    'relative flex flex-col items-center justify-center rounded-lg py-2 text-[13px] font-medium transition-colors',
                    isSelected ? 'bg-primary-600 text-white'
                      : isToday ? 'bg-primary-50 text-primary-700 font-bold'
                      : 'text-gray-700 hover:bg-gray-100',
                  ].join(' ')}
                >
                  {day}
                  {(hasSession || hasTask) && (
                    <div className="flex gap-0.5 mt-1">
                      {hasSession  && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : 'bg-primary-500'}`} />}
                      {hasTask     && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : 'bg-violet-500'}`} />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 px-1">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary-500 shrink-0" /><span className="text-[11.5px] text-gray-400">Session</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" /><span className="text-[11.5px] text-gray-400">My task</span></div>
          </div>
        </div>

        {/* Selected day panel */}
        {selectedKey && (
          <div className="border-t border-gray-100">
            {/* Day header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
              <button
                onClick={() => { setEditTask(undefined); setShowForm(true); }}
                className="flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-semibold text-primary-600 bg-white border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
              >
                <Plus size={11} /> Add task
              </button>
            </div>

            {/* Event list */}
            <div className="px-3 py-2 space-y-1">
              {selectedEvents.length === 0 ? (
                <p className="text-[12px] text-gray-400 py-2 px-1">No events — add a personal task above.</p>
              ) : selectedEvents.map((evt, i) => {
                const isConfirming = evt.task && confirmDeleteId === evt.task.id;

                return (
                  <div
                    key={i}
                    className={[
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors group',
                      evt.type === 'task'
                        ? evt.task?.is_done
                          ? 'bg-gray-50 border-gray-100'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                        : 'bg-white border-gray-100',
                    ].join(' ')}
                  >
                    {/* Left indicator / checkbox */}
                    {evt.type === 'task' ? (
                      <button
                        onClick={() => evt.task && handleToggleDone(evt.task)}
                        className={[
                          'shrink-0 w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-all',
                          evt.task?.is_done
                            ? 'bg-violet-500 border-violet-500 text-white'
                            : 'border-gray-300 hover:border-violet-400 bg-white',
                        ].join(' ')}
                        style={{ width: 18, height: 18 }}
                      >
                        {evt.task?.is_done && <Check size={10} strokeWidth={3} />}
                      </button>
                    ) : (
                      <span className="shrink-0 w-2 h-2 rounded-full mt-0.5 bg-primary-400" />
                    )}

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12.5px] font-semibold leading-snug truncate ${evt.task?.is_done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {evt.label}
                      </p>
                      {(evt.time || (evt.type !== 'task' && evt.sub)) && (
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {[evt.time, evt.type !== 'task' ? evt.sub : null].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>

                    {/* Task actions */}
                    {evt.type === 'task' && evt.task && (
                      isConfirming ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-red-500 font-semibold">Delete?</span>
                          <button
                            onClick={() => handleDelete(evt.task!.id)}
                            className="px-2 py-0.5 text-[11px] font-semibold bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditTask(evt.task); setShowForm(true); }}
                            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            title="Edit"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(evt.task!.id)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <TaskFormModal
          initialDate={selectedKey ?? undefined}
          task={editTask}
          onSaved={refetchTasks}
          onClose={() => { setShowForm(false); setEditTask(undefined); }}
        />
      )}
    </>
  );
}
