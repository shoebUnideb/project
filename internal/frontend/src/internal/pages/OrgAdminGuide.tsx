import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  UserCog, Building2, Users, ClipboardList, Layers, FolderOpen,
  GraduationCap, ClipboardEdit, CalendarDays, MessageSquare,
  Activity, Sparkles, BarChart2,
  UserPlus, Shield, Settings, Download, Archive, Search, Eye,
  Bell, RefreshCw, Copy, FileText, Send, CheckSquare, Award,
  Video, Hash, Paperclip, Bookmark, TrendingUp, Zap, Link2,
  Plus, Filter, List, UserCheck, BookOpen,
  CheckCircle2, Clock, ArrowRight,
  ChevronRight, ExternalLink,
} from 'lucide-react';
import { useOrg } from '../context/OrgContext';
import { membersStatsApi, orgApi, trainingApi, docApi, contributionsApi } from '../api/orgApi';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LiveStatus { count: number; label: string; }
type LiveDataKey = 'members' | 'departments' | 'onboarding' | 'documents' | 'courses' | 'contributions';

interface LiveData {
  members:       LiveStatus | null;
  departments:   LiveStatus | null;
  onboarding:    LiveStatus | null;
  documents:     LiveStatus | null;
  courses:       LiveStatus | null;
  contributions: LiveStatus | null;
}

interface Capability {
  icon:  React.ReactNode;
  title: string;
  desc:  string;
}

interface GuideItem {
  id:           string;
  group:        string;
  title:        string;
  subtitle:     string;
  icon:         (size: number) => React.ReactNode;
  route:        string;
  liveKey:      LiveDataKey | null;
  capabilities: Capability[];
  keyCaps:      string[];
  learnMore:    string[];
}

// ── Guide data ────────────────────────────────────────────────────────────────

