import { useRef, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, User, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AppSwitcher from '../AppSwitcher';
import OrgNotificationBell from '../components/OrgNotificationBell';

function getPageLabel(pathname: string): string {
  if (pathname.startsWith('/org/onboarding-mgmt')) return 'Onboarding Management';
  if (pathname.startsWith('/org/admin-guide'))     return 'Admin Guide';
  if (pathname.startsWith('/org/doc-templates'))   return 'Agreement Templates';
  if (pathname.startsWith('/org/onboarding'))      return 'My Onboarding';
  if (pathname.startsWith('/org/dashboard'))       return 'Dashboard';
  if (pathname.startsWith('/org/contributions'))   return 'Contributions';
  if (pathname.startsWith('/org/agreements'))      return 'Agreements';
  if (pathname.startsWith('/org/checkins'))        return 'Check-ins';
  if (pathname.startsWith('/org/performance'))     return 'Performance';
  if (pathname.startsWith('/org/learning'))        return 'Learning';
  if (pathname.startsWith('/org/directory'))       return 'People Directory';
  if (pathname.startsWith('/org/documents'))       return 'Agreements';
  if (pathname.startsWith('/org/help'))            return 'Help & Support';
  if (pathname.startsWith('/org/training'))        return 'Training';
  if (pathname.startsWith('/org/events'))          return 'Events & Meetings';
  if (pathname.startsWith('/org/members'))         return 'Users & Roles';
  if (pathname.startsWith('/org/departments'))     return 'Departments';
  if (pathname.startsWith('/org/analytics'))       return 'Reports & Analytics';
  if (pathname.startsWith('/org/integrations'))    return 'Integrations';
  if (pathname.startsWith('/org/audit'))           return 'Audit Logs';
  if (pathname.startsWith('/org/recruitment'))     return 'Recruitment';
  if (pathname.startsWith('/org/roles'))           return 'Roles';
  return '';
}

export default function OrgTopbar() {
  const { user, logout } = useAuth();
  const location     = useLocation();
  const navigate     = useNavigate();
  const [open, setOpen]           = useState(false);
  const [logoutConfirm, setLogout] = useState(false);
  const dropdownRef  = useRef<HTMLDivElement>(null);

  const pageLabel  = getPageLabel(location.pathname);
  const initials   = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || user.username[0].toUpperCase()
    : '';
  const displayName = user?.first_name
    ? `${user.first_name} ${user.last_name ?? ''}`.trim()
    : user?.username ?? '';
  const profileRoute =
    user?.role === 'student'    ? '/student/profile' :
    user?.role === 'mentor'     ? '/mentor/profile'  : '/admin/settings';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-30 h-10 bg-white border-b border-gray-200 flex items-center px-4 gap-3">
        <Link to="/org/dashboard" className="hidden sm:flex items-center gap-2.5 shrink-0 self-stretch py-1">
          <div className="bg-gray-100 rounded h-full flex items-center px-1.5">
            <img src="/gile.png" alt="GILE Foundation" className="h-full w-auto" />
          </div>
          <span className="text-[15px] font-bold text-gray-900 tracking-tight">GILE Foundation</span>
        </Link>

        {pageLabel && (
          <>
            <span className="text-gray-300 text-[13px] select-none hidden sm:block">|</span>
            <span className="text-[12.5px] text-gray-500 hidden sm:block">{pageLabel}</span>
          </>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-0.5">
          <AppSwitcher variant="light" />
          <OrgNotificationBell />

          {/* User dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setOpen(p => !p)}
              className="flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-md hover:bg-gray-100 transition-colors ml-0.5"
            >
              {user?.profile_picture ? (
                <img src={user.profile_picture} alt={displayName} className="w-7 h-7 rounded-md object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-md bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {initials}
                </div>
              )}
              <ChevronDown size={11} className="text-gray-500" />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-50">
                {/* User info */}
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                  {user?.profile_picture ? (
                    <img src={user.profile_picture} alt={displayName} className="w-9 h-9 rounded-md object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-md bg-teal-600 text-white text-[12px] font-bold flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 truncate">{displayName}</p>
                    <p className="text-[11px] text-gray-400">@{user?.username}</p>
                  </div>
                </div>

                <Link
                  to={profileRoute}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <User size={13} /> My Profile
                </Link>

                <button
                  onClick={() => { setOpen(false); setLogout(true); }}
                  className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={13} /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {logoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-[340px] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <LogOut size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-[15px] font-bold text-gray-900">Log out?</p>
                <p className="text-[12.5px] text-gray-500 mt-0.5">You'll be returned to the login screen.</p>
              </div>
            </div>
            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => setLogout(false)}
                className="flex-1 px-4 py-2 text-[13px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2 text-[13px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
