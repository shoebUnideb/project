import type { WorkspaceTaskStatusEvent } from '../../../types';

export const STATUS_COLORS: Record<string, string> = {
  submitted:      'bg-indigo-100 text-indigo-700 border-indigo-200',
  resubmitted:    'bg-purple-100 text-purple-700 border-purple-200',
  completed:      'bg-green-100 text-green-700 border-green-200',
  needs_revision: 'bg-orange-100 text-orange-700 border-orange-200',
  in_progress:    'bg-primary-100 text-primary-700 border-primary-200',
  not_started:    'bg-gray-100 text-gray-600 border-gray-200',
};

export function RevisionTimeline({ events }: { events: WorkspaceTaskStatusEvent[] }) {
  if (events.length === 0) {
    return <p className="text-[12px] text-gray-400 py-4 text-center">No history yet.</p>;
  }
  return (
    <div className="relative pl-5">
      <div className="absolute left-1.5 top-1 bottom-1 w-px bg-gray-200" />
      <div className="space-y-4">
        {events.map(ev => (
          <div key={ev.id} className="relative">
            <div className="absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-primary-400" />
            <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${STATUS_COLORS[ev.to_status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
              {ev.to_status.replace(/_/g, ' ')}
            </div>
            <p className="text-[10.5px] text-gray-400 mt-0.5">
              {ev.actor ? (ev.actor.first_name || ev.actor.username) : 'System'}
              {' · '}
              {new Date(ev.created_at).toLocaleString()}
            </p>
            {ev.note && (
              <p className="text-[12.5px] text-gray-700 bg-gray-50 rounded-lg px-3 py-2 mt-1.5 leading-relaxed">
                "{ev.note}"
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
