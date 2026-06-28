import { useState, useEffect } from 'react';
import { ScrollText, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { auditApi, type AuditLogEntry } from '../api/orgApi';
import { useOrg } from '../context/OrgContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTION_BADGE: Record<string, string> = {
  create:  'bg-emerald-100 text-emerald-700',
  update:  'bg-blue-50 text-blue-700',
  delete:  'bg-red-50 text-red-700',
  approve: 'bg-teal-50 text-teal-700',
  login:   'bg-gray-100 text-gray-600',
  export:  'bg-amber-50 text-amber-700',
};
const ACTION_LABEL: Record<string, string> = {
  create: 'Create', update: 'Update', delete: 'Delete',
  approve: 'Approve', login: 'Login', export: 'Export',
};
const ALL_ACTIONS = ['create', 'update', 'delete', 'approve', 'login', 'export'];

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hrs   = Math.floor(mins / 60);
  const days  = Math.floor(hrs / 24);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

// ── Log Row ───────────────────────────────────────────────────────────────────

function LogRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = entry.changes && Object.keys(entry.changes).length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={() => hasChanges && setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full ${ACTION_BADGE[entry.action] ?? 'bg-gray-100 text-gray-600'}`}>
            {ACTION_LABEL[entry.action] ?? entry.action}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12.5px] font-semibold text-gray-800">{entry.actor_name}</span>
            <span className="text-[11.5px] text-gray-400">·</span>
            <span className="text-[12px] text-gray-500 font-medium">{entry.module}</span>
            {entry.record_repr && (
              <>
                <span className="text-[11.5px] text-gray-300">·</span>
                <span className="text-[12px] text-gray-500 truncate max-w-[200px]">{entry.record_repr}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-gray-400 whitespace-nowrap">{relativeTime(entry.created_at)}</span>
          {hasChanges && (
            expanded ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />
          )}
        </div>
      </button>

      {expanded && hasChanges && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-2.5">
          <pre className="text-[11.5px] text-gray-600 bg-gray-50 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(entry.changes, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrgAudit() {
  const { isSuperadmin, canManageMembers } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;

  const [logs, setLogs]       = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [module, setModule]   = useState('');
  const [action, setAction]   = useState('');
  const [limit, setLimit]     = useState(50);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchLogs = async (newLimit: number) => {
    if (newLimit > limit) setLoadingMore(true);
    else setLoading(true);
    try {
      const data = await auditApi.getLogs({
        module: module || undefined,
        action: action || undefined,
        limit: newLimit,
      });
      setLogs(data);
      setLimit(newLimit);
    } catch { /* ignore */ }
    finally { setLoading(false); setLoadingMore(false); }
  };

  useEffect(() => {
    if (isAdmin) fetchLogs(50);
    else setLoading(false);
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => fetchLogs(50);

  const modules = Array.from(new Set(logs.map(l => l.module))).sort();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
          <Lock size={28} className="text-gray-400" />
        </div>
        <p className="text-[15px] font-semibold text-gray-700">Access Denied</p>
        <p className="text-[13px] text-gray-400 mt-1">Audit logs are only available to administrators.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Audit Logs</h1>
        <p className="text-gray-500 text-sm">Track all actions performed in the portal</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Module</label>
          <select
            value={module}
            onChange={e => setModule(e.target.value)}
            className="px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            <option value="">All Modules</option>
            {modules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Action</label>
          <select
            value={action}
            onChange={e => setAction(e.target.value)}
            className="px-3 py-2 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            <option value="">All Actions</option>
            {ALL_ACTIONS.map(a => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
          </select>
        </div>
        <button
          onClick={applyFilters}
          className="px-4 py-2 text-[13px] font-semibold text-white bg-teal-500 hover:bg-teal-600 rounded-xl transition-colors"
        >
          Apply
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-4">
            <ScrollText size={28} className="text-teal-400" />
          </div>
          <p className="text-[15px] font-semibold text-gray-700">No audit logs</p>
          <p className="text-[13px] text-gray-400 mt-1">Actions performed in the portal will appear here.</p>
        </div>
      ) : (
        <>
          <p className="text-[12px] text-gray-400 mb-3">{logs.length} entr{logs.length !== 1 ? 'ies' : 'y'}</p>
          <div className="space-y-2">
            {logs.map(entry => <LogRow key={entry.id} entry={entry} />)}
          </div>
          {logs.length >= limit && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => fetchLogs(limit + 100)}
                disabled={loadingMore}
                className="px-5 py-2.5 text-[13px] font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl disabled:opacity-60 transition-colors"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