const GUIDE_ITEMS: GuideItem[] = [
  // ── Organisation Setup ─────────────────────────────────────────────────────
  {
    id: 'users-roles', group: 'Organisation Setup',
    title: 'Users & Roles',
    subtitle: 'Manage members, roles and permissions.',
    icon: (s) => <UserCog size={s} />,
    route: '/org/members', liveKey: 'members',
    capabilities: [
      { icon: <UserPlus size={16} />, title: 'Invite',      desc: 'Add members by email with an instant login link.' },
      { icon: <Shield   size={16} />, title: 'Assign',      desc: 'Set permissions by assigning a role on creation.' },
      { icon: <Settings size={16} />, title: 'Manage',      desc: 'Edit, suspend, or deactivate member accounts.' },
      { icon: <Activity size={16} />, title: 'Fingerprint', desc: 'View a full timeline of each member\'s activity.' },
      { icon: <Download size={16} />, title: 'Export',      desc: 'Export the full member list as CSV.' },
    ],
    keyCaps: [
      'Invite members by email — they receive an instant login link',
      'Assign a role to each member that bundles their permissions',
      'Deactivate or suspend accounts without permanently deleting them',
      'Click any member row to open the People Fingerprint view',
      'Create custom roles (e.g. Intern, Manager) with scoped permissions',
      'Export the full member list as CSV for reporting or HR records',
    ],
    learnMore: ['How to invite members', 'Managing roles & permissions', 'Export member data'],
  },
  {
    id: 'departments', group: 'Organisation Setup',
    title: 'Departments',
    subtitle: 'Organize teams and set org structure.',
    icon: (s) => <Building2 size={s} />,
    route: '/org/departments', liveKey: 'departments',
    capabilities: [
      { icon: <Plus      size={16} />, title: 'Create',  desc: 'Add departments with a name and dept head.' },
      { icon: <UserCheck size={16} />, title: 'Assign',  desc: 'Add members and set department membership.' },
      { icon: <Link2     size={16} />, title: 'Link',    desc: 'Auto-creates a chat channel per department.' },
      { icon: <BarChart2 size={16} />, title: 'Analyze', desc: 'View dept breakdowns throughout analytics.' },
      { icon: <Archive   size={16} />, title: 'Archive', desc: 'Archive inactive departments without data loss.' },
    ],
    keyCaps: [
      'Create departments with a name, description, and department head',
      'Assign members — dept membership drives filters platform-wide',
      'A chat channel is automatically created for every new department',
      'Archive inactive departments without losing history or member data',
      'Department breakdowns appear throughout Reports & Analytics',
      'View the full org hierarchy tree in the right panel at a glance',
    ],
    learnMore: ['How to create a department', 'Managing department members', 'Department analytics overview'],
  },
  {
    id: 'directory', group: 'Organisation Setup',
    title: 'People Directory',
    subtitle: 'View and manage all members.',
    icon: (s) => <Users size={s} />,
    route: '/org/directory', liveKey: 'members',
    capabilities: [
      { icon: <Search        size={16} />, title: 'Search',  desc: 'Find any member by name, role, dept, or email.' },
      { icon: <Eye           size={16} />, title: 'View',    desc: 'Open extended profile with skills and manager.' },
      { icon: <MessageSquare size={16} />, title: 'Message', desc: 'Send a direct message from the directory.' },
      { icon: <Filter        size={16} />, title: 'Filter',  desc: 'Filter by status, department, or role.' },
      { icon: <Download      size={16} />, title: 'Export',  desc: 'Export the current filtered view as CSV.' },
    ],
    keyCaps: [
      'Search any member by name, role, department, or email',
      'Toggle between avatar grid view and sortable list view',
      'Click a member to see skills, buddy, and manager info',
      'Send a direct message to any member with a single click',
      'Export the current filtered view as CSV for audits or reports',
      'Regular members also have access to the directory',
    ],
    learnMore: ['Using the People Directory', 'Viewing member profiles', 'Exporting directory data'],
  },

  // ── Onboard Members ────────────────────────────────────────────────────────
  {
    id: 'onboarding-mgmt', group: 'Onboard Members',
    title: 'Onboarding Management',
    subtitle: 'Build onboarding experiences for new joiners.',
    icon: (s) => <ClipboardList size={s} />,
    route: '/org/onboarding-mgmt', liveKey: 'onboarding',
    capabilities: [
      { icon: <Plus      size={16} />, title: 'Create',  desc: 'Build a program per member with a template.' },
      { icon: <UserCheck size={16} />, title: 'Assign',  desc: 'Set a buddy and manager for each program.' },
      { icon: <Activity  size={16} />, title: 'Monitor', desc: 'Track tasks in real time — pending to complete.' },
      { icon: <Bell      size={16} />, title: 'Remind',  desc: 'Nudge members with overdue or unstarted tasks.' },
      { icon: <RefreshCw size={16} />, title: 'Reset',   desc: 'Reset or archive completed onboarding programs.' },
    ],
    keyCaps: [
      'Create one onboarding program per member using a task template',
      'Assign a buddy and a manager so members know who to contact',
      'Monitor real-time progress: pending, in progress, overdue, complete',
      'Send reminder nudges to members who have not started or are overdue',
      'Each task type has its own workflow: upload, approve, form, meeting',
      'Reset or archive completed onboardings at any time',
    ],
    learnMore: ['Creating onboarding programs', 'Tracking member progress', 'Sending reminders'],
  },
  {
    id: 'task-templates', group: 'Onboard Members',
    title: 'Task Templates',
    subtitle: 'Create and manage reusable task libraries.',
    icon: (s) => <Layers size={s} />,
    route: '/org/task-templates', liveKey: null,
    capabilities: [
      { icon: <Layers       size={16} />, title: 'Build',  desc: 'Create named step libraries for onboarding.' },
      { icon: <List         size={16} />, title: 'Types',  desc: 'Five task types: Info, Upload, Approval, Meeting, Form.' },
      { icon: <Copy         size={16} />, title: 'Clone',  desc: 'Duplicate any template as a starting point.' },
      { icon: <Download     size={16} />, title: 'Import', desc: 'Pull pre-built blueprints from the Template Hub.' },
      { icon: <CalendarDays size={16} />, title: 'Phases', desc: 'Assign phase labels and due-offsets per task.' },
    ],
    keyCaps: [
      'A template is a named task list you create once and reuse many times',
      'Five task types: Info, Upload, Approval, Meeting, Form',
      'Set a phase label (e.g. Week 1) and due-offset in days per task',
      'Mark tasks Required — they block the completion certificate until done',
      'Clone any existing template to use as a starting point',
      'Import pre-built blueprints from the Template Hub and customise them',
    ],
    learnMore: ['Building task templates', 'Task types explained', 'Cloning templates'],
  },
  {
    id: 'documents', group: 'Onboard Members',
    title: 'Agreements',
    subtitle: 'Manage agreements & acknowledgements.',
    icon: (s) => <FolderOpen size={s} />,
    route: '/org/documents', liveKey: 'documents',
    capabilities: [
      { icon: <FileText    size={16} />, title: 'Create', desc: 'Build doc templates once and reuse for any member.' },
      { icon: <Send        size={16} />, title: 'Assign', desc: 'Assign to any member or attach to an onboarding program.' },
      { icon: <CheckSquare size={16} />, title: 'Review', desc: 'Approve or reject uploads with an optional note.' },
      { icon: <Clock       size={16} />, title: 'Track',  desc: 'Set expiration dates with automated alerts.' },
      { icon: <Download    size={16} />, title: 'Export', desc: 'Export full document status as CSV for compliance.' },
    ],
    keyCaps: [
      'Create document templates (NDAs, contracts, policy sign-offs) once',
      'Members upload signed copies directly in the portal for your review',
      'Approve or reject with an optional note — members are notified instantly',
      'Set expiration dates — the platform alerts before agreements expire',
      'Attach agreements to onboarding programs for automatic assignment',
      'Export the complete document status report as CSV for compliance',
    ],
    learnMore: ['Assigning documents', 'Reviewing member uploads', 'Document expiration tracking'],
  },

  // ── Learning & Growth ──────────────────────────────────────────────────────
  {
    id: 'training', group: 'Learning & Growth',
    title: 'Training',
    subtitle: 'Create training modules and track progress.',
    icon: (s) => <GraduationCap size={s} />,
    route: '/org/training', liveKey: 'courses',
    capabilities: [
      { icon: <BookOpen  size={16} />, title: 'Build',   desc: 'Courses with modules, chapters, and lessons.' },
      { icon: <UserPlus  size={16} />, title: 'Enroll',  desc: 'Add members individually or enroll a whole dept.' },
      { icon: <BarChart2 size={16} />, title: 'Track',   desc: 'Monitor completion rates and average quiz scores.' },
      { icon: <Award     size={16} />, title: 'Certify', desc: 'Auto-generate downloadable completion certificates.' },
      { icon: <Bell      size={16} />, title: 'Remind',  desc: 'Auto-remind members who skip mandatory courses.' },
    ],
    keyCaps: [
      'Build courses from modules and lessons — drag-and-drop to reorder',
      'Four lesson types: Video, Reading, Quiz (with pass threshold), Assignment',
      'Mark a course Mandatory to trigger automatic reminders for non-completers',
      'Enrol members individually or auto-enrol an entire department at once',
      'Track per-course completion rate, average quiz score, and certificates issued',
      'Completion certificates are auto-generated and downloadable by members',
    ],
    learnMore: ['Creating training courses', 'Enrolling members', 'Tracking completion rates'],
  },
  {
    id: 'forms', group: 'Learning & Growth',
    title: 'Forms & Surveys',
    subtitle: 'Build forms and collect responses from members.',
    icon: (s) => <ClipboardEdit size={s} />,
    route: '/org/forms', liveKey: null,
    capabilities: [
      { icon: <ClipboardEdit size={16} />, title: 'Build',     desc: 'Drag-and-drop field builder, no code required.' },
      { icon: <Users         size={16} />, title: 'Assign',    desc: 'Target all members, a dept, or specific people.' },
      { icon: <Clock         size={16} />, title: 'Deadlines', desc: 'Set due dates — overdue forms are highlighted.' },
      { icon: <CheckCircle2  size={16} />, title: 'Collect',   desc: 'Aggregated results and per-question breakdowns.' },
      { icon: <Download      size={16} />, title: 'Export',    desc: 'Export all responses as CSV for analysis.' },
    ],
    keyCaps: [
      'Build forms with a drag-and-drop field builder — no code required',
      'Field types: short text, long text, multiple choice, rating, date, file upload',
      'Assign to all members, a specific department, or handpicked individuals',
      'Set a due date — overdue forms are highlighted in the member\'s portal',
      'View aggregated results, per-question breakdowns, and individual responses',
      'Export all responses as CSV for further analysis or BI tools',
    ],
    learnMore: ['Creating forms and surveys', 'Assigning forms to members', 'Viewing form responses'],
  },
  {
    id: 'events', group: 'Learning & Growth',
    title: 'Events & Meetings',
    subtitle: 'Schedule events and manage RSVPs.',
    icon: (s) => <CalendarDays size={s} />,
    route: '/org/events', liveKey: null,
    capabilities: [
      { icon: <CalendarDays size={16} />, title: 'Schedule', desc: 'One-off or recurring events of any type.' },
      { icon: <Users        size={16} />, title: 'Target',   desc: 'All members, a dept, or a handpicked list.' },
      { icon: <Video        size={16} />, title: 'Virtual',  desc: 'Attach Zoom, Teams, or Meet links.' },
      { icon: <CheckCircle2 size={16} />, title: 'RSVP',     desc: 'Members RSVP directly from their portal.' },
      { icon: <Activity     size={16} />, title: 'Attend',   desc: 'Record post-event attendance permanently.' },
    ],
    keyCaps: [
      'Schedule one-off or recurring events — orientations, webinars, check-ins',
      'Set a physical location or attach a virtual meeting link (Zoom, Teams, Meet)',
      'Target events to all members, a specific department, or a handpicked list',
      'Members RSVP directly from their portal and see it in their calendar',
      'Mark attendance after the event to keep a permanent participation record',
      'Upcoming events surface automatically on every member\'s dashboard',
    ],
    learnMore: ['Scheduling events', 'Managing RSVPs', 'Recording attendance'],
  },

  // ── Communication ──────────────────────────────────────────────────────────
  {
    id: 'chat', group: 'Communication',
    title: 'Chat',
    subtitle: 'Monitor conversations and settings.',
    icon: (s) => <MessageSquare size={s} />,
    route: '/org/chat', liveKey: null,
    capabilities: [
      { icon: <Hash          size={16} />, title: 'Channels', desc: 'Create topic or team channels with member access.' },
      { icon: <MessageSquare size={16} />, title: 'DMs',      desc: 'Direct messaging between any org members.' },
      { icon: <BarChart2     size={16} />, title: 'Polls',    desc: 'Run quick team votes inside any channel.' },
      { icon: <Paperclip    size={16} />, title: 'Files',    desc: 'Attach files and images to any message.' },
      { icon: <Bookmark     size={16} />, title: 'Pins',     desc: 'Pin key messages at the top of a channel.' },
    ],
    keyCaps: [
      '#general, #announcements, and #random are auto-created on first member',
      'A #dept channel is automatically created for every new department',
      'Create custom channels for any topic or project with per-channel access',
      'Members send direct messages to any other org member in one click',
      'Attach files and images to messages; run polls for quick team votes',
      'Pin important messages so they stay visible at the top for everyone',
    ],
    learnMore: ['Creating chat channels', 'Direct messaging members', 'Using polls in channels'],
  },
  {
    id: 'contributions', group: 'Communication',
    title: 'Contributions',
    subtitle: 'Review and approve member work logs.',
    icon: (s) => <Activity size={s} />,
    route: '/org/contributions', liveKey: 'contributions',
    capabilities: [
      { icon: <CheckSquare size={16} />, title: 'Review',  desc: 'Approve or reject each log with an optional note.' },
      { icon: <Layers      size={16} />, title: 'Bulk',    desc: 'Process many submissions at once in bulk.' },
      { icon: <BarChart2   size={16} />, title: 'Analyze', desc: 'Volume charts by member and department.' },
      { icon: <Clock       size={16} />, title: 'History', desc: 'View per-member contribution log history.' },
      { icon: <Download    size={16} />, title: 'Export',  desc: 'Export all data as CSV for payroll or reports.' },
    ],
    keyCaps: [
      'Members log work hours, completed tasks, or deliverables from their portal',
      'Every submission lands in your Approval Queue for review',
      'Use Bulk Review to process many submissions at once instead of one by one',
      'Click any member row to open their full contribution detail and history',
      'Charts show contribution volume over time and breakdown by department',
      'Export all contribution data as CSV for payroll processing or impact reports',
    ],
    learnMore: ['Reviewing contributions', 'Bulk approval workflow', 'Contribution analytics'],
  },
  {
    id: 'template-hub', group: 'Communication',
    title: 'Template Hub',
    subtitle: 'Access and manage reusable onboarding templates.',
    icon: (s) => <Sparkles size={s} />,
    route: '/org/template-hub', liveKey: null,
    capabilities: [
      { icon: <Search        size={16} />, title: 'Browse',    desc: 'Explore a curated library of pre-built blueprints.' },
      { icon: <Download      size={16} />, title: 'Import',    desc: 'Import any blueprint in one click.' },
      { icon: <ClipboardEdit size={16} />, title: 'Customize', desc: 'Fully editable after import in Task Templates.' },
      { icon: <Users         size={16} />, title: 'Roles',     desc: 'Covers NGOs, interns, engineers, managers, and more.' },
      { icon: <Zap           size={16} />, title: 'Save Time', desc: 'Skip building from scratch with a ready blueprint.' },
    ],
    keyCaps: [
      'A curated library of ready-made onboarding blueprints for common roles',
      'Import any blueprint in one click — it becomes a fully editable task template',
      'Blueprints cover NGO staff, interns, engineers, managers, coordinators',
      'Each blueprint shows estimated time, phase breakdown, and task count',
      'After import, customise every step directly in Task Templates',
      'Use blueprints as a starting point to save hours of manual setup',
    ],
    learnMore: ['Browsing the Template Hub', 'Importing blueprints', 'Customising templates'],
  },

  // ── Reporting ──────────────────────────────────────────────────────────────
  {
    id: 'analytics', group: 'Reporting',
    title: 'Reports & Analytics',
    subtitle: 'Get insights and export org-wide reports.',
    icon: (s) => <BarChart2 size={s} />,
    route: '/org/analytics', liveKey: null,
    capabilities: [
      { icon: <TrendingUp    size={16} />, title: 'KPIs',     desc: 'Org-wide health metrics on one screen.' },
      { icon: <Search        size={16} />, title: 'Drill',    desc: 'Per-member contribution and activity detail.' },
      { icon: <GraduationCap size={16} />, title: 'Training', desc: 'Course completion rates and certificate counts.' },
      { icon: <Filter        size={16} />, title: 'Filter',   desc: 'Filter charts by dept, role, or date range.' },
      { icon: <Download      size={16} />, title: 'Export',   desc: 'Export any view as CSV for spreadsheets or BI tools.' },
    ],
    keyCaps: [
      'Org-wide KPIs on one screen — active members, hours logged, completions',
      'Contribution drilldown: per-member hours, approval rate, weekly trends',
      'Training tab: per-course completion rate, enrolment, score, certificates',
      'Filter every chart by department, role, or custom date range',
      'Export any data view as CSV for further analysis in spreadsheets or BI tools',
      'Use Analytics as your weekly admin health check to spot issues early',
    ],
    learnMore: ['Contribution analytics', 'Training analytics', 'Exporting data reports'],
  },
];

