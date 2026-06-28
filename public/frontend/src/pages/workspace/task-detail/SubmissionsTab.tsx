import { useState } from 'react';
import { CheckSquare, Square, AlertTriangle, ThumbsUp, X, Calendar } from 'lucide-react';
import { useApiList } from '../../../hooks/useApi';
import { workspacesApi } from '../../../api/workspaces';
import apiClient from '../../../api/apiClient';
import type { WorkspaceTaskSubmissionSummary } from '../../../types';
import Avatar from '../../../components/ui/Avatar';
import { StatusPill } from '../../../components/workspace/task/TaskStatusPill';

const FILTER_OPTS = [
  { val: '',               label: 'All' },
  { val: 'not_started',    label: 'Not Started' },
  { val: 'in_progress',    label: 'In Progress' },
  { val: 'submitted',      label: 'Submitted' },
  { val: 'needs_revision', label: 'Needs Revision' },
  { val: 'completed',      label: 'Completed' },
];

export function SubmissionsTab({
  workspaceId, taskId, onOpenSubmission,
}: {
  workspaceId: number; taskId: number;
  onOpenSubmission: (sub: WorkspaceTaskSubmissionSummary) => void;
}) {
  const [filterStatus, setFilterStatus] = useState('');
  const { data: subs, loading, refetch } = useApiList<WorkspaceTaskSubmissionSummary>(
    () => workspacesApi.getSubmissions(workspaceId, taskId, filterStatus || undefined),
    [workspaceId, taskId, filterStatus],
  );
  const [selected, setSelected]   = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const toggleSelect = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(prev => prev.size === subs.length ? new Set() : new Set(subs.map(s => s.id)));

  const reviewableSelected = subs
    .filter(s => selected.has(s.id) && (s.status === 'submitted' || s.status === 'resubmitted'))
    .map(s => s.id);

  const doBulkReview = async (reviewStatus: 'completed' | 'needs_revision') => {
    if (reviewableSelected.length === 0) return;
    setBulkLoading(true);
    try {
      await apiClient.initCsrf();
      await workspacesApi.bulkReview(workspaceId, taskId, reviewableSelected, reviewStatus);
      setSelected(new Set());
      refetch();
    } finally { setBulkLoading(false); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_OPTS.map(o => (
            <button key={o.val} onClick={() => setFilterStatus(o.val)}
              className={`px-2.5 py-1 text-[11.5px] font-medium rounded-lg transition-colors ${
                filterStatus === o.val ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {o.label}
            </button>
          ))}
        </div>
        {subs.length > 0 && (
          <button onClick={toggleAll}
            className="ml-auto flex items-center gap-1.5 text-[11.5px] text-gray-500 hover:text-gray-800 font-medium transition-colors">
            {selected.size === subs.length ? <CheckSquare size={13} /> : <Square size={13} />}
            {selected.size === subs.length ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>

      {loading && <p className="text-[13px] text-gray-400 py-4 text-center">Loading…</p>}
      {!loading && subs.length === 0 && (
        <p className="text-[13px] text-gray-400 py-8 text-center">No submissions match this filter.</p>
      )}

      <div className="space-y-2">
        {subs.map(sub => {
          const name = `${sub.student.user.first_name || ''} ${sub.student.user.last_name || ''}`.trim() || sub.student.user.username;
          const pct  = sub.checks_total ? Math.round((sub.checks_done / sub.checks_total) * 100) : 0;
          const effDue = sub.effective_due_date;
          const isSelected = selected.has(sub.id);
          return (
            <div key={sub.id} className={`flex items-center gap-2 bg-white border rounded-xl px-3 py-3 transition-all ${
              isSelected ? 'border-primary-400 shadow-sm' : 'border-gray-200'
            }`}>
              <button onClick={() => toggleSelect(sub.id)}
                className={`shrink-0 transition-colors ${isSelected ? 'text-primary-600' : 'text-gray-300 hover:text-gray-400'}`}>
                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
              <button onClick={() => onOpenSubmission(sub)} className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-3">
                  <Avatar name={name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-semibold text-gray-900">{name}</p>
                      <StatusPill s={sub.status} />
                      {sub.effective_late && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full uppercase tracking-widest">Late</span>
                      )}
                      {sub.due_date_override && (
                        <span className="text-[10.5px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">
                          Custom due date
                        </span>
                      )}
                    </div>
                    {sub.checks_total > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 max-w-[120px] h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10.5px] text-gray-400">{sub.checks_done}/{sub.checks_total} deliverables</span>
                      </div>
                    )}
                    {effDue && (
                      <p className="text-[10.5px] text-gray-400 mt-0.5">
                        <Calendar size={9} className="inline mr-0.5" />
                        Due {new Date(effDue).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {sub.submitted_at && (
                    <span className="text-[11px] text-gray-400 shrink-0">
                      {new Date(sub.submitted_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="sticky bottom-4 mt-4 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl">
          <span className="text-[12.5px] font-medium flex-1">{selected.size} selected · {reviewableSelected.length} reviewable</span>
          <button
            onClick={() => doBulkReview('completed')}
            disabled={bulkLoading || reviewableSelected.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-[12px] font-semibold rounded-lg transition-colors">
            <ThumbsUp size={12} /> Mark Complete
          </button>
          <button
            onClick={() => doBulkReview('needs_revision')}
            disabled={bulkLoading || reviewableSelected.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-[12px] font-semibold rounded-lg transition-colors">
            <AlertTriangle size={12} /> Needs Revision
          </button>
          <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
