import { Link } from 'react-router-dom';
import {
  ShieldCheck, Mail, Linkedin, Twitter, Github,
  LayoutDashboard, Users, LayoutGrid, MessageSquare,
  Store, Newspaper, ClipboardList, BookOpen, Settings,
  User, CheckCircle2, HelpCircle, FileText, Lock,
  Globe, Info, Phone, Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { Role } from '../../types';

const YEAR = new Date().getFullYear();

interface NavLink { label: string; to: string; icon: React.ReactNode }
interface ExtLink { label: string; href: string; icon: React.ReactNode }

const PLATFORM_LINKS: Record<Role, NavLink[]> = {
  student: [
    { label: 'Workspaces',  to: '/workspaces',        icon: <LayoutGrid size={12} /> },
    { label: 'Dashboard',   to: '/student/dashboard', icon: <LayoutDashboard size={12} /> },
    { label: 'Feed',        to: '/feed',              icon: <Newspaper size={12} /> },
    { label: 'Messages',    to: '/messages',          icon: <MessageSquare size={12} /> },
    { label: 'Marketplace', to: '/marketplace',       icon: <Store size={12} /> },
    { label: 'My Profile',  to: '/student/profile',  icon: <User size={12} /> },
  ],
  mentor: [
    { label: 'Dashboard',   to: '/mentor/dashboard', icon: <LayoutDashboard size={12} /> },
    { label: 'My Students', to: '/mentor/students',  icon: <Users size={12} /> },
    { label: 'Workspaces',  to: '/workspaces',       icon: <LayoutGrid size={12} /> },
    { label: 'Feed',        to: '/feed',             icon: <Newspaper size={12} /> },
    { label: 'Messages',    to: '/mentor/messages',  icon: <MessageSquare size={12} /> },
    { label: 'Marketplace', to: '/marketplace',      icon: <Store size={12} /> },
    { label: 'My Profile',  to: '/mentor/profile',  icon: <User size={12} /> },
  ],
  superadmin: [
    { label: 'Dashboard',    to: '/admin/dashboard',    icon: <LayoutDashboard size={12} /> },
    { label: 'Users',        to: '/admin/users',        icon: <Users size={12} /> },
    { label: 'Assignments',  to: '/admin/assignments',  icon: <ClipboardList size={12} /> },
    { label: 'Workspaces',   to: '/workspaces',         icon: <LayoutGrid size={12} /> },
    { label: 'Feed',         to: '/feed',               icon: <Newspaper size={12} /> },
    { label: 'Messages',     to: '/admin/messages',     icon: <MessageSquare size={12} /> },
    { label: 'Settings',     to: '/admin/settings',     icon: <Settings size={12} /> },
  ],
};

const RESOURCE_LINKS: ExtLink[] = [
  { label: 'Help Center',           href: '#', icon: <HelpCircle size={12} /> },
  { label: 'Getting Started Guide', href: '#', icon: <Zap size={12} /> },
  { label: 'Study Abroad Handbook', href: '#', icon: <BookOpen size={12} /> },
  { label: 'FAQ',                   href: '#', icon: <FileText size={12} /> },
  { label: 'Release Notes',         href: '#', icon: <CheckCircle2 size={12} /> },
  { label: 'Contact Support',       href: '#', icon: <Phone size={12} /> },
];

const COMPANY_LINKS: ExtLink[] = [
  { label: 'About GILE Foundation', href: '#', icon: <Info size={12} /> },
  { label: 'Our Mission',         href: '#', icon: <Globe size={12} /> },
  { label: 'Privacy Policy',      href: '#', icon: <Lock size={12} /> },
  { label: 'Terms of Service',    href: '#', icon: <FileText size={12} /> },
  { label: 'Cookie Policy',       href: '#', icon: <FileText size={12} /> },
  { label: 'Data Security',       href: '#', icon: <ShieldCheck size={12} /> },
];

const ROLE_HEADING: Record<Role, string> = {
  student:    'Student Platform',
  mentor:     'Mentor Platform',
  superadmin: 'Admin Platform',
};

const ROLE_TAGLINE: Record<Role, string> = {
  student:    'Connect with your mentors, grow your skills, and unlock new opportunities and all in one place.',
  mentor:     'Empower the next generation. Guide your mentees, share knowledge, and track their growth.',
  superadmin: 'Manage the GILE mentorship network — users, workspaces, and platform health at a glance.',
};

export default function Footer() {
  const { user } = useAuth();

  const role       = user?.role ?? 'student';
  const platLinks  = PLATFORM_LINKS[role] ?? PLATFORM_LINKS.student;
  const heading    = ROLE_HEADING[role];
  const tagline    = ROLE_TAGLINE[role];

  return (
    <footer className="border-t border-[#e0e0e0] bg-white">

      {/* ── Main grid ─────────────────────────────────────────── */}
      <div className="px-8 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">

        {/* Col 1 — Brand */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <img src="/gile.png" alt="GILE Foundation" className="h-20 w-auto" />
          </div>
          <p className="text-[12px] text-gray-500 leading-relaxed max-w-[200px]">
            {tagline}
          </p>
          <div className="flex items-center gap-1.5 text-[11.5px] text-gray-500">
            <Mail size={12} className="shrink-0" />
            <a href="mailto:support@gilefoundation.org"
               className="hover:text-gray-900 transition-colors truncate">
              support@gilefoundation.org
            </a>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <a href="#" aria-label="LinkedIn"
               className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <Linkedin size={14} />
            </a>
            <a href="#" aria-label="Twitter / X"
               className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <Twitter size={14} />
            </a>
            <a href="#" aria-label="GitHub"
               className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <Github size={14} />
            </a>
          </div>
        </div>

        {/* Col 2 — Platform (role-aware) */}
        <div className="space-y-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-widest text-gray-400">
            {heading}
          </p>
          <ul className="space-y-1.5">
            {platLinks.map(item => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="flex items-center gap-2 text-[12.5px] text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <span className="opacity-60">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3 — Resources */}
        <div className="space-y-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-widest text-gray-400">
            Resources
          </p>
          <ul className="space-y-1.5">
            {RESOURCE_LINKS.map(item => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="flex items-center gap-2 text-[12.5px] text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <span className="opacity-60">{item.icon}</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 4 — Company & Legal */}
        <div className="space-y-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-widest text-gray-400">
            Company
          </p>
          <ul className="space-y-1.5">
            {COMPANY_LINKS.map(item => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="flex items-center gap-2 text-[12.5px] text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <span className="opacity-60">{item.icon}</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Bottom bar ────────────────────────────────────────── */}
      <div className="border-t border-[#e8e8e8] px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-[11.5px] text-gray-400">
          © {YEAR} GILE Foundation.
        </p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-[11px] text-gray-400">All systems operational</span>
        </div>
      </div>

    </footer>
  );
}
