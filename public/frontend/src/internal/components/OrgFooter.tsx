import { Link } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Activity, UserCog, BarChart2, ClipboardEdit,
  ListChecks, GraduationCap, CalendarDays, Users, FolderOpen,
  BookOpen, HelpCircle, FileText, Phone, Compass,
  Info, Globe, Lock, Shield, Mail, CheckCircle2,
} from 'lucide-react';
import { useOrg } from '../context/OrgContext';

interface FooterLink { icon: React.ReactNode; label: string; to: string; }

const ADMIN_PORTAL_LINKS: FooterLink[] = [
  { icon: <LayoutDashboard size={13} />, label: 'Dashboard',       to: '/org/dashboard' },
  { icon: <ClipboardList   size={13} />, label: 'Onboarding Mgmt', to: '/org/onboarding-mgmt' },
  { icon: <Activity        size={13} />, label: 'Contributions',   to: '/org/contributions' },
  { icon: <UserCog         size={13} />, label: 'Users & Roles',   to: '/org/members' },
  { icon: <BarChart2       size={13} />, label: 'Analytics',       to: '/org/analytics' },
  { icon: <ClipboardEdit   size={13} />, label: 'Forms & Surveys', to: '/org/forms' },
];

const MEMBER_PORTAL_LINKS: FooterLink[] = [
  { icon: <LayoutDashboard size={13} />, label: 'Dashboard',        to: '/org/dashboard' },
  { icon: <ListChecks      size={13} />, label: 'My Onboarding',    to: '/org/onboarding' },
  { icon: <Activity        size={13} />, label: 'Contributions',    to: '/org/contributions' },
  { icon: <GraduationCap   size={13} />, label: 'Training',         to: '/org/training' },
  { icon: <CalendarDays    size={13} />, label: 'Events & Meetings',to: '/org/events' },
  { icon: <Users           size={13} />, label: 'People Directory', to: '/org/directory' },
  { icon: <FolderOpen      size={13} />, label: 'Agreements',       to: '/org/documents' },
];

const ADMIN_RESOURCE_LINKS: FooterLink[] = [
  { icon: <BookOpen    size={13} />, label: 'Admin Guide',          to: '/org/admin-guide' },
  { icon: <Compass     size={13} />, label: 'Getting Started',      to: '/org/admin-guide' },
  { icon: <HelpCircle  size={13} />, label: 'Help Center',          to: '/org/admin-guide' },
  { icon: <FileText    size={13} />, label: 'FAQ',                  to: '/org/admin-guide' },
  { icon: <FileText    size={13} />, label: 'Release Notes',        to: '/org/admin-guide' },
  { icon: <Phone       size={13} />, label: 'Contact Support',      to: '/org/admin-guide' },
];

const MEMBER_RESOURCE_LINKS: FooterLink[] = [
  { icon: <Compass     size={13} />, label: 'Getting Started',      to: '/org/onboarding' },
  { icon: <HelpCircle  size={13} />, label: 'Help Center',          to: '/org/onboarding' },
  { icon: <FileText    size={13} />, label: 'FAQ',                  to: '/org/onboarding' },
  { icon: <FileText    size={13} />, label: 'Release Notes',        to: '/org/onboarding' },
  { icon: <Phone       size={13} />, label: 'Contact Support',      to: '/org/onboarding' },
];

const COMPANY_LINKS: FooterLink[] = [
  { icon: <Info    size={13} />, label: 'About GILE Foundation', to: '/org/dashboard' },
  { icon: <Globe   size={13} />, label: 'Our Mission',           to: '/org/dashboard' },
  { icon: <Lock    size={13} />, label: 'Privacy Policy',        to: '/org/dashboard' },
  { icon: <FileText size={13}/>, label: 'Terms of Service',      to: '/org/dashboard' },
  { icon: <FileText size={13}/>, label: 'Cookie Policy',         to: '/org/dashboard' },
  { icon: <Shield  size={13} />, label: 'Data Security',         to: '/org/dashboard' },
];

function FooterCol({ heading, links }: { heading: string; links: FooterLink[] }) {
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-3">{heading}</p>
      <ul className="space-y-2.5">
        {links.map(l => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="flex items-center gap-2 text-[12.5px] text-gray-500 hover:text-gray-800 transition-colors"
            >
              <span className="text-gray-400 shrink-0">{l.icon}</span>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OrgFooter() {
  const { isSuperadmin, canManageMembers } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;

  const portalHeading = isAdmin ? 'Admin Portal' : 'Internal Portal';
  const portalLinks   = isAdmin ? ADMIN_PORTAL_LINKS  : MEMBER_PORTAL_LINKS;
  const resourceLinks = isAdmin ? ADMIN_RESOURCE_LINKS : MEMBER_RESOURCE_LINKS;

  return (
    <footer className="mt-3 border-t border-gray-200 bg-white">
      <div className="px-8 py-10">
        <div className="grid grid-cols-4 gap-8">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <img src="/gile.png" alt="GILE Foundation" className="h-8 w-auto" />
              <span className="text-[14px] font-bold text-gray-900 tracking-tight">GILE Foundation</span>
            </div>
            <p className="text-[12.5px] text-gray-500 leading-relaxed mb-4">
              {isAdmin
                ? 'The GILE Foundation internal portal — manage members, onboarding, and org operations at a glance.'
                : 'The GILE Foundation internal portal — your onboarding, contributions, and team resources in one place.'}
            </p>
            <div className="flex items-center gap-1.5 text-[12px] text-gray-400 mb-4">
              <Mail size={13} className="shrink-0" />
              support@gilefoundation.org
            </div>
            <div className="flex items-center gap-3">
              <a href="#" className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="LinkedIn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Twitter">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="GitHub">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
              </a>
            </div>
          </div>

          <FooterCol heading={portalHeading} links={portalLinks} />
          <FooterCol heading="Resources"     links={resourceLinks} />
          <FooterCol heading="Company"       links={COMPANY_LINKS} />

        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-100 px-8 py-3 flex items-center justify-between">
        <p className="text-[11.5px] text-gray-400">© 2026 GILE Foundation.</p>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-emerald-500" />
          <span className="text-[11.5px] text-gray-400">All systems operational</span>
        </div>
      </div>
    </footer>
  );
}
