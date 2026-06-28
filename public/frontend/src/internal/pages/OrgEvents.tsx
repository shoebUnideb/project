import { useState, useEffect, useMemo } from 'react';
import {
  Calendar, MapPin, Video, Users, Plus, Pencil, Trash2,
  X, CheckCircle2, Clock, ChevronLeft, ChevronRight,
  Download, Search, SlidersHorizontal,
  UserPlus, Tag, Settings2, MoreHorizontal, Check,
} from 'lucide-react';
import {
  eventsApi, eventTypesApi, eventSettingsApi, orgApi,
  type OrgEvent, type RSVPStatus, type EventAttendance,
  type EventTypeConfig, type EventSettingsData, type OrgMember,
} from '../api/orgApi';
import { useOrg } from '../context/OrgContext';
import PageHelp, { type PageHelpSection } from '../components/PageHelp';

const EVENTS_HELP: PageHelpSection[] = [
  {
    eyebrow: '1 · What is an Event?',
    bullets: [
      'An **event** is anything you schedule for your team — meetings, orientations, training sessions, town halls.',
      'Events can be **virtual** (with a meeting link), **in-person** (with a physical address), or **hybrid**.',
      'Each event has a **type** (e.g., Meeting, Orientation, Training) — types are configurable from Settings.',
    ],
  },
  {
    eyebrow: '2 · Create an Event',
    bullets: [
      'Click **+ Create New Event** in the top right.',
      'Fill in the **name, type, date/time, location, and description**.',
      'Choose a **target audience** — everyone, a department, or specific members.',
      'Toggle **Send invites** to email everyone targeted as soon as you save.',
    ],
  },
  {
    eyebrow: '3 · Track Registrations & RSVPs',
    bullets: [
      'Each row shows **how many have registered** out of how many were invited.',
      'Click a row to open the **event detail panel** — see who responded Yes/No/Maybe, who hasn\'t replied yet, and a check-in list on the day.',
      'Use **Send Reminder** to ping members who haven\'t responded.',
    ],
  },
  {
    eyebrow: '4 · Recurring Events & Meetings',
    bullets: [
      'For weekly stand-ups or monthly all-hands, use **Create Recurring Event** in Quick Actions.',
      'Recurring events spawn one row per occurrence — edit one without affecting the rest, or use **Edit Series** to update them all.',
      'The **Meetings** tab focuses on one-on-ones and short calls separately from larger events.',
    ],
  },
  {
    eyebrow: '5 · Calendar & Reports',
    bullets: [
      'The right-side **Calendar** highlights the current day and dots days with scheduled events.',
      'Use **Export Report** to download attendance and registration data as CSV.',
      'Past events stay searchable in the **Past Events** tab — useful for audit and historical reporting.',
    ],
  },
  {
    eyebrow: 'Tip',
    body: 'Link events to onboarding programs — when an onboarding task is a "meeting" type, the event you create here becomes the meeting it links to.',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const RSVP_LABEL: Record<RSVPStatus, string> = {
  accepted: 'Accepted', declined: 'Declined', maybe: 'Maybe', no_response: 'No Response',
};

function getTypeLabel(slug: string, types: EventTypeConfig[]): string {
  return types.find(t => t.slug === slug)?.label ?? slug;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function fmtDtFull(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}
function eventStatus(e: OrgEvent): 'Upcoming' | 'Ongoing' | 'Completed' {
  const now = new Date();
  const start = new Date(e.start_dt);
  const end   = new Date(e.end_dt);
  if (now < start) return 'Upcoming';
  if (now <= end)  return 'Ongoing';
  return 'Completed';
}
function duration(e: OrgEvent): string {
  const ms = new Date(e.end_dt).getTime() - new Date(e.start_dt).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} mins`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function exportCsv(events: OrgEvent[], types: EventTypeConfig[]) {
  const header = ['Title', 'Type', 'Date', 'Start', 'End', 'Location', 'Organizer', 'Target Audience', 'Status', 'Registered'];
  const rows = events.map(e => [
    `"${e.title}"`,
    getTypeLabel(e.event_type, types),
    fmtDate(e.start_dt),
    fmtTime(e.start_dt),
    fmtTime(e.end_dt),
    `"${e.location || ''}"`,
    `"${e.organizer_name}"`,
    `"${e.target_audience || ''}"`,
    eventStatus(e),
    e.max_attendees ? `${e.rsvp_count}/${e.max_attendees}` : String(e.rsvp_count),
  ]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'events_report.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── Mini Calendar (sidebar) ───────────────────────────────────────────────────

function MiniCalendar({ events, onDayClick, selectedDate }: {
  events: OrgEvent[];
  onDayClick?: (date: Date) => void;
  selectedDate?: Date | null;
}) {
  const [current, setCurrent] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year  = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Use the ISO date string directly (YYYY-MM-DD) to avoid UTC→local day shifts
  const eventsByDay = useMemo<Record<number, string[]>>(() => {
    const map: Record<number, string[]> = {};
    for (const e of events) {
      if (!e.start_dt) continue;
      const datePart = e.start_dt.slice(0, 10); // "2026-06-27"
      const [eYear, eMonth, eDay] = datePart.split('-').map(Number);
      if (eYear === year && eMonth - 1 === month) {
        if (!map[eDay]) map[eDay] = [];
        map[eDay].push(e.event_type);
      }
    }
    return map;
  }, [events, year, month]);

  const today = new Date();
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1;

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="p-1 rounded hover:bg-gray-100 text-gray-400">
          <ChevronLeft size={13} />
        </button>
        <span className="text-[12px] font-bold text-gray-800">
          {current.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="p-1 rounded hover:bg-gray-100 text-gray-400">
          <ChevronRight size={13} />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-gray-400 py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} className="h-8" />;
          const dots = eventsByDay[day] ?? [];
          const isToday = day === todayDay;
          const isSelected = selectedDate &&
            selectedDate.getFullYear() === year &&
            selectedDate.getMonth() === month &&
            selectedDate.getDate() === day;
          return (
            <button
              key={day}
              onClick={() => onDayClick && onDayClick(new Date(year, month, day))}
              className={`h-8 flex flex-col items-center justify-start pt-0.5 rounded-lg text-[11px] font-semibold transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                  : isToday
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {day}
              {dots.length > 0 && (
                <div className="flex gap-px mt-0.5">
                  {dots.slice(0, 3).map((_, j) => (
                    <div key={j} className={`w-1 h-1 rounded-full ${isSelected || isToday ? 'bg-white/70' : 'bg-gray-400'}`} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100">
        {['Meeting', 'Training', 'Orientation'].map(t => (
          <div key={t} className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            <span className="text-[10px] text-gray-400">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Event Form Modal ──────────────────────────────────────────────────────────

const BLANK: Partial<OrgEvent> = {
  title: '', description: '', event_type: 'meeting',
  start_dt: '', end_dt: '', location: '', virtual_link: '',
  target_audience: '', max_attendees: null,
};

function EventModal({
  initial,
  defaultType,
  eventTypes,
  onClose,
  onSaved,
}: {
  initial?: OrgEvent;
  defaultType?: string;
  eventTypes: EventTypeConfig[];
  onClose: () => void;
  onSaved: (e: OrgEvent) => void;
}) {
  const [form, setForm] = useState<Partial<OrgEvent>>(initial ?? {
    ...BLANK,
    event_type: defaultType ?? 'meeting',
  });
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [allMembers, setAllMembers]       = useState<OrgMember[]>([]);
  const [memberSearch, setMemberSearch]   = useState('');
  const [pickerOpen, setPickerOpen]       = useState(false);
  const [assignedIds, setAssignedIds]     = useState<number[]>(initial?.assigned_member_ids ?? []);

  useEffect(() => {
    orgApi.getMembers({ status: 'active' }).then(setAllMembers).catch(() => {});
  }, []);

  const set = (k: keyof OrgEvent, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const assignedMembers = allMembers.filter(m => assignedIds.includes(m.user.id));
  const searchResults = memberSearch.trim()
    ? allMembers.filter(m =>
        !assignedIds.includes(m.user.id) &&
        (m.user.display_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
         m.user.email.toLowerCase().includes(memberSearch.toLowerCase()))
      ).slice(0, 8)
    : [];

  const addMember = (m: OrgMember) => {
    setAssignedIds(prev => [...prev, m.user.id]);
    setMemberSearch('');
    setPickerOpen(false);
  };

  const removeMember = (userId: number) => {
    setAssignedIds(prev => prev.filter(id => id !== userId));
  };

  const submit = async () => {
    if (!form.title?.trim() || !form.start_dt || !form.end_dt) {
      setError('Title, start time, and end time are required.');
      return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        assigned_member_ids: assignedIds,
      };
      const saved = initial
        ? await eventsApi.updateEvent(initial.id, payload)
        : await eventsApi.createEvent(payload);
      onSaved(saved);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-[14px] font-bold text-gray-900">{initial ? 'Edit Event' : 'New Event'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
          <div>
            <label className="block text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Title *</label>
            <input value={form.title ?? ''} onChange={e => set('title', e.target.value)}
              className="w-full px-3 py-1.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="Event title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Type</label>
              <select value={form.event_type} onChange={e => set('event_type', e.target.value)}
                className="w-full px-3 py-1.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300">
                {eventTypes.filter(t => t.is_active).map(t => (
                  <option key={t.slug} value={t.slug}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Target Audience</label>
              <input value={form.target_audience ?? ''} onChange={e => set('target_audience', e.target.value)}
                className="w-full px-3 py-1.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="e.g. New Hires" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Start *</label>
              <input type="datetime-local" value={form.start_dt?.slice(0, 16) ?? ''} onChange={e => set('start_dt', e.target.value)}
                className="w-full px-3 py-1.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1">End *</label>
              <input type="datetime-local" value={form.end_dt?.slice(0, 16) ?? ''} onChange={e => set('end_dt', e.target.value)}
                className="w-full px-3 py-1.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Location</label>
              <input value={form.location ?? ''} onChange={e => set('location', e.target.value)}
                className="w-full px-3 py-1.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="Room / address" />
            </div>
            <div>
              <label className="block text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Max Attendees</label>
              <input type="number" min={0} value={form.max_attendees ?? ''} onChange={e => set('max_attendees', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-1.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="Unlimited" />
            </div>
          </div>
          <div>
            <label className="block text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Virtual Link</label>
            <input value={form.virtual_link ?? ''} onChange={e => set('virtual_link', e.target.value)}
              className="w-full px-3 py-1.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
              placeholder="https://meet.google.com/…" />
          </div>
          <div>
            <label className="block text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
            <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)} rows={3}
              className="w-full px-3 py-1.5 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none"
              placeholder="Optional details…" />
          </div>

          {/* ── Assign to specific members ── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide">
                Assign to Specific Members
              </label>
              <span className="text-[10px] text-gray-400">
                {assignedIds.length === 0 ? 'Visible to everyone' : `${assignedIds.length} member${assignedIds.length !== 1 ? 's' : ''} only`}
              </span>
            </div>

            {/* Selected member pills */}
            {assignedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {assignedMembers.map(m => (
                  <span key={m.user.id} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-gray-100 text-gray-700 rounded-full text-[11.5px] font-medium">
                    <span className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[9px] font-bold text-gray-600 shrink-0">
                      {m.user.display_name.charAt(0).toUpperCase()}
                    </span>
                    {m.user.display_name}
                    <button onClick={() => removeMember(m.user.id)} className="text-gray-400 hover:text-gray-700 ml-0.5">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search input */}
            <div className="relative">
              <div className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus-within:ring-2 focus-within:ring-gray-300 focus-within:border-transparent">
                <Search size={12} className="text-gray-400 shrink-0" />
                <input
                  value={memberSearch}
                  onChange={e => { setMemberSearch(e.target.value); setPickerOpen(true); }}
                  onFocus={() => setPickerOpen(true)}
                  onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
                  placeholder="Search members to assign…"
                  className="flex-1 text-[12.5px] bg-transparent focus:outline-none text-gray-700 placeholder-gray-400"
                />
                {assignedIds.length > 0 && (
                  <button onClick={() => setAssignedIds([])} className="text-[10px] text-gray-400 hover:text-red-500 shrink-0">Clear all</button>
                )}
              </div>
              {pickerOpen && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                  {searchResults.map(m => (
                    <button
                      key={m.user.id}
                      onMouseDown={() => addMember(m)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-gray-50 text-left"
                    >
                      <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">
                        {m.user.display_name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-gray-800 truncate">{m.user.display_name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{m.user.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[10.5px] text-gray-400 mt-1">
              Leave empty to make this event visible to all members.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-1.5 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-4 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-60 rounded-lg">
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Event Detail Drawer ───────────────────────────────────────────────────────

function EventDrawer({
  event, isAdmin, eventTypes, onClose, onUpdated, onDeleted,
}: {
  event: OrgEvent; isAdmin: boolean;
  eventTypes: EventTypeConfig[];
  onClose: () => void;
  onUpdated: (e: OrgEvent) => void;
  onDeleted: (id: number) => void;
}) {
  const [detail, setDetail]     = useState<OrgEvent>(event);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [rsvpErr, setRsvpErr]   = useState('');
  const [markSaving, setMarkSaving] = useState<number | null>(null);
  const [markErr, setMarkErr]   = useState('');
  const [deleteErr, setDeleteErr] = useState('');

  useEffect(() => {
    eventsApi.getEvent(event.id).then(setDetail).catch(() => {}).finally(() => setLoading(false));
  }, [event.id]);

  const handleDelete = async () => {
    setDeleting(true); setDeleteErr('');
    try { await eventsApi.deleteEvent(detail.id); onDeleted(detail.id); }
    catch { setDeleteErr('Failed to delete.'); }
    finally { setDeleting(false); }
  };

  const handleRSVP = async (rsvp: RSVPStatus) => {
    setRsvpSaving(true); setRsvpErr('');
    try {
      await eventsApi.rsvp(detail.id, rsvp);
      const fresh = await eventsApi.getEvent(detail.id);
      setDetail(fresh);
      onUpdated(fresh);
    } catch { setRsvpErr('Failed to save RSVP.'); }
    finally { setRsvpSaving(false); }
  };

  const handleMarkAttended = async (a: EventAttendance, attended: boolean) => {
    setMarkSaving(a.user_id); setMarkErr('');
    try {
      const updated = await eventsApi.markAttended(detail.id, a.user_id, attended);
      setDetail(d => ({
        ...d,
        attendances: d.attendances?.map(att => att.user_id === a.user_id ? updated : att),
      }));
    } catch { setMarkErr('Failed to update attendance.'); }
    finally { setMarkSaving(null); }
  };

  const status = eventStatus(detail);

  return (
    <>
      {/* ── 80% centred modal ── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
        <div
          className="bg-white rounded-2xl shadow-2xl w-[80vw] max-w-5xl h-[82vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-7 py-4 border-b border-gray-100 shrink-0">
            <div className="min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wide bg-gray-100 px-2 py-0.5 rounded-full">
                  {getTypeLabel(detail.event_type, eventTypes)}
                </span>
                {detail.is_recurring && (
                  <span className="text-[10.5px] text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">Recurring</span>
                )}
                <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${
                  status === 'Completed' ? 'bg-gray-100 text-gray-400' :
                  status === 'Ongoing'   ? 'bg-blue-50 text-blue-700' :
                                          'bg-emerald-50 text-emerald-700'
                }`}>
                  {status}
                </span>
              </div>
              <h2 className="text-[18px] font-bold text-gray-900 leading-snug">{detail.title}</h2>
            </div>
            <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 mt-0.5">
              <X size={16} />
            </button>
          </div>

          {/* Body — two columns */}
          <div className="flex-1 overflow-hidden flex min-h-0">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="space-y-3 w-64">
                  {[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />)}
                </div>
              </div>
            ) : (
              <>
                {/* Left column — event details */}
                <div className="flex-1 overflow-y-auto px-7 py-5 space-y-4 border-r border-gray-100">
                  {/* Time */}
                  <div className="flex items-start gap-3">
                    <Clock size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[13px] font-semibold text-gray-800">{fmtDtFull(detail.start_dt)}</p>
                      <p className="text-[12px] text-gray-400 mt-0.5">to {fmtDtFull(detail.end_dt)} · {duration(detail)}</p>
                    </div>
                  </div>

                  {/* Location */}
                  {detail.location && (
                    <div className="flex items-center gap-3">
                      <MapPin size={14} className="text-gray-400 shrink-0" />
                      <p className="text-[13px] text-gray-700">{detail.location}</p>
                    </div>
                  )}

                  {/* Virtual link */}
                  {detail.virtual_link && (
                    <div className="flex items-center gap-3">
                      <Video size={14} className="text-gray-400 shrink-0" />
                      <a href={detail.virtual_link} target="_blank" rel="noopener noreferrer"
                        className="text-[13px] text-blue-700 hover:underline font-medium">
                        Join meeting →
                      </a>
                    </div>
                  )}

                  {/* Organizer */}
                  <div className="flex items-center gap-3">
                    <Users size={14} className="text-gray-400 shrink-0" />
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[13px] text-gray-600">{detail.organizer_name || '—'}</span>
                      {detail.target_audience && (
                        <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          Audience: {detail.target_audience}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Assigned members */}
                  {detail.assigned_members_data?.length > 0 && (
                    <div>
                      <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Assigned Members ({detail.assigned_members_data.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {detail.assigned_members_data.map(m => (
                          <span key={m.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-[11.5px] font-medium">
                            <span className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center text-[9px] font-bold">
                              {m.name.charAt(0).toUpperCase()}
                            </span>
                            {m.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {detail.description && (
                    <div>
                      <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Description</p>
                      <p className="text-[13px] text-gray-600 leading-relaxed">{detail.description}</p>
                    </div>
                  )}
                </div>

                {/* Right column — stats + RSVP / attendees */}
                <div className="w-[340px] shrink-0 overflow-y-auto px-6 py-5 space-y-5 bg-gray-50/50">
                  {/* Stats */}
                  <div className="flex items-center gap-5 pb-4 border-b border-gray-100">
                    <div>
                      <p className="text-[10.5px] text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Registered</p>
                      <p className="text-[22px] font-bold text-gray-900 leading-none">
                        {detail.rsvp_count}
                        {detail.max_attendees ? <span className="text-[13px] text-gray-400 font-medium"> / {detail.max_attendees}</span> : ''}
                      </p>
                    </div>
                    {status === 'Completed' && (
                      <div>
                        <p className="text-[10.5px] text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Attended</p>
                        <p className="text-[22px] font-bold text-gray-900 leading-none">
                          {detail.attendances?.filter(a => a.attended).length ?? 0}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* RSVP (member) */}
                  {!isAdmin && (
                    <div>
                      <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Your RSVP</p>
                      <div className="flex flex-col gap-2">
                        {([
                          { val: 'accepted' as RSVPStatus, label: '✓ Going',     active: 'bg-emerald-600 text-white border-emerald-600', hover: 'hover:border-emerald-400 hover:text-emerald-700' },
                          { val: 'maybe'    as RSVPStatus, label: '? Maybe',     active: 'bg-amber-500 text-white border-amber-500',     hover: 'hover:border-amber-400 hover:text-amber-700' },
                          { val: 'declined' as RSVPStatus, label: '✗ Can\'t go', active: 'bg-red-600 text-white border-red-600',         hover: 'hover:border-red-400 hover:text-red-600' },
                        ]).map(r => (
                          <button
                            key={r.val}
                            disabled={rsvpSaving}
                            onClick={() => handleRSVP(r.val)}
                            className={`w-full px-4 py-2 text-[12.5px] font-semibold rounded-lg border transition-colors ${
                              detail.my_rsvp === r.val
                                ? r.active
                                : `border-gray-200 text-gray-600 bg-white ${r.hover}`
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                      {rsvpErr && <p className="text-[11px] text-red-600 mt-2">{rsvpErr}</p>}
                    </div>
                  )}

                  {/* Attendees (admin) */}
                  {isAdmin && (
                    <div>
                      <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
                        Attendees ({detail.attendances?.length ?? 0})
                      </p>
                      {detail.attendances && detail.attendances.length > 0 ? (
                        <div className="space-y-1.5">
                          {detail.attendances.map(a => (
                            <div key={a.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 bg-white rounded-lg border border-gray-100">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                  <span className="text-[11px] font-bold text-gray-500">
                                    {a.user_name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[12px] font-semibold text-gray-700 truncate">{a.user_name}</p>
                                  <p className="text-[10.5px] text-gray-400">{RSVP_LABEL[a.rsvp]}</p>
                                </div>
                              </div>
                              <button
                                disabled={markSaving === a.user_id}
                                onClick={() => handleMarkAttended(a, !a.attended)}
                                className={`shrink-0 flex items-center gap-1 text-[10.5px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
                                  a.attended
                                    ? 'bg-gray-900 text-white border-gray-900'
                                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-700'
                                }`}
                              >
                                <CheckCircle2 size={10} />
                                {a.attended ? 'Attended' : 'Mark'}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[12px] text-gray-400">No RSVPs yet.</p>
                      )}
                      {markErr && <p className="text-[11px] text-red-600 mt-1">{markErr}</p>}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer — admin actions */}
          {isAdmin && (
            <div className="border-t border-gray-100 shrink-0">
              {confirmDel ? (
                <div className="px-7 py-3.5 bg-gray-50 flex items-center gap-3">
                  <p className="text-[12.5px] text-gray-700 font-medium flex-1">Delete this event? This cannot be undone.</p>
                  <button onClick={() => { setConfirmDel(false); setDeleteErr(''); }} disabled={deleting}
                    className="px-3 py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-white rounded-lg border border-gray-200">Cancel</button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-60 rounded-lg">
                    {deleting ? 'Deleting…' : 'Confirm Delete'}
                  </button>
                  {deleteErr && <p className="text-[11px] text-red-600">{deleteErr}</p>}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-7 py-3.5">
                  <button onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg">
                    <Pencil size={12} /> Edit Event
                  </button>
                  <button onClick={() => setConfirmDel(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <EventModal
          initial={detail}
          eventTypes={eventTypes}
          onClose={() => setEditing(false)}
          onSaved={e => { setDetail(e); onUpdated(e); setEditing(false); }}
        />
      )}
    </>
  );
}

// ── Event Table ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 5;

function EventTable({
  events,
  isAdmin,
  eventTypes,
  onRowClick,
  onEdit,
  onDelete,
}: {
  events: OrgEvent[];
  isAdmin: boolean;
  eventTypes: EventTypeConfig[];
  onRowClick: (e: OrgEvent) => void;
  onEdit: (e: OrgEvent) => void;
  onDelete: (e: OrgEvent) => void;
}) {
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const pageEvents = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when events list changes
  useEffect(() => { setPage(1); }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <Calendar size={28} className="text-gray-300 mb-3" />
        <p className="text-[13px] font-semibold text-gray-500">No events found</p>
        <p className="text-[12px] text-gray-400 mt-0.5">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div>
      {/* Table — fixed rows height so card never resizes */}
      <div className="h-[360px] overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="py-2 pr-4 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide w-14" />
            <th className="py-2 pr-4 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide">Event Name</th>
            <th className="py-2 pr-4 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide">Type</th>
            <th className="py-2 pr-4 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide">Date & Time</th>
            <th className="py-2 pr-4 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide">Organized By</th>
            <th className="py-2 pr-4 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide">Target Audience</th>
            <th className="py-2 pr-4 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
            <th className="py-2 pr-4 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide">{isAdmin ? 'Registered' : 'My RSVP'}</th>
            {isAdmin && <th className="py-2 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide w-10" />}
          </tr>
        </thead>
        <tbody>
          {pageEvents.map(e => {
            const status = eventStatus(e);
            return (
              <tr
                key={e.id}
                onClick={() => { setOpenMenu(null); onRowClick(e); }}
                className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                {/* Date block */}
                <td className="py-2 pr-4">
                  <div className="w-10 flex flex-col items-center bg-gray-50 rounded-lg py-1.5 border border-gray-100">
                    <span className="text-[9.5px] font-bold text-gray-400 uppercase leading-tight">
                      {new Date(e.start_dt).toLocaleString('en-US', { month: 'short' })}
                    </span>
                    <span className="text-[17px] font-bold text-gray-800 leading-tight">
                      {new Date(e.start_dt).getDate()}
                    </span>
                  </div>
                </td>
                {/* Name */}
                <td className="py-2 pr-4 max-w-[200px]">
                  <p className="text-[12.5px] font-semibold text-gray-900 leading-snug truncate">{e.title}</p>
                  {e.description && (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{e.description}</p>
                  )}
                </td>
                {/* Type */}
                <td className="py-2 pr-4">
                  <span className="text-[12px] text-gray-600">{getTypeLabel(e.event_type, eventTypes)}</span>
                </td>
                {/* Date & Time */}
                <td className="py-2 pr-4 whitespace-nowrap">
                  <p className="text-[12px] text-gray-700">{fmtDate(e.start_dt)}</p>
                  <p className="text-[11px] text-gray-400">{fmtTime(e.start_dt)} – {fmtTime(e.end_dt)}</p>
                </td>
                {/* Organizer */}
                <td className="py-2 pr-4">
                  <span className="text-[12px] text-gray-600">{e.organizer_name || '—'}</span>
                </td>
                {/* Audience */}
                <td className="py-2 pr-4">
                  <span className="text-[12px] text-gray-600">{e.target_audience || '—'}</span>
                </td>
                {/* Status */}
                <td className="py-2 pr-4">
                  <span className={`text-[12px] font-semibold ${
                    status === 'Upcoming'  ? 'text-gray-800' :
                    status === 'Ongoing'   ? 'text-gray-900' :
                    'text-gray-400'
                  }`}>{status}</span>
                </td>
                {/* Registered / My RSVP */}
                <td className="py-2 pr-4">
                  {isAdmin ? (
                    <span className="text-[12px] text-gray-600">
                      {e.rsvp_count}
                      {e.max_attendees ? ` / ${e.max_attendees}` : ''}
                    </span>
                  ) : (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      e.my_rsvp === 'accepted'    ? 'bg-emerald-100 text-emerald-700' :
                      e.my_rsvp === 'declined'    ? 'bg-red-100 text-red-600' :
                      e.my_rsvp === 'maybe'       ? 'bg-amber-100 text-amber-700' :
                                                    'bg-gray-100 text-gray-500'
                    }`}>
                      {e.my_rsvp === 'accepted' ? '✓ Going' :
                       e.my_rsvp === 'declined' ? '✗ Declined' :
                       e.my_rsvp === 'maybe'    ? '? Maybe' :
                                                  'Not yet'}
                    </span>
                  )}
                </td>
                {/* Actions */}
                {isAdmin && (
                  <td className="py-2 relative" onClick={ev => ev.stopPropagation()}>
                    <button
                      onClick={() => setOpenMenu(openMenu === e.id ? null : e.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {openMenu === e.id && (
                      <div className="absolute right-0 top-8 z-20 w-32 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                        <button onClick={() => { setOpenMenu(null); onEdit(e); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
                          <Pencil size={11} /> Edit
                        </button>
                        <button onClick={() => { setOpenMenu(null); onDelete(e); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-gray-600 hover:bg-gray-50">
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>{/* end fixed-height rows */}

      {/* Pagination */}
      <div className="flex items-center justify-between pt-3 mt-1">
        <span className="text-[11.5px] text-gray-400">
          Showing {Math.min((page - 1) * PAGE_SIZE + 1, events.length)} to {Math.min(page * PAGE_SIZE, events.length)} of {events.length} events
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30">
            <ChevronLeft size={13} />
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const p = totalPages <= 5 ? i + 1 :
              page <= 3 ? i + 1 :
              page >= totalPages - 2 ? totalPages - 4 + i :
              page - 2 + i;
            return (
              <button key={p} onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-[11.5px] font-semibold transition-colors ${
                  page === p ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}>
                {p}
              </button>
            );
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30">
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────

function DeleteConfirmModal({
  event,
  onCancel,
  onConfirm,
}: {
  event: OrgEvent;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setDeleting(true); setError('');
    try { await eventsApi.deleteEvent(event.id); onConfirm(); }
    catch { setError('Failed to delete.'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
        <h2 className="text-[14px] font-bold text-gray-900 mb-1">Delete Event</h2>
        <p className="text-[12.5px] text-gray-500 mb-4">
          Delete "<span className="font-semibold text-gray-700">{event.title}</span>"? This cannot be undone.
        </p>
        {error && <p className="text-[12px] text-red-600 mb-3">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-1.5 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={handleConfirm} disabled={deleting}
            className="px-4 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-60 rounded-lg">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// ── Manage Event Types Modal ──────────────────────────────────────────────────

function ManageEventTypesModal({
  eventTypes,
  onClose,
  onUpdated,
}: {
  eventTypes: EventTypeConfig[];
  onClose: () => void;
  onUpdated: (types: EventTypeConfig[]) => void;
}) {
  const [types, setTypes] = useState<EventTypeConfig[]>(eventTypes);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [editForm, setEditForm]     = useState({ label: '', description: '' });
  const [addingNew, setAddingNew]   = useState(false);
  const [newForm, setNewForm]       = useState({ slug: '', label: '' });
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const startEdit = (t: EventTypeConfig) => {
    setEditingId(t.id);
    setEditForm({ label: t.label, description: t.description });
    setAddingNew(false);
    setError('');
  };

  const saveEdit = async (t: EventTypeConfig) => {
    if (!editForm.label.trim()) { setError('Label is required.'); return; }
    setSaving(true); setError('');
    try {
      const updated = await eventTypesApi.updateType(t.id, editForm);
      const next = types.map(x => x.id === t.id ? updated : x);
      setTypes(next); onUpdated(next); setEditingId(null);
    } catch { setError('Failed to save.'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (t: EventTypeConfig) => {
    setSaving(true);
    try {
      const updated = await eventTypesApi.updateType(t.id, { is_active: !t.is_active });
      const next = types.map(x => x.id === t.id ? updated : x);
      setTypes(next); onUpdated(next);
    } catch { setError('Failed to update.'); }
    finally { setSaving(false); }
  };

  const deleteType = async (t: EventTypeConfig) => {
    if (t.is_default) return;
    if (t.event_count > 0) { setError(`Cannot delete "${t.label}" — it has ${t.event_count} event(s).`); return; }
    setSaving(true); setError('');
    try {
      await eventTypesApi.deleteType(t.id);
      const next = types.filter(x => x.id !== t.id);
      setTypes(next); onUpdated(next);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to delete.';
      setError(msg);
    } finally { setSaving(false); }
  };

  const addType = async () => {
    if (!newForm.slug.trim() || !newForm.label.trim()) { setError('Slug and label are required.'); return; }
    setSaving(true); setError('');
    try {
      const created = await eventTypesApi.createType(newForm);
      const next = [...types, created];
      setTypes(next); onUpdated(next);
      setAddingNew(false); setNewForm({ slug: '', label: '' });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string; slug?: string[] } } })?.response?.data?.detail
        ?? (e as { response?: { data?: { slug?: string[] } } })?.response?.data?.slug?.[0]
        ?? 'Failed to create.';
      setError(msg);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <h2 className="text-[14px] font-bold text-gray-900">Manage Event Types</h2>
          <div className="flex items-center gap-2">
            {!addingNew && (
              <button
                onClick={() => { setAddingNew(true); setEditingId(null); setError(''); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-lg"
              >
                <Plus size={12} /> Add Type
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 pt-3 shrink-0">
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-100">
                <th className="px-5 py-2.5 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                <th className="px-5 py-2.5 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide">Slug</th>
                <th className="px-5 py-2.5 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide text-center">Events</th>
                <th className="px-5 py-2.5 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide text-center">Active</th>
                <th className="px-5 py-2.5 text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Add new row */}
              {addingNew && (
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td className="px-5 py-2.5">
                    <input
                      value={newForm.label}
                      onChange={e => setNewForm(f => ({ ...f, label: e.target.value }))}
                      placeholder="Label"
                      className="w-full px-2 py-1 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
                    />
                  </td>
                  <td className="px-5 py-2.5">
                    <input
                      value={newForm.slug}
                      onChange={e => setNewForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                      placeholder="slug"
                      className="w-full px-2 py-1 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
                    />
                  </td>
                  <td className="px-5 py-2.5 text-center text-[12px] text-gray-400">—</td>
                  <td className="px-5 py-2.5 text-center text-[12px] text-gray-400">—</td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button onClick={addType} disabled={saving}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 rounded-lg">
                        <Check size={10} /> Add
                      </button>
                      <button onClick={() => { setAddingNew(false); setNewForm({ slug: '', label: '' }); setError(''); }}
                        className="px-2.5 py-1 text-[11.5px] font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {types.map(t => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  {editingId === t.id ? (
                    <>
                      <td className="px-5 py-2.5">
                        <input
                          value={editForm.label}
                          onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                          className="w-full px-2 py-1 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
                        />
                      </td>
                      <td className="px-5 py-2.5 text-[12px] text-gray-400">{t.slug}</td>
                      <td className="px-5 py-2.5 text-center text-[12px] text-gray-600">{t.event_count}</td>
                      <td className="px-5 py-2.5 text-center">—</td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => saveEdit(t)} disabled={saving}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11.5px] font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 rounded-lg">
                            <Check size={10} /> Save
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="px-2.5 py-1 text-[11.5px] font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-3">
                        <p className="text-[13px] font-semibold text-gray-800">{t.label}</p>
                        {t.description && <p className="text-[11px] text-gray-400 mt-0.5">{t.description}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[11.5px] text-gray-500 font-mono bg-gray-50 px-1.5 py-0.5 rounded">{t.slug}</span>
                        {t.is_default && <span className="ml-1.5 text-[10px] text-gray-400">default</span>}
                      </td>
                      <td className="px-5 py-3 text-center text-[12.5px] text-gray-600">{t.event_count}</td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => toggleActive(t)}
                          disabled={saving}
                          title={t.is_active ? 'Click to deactivate' : 'Click to activate'}
                          className={`inline-flex items-center justify-center w-8 h-5 rounded-full transition-colors disabled:opacity-50 ${
                            t.is_active ? 'bg-gray-900' : 'bg-gray-200'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${
                            t.is_active ? 'translate-x-1.5' : '-translate-x-1.5'
                          }`} />
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => startEdit(t)}
                            className="flex items-center gap-1 px-2 py-1 text-[11.5px] text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
                            <Pencil size={10} /> Edit
                          </button>
                          <button
                            onClick={() => deleteType(t)}
                            disabled={saving || t.is_default || t.event_count > 0}
                            title={t.is_default ? 'Default type' : t.event_count > 0 ? 'In use' : 'Delete'}
                            className="flex items-center gap-1 px-2 py-1 text-[11.5px] text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-100 rounded-lg">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Event Settings Modal ──────────────────────────────────────────────────────

const SETTINGS_DEFAULTS: EventSettingsData = {
  id: 0, allow_self_rsvp: true, rsvp_deadline_hours: 0,
  default_duration_minutes: 60, send_reminders: true,
  reminder_hours_before: 24, require_attendance_marking: false,
  default_location: '', updated_at: '',
};

function EventSettingsModal({ onClose }: { onClose: () => void }) {
  const [form, setForm]       = useState<EventSettingsData>(SETTINGS_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    eventSettingsApi.getSettings()
      .then(setForm)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof EventSettingsData>(k: K, v: EventSettingsData[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setError(''); setSuccess(false);
    try {
      const updated = await eventSettingsApi.updateSettings(form);
      setForm(updated); setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch { setError('Failed to save settings.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <h2 className="text-[14px] font-bold text-gray-900">Event Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
        </div>

        {loading ? (
          <div className="flex-1 p-5 space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* RSVP Settings */}
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">RSVP Settings</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800">Allow self-RSVP</p>
                    <p className="text-[11.5px] text-gray-400">Members can RSVP themselves to events</p>
                  </div>
                  <button
                    onClick={() => set('allow_self_rsvp', !form.allow_self_rsvp)}
                    className={`relative inline-flex w-10 h-5.5 rounded-full transition-colors ${
                      form.allow_self_rsvp ? 'bg-gray-900' : 'bg-gray-200'
                    }`}
                    style={{ height: '22px', width: '40px' }}
                  >
                    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow mt-[3px] transition-transform ${
                      form.allow_self_rsvp ? 'translate-x-[19px]' : 'translate-x-[3px]'
                    }`} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800">RSVP deadline</p>
                    <p className="text-[11.5px] text-gray-400">Hours before event when RSVP closes (0 = no deadline)</p>
                  </div>
                  <input
                    type="number" min={0} value={form.rsvp_deadline_hours}
                    onChange={e => set('rsvp_deadline_hours', parseInt(e.target.value) || 0)}
                    className="w-20 px-2.5 py-1.5 text-[13px] text-center border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
              </div>
            </div>

            {/* Reminders */}
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Reminders</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800">Send email reminders</p>
                    <p className="text-[11.5px] text-gray-400">Notify attendees before the event</p>
                  </div>
                  <button
                    onClick={() => set('send_reminders', !form.send_reminders)}
                    className={`relative inline-flex rounded-full transition-colors ${
                      form.send_reminders ? 'bg-gray-900' : 'bg-gray-200'
                    }`}
                    style={{ height: '22px', width: '40px' }}
                  >
                    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow mt-[3px] transition-transform ${
                      form.send_reminders ? 'translate-x-[19px]' : 'translate-x-[3px]'
                    }`} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className={`text-[13px] font-semibold ${form.send_reminders ? 'text-gray-800' : 'text-gray-400'}`}>
                      Hours before event
                    </p>
                    <p className="text-[11.5px] text-gray-400">When to send the reminder</p>
                  </div>
                  <input
                    type="number" min={1} value={form.reminder_hours_before}
                    disabled={!form.send_reminders}
                    onChange={e => set('reminder_hours_before', parseInt(e.target.value) || 1)}
                    className="w-20 px-2.5 py-1.5 text-[13px] text-center border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-40"
                  />
                </div>
              </div>
            </div>

            {/* Defaults */}
            <div className="px-5 py-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Defaults</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800">Default duration</p>
                    <p className="text-[11.5px] text-gray-400">Minutes for new events</p>
                  </div>
                  <input
                    type="number" min={5} value={form.default_duration_minutes}
                    onChange={e => set('default_duration_minutes', parseInt(e.target.value) || 60)}
                    className="w-20 px-2.5 py-1.5 text-[13px] text-center border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-gray-800 mb-1">Default location</p>
                  <input
                    value={form.default_location}
                    onChange={e => set('default_location', e.target.value)}
                    placeholder="e.g. Conference Room A"
                    className="w-full px-3 py-1.5 text-[12.5px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800">Require attendance marking</p>
                    <p className="text-[11.5px] text-gray-400">Admin must mark attendance after events complete</p>
                  </div>
                  <button
                    onClick={() => set('require_attendance_marking', !form.require_attendance_marking)}
                    className={`relative inline-flex rounded-full transition-colors ${
                      form.require_attendance_marking ? 'bg-gray-900' : 'bg-gray-200'
                    }`}
                    style={{ height: '22px', width: '40px' }}
                  >
                    <span className={`inline-block w-4 h-4 bg-white rounded-full shadow mt-[3px] transition-transform ${
                      form.require_attendance_marking ? 'translate-x-[19px]' : 'translate-x-[3px]'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex items-center justify-between">
          <div>
            {error && <p className="text-[12px] text-red-600">{error}</p>}
            {success && <p className="text-[12px] text-gray-500">Settings saved.</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={save} disabled={saving || loading}
              className="px-4 py-1.5 text-[12.5px] font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-60 rounded-lg">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type FilterTab = 'upcoming' | 'all' | 'past' | 'meetings' | 'my_rsvps';

const FILTER_TABS: { id: FilterTab; label: string; memberOnly?: boolean }[] = [
  { id: 'upcoming',  label: 'Upcoming Events' },
  { id: 'all',       label: 'All Events' },
  { id: 'past',      label: 'Past Events' },
  { id: 'meetings',  label: 'Meetings' },
  { id: 'my_rsvps',  label: 'My RSVPs', memberOnly: true },
];

export default function OrgEvents() {
  const { isSuperadmin, canManageMembers } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;

  const [events, setEvents]           = useState<OrgEvent[]>([]);
  const [eventTypes, setEventTypes]   = useState<EventTypeConfig[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<FilterTab>('upcoming');
  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState<'Upcoming' | 'Ongoing' | 'Completed' | ''>('');
  const [dateFilter, setDateFilter]   = useState<Date | null>(null);
  const [viewing, setViewing]         = useState<OrgEvent | null>(null);
  const [creating, setCreating]       = useState(false);
  const [createType, setCreateType]   = useState<string | undefined>(undefined);
  const [editingEvent, setEditingEvent] = useState<OrgEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<OrgEvent | null>(null);
  const [showManageTypes, setShowManageTypes]     = useState(false);
  const [showEventSettings, setShowEventSettings] = useState(false);

  useEffect(() => {
    Promise.all([
      eventsApi.getEvents(),
      eventTypesApi.getTypes(),
    ]).then(([evs, types]) => {
      setEvents(evs);
      setEventTypes(types);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const now = new Date();

  const tabFiltered = useMemo(() => events.filter(e => {
    if (tab === 'upcoming')  return new Date(e.end_dt) >= now;
    if (tab === 'past')      return new Date(e.end_dt) < now;
    if (tab === 'meetings')  return e.event_type === 'meeting';
    if (tab === 'my_rsvps')  return e.my_rsvp === 'accepted' || e.my_rsvp === 'maybe';
    return true;
  }), [events, tab]);

  const filtered = useMemo(() => tabFiltered.filter(e => {
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) &&
        !e.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter && e.event_type !== typeFilter) return false;
    if (statusFilter && eventStatus(e) !== statusFilter) return false;
    if (dateFilter) {
      const datePart = e.start_dt?.slice(0, 10) ?? '';
      const [eYear, eMonth, eDay] = datePart.split('-').map(Number);
      if (eYear  !== dateFilter.getFullYear() ||
          eMonth - 1 !== dateFilter.getMonth()    ||
          eDay   !== dateFilter.getDate()) return false;
    }
    return true;
  }), [tabFiltered, search, typeFilter, statusFilter, dateFilter]);

  // ── Sidebar data ───────────────────────────────────────────────────────────

  const upcomingMeetings = events
    .filter(e => e.event_type === 'meeting' && new Date(e.start_dt) >= now)
    .slice(0, 4);

  const recentEvents = events
    .filter(e => new Date(e.end_dt) < now)
    .sort((a, b) => b.end_dt.localeCompare(a.end_dt))
    .slice(0, 4);

  const typeCounts: Record<string, number> = {};
  for (const e of events) {
    typeCounts[e.event_type] = (typeCounts[e.event_type] ?? 0) + 1;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreated = (e: OrgEvent) => {
    setEvents(prev => [...prev, e].sort((a, b) => a.start_dt.localeCompare(b.start_dt)));
    setCreating(false);
    setCreateType(undefined);
  };

  const handleUpdated = (updated: OrgEvent) => {
    setEvents(prev => prev.map(e => e.id === updated.id ? updated : e));
    setEditingEvent(null);
    if (viewing?.id === updated.id) setViewing(updated);
  };

  const handleDeleted = (id: number) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    setDeletingEvent(null);
    if (viewing?.id === id) setViewing(null);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-100 rounded-xl animate-pulse w-48" />
        <div className="grid grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
        {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-[16px] font-bold text-gray-900 leading-tight">Events & Meetings Overview</h1>
            <PageHelp title="How Events & Meetings Work" sections={EVENTS_HELP} />
          </div>
          <p className="text-[12px] text-gray-500 mt-0.5">
            {isAdmin
              ? 'Schedule, manage and track all onboarding related events and meetings'
              : 'Browse upcoming events, RSVP, and track your schedule'
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => exportCsv(events, eventTypes)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Download size={13} /> Export Report
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => { setCreateType(undefined); setCreating(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-lg"
            >
              <Plus size={13} /> Create New Event
            </button>
          )}
        </div>
      </div>

      {/* ── Two-column body ───────────────────────────────────────── */}
      <div className="flex gap-4 items-start">

        {/* ── Left / Main ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {FILTER_TABS.filter(t => !t.memberOnly || !isAdmin).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-[12px] font-semibold transition-colors border-b-2 -mb-px ${
                  tab === t.id
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
            <div className="flex items-center gap-1.5 flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search events by name or description..."
                className="flex-1 text-[12.5px] bg-transparent focus:outline-none text-gray-700 placeholder-gray-400"
              />
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none cursor-pointer"
            >
              <option value="">All Types</option>
              {eventTypes.filter(t => t.is_active).map(t => (
                <option key={t.slug} value={t.slug}>{t.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white text-gray-600 focus:outline-none cursor-pointer"
            >
              <option value="">All Status</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
            </select>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
              <SlidersHorizontal size={12} /> Filters
            </button>
            {dateFilter && (
              <button
                onClick={() => setDateFilter(null)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 shrink-0"
              >
                <Calendar size={11} />
                {dateFilter.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                <X size={11} className="ml-0.5" />
              </button>
            )}
          </div>

          {/* Table */}
          <div className="px-4 pb-4">
            <EventTable
              events={filtered}
              isAdmin={isAdmin}
              eventTypes={eventTypes}
              onRowClick={setViewing}
              onEdit={setEditingEvent}
              onDelete={setDeletingEvent}
            />
          </div>

          {/* ── Bottom section ──────────────────────────────────── */}
          <div className="border-t border-gray-100 grid grid-cols-2 divide-x divide-gray-100">
            {/* Upcoming Meetings */}
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12.5px] font-bold text-gray-800">Upcoming Meetings</p>
                <button
                  onClick={() => setTab('meetings')}
                  className="text-[11px] font-semibold text-gray-500 hover:text-gray-700"
                >
                  View all
                </button>
              </div>
              {upcomingMeetings.length === 0 ? (
                <p className="text-[12px] text-gray-400">No upcoming meetings.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingMeetings.map(e => (
                    <div key={e.id} onClick={() => setViewing(e)} className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 rounded-lg px-1 py-1 -mx-1">
                      <div className="shrink-0 w-12 text-center">
                        <p className="text-[18px] font-bold text-gray-800 leading-tight">{new Date(e.start_dt).getDate()}</p>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">{fmtTime(e.start_dt)}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-gray-800 truncate">{e.title}</p>
                        <p className="text-[11px] text-gray-400">
                          {e.virtual_link ? 'Virtual' : e.location || 'No location'} · {duration(e)}
                        </p>
                      </div>
                      {e.organizer_name && (
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-gray-500">{e.organizer_name.charAt(0)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Events */}
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12.5px] font-bold text-gray-800">Recent Events</p>
                <button
                  onClick={() => setTab('past')}
                  className="text-[11px] font-semibold text-gray-500 hover:text-gray-700"
                >
                  View all
                </button>
              </div>
              {recentEvents.length === 0 ? (
                <p className="text-[12px] text-gray-400">No recent events.</p>
              ) : (
                <div className="space-y-2">
                  {recentEvents.map(e => (
                    <div key={e.id} onClick={() => setViewing(e)} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg px-1 py-1 -mx-1">
                      <div className="w-6 h-6 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                        <Calendar size={12} className="text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-gray-800 truncate">{e.title}</p>
                        <p className="text-[11px] text-gray-400">{fmtDate(e.start_dt)} · {fmtTime(e.start_dt)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-semibold text-gray-700">
                          {e.rsvp_count}{e.max_attendees ? ` / ${e.max_attendees}` : ''}
                        </p>
                        <p className="text-[10.5px] text-gray-400">Attended</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Sidebar ────────────────────────────────────────── */}
        <div className="w-[260px] shrink-0 space-y-3">
          {/* Calendar */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[12px] font-bold text-gray-800 mb-3">Calendar</p>
            <MiniCalendar
              events={events}
              selectedDate={dateFilter}
              onDayClick={d => {
                setDateFilter(prev =>
                  prev &&
                  prev.getFullYear() === d.getFullYear() &&
                  prev.getMonth()    === d.getMonth()    &&
                  prev.getDate()     === d.getDate()
                    ? null
                    : d
                );
                setTab('all');
              }}
            />
          </div>

          {/* Event Types */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-bold text-gray-800">Event Types</p>
              <button className="text-[11px] text-gray-400 hover:text-gray-600">View all</button>
            </div>
            <div className="space-y-2">
              {eventTypes
                .filter(t => (typeCounts[t.slug] ?? 0) > 0)
                .map(t => (
                  <div key={t.slug} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users size={12} className="text-gray-400" />
                      <span className="text-[12px] text-gray-600">{t.label}</span>
                    </div>
                    <span className="text-[11.5px] text-gray-400">{typeCounts[t.slug]} events</span>
                  </div>
                ))}
              {Object.keys(typeCounts).length === 0 && (
                <p className="text-[12px] text-gray-400">No events yet.</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          {isAdmin ? (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[12px] font-bold text-gray-800 mb-3">Quick Actions</p>
              <div className="space-y-1.5">
                {[
                  { icon: <Plus size={12} />,          label: 'Create New Event',     action: () => { setCreateType(undefined); setCreateRecurring(false); setCreating(true); } },
                  { icon: <UserPlus size={12} />,  label: 'Schedule Meeting',   action: () => { setCreateType('meeting'); setCreating(true); } },
                  { icon: <Tag size={12} />,        label: 'Manage Event Types', action: () => setShowManageTypes(true) },
                  { icon: <Settings2 size={12} />,      label: 'Event Settings',       action: () => setShowEventSettings(true) },
                ].map(qa => (
                  <button
                    key={qa.label}
                    onClick={qa.action}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-gray-400">{qa.icon}</span>
                    {qa.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-[12px] font-bold text-gray-800 mb-3">Quick Actions</p>
              <div className="space-y-1.5">
                {[
                  { icon: <Calendar size={12} />, label: 'Upcoming Events',       action: () => setTab('upcoming') },
                  { icon: <CheckCircle2 size={12} />, label: 'Events I\'m Attending', action: () => setTab('my_rsvps') },
                  { icon: <Clock size={12} />,        label: 'Past Events',           action: () => setTab('past') },
                  { icon: <Users size={12} />,        label: 'Meetings Only',         action: () => setTab('meetings') },
                ].map(qa => (
                  <button
                    key={qa.label}
                    onClick={qa.action}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-gray-400">{qa.icon}</span>
                    {qa.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────── */}
      {creating && (
        <EventModal
          defaultType={createType}
          eventTypes={eventTypes}
          onClose={() => { setCreating(false); setCreateType(undefined); }}
          onSaved={handleCreated}
        />
      )}

      {editingEvent && (
        <EventModal
          initial={editingEvent}
          eventTypes={eventTypes}
          onClose={() => setEditingEvent(null)}
          onSaved={handleUpdated}
        />
      )}

      {deletingEvent && (
        <DeleteConfirmModal
          event={deletingEvent}
          onCancel={() => setDeletingEvent(null)}
          onConfirm={() => handleDeleted(deletingEvent.id)}
        />
      )}

      {viewing && (
        <EventDrawer
          event={viewing}
          isAdmin={isAdmin}
          eventTypes={eventTypes}
          onClose={() => setViewing(null)}
          onUpdated={updated => {
            setEvents(prev => prev.map(e => e.id === updated.id ? updated : e));
            setViewing(updated);
          }}
          onDeleted={id => {
            setEvents(prev => prev.filter(e => e.id !== id));
            setViewing(null);
          }}
        />
      )}

      {showManageTypes && (
        <ManageEventTypesModal
          eventTypes={eventTypes}
          onClose={() => setShowManageTypes(false)}
          onUpdated={setEventTypes}
        />
      )}

      {showEventSettings && (
        <EventSettingsModal
          onClose={() => setShowEventSettings(false)}
        />
      )}
    </div>
  );
}
