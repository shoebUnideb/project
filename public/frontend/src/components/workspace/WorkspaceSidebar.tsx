import { useRef, useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Home, BookOpen, Users, CheckSquare, MessageSquare, ArrowLeft, Settings, Globe, Lock, EyeOff, FileText, ChevronDown, Check, ClipboardList } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useApiList } from '../../hooks/useApi';
import { workspacesApi } from '../../api/workspaces';
import type { WorkspaceResource, Workspace } from '../../types';
import Avatar from '../ui/Avatar';

const NAV = [
  { label: 'Home',      path: '',          icon: <Home size={15} />          },
  { label: 'Resources', path: '/resources', icon: <BookOpen size={15} />     },
  { label: 'Members',   path: '/members',   icon: <Users size={15} />        },
  { label: 'Tasks',     path: '/tasks',     icon: <CheckSquare size={15} />  },
  { label: 'Chat',      path: '/chat',      icon: <MessageSquare size={15} /> },
];

function PrivacyIcon({ privacy }: { privacy: string }) {
  if (privacy === 'private') return <Lock size={10} className="text-white/60" />;
  if (privacy === 'secret')  return <EyeOff size={10} className="text-white/60" />;
  return <Globe size={10} className="text-white/60" />;
}

function getResourceIcon(r: WorkspaceResource) {
  if (r.resource_type === 'link') return <Globe size={12} />;
  if (r.resource_type === 'note') return <FileText size={12} />;
  const ext = (r.file_url ?? r.file ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return <FileText size={12} />;
  return <FileText size={12} />;
}

export default function WorkspaceSidebar({ width }: { width?: number }) {
  const { workspace, isOwner, isMentor } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  if (!workspace) return null;

  const wid = workspace.id;
  const base        = `/w/${workspace.slug}`;
  const displayName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || (user?.username ?? '');

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: resources } = useApiList<WorkspaceResource>(() => workspacesApi.getResources(wid), [wid]);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: allWorkspaces } = useApiList<Workspace>(() => workspacesApi.list(), []);
  const memberWorkspaces = allWorkspaces.filter(w =>
    w.my_status === 'owner' || w.my_status === 'approved' || w.my_status === 'mentor'
  );

  const quickResources = resources.filter(r => !r.is_hidden).slice(0, 5);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  return (
    <aside
      className="fixed top-10 bottom-0 left-0 z-20 flex flex-col bg-primary-600 overflow-y-auto overflow-x-hidden"
      style={{ width: width ?? 185 }}
    >

      {/* Workspace switcher */}
      <div className="px-3.5 py-3 bg-primary-700 shrink-0 relative" ref={dropdownRef}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex-1 min-w-0 flex items-center gap-2.5 rounded-lg hover:bg-white/[0.10] px-1 py-1 transition-colors"
          >
            {workspace.logo_url ? (
              <img src={workspace.logo_url} alt="logo" className="w-8 h-8 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white text-[16px] shrink-0">
                {workspace.icon_emoji || workspace.name[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[13px] font-bold text-white truncate leading-tight">{workspace.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <PrivacyIcon privacy={workspace.privacy} />
                <span className="text-[10px] text-white/60 capitalize">
                  {isMentor ? 'Mentor' : `${workspace.privacy} workspace`}
                </span>
              </div>
            </div>
            <ChevronDown size={14} className={`shrink-0 text-white/60 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOwner && (
            <NavLink
              to={`${base}/settings`}
              title="Workspace settings"
              className={({ isActive }) =>
                ['shrink-0 p-1.5 rounded-md transition-colors',
                  isActive ? 'text-white bg-white/20' : 'text-white/70 hover:text-white hover:bg-white/[0.12]',
                ].join(' ')
              }
            >
              <Settings size={13} />
            </NavLink>
          )}
        </div>

        {/* Dropdown */}
        {dropdownOpen && (
          <div className="absolute left-2 right-2 top-full mt-1 z-50 bg-primary-600 border border-white/20 rounded-xl shadow-2xl overflow-hidden py-1">
            <p className="text-[10px] font-semibold text-white/60 uppercase tracking-widest px-3 pt-2 pb-1.5">
              My Workspaces
            </p>
            <div className="max-h-64 overflow-y-auto">
              {memberWorkspaces.length === 0 && (
                <p className="text-[12px] text-white/70 px-3 py-3">No workspaces found.</p>
              )}
              {memberWorkspaces.map(w => (
                <button
                  key={w.id}
                  onClick={() => { setDropdownOpen(false); navigate(`/w/${w.slug}`); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/[0.12] transition-colors text-left"
                >
                  {w.logo_url ? (
                    <img src={w.logo_url} alt="" className="w-7 h-7 rounded-md object-cover shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-[13px] shrink-0 bg-white/20">
                      {w.icon_emoji || w.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 min-w-0 text-[12.5px] font-medium text-white truncate">{w.name}</span>
                  {w.id === workspace.id && <Check size={13} className="shrink-0 text-white" />}
                </button>
              ))}
            </div>
            <div className="border-t border-white/20 mt-1">
              <button
                onClick={() => { setDropdownOpen(false); navigate('/workspaces'); }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-white/70 hover:text-white hover:bg-white/[0.12] transition-colors"
              >
                <ArrowLeft size={12} /> All workspaces
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Nav */}
      <nav className="px-2 py-2 space-y-0.5 shrink-0">
        <Link to="/workspaces"
          className="flex items-center gap-2.5 px-2.5 py-1 rounded-md text-[12.5px] font-medium text-white/70 hover:bg-white/[0.12] hover:text-white transition-colors mb-1">
          <ArrowLeft size={15} /> Back to platform
        </Link>
        {NAV.map(item => {
          const to = item.path ? `${base}${item.path}` : base;
          return (
            <NavLink
              key={item.label}
              to={to}
              end={item.path === ''}
              className={({ isActive }) =>
                ['flex items-center gap-2.5 px-2.5 py-1 rounded-md text-[12.5px] font-medium transition-colors',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:bg-white/[0.12] hover:text-white',
                ].join(' ')
              }
            >
              <span className="shrink-0 opacity-80">{item.icon}</span>
              {item.label}
            </NavLink>
          );
        })}
        {isOwner && (
          <NavLink
            to={`${base}/submissions`}
            className={({ isActive }) =>
              ['flex items-center gap-2.5 px-2.5 py-1 rounded-md text-[12.5px] font-medium transition-colors',
                isActive ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/[0.12] hover:text-white',
              ].join(' ')
            }
          >
            <span className="shrink-0 opacity-80"><ClipboardList size={15} /></span>
            Submissions
          </NavLink>
        )}
      </nav>

      {/* Quick Access */}
      {quickResources.length > 0 && (
        <div className="px-3.5 py-3 border-t border-white/20 shrink-0">
          <p className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-2">
            Quick Access
          </p>
          <div className="space-y-0.5">
            {quickResources.map(r => {
              const url = r.resource_type === 'link' ? r.url : r.file_url;
              const inner = (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-white/80 hover:bg-white/[0.12] hover:text-white transition-colors">
                  <span className="shrink-0 opacity-70">{getResourceIcon(r)}</span>
                  <span className="truncate">{r.title}</span>
                </div>
              );
              if (url) {
                return (
                  <a key={r.id} href={url} target="_blank" rel="noreferrer">
                    {inner}
                  </a>
                );
              }
              return (
                <Link key={r.id} to={`${base}/resources`}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      )}


      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="px-3.5 py-3 mb-2 bg-primary-700 shrink-0">
        <div className="flex items-center gap-2">
          <Avatar name={displayName} size="sm" />
          <span className="text-[11.5px] text-white/70 truncate">{displayName || `@${user?.username}`}</span>
        </div>
      </div>
    </aside>
  );
}