const TRACKED: LiveDataKey[] = ['members', 'departments', 'onboarding', 'documents', 'courses', 'contributions'];

// ── Explore list item ─────────────────────────────────────────────────────────

function ExploreListItem({ item, isSelected, onClick }: {
  item:       GuideItem;
  isSelected: boolean;
  onClick:    () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors border-l-2',
        isSelected
          ? 'border-teal-500 bg-teal-50/60'
          : 'border-transparent hover:bg-gray-50',
      ].join(' ')}
    >
      <span className={`shrink-0 ${isSelected ? 'text-teal-600' : 'text-gray-400'}`}>
        {item.icon(16)}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-semibold truncate ${isSelected ? 'text-teal-700' : 'text-gray-800'}`}>
          {item.title}
        </p>
        <p className="text-[11.5px] text-gray-400 truncate">{item.subtitle}</p>
      </div>
      <ChevronRight size={14} className={`shrink-0 ${isSelected ? 'text-teal-500' : 'text-gray-300'}`} />
    </button>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ item, liveData, liveLoading, navigate }: {
  item:        GuideItem;
  liveData:    LiveData;
  liveLoading: boolean;
  navigate:    ReturnType<typeof useNavigate>;
}) {
  const status = item.liveKey ? liveData[item.liveKey] : undefined;

  return (
    <div className="max-w-3xl">
      {/* Icon + title */}
      <div className="flex items-start gap-4 mb-5">
        <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center shrink-0 text-teal-600">
          {item.icon(24)}
        </div>
        <div>
          <h2 className="text-[20px] font-bold text-gray-900">{item.title}</h2>
          <p className="text-[13px] text-gray-500 mt-0.5">{item.subtitle}</p>
        </div>
      </div>

      {/* Capabilities row */}
      <div className="grid grid-cols-5 gap-3 mb-7">
        {item.capabilities.map((cap, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-3.5">
            <div className="text-gray-400 mb-2.5">{cap.icon}</div>
            <p className="text-[12px] font-semibold text-gray-800 mb-1">{cap.title}</p>
            <p className="text-[11px] text-gray-400 leading-snug">{cap.desc}</p>
          </div>
        ))}
      </div>

      {/* Key Capabilities */}
      <div className="mb-7">
        <p className="text-[13px] font-bold text-gray-900 mb-3">Key Capabilities</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
          {item.keyCaps.map((cap, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 size={13} className="text-teal-500 shrink-0 mt-[3px]" />
              <span className="text-[12.5px] text-gray-600 leading-snug">{cap}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Learn more */}
      <div className="mb-7">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Learn more</p>
        <div className="flex items-center flex-wrap gap-5">
          {item.learnMore.map(link => (
            <button
              key={link}
              onClick={() => navigate(item.route)}
              className="flex items-center gap-1 text-[12.5px] text-teal-600 hover:text-teal-700 font-medium transition-colors"
            >
              {link} <ExternalLink size={11} />
            </button>
          ))}
        </div>
      </div>

      {/* Go button */}
      <button
        onClick={() => navigate(item.route)}
        className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-[13px] font-semibold rounded-lg hover:bg-teal-700 transition-colors"
      >
        Go to {item.title} <ArrowRight size={14} />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OrgAdminGuide() {
  const navigate = useNavigate();
  const { isSuperadmin, canManageMembers } = useOrg();
  const isAdmin = isSuperadmin || canManageMembers;

  const [selectedId, setSelectedId] = useState<string>(GUIDE_ITEMS[0].id);
  const [liveData,   setLiveData]   = useState<LiveData>({
    members: null, departments: null, onboarding: null,
    documents: null, courses: null, contributions: null,
  });
  const [liveLoading, setLiveLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      membersStatsApi.getStats(),
      orgApi.getDepartmentStats(),
      orgApi.getOnboardingStats(),
      docApi.getDocGlobalStats(),
      trainingApi.getCourses(),
      contributionsApi.getAdminSummary(),
    ]).then(([m, d, o, doc, t, c]) => {
      setLiveData({
        members:
          m.status === 'fulfilled' && m.value.total > 0
            ? { count: m.value.total, label: `${m.value.total} member${m.value.total !== 1 ? 's' : ''}` }
            : null,
        departments:
          d.status === 'fulfilled' && d.value.total_departments > 0
            ? { count: d.value.total_departments, label: `${d.value.total_departments} department${d.value.total_departments !== 1 ? 's' : ''}` }
            : null,
        onboarding:
          o.status === 'fulfilled' && o.value.total > 0
            ? { count: o.value.total, label: `${o.value.total} program${o.value.total !== 1 ? 's' : ''}` }
            : null,
        documents:
          doc.status === 'fulfilled' && doc.value.total_documents > 0
            ? { count: doc.value.total_documents, label: `${doc.value.total_documents} document${doc.value.total_documents !== 1 ? 's' : ''}` }
            : null,
        courses:
          t.status === 'fulfilled' && t.value.length > 0
            ? { count: t.value.length, label: `${t.value.length} course${t.value.length !== 1 ? 's' : ''}` }
            : null,
        contributions:
          c.status === 'fulfilled' && c.value.active_contributors > 0
            ? { count: c.value.active_contributors, label: `${c.value.active_contributors} active contributor${c.value.active_contributors !== 1 ? 's' : ''}` }
            : null,
      });
    }).finally(() => setLiveLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAdmin) return <Navigate to="/org/dashboard" replace />;

  const selectedItem = GUIDE_ITEMS.find(i => i.id === selectedId) ?? GUIDE_ITEMS[0];
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="flex flex-col -m-6">

      {/* ── Header ── */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[16px] font-bold text-gray-900">Admin Guide</h1>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Everything you can do in the internal portal — with live setup status
            </p>
          </div>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 text-[12.5px] font-semibold text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed select-none mt-0.5"
            title="Coming soon"
          >
            <Download size={14} /> Download Guide (PDF)
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex">

        {/* Explore list */}
        <div className="w-[320px] shrink-0 bg-white border-r border-gray-100 flex flex-col">
          <div className="flex-1">
            {GUIDE_ITEMS.map(item => (
              <ExploreListItem
                key={item.id}
                item={item}
                isSelected={selectedId === item.id}
                onClick={() => setSelectedId(item.id)}
              />
            ))}
            <p className="text-[11px] text-gray-300 px-5 py-3">Last updated: {today}</p>
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 px-8 py-6 bg-gray-50">
          <DetailPanel
            item={selectedItem}
            liveData={liveData}
            liveLoading={liveLoading}
            navigate={navigate}
          />
        </div>

      </div>
    </div>
  );
}
