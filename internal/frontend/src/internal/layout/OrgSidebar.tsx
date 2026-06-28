import { NavLink } from 'react-router-dom';
import {
  ListChecks, Activity, FolderOpen,
  Users,
  ClipboardList, GraduationCap, CalendarDays,
  UserCog, BarChart2,
  ChevronLeft, ChevronRight, ClipboardEdit, MessageSquare, BookOpen,
} from 'lucide-react';
import { useOrg } from '../context/OrgContext';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const MEMBER_NAV: NavItem[] = [
  { to: '/org/onboarding',    icon: <ListChecks size={16} />,      label: 'My Onboarding' },
  { to: '/org/contributions', icon: <Activity size={16} />,        label: 'Contributions' },
  { to: '/org/my-forms',     icon: <ClipboardEdit size={16} />,  label: 'Forms' },
  { to: '/org/training',       icon: <GraduationCap size={16} />,    label: 'Training' },
  { to: '/org/events',        icon: <CalendarDays size={16} />,    label: 'Events & Meetings' },
  { to: '/org/chat',          icon: <MessageSquare size={16} />,   label: 'Chat' },
  { to: '/org/directory',     icon: <Users size={16} />,           label: 'People Directory' },
  { to: '/org/documents',     icon: <FolderOpen size={16} />,      label: 'Agreements' },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/org/admin-guide',     icon: <BookOpen size={16} />,       label: 'Admin Guide' },
  { to: '/org/onboarding-mgmt', icon: <ClipboardList size={16} />,  label: 'Onboarding Mgmt' },
  { to: '/org/contributions',   icon: <Activity size={16} />,       label: 'Contributions' },
  { to: '/org/documents',       icon: <FolderOpen size={16} />,     label: 'Agreements' },
  { to: '/org/training',        icon: <GraduationCap size={16} />,  label: 'Training' },
  { to: '/org/events',          icon: <CalendarDays size={16} />,   label: 'Events & Meetings' },
  { to: '/org/chat',            icon: <MessageSquare size={16} />,  label: 'Chat' },
  { to: '/org/forms',           icon: <ClipboardEdit size={16} />,  label: 'Forms & Surveys' },
  { to: '/org/members',         icon: <UserCog size={16} />,        label: 'Users & Roles' },
  { to: '/org/analytics',       icon: <BarChart2 size={16} />,      label: 'Reports & Analytics' },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function OrgSidebar({ collapsed, onToggle }: Props) {
  const { isSuperadmin, canManageMembers } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;
  const nav = isAdmin ? ADMIN_NAV : MEMBER_NAV;

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    collapsed
      ? [
          'flex items-center justify-center w-9 h-9 mx-auto rounded-lg transition-colors relative group/tip',
          isActive
            ? 'bg-teal-50 text-teal-700'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
        ].join(' ')
      : [
          'flex items-center gap-3 px-3 py-2 w-full rounded-lg transition-colors text-[13px] font-medium',
          isActive
            ? 'bg-teal-50 text-teal-700'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800',
        ].join(' ');

  return (
    <aside
      className="fixed top-10 left-0 bottom-0 bg-white border-r border-gray-200 flex flex-col z-20 transition-all duration-200 overflow-hidden"
      style={{ width: collapsed ? 56 : 220 }}
    >
      {/* Portal label */}
      <div className={['px-3 pt-4 pb-2.5 shrink-0', collapsed ? 'flex justify-center' : ''].join(' ')}>
        {collapsed
          ? <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
          : (
            <p className={`text-[9.5px] font-bold uppercase tracking-[0.14em] ${isAdmin ? 'text-gray-400' : 'text-teal-600'}`}>
              {isAdmin ? 'Admin Portal' : 'Internal Portal'}
            </p>
          )
        }
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 flex flex-col gap-0.5">
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={linkClass}
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
            {collapsed && (
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-md whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                {item.label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className={[
          'flex items-center py-2.5 border-t border-gray-100 text-[12px] font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors shrink-0',
          collapsed ? 'justify-center px-0' : 'gap-1.5 px-3',
        ].join(' ')}
      >
        {collapsed
          ? <ChevronRight size={14} />
          : <><ChevronLeft size={14} /><span>Collapse</span></>
        }
      </button>
    </aside>
  );
}
