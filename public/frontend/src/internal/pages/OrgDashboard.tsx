import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Users, UserCheck, ListChecks, AlertCircle, CalendarDays,
  Clock, Activity, CheckCircle2, MapPin, Video, FileText,
  TrendingUp, ArrowRight,
} from 'lucide-react';
import {
  dashboardApi,
  type AdminDashboard, type MemberDashboard, type OrgEvent, type EventType,
} from '../api/orgApi';
import { useOrg } from '../context/OrgContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const EVENT_TYPE_BADGE: Record<EventType, string> = {
  orientation: 'bg-purple-100 text-purple-700',
  welcome:     'bg-teal-100 text-teal-700',
  training:    'bg-blue-100 text-blue-700',
  webinar:     'bg-indigo-100 text-indigo-700',
  checkin:     'bg-amber-100 text-amber-700',
  meeting:     'bg-gray-100 text-gray-700',
};
const EVENT_TYPE_LABEL: Record<EventType, string> = {
  orientation: 'Orientation', welcome: 'Welcome', training: 'Training',
  webinar: 'Webinar', checkin: 'Check-in', meeting: 'Meeting',
};

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, onClick, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  onClick?: () => void;
  accent?: string;
}) {
  const base = 'bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-2';
  return (
    <div
      className={`${base} ${onClick ? 'cursor-pointer hover:border-teal-300 hover:shadow-sm transition-all' : ''}`}
      onClick={onClick}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent ?? 'bg-gray-50'}`}>
        {icon}
      </div>
      <div>
        <p className="text-[24px] font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-[12px] text-gray-400 mt-0.5 font-medium">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Event Mini-Card ───────────────────────────────────────────────────────────

function EventMiniCard({ event }: { event: OrgEvent }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${EVENT_TYPE_BADGE[event.event_type]}`}>
          {EVENT_TYPE_LABEL[event.event_type]}
        </span>
      </div>
      <p className="text-[13.5px] font-bold text-gray-900 mb-1 leading-snug">{event.title}</p>
      <div className="flex items-center gap-1.5 text-[11.5px] text-gray-400">
        <Clock size={11} />
        <span>{fmtDt(event.start_dt)}</span>
      </div>
      {event.location && (
        <div className="flex items-center gap-1.5 text-[11.5px] text-gray-400 mt-0.5">
          <MapPin size={11} />
          <span className="truncate">{event.location}</span>
        </div>
      )}
      {!event.location && event.virtual_link && (
        <div className="flex items-center gap-1.5 text-[11.5px] text-teal-500 mt-0.5">
          <Video size={11} />
          <span>Virtual</span>
        </div>
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 bg-gray-100 rounded-xl w-56 animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
      <div className="h-6 bg-gray-100 rounded w-40 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  );
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────

function AdminView({ data }: { data: AdminDashboard }) {
  const nav = useNavigate();
  const pendingTotal = data.pending_contributions + data.pending_documents + data.pending_checkins;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          icon={<Users size={16} className="text-teal-600" />}
          label="Total Members"
          value={data.members.total}
          accent="bg-teal-50"
        />
        <StatCard
          icon={<UserCheck size={16} className="text-emerald-600" />}
          label="Active"
          value={data.members.active}
          accent="bg-emerald-50"
        />
        <StatCard
          icon={<ListChecks size={16} className="text-blue-600" />}
          label="Onboarding Active"
          value={data.onboarding.active}
          accent="bg-blue-50"
          onClick={() => nav('/org/onboarding-mgmt')}
        />
        <StatCard
          icon={<AlertCircle size={16} className="text-amber-600" />}
          label="Pending Reviews"
          value={pendingTotal}
          sub={`${data.pending_contributions} contrib · ${data.pending_documents} docs · ${data.pending_checkins} checkins`}
          accent="bg-amber-50"
        />
        <StatCard
          icon={<CalendarDays size={16} className="text-purple-600" />}
          label="Upcoming Events"
          value={data.upcoming_events_count}
          accent="bg-purple-50"
          onClick={() => nav('/org/events')}
        />
      </div>

      {/* Quick action links */}
      <div className="flex flex-wrap items-center gap-2">
        {data.pending_contributions > 0 && (
          <button
            onClick={() => nav('/org/contributions')}
            className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors"
          >
            <Activity size={13} /> Review {data.pending_contributions} Contribution{data.pending_contributions !== 1 ? 's' : ''} <ArrowRight size={11} />
          </button>
        )}
        {data.pending_documents > 0 && (
          <button
            onClick={() => nav('/org/documents')}
            className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"
          >
            <FileText size={13} /> Review {data.pending_documents} Document{data.pending_documents !== 1 ? 's' : ''} <ArrowRight size={11} />
          </button>
        )}
        {data.pending_checkins > 0 && (
          <button
            onClick={() => nav('/org/checkins')}
            className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors"
          >
            <CheckCircle2 size={13} /> Review {data.pending_checkins} Check-in{data.pending_checkins !== 1 ? 's' : ''} <ArrowRight size={11} />
          </button>
        )}
        {pendingTotal === 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <p className="text-[12.5px] font-semibold text-emerald-700">All reviews up to date</p>
          </div>
        )}
      </div>

      {/* Upcoming Events */}
      {data.upcoming_events.length > 0 && (
        <div>
          <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">Upcoming Events</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {data.upcoming_events.map(e => <EventMiniCard key={e.id} event={e} />)}
          </div>
        </div>
      )}

      {/* Onboarding summary row */}
      <div>
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">Onboarding Overview</p>
        <div className="flex flex-wrap gap-3">
          {(['pending', 'active', 'paused', 'completed'] as const).map(s => (
            <div key={s} className="bg-white rounded-2xl border border-gray-200 px-4 py-3 flex items-center gap-3">
              <p className="text-[18px] font-bold text-gray-900">{data.onboarding[s]}</p>
              <p className="text-[12px] text-gray-400 font-medium capitalize">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Member Dashboard ──────────────────────────────────────────────────────────

function MemberView({ data }: { data: MemberDashboard }) {
  const nav = useNavigate();

  return (
    <div className="space-y-6">
      {/* Onboarding */}
      {data.onboarding ? (
        <div
          className="bg-white rounded-2xl border border-gray-200 p-5 cursor-pointer hover:border-teal-300 hover:shadow-sm transition-all"
          onClick={() => nav('/org/onboarding')}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ListChecks size={16} className="text-teal-600" />
              <p className="text-[14px] font-bold text-gray-900">My Onboarding</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${
                data.onboarding.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                data.onboarding.status === 'active'    ? 'bg-blue-50 text-blue-700' :
                data.onboarding.status === 'paused'    ? 'bg-amber-50 text-amber-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {data.onboarding.status.charAt(0).toUpperCase() + data.onboarding.status.slice(1)}
              </span>
              <ArrowRight size={14} className="text-gray-400" />
            </div>
          </div>
          {data.onboarding.template_name && (
            <p className="text-[12px] text-gray-400 mb-3">{data.onboarding.template_name}</p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all"
                style={{ width: `${data.onboarding.progress_pct}%` }}
              />
            </div>
            <span className="text-[12px] font-semibold text-gray-500 shrink-0">{data.onboarding.progress_pct}%</span>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
            <ListChecks size={18} className="text-gray-400" />
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-gray-700">No onboarding assigned</p>
            <p className="text-[12px] text-gray-400">Your coordinator will assign onboarding tasks when ready.</p>
          </div>
        </div>
      )}

      {/* Contribution stats */}
      <div>
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">My Contributions</p>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Clock size={16} className="text-blue-500" />}
            label="Total Hours"
            value={data.contributions.total_hours.toFixed(1)}
            accent="bg-blue-50"
          />
          <StatCard
            icon={<Activity size={16} className="text-teal-500" />}
            label="Total"
            value={data.contributions.total_contributions}
            accent="bg-teal-50"
          />
          <StatCard
            icon={<CheckCircle2 size={16} className="text-emerald-500" />}
            label="Approved"
            value={data.contributions.approved}
            accent="bg-emerald-50"
          />
        </div>
      </div>

      {/* Upcoming Events */}
      {data.upcoming_events.length > 0 && (
        <div>
          <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">Upcoming Events</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {data.upcoming_events.map(e => <EventMiniCard key={e.id} event={e} />)}
          </div>
        </div>
      )}

      {/* Pending Documents */}
      {data.pending_documents.length > 0 && (
        <div>
          <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">Documents Needing Action</p>
          <div className="space-y-2">
            {data.pending_documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText size={14} className="text-gray-400 shrink-0" />
                  <p className="text-[13px] font-semibold text-gray-800 truncate">{doc.title}</p>
                </div>
                <span className={`shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${
                  doc.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {doc.status === 'rejected' ? 'Revision Needed' : 'Assigned'}
                </span>
              </div>
            ))}
            <button
              onClick={() => nav('/org/documents')}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold text-teal-600 hover:text-teal-700 mt-1"
            >
              View all documents <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgDashboard() {
  const { isSuperadmin, canManageMembers } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;

  const [data, setData]       = useState<AdminDashboard | MemberDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) { setLoading(false); return; }
    dashboardApi.getDashboard()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isAdmin) return <Navigate to="/org/admin-guide" replace />;

  const subtitle = isAdmin
    ? 'Overview of your organisation'
    : 'Your activity and upcoming items';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          {isAdmin ? (
            <><TrendingUp size={22} className="text-teal-500" /> Admin Overview</>
          ) : (
            <>Dashboard</>
          )}
        </h1>
        <p className="text-gray-500 text-sm">{subtitle}</p>
      </div>

      {loading && <DashboardSkeleton />}

      {!loading && !data && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-[15px] font-semibold text-gray-500">Could not load dashboard data.</p>
        </div>
      )}

      {!loading && data && (
        isAdmin
          ? <AdminView data={data as AdminDashboard} />
          : <MemberView data={data as MemberDashboard} />
      )}
    </div>
  );
}
