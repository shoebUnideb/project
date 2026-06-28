import { Video, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import apiClient from '../../api/apiClient';
import { sessionsApi } from '../../api/sessions';
import { useApiList } from '../../hooks/useApi';
import type { MentorSession, SessionStatus } from '../../types';

const STATUS_STYLES: Record<SessionStatus, string> = {
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

interface Props {
  role: 'mentor' | 'student';
}

export default function SessionsCard({ role }: Props) {
  const { data: sessions, refetch } = useApiList(sessionsApi.list);

  const upcoming = sessions
    .filter(s => s.status !== 'cancelled' && new Date(`${s.date}T${s.end_time}`) >= new Date())
    .slice(0, 5);

  const updateStatus = async (id: number, status: string) => {
    await apiClient.initCsrf();
    await sessionsApi.update(id, { status });
    refetch();
  };

  if (upcoming.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-[13px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
        Upcoming Sessions
      </h2>
      <div className="space-y-2">
        {upcoming.map((sess: MentorSession) => {
          const other = role === 'mentor' ? sess.student : sess.mentor;
          const otherName = `${other.first_name ?? ''} ${other.last_name ?? ''}`.trim() || other.username;
          return (
            <div key={sess.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${STATUS_STYLES[sess.status]} bg-white`}>
              <Video size={15} className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-gray-800">{sess.title}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLES[sess.status]}`}>
                    {sess.status}
                  </span>
                </div>
                <p className="text-[11.5px] text-gray-500">
                  {role === 'mentor' ? 'with' : 'with'} {otherName} · {new Date(sess.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {sess.start_time}–{sess.end_time}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {sess.meeting_link && sess.status === 'confirmed' && (
                  <a href={sess.meeting_link} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                    <ExternalLink size={10} /> Join
                  </a>
                )}
                {role === 'mentor' && sess.status === 'pending' && (
                  <>
                    <button onClick={() => updateStatus(sess.id, 'confirmed')}
                      className="p-1 text-green-500 hover:text-green-700" title="Confirm">
                      <CheckCircle size={15} />
                    </button>
                    <button onClick={() => updateStatus(sess.id, 'cancelled')}
                      className="p-1 text-red-400 hover:text-red-600" title="Decline">
                      <XCircle size={15} />
                    </button>
                  </>
                )}
                {role === 'student' && sess.status === 'pending' && (
                  <Clock size={14} className="text-amber-500" title="Awaiting confirmation" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
