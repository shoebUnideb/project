import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Rocket, Target, Globe, Phone, Wifi, Briefcase, Users, Heart, GraduationCap, Handshake, BarChart3, MapPin, Megaphone,
  Share2, Backpack, Compass, Network, ClipboardList, FolderOpen, Layers, MessageSquare, Coins, UserCheck,
  Search, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Upload, Plus, Filter,
  Play, MoreHorizontal, FileText, GripVertical,
  Pencil, Copy, Eye, Trash2,
  Check, X, Loader2, ArrowRight,
  BookOpen, Calendar, Info, CheckCircle2,
} from 'lucide-react';
import { orgApi, type TaskType, type AssigneeType, type OnboardingTemplate, type Department } from '../api/orgApi';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BlueprintTask {
  title: string;
  description: string;
  task_type: TaskType;
  phase: string;
  content_body: string;
  due_offset_days: number;
  required: boolean;
  approval_required: boolean;
  assignee_type: AssigneeType;
  order: number;
}

interface Blueprint {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  estimatedDays: number;
  phases: string[];
  category: string;
  tasks: BlueprintTask[];
}

const BLUEPRINT_ICONS: Record<string, React.ReactNode> = {
  'tech-startup':    <Rocket size={16} className="text-gray-700" />,
  'product-manager': <Target size={16} className="text-gray-700" />,
  'ngo-staff':       <Globe  size={16} className="text-gray-700" />,
  'sdr-onboarding':     <Phone  size={16} className="text-gray-700" />,
  'remote-engineering': <Wifi      size={16} className="text-gray-700" />,
  'executive-90':        <Briefcase size={16} className="text-gray-700" />,
  'hr-business-partner':   <Users     size={16} className="text-gray-700" />,
  'volunteer-coordinator': <Heart         size={16} className="text-gray-700" />,
  'summer-internship':        <GraduationCap size={16} className="text-gray-700" />,
  'customer-success-manager': <Handshake     size={16} className="text-gray-700" />,
  'data-analyst':             <BarChart3     size={16} className="text-gray-700" />,
  'field-program-officer':    <MapPin        size={16} className="text-gray-700" />,
  'marketing-manager':        <Megaphone     size={16} className="text-gray-700" />,
  'social-media-manager':     <Share2         size={16} className="text-gray-700" />,
  'generic-intern':           <Backpack       size={16} className="text-gray-700" />,
  'program-coordinator-ngo':  <Compass        size={16} className="text-gray-700" />,
  'ngo-program-manager':      <Network        size={16} className="text-gray-700" />,
  'operations-coordinator':   <ClipboardList  size={16} className="text-gray-700" />,
  'admin-assistant':          <FolderOpen     size={16} className="text-gray-700" />,
  'project-manager':          <Layers         size={16} className="text-gray-700" />,
  'communications-officer':   <MessageSquare  size={16} className="text-gray-700" />,
  'fundraising-officer':      <Coins          size={16} className="text-gray-700" />,
  'first-time-manager':       <UserCheck      size={16} className="text-gray-700" />,
};

// ── Blueprints ─────────────────────────────────────────────────────────────────

const BLUEPRINTS: Blueprint[] = [
  // ── 1. Tech Startup Onboarding ───────────────────────────────────────────────
  {
    id: 'tech-startup',
    title: 'Tech Startup Onboarding',
    subtitle: 'Full-stack engineer & product hire track',
    description:
      'A fast-paced, structured onboarding journey designed for technology companies. Covers environment setup, security & compliance, product deep-dives, and culture integration — from Day 1 through Month 1.',
    badge: 'Most Popular',
    estimatedDays: 30,
    category: 'Technology',
    phases: ['Day 1 — Launch Sequence', 'Week 1 — System Integration', 'Month 1 — Deep Dive'],
    tasks: [
      { title: 'Welcome to the Team!', description: 'Read your personalised welcome packet and get excited about what\'s ahead.', task_type: 'info', phase: 'Day 1 — Launch Sequence', content_body: 'Welcome aboard! This packet covers our mission, your first-week schedule, key contacts, and what to expect in your first 30 days.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Laptop & Equipment Confirmed', description: 'IT confirms your laptop, peripherals, and dev tools are fully configured.', task_type: 'approval', phase: 'Day 1 — Launch Sequence', content_body: 'Your IT administrator will verify hardware, MDM, password manager, VPN, MFA, and tokens.', due_offset_days: 1, required: true, approval_required: true, assignee_type: 'it', order: 2 },
      { title: 'Emergency Contact & Personal Details', description: 'Fill out your emergency contact information and personal HR details.', task_type: 'form', phase: 'Day 1 — Launch Sequence', content_body: 'Please provide legal name, personal email & phone, emergency contact, T-shirt size, dietary requirements, pronouns.', due_offset_days: 1, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: 'Photo ID Verification', description: 'Upload a clear photo of your government-issued ID for employment verification.', task_type: 'upload', phase: 'Day 1 — Launch Sequence', content_body: 'Please upload a clear scan or photo of passport, national ID, or driver\'s licence.', due_offset_days: 1, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: 'Team Kickoff Video Call', description: 'Jump on a 30-minute video intro with your immediate team and manager.', task_type: 'meeting', phase: 'Day 1 — Launch Sequence', content_body: 'Your manager will schedule a 30-minute video call on Day 1.', due_offset_days: 1, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'GitHub Repository Access', description: 'IT grants access to all required repositories and confirms your first commit.', task_type: 'approval', phase: 'Week 1 — System Integration', content_body: 'Access to main product monorepo, infrastructure repo, internal tooling, and GitHub Actions secrets.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 6 },
      { title: 'Slack, Notion & Tooling Setup', description: 'Confirm you\'re connected to all communication and documentation tools.', task_type: 'approval', phase: 'Week 1 — System Integration', content_body: 'Tools to verify: Slack, Notion, Linear/Jira, Figma, Google Workspace.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 7 },
      { title: 'Development Environment Survey', description: 'Report your local dev setup so we can catch issues early.', task_type: 'form', phase: 'Week 1 — System Integration', content_body: 'Tell us about your OS, dev environment setup, editor, and any blockers.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Signed Code of Conduct', description: 'Read, sign, and upload the company Code of Conduct document.', task_type: 'upload', phase: 'Week 1 — System Integration', content_body: 'Our Code of Conduct covers professional behaviour, confidentiality, conflict of interest, and acceptable use.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Security & Compliance Training', description: 'Complete the mandatory security awareness module and pass the quiz.', task_type: 'info', phase: 'Week 1 — System Integration', content_body: 'Modules on Password & Authentication, Data Classification, Device Security, and Incident Reporting.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: '1:1 with Engineering Lead', description: 'Your first technical deep-dive with the engineering lead or CTO.', task_type: 'meeting', phase: 'Week 1 — System Integration', content_body: '45-minute codebase, architecture, and deployment pipeline overview.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'Engineering Handbook Review', description: 'Read the full engineering handbook covering our standards and practices.', task_type: 'info', phase: 'Week 1 — System Integration', content_body: 'Git workflow, code review culture, testing standards, on-call rotation, RFC process.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Architecture Deep Dive', description: 'Study the full system architecture — services, data models, and integrations.', task_type: 'info', phase: 'Month 1 — Deep Dive', content_body: 'System map, data models, API contract, third-party integrations, infrastructure overview.', due_offset_days: 7, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'Live Product Demo Session', description: 'Attend a full live product walkthrough as if you were a new customer.', task_type: 'meeting', phase: 'Month 1 — Deep Dive', content_body: 'Your PM will run a 60-minute live demo of the full product.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: 'Buddy Weekly Check-in', description: 'Complete your first buddy check-in — a low-stakes peer support conversation.', task_type: 'meeting', phase: 'Month 1 — Deep Dive', content_body: 'Your onboarding buddy is a peer engineer for the first 30 days.', due_offset_days: 14, required: false, approval_required: false, assignee_type: 'buddy', order: 15 },
      { title: 'First Pull Request Submitted', description: 'Submit a screenshot or link proving your first PR was opened and reviewed.', task_type: 'upload', phase: 'Month 1 — Deep Dive', content_body: 'Pick a "good-first-issue" ticket, open a PR, get review, pass CI.', due_offset_days: 21, required: true, approval_required: false, assignee_type: 'new_hire', order: 16 },
      { title: 'Systems Access Audit', description: 'IT confirms you have access to all required systems and none you shouldn\'t.', task_type: 'approval', phase: 'Month 1 — Deep Dive', content_body: 'Formal access audit covering staging/dev, data warehouse, cloud console.', due_offset_days: 14, required: true, approval_required: true, assignee_type: 'it', order: 17 },
      { title: '30-Day Reflection & Feedback', description: 'Share your honest thoughts on the onboarding experience after your first month.', task_type: 'form', phase: 'Month 1 — Deep Dive', content_body: 'Reflect on Day 1 preparedness, most valuable parts, frustrations, and culture fit.', due_offset_days: 30, required: true, approval_required: false, assignee_type: 'new_hire', order: 18 },
    ],
  },

  // ── 2. Product Manager Fast Track ────────────────────────────────────────────
  {
    id: 'product-manager',
    title: 'Product Manager Fast Track',
    subtitle: 'For PMs joining fast-moving product teams',
    description:
      'A structured but fast-paced onboarding designed for Product Managers at startups and scale-ups. Moves from context-building in Week 1 to autonomous roadmap ownership by Month 1.',
    badge: 'Startup Favourite',
    estimatedDays: 30,
    category: 'Technology',
    phases: ['Days 1–3 — Foundations', 'Week 1–2 — Context & Discovery', 'Month 1 — First Ownership'],
    tasks: [
      { title: 'Welcome & PM Playbook', description: 'Read the PM Playbook and understand how your team builds, decides, and ships.', task_type: 'info', phase: 'Days 1–3 — Foundations', content_body: 'Product philosophy, decision-making framework, shipping culture, and current priorities.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Tool Access: Jira/Linear, Figma, Analytics', description: 'IT provisions access to all core PM tools — planning, design, and analytics.', task_type: 'approval', phase: 'Days 1–3 — Foundations', content_body: 'Provision access to Linear/Jira, Notion, Figma, Dovetail, Mixpanel/Amplitude, Looker.', due_offset_days: 1, required: true, approval_required: true, assignee_type: 'it', order: 2 },
      { title: 'Meet Your Engineering Lead', description: 'A 45-minute intro with your engineering counterpart.', task_type: 'meeting', phase: 'Days 1–3 — Foundations', content_body: 'Introductions, team setup, working agreements, candid feedback.', due_offset_days: 1, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: 'Stakeholder Map', description: 'Document your top stakeholders, their priorities, and communication preferences.', task_type: 'form', phase: 'Days 1–3 — Foundations', content_body: 'Identify top 5 collaborators, their priorities, decision authority, and communication preferences.', due_offset_days: 2, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: 'Sprint Ceremony Attendance', description: 'Attend a full set of sprint ceremonies as a silent observer.', task_type: 'meeting', phase: 'Days 1–3 — Foundations', content_body: 'Sprint planning, daily standup, sprint review, retrospective.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Customer Interview Recordings Review', description: 'Watch 5+ recent customer interviews before forming opinions about the product.', task_type: 'info', phase: 'Week 1–2 — Context & Discovery', content_body: 'Watch at least 5 recent customer interviews and synthesize the top problems.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Competitive Landscape Analysis', description: 'Build a working knowledge of the top 3–5 competitors in your market.', task_type: 'info', phase: 'Week 1–2 — Context & Discovery', content_body: 'Document each competitor\'s value prop, differentiators, pricing, and recent moves.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Current Roadmap Walkthrough', description: 'Deep-dive session with your manager on the roadmap and the decisions behind it.', task_type: 'meeting', phase: 'Week 1–2 — Context & Discovery', content_body: 'Current priorities, 6-month bets, what we chose NOT to do, dependencies.', due_offset_days: 7, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'User Research Archive Deep Dive', description: 'Study the research archive to anchor your product instincts in evidence.', task_type: 'info', phase: 'Week 1–2 — Context & Discovery', content_body: 'Persona library, jobs to be done, usability tests, NPS trends, discovery synthesis.', due_offset_days: 7, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Metrics & KPI Dashboard Review', description: 'Your manager confirms you understand the key product metrics dashboards.', task_type: 'approval', phase: 'Week 1–2 — Context & Discovery', content_body: 'North star metric, activation funnel, retention cohorts, feature adoption, revenue.', due_offset_days: 7, required: true, approval_required: true, assignee_type: 'manager', order: 10 },
      { title: 'Write Your First PRD', description: 'Write, share for review, and upload a PRD for a real in-scope problem.', task_type: 'upload', phase: 'Month 1 — First Ownership', content_body: 'PRD with problem, success metrics, user stories, scope, risks.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'Shadow a Customer Discovery Call', description: 'Join a live customer call as a silent observer and write a synthesis within 24 hours.', task_type: 'meeting', phase: 'Month 1 — First Ownership', content_body: 'Silent observer role with verbatim notes and 200-word synthesis within 24 hours.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'First Sprint Retrospective as Contributor', description: 'Attend your first retro as an active participant with prepared observations.', task_type: 'meeting', phase: 'Month 1 — First Ownership', content_body: 'Active retro participation with prepared observations on what worked and what didn\'t.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: '30-Day PM Review & Roadmap Proposal', description: 'Submit your 30-day perspective — problems, priorities, and one roadmap proposal.', task_type: 'form', phase: 'Month 1 — First Ownership', content_body: 'Reflection on customer problems, roadmap reprioritization, and biggest risks.', due_offset_days: 30, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
    ],
  },

  // ── 3. NGO New Staff Onboarding ──────────────────────────────────────────────
  {
    id: 'ngo-staff',
    title: 'NGO New Staff Onboarding',
    subtitle: 'For mission-driven organisations and development work',
    description:
      'A comprehensive onboarding programme for NGO and non-profit staff. Covers safeguarding, data protection, programme context, and field safety — built around the realities of mission-driven work.',
    badge: 'Sector Standard',
    estimatedDays: 30,
    category: 'NGO & Non-Profit',
    phases: ['Day 1 — Welcome & Admin', 'Week 1 — Policy & Culture', 'Month 1 — Mission Ready'],
    tasks: [
      { title: 'Welcome Letter & Organisational Mission', description: 'Read your welcome packet and understand the mission, history, and strategic goals.', task_type: 'info', phase: 'Day 1 — Welcome & Admin', content_body: 'Mission, theory of change, history, strategic plan, and programme overview.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Employment Contract & Legal Documentation', description: 'Upload signed copies of your employment contract and required HR documents.', task_type: 'upload', phase: 'Day 1 — Welcome & Admin', content_body: 'Signed contract, job description, right to work, bank details, tax declaration, pension forms.', due_offset_days: 1, required: true, approval_required: false, assignee_type: 'new_hire', order: 2 },
      { title: 'Emergency Contact & Personal Details', description: 'Provide HR records and emergency preparedness information.', task_type: 'form', phase: 'Day 1 — Welcome & Admin', content_body: 'Legal name, contact details, emergency contact, medical info, dietary needs, languages.', due_offset_days: 1, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: 'Meet the Team Introduction Call', description: 'A 30–45 minute video call to put faces to names and begin building relationships.', task_type: 'meeting', phase: 'Day 1 — Welcome & Admin', content_body: 'Round-table introductions, team culture, current priorities, open questions.', due_offset_days: 1, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: 'Org Chart & Key Contacts Review', description: 'Review the organisational structure and create a personal contact cheat sheet.', task_type: 'info', phase: 'Day 1 — Welcome & Admin', content_body: 'Org chart, programme teams, support functions, leadership team, country offices.', due_offset_days: 2, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Systems Access: CRM, Email, Cloud Tools', description: 'IT provisions access to communication, programme, and finance systems.', task_type: 'approval', phase: 'Day 1 — Welcome & Admin', content_body: 'Email, M365/Google, Slack/Teams, donor CRM, beneficiary management, expense/procurement.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 6 },
      { title: 'Safeguarding Policy Training', description: 'Complete mandatory safeguarding training — required before any external engagement.', task_type: 'info', phase: 'Week 1 — Policy & Culture', content_body: 'Modules on definitions, policy, recognising and reporting concerns, safe programming.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Data Protection & GDPR Compliance', description: 'Complete mandatory data protection training covering beneficiary and donor data.', task_type: 'info', phase: 'Week 1 — Policy & Culture', content_body: 'Legal bases, data classification, secure storage, breach response, individual rights.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Beneficiary Code of Conduct', description: 'Read and sign the Beneficiary Code of Conduct — a binding commitment for all staff.', task_type: 'upload', phase: 'Week 1 — Policy & Culture', content_body: 'Power dynamics, ethical engagement, anti-bribery, conflict of interest, whistleblowing.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Programme Overview Presentation', description: 'A 60-minute deep-dive on the programmes you will be working within or alongside.', task_type: 'meeting', phase: 'Week 1 — Policy & Culture', content_body: 'Programme history, beneficiary populations, theory of change, current priorities.', due_offset_days: 7, required: true, approval_required: false, assignee_type: 'manager', order: 10 },
      { title: 'Field Safety & Risk Management Briefing', description: 'Mandatory safety briefing for all staff — especially those who may travel to programme areas.', task_type: 'info', phase: 'Week 1 — Policy & Culture', content_body: 'Security protocols, medical preparedness, vehicle safety, evacuation, psychosocial support.', due_offset_days: 7, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'Donor Communication Guidelines', description: 'Learn how to communicate with donors and write beneficiary-dignity-centred content.', task_type: 'info', phase: 'Month 1 — Mission Ready', content_body: 'Voice and tone, restricted information, donor reporting, photography consent, success stories.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Theory of Change Workshop', description: 'A facilitated workshop to deeply understand the causal pathway from activities to impact.', task_type: 'meeting', phase: 'Month 1 — Mission Ready', content_body: '90-minute workshop covering ToC diagram, key assumptions, evidence, and personal role.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'Volunteer & Partner Management Overview', description: 'A session covering the volunteer programme, partner ecosystem, and partnership agreements.', task_type: 'meeting', phase: 'Month 1 — Mission Ready', content_body: 'Volunteer programme structure, partner ecosystem, MOUs, sub-grant agreements.', due_offset_days: 14, required: false, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: '30-Day Mission Alignment Reflection', description: 'Share your honest reflection on onboarding, policies, and mission connection.', task_type: 'form', phase: 'Month 1 — Mission Ready', content_body: 'Reflection on mission understanding, policy navigation, team support, mission connection.', due_offset_days: 30, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
    ],
  },

  // ── 4. Sales Development Rep (SDR) Onboarding ────────────────────────────────
  {
    id: 'sdr-onboarding',
    title: 'Sales Development Rep Onboarding',
    subtitle: 'Ramp new SDRs to first qualified meeting in 45 days',
    description:
      'A structured 45-day ramp for new Sales Development Reps. Covers stack setup, ICP mastery, pitch certification, objection handling, and live pipeline ownership — ending with the first qualified meeting booked in CRM.',
    badge: 'Sales Ready',
    estimatedDays: 45,
    category: 'Sales',
    phases: ['Week 1 — Foundations & Tools', 'Weeks 2–3 — Pitch & Outbound', 'Weeks 4–6 — Live Pipeline'],
    tasks: [
      { title: 'Welcome & Sales Org Overview', description: 'Read your welcome packet and understand the sales org structure, segments, and quotas.', task_type: 'info', phase: 'Week 1 — Foundations & Tools', content_body: 'Sales team structure, SDR / AE / CSM hand-off model, segments (SMB, Mid-Market, Enterprise), quota and commission overview.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'CRM, Dialer & Sales Engagement Access', description: 'IT provisions Salesforce, Outreach/Salesloft, ZoomInfo, Gong, and dialer.', task_type: 'approval', phase: 'Week 1 — Foundations & Tools', content_body: 'Access to Salesforce, Outreach or Salesloft, ZoomInfo or Apollo, Gong or Chorus, dialer (Aircall/Dialpad), LinkedIn Sales Navigator.', due_offset_days: 1, required: true, approval_required: true, assignee_type: 'it', order: 2 },
      { title: 'SDR Profile & Territory Preferences', description: 'Submit your background, strengths, and preferred territory or vertical focus.', task_type: 'form', phase: 'Week 1 — Foundations & Tools', content_body: 'Background, prior tools, strongest verticals, preferred territory, language fluencies, working hours.', due_offset_days: 1, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: '1:1 with Sales Manager', description: 'A 45-minute kickoff with your manager covering expectations and the first 90 days.', task_type: 'meeting', phase: 'Week 1 — Foundations & Tools', content_body: '45-minute kickoff covering ramp plan, weekly cadence, success metrics, coaching style, and personal goals.', due_offset_days: 2, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: 'ICP & Buyer Persona Deep Dive', description: 'Master the ideal customer profile, target titles, and buying triggers.', task_type: 'info', phase: 'Week 1 — Foundations & Tools', content_body: 'ICP firmographics, target titles, pain points, buying triggers, disqualifiers, common tech stacks.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Product Pitch Mastery — Module 1', description: 'Study the core pitch deck, value props, differentiators, and demo flow.', task_type: 'info', phase: 'Week 1 — Foundations & Tools', content_body: 'Core pitch deck, three value pillars, top competitive differentiators, demo storyline, common questions.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Shadow 5 Senior SDR Calls', description: 'Listen in on at least 5 live or recorded calls from top-performing SDRs.', task_type: 'meeting', phase: 'Weeks 2–3 — Pitch & Outbound', content_body: 'Shadow 5 calls (mix of cold, warm, discovery). Take notes on opener, qualification, objection handling, and next steps.', due_offset_days: 8, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Record & Submit Mock Cold Call', description: 'Record a 5-minute mock cold call with a peer and upload it for review.', task_type: 'upload', phase: 'Weeks 2–3 — Pitch & Outbound', content_body: 'Pair with a peer SDR, role-play a cold call against the standard ICP, record on Gong/Chorus, upload the link.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Objection Handling Playbook', description: 'Read and internalise the objection handling playbook — top 15 objections with responses.', task_type: 'info', phase: 'Weeks 2–3 — Pitch & Outbound', content_body: 'Top 15 objections grouped by category (price, timing, authority, competitor, status quo) with proven responses and follow-up moves.', due_offset_days: 12, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Pitch Certification — Manager Sign-Off', description: 'Deliver your full pitch live to your manager and get certified before going to market.', task_type: 'approval', phase: 'Weeks 2–3 — Pitch & Outbound', content_body: 'Live 10-minute pitch + 5 minutes of manager objections. Pass criteria: clean opener, value pillars covered, 3 objections handled, clear close.', due_offset_days: 14, required: true, approval_required: true, assignee_type: 'manager', order: 10 },
      { title: 'Cold Email Sequence Draft Review', description: 'Draft your first 4-step cold email sequence and submit for review.', task_type: 'form', phase: 'Weeks 2–3 — Pitch & Outbound', content_body: '4-step sequence: hook, value, social proof, breakup. Manager reviews subject lines, personalisation tokens, and CTAs.', due_offset_days: 15, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'First Live Cold Calls — Manager Listening', description: 'Make your first block of live cold calls with your manager listening for coaching.', task_type: 'meeting', phase: 'Weeks 4–6 — Live Pipeline', content_body: '2-hour call block with manager listening on Gong. Target: 40+ dials, 5+ conversations. Immediate debrief afterwards.', due_offset_days: 21, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Discovery Call Framework (MEDDPICC / BANT)', description: 'Learn the qualification framework used to score and pass opportunities to AEs.', task_type: 'info', phase: 'Weeks 4–6 — Live Pipeline', content_body: 'MEDDPICC fields (Metrics, Economic Buyer, Decision Criteria/Process, Paper Process, Identify Pain, Champion, Competition) or BANT — whichever the org uses.', due_offset_days: 25, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'First Qualified Meeting Booked', description: 'Book your first qualified meeting and upload the calendar invite + CRM record.', task_type: 'upload', phase: 'Weeks 4–6 — Live Pipeline', content_body: 'Upload a screenshot of the calendar invite and the Salesforce opportunity showing MEDDPICC/BANT fields filled.', due_offset_days: 35, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: 'Weekly Buddy Check-ins', description: 'Complete your buddy check-ins — informal coaching with a senior SDR.', task_type: 'meeting', phase: 'Weeks 4–6 — Live Pipeline', content_body: '30-minute weekly check-ins with assigned senior SDR buddy. Topics: what worked, what didn\'t, pipeline review.', due_offset_days: 30, required: false, approval_required: false, assignee_type: 'buddy', order: 15 },
      { title: '45-Day SDR Self-Review', description: 'Share your honest reflection on ramp, coaching quality, and confidence going into month 2.', task_type: 'form', phase: 'Weeks 4–6 — Live Pipeline', content_body: 'Reflect on pitch confidence, hardest objections, coaching quality, tool friction, and goals for the next 45 days.', due_offset_days: 45, required: true, approval_required: false, assignee_type: 'new_hire', order: 16 },
    ],
  },

  // ── 5. Remote-First Engineering Onboarding ───────────────────────────────────
  {
    id: 'remote-engineering',
    title: 'Remote-First Engineering Onboarding',
    subtitle: 'For distributed engineers — async-first, ship in week one',
    description:
      'A 30-day onboarding journey built for fully distributed engineering teams. Prioritises async communication, written-first culture, time-zone-aware collaboration, and shipping a first PR in week one — without any in-person rituals required.',
    badge: 'Remote Ready',
    estimatedDays: 30,
    category: 'Technology',
    phases: ['Day 1 — Remote Setup', 'Week 1 — Async Foundations', 'Weeks 2–4 — Ship & Integrate'],
    tasks: [
      { title: 'Welcome to a Remote-First Team', description: 'Read the welcome packet built for distributed teammates — culture, rituals, and expectations.', task_type: 'info', phase: 'Day 1 — Remote Setup', content_body: 'Mission, remote-first principles, working agreements, key rituals (async standups, demo Fridays), and what async-by-default means in practice.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Home Office Setup Photo & Stipend Request', description: 'Upload a photo of your home workspace and submit your home-office stipend request.', task_type: 'upload', phase: 'Day 1 — Remote Setup', content_body: 'Upload a workspace photo and the stipend request form (chair, monitor, internet upgrade). Up to the configured budget — your manager approves.', due_offset_days: 1, required: true, approval_required: false, assignee_type: 'new_hire', order: 2 },
      { title: 'Hardware, MDM & VPN Provisioned (Shipped)', description: 'IT confirms hardware shipped, MDM enrolled, and VPN/MFA working end-to-end.', task_type: 'approval', phase: 'Day 1 — Remote Setup', content_body: 'Tracking number for shipped laptop, MDM enrollment confirmed, VPN client installed, MFA enrolled (TOTP + hardware key), password manager seeded.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 3 },
      { title: 'Time Zone, Working Hours & Overlap Preferences', description: 'Submit your working hours, time zone, and preferred meeting overlap windows.', task_type: 'form', phase: 'Day 1 — Remote Setup', content_body: 'Local time zone, daily core hours, blocked focus time, overlap preference with team timezones, language fluencies, holiday calendar.', due_offset_days: 1, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: 'Async Welcome Loom from Manager', description: 'Watch the personalised welcome Loom from your manager — your async kickoff.', task_type: 'meeting', phase: 'Day 1 — Remote Setup', content_body: 'A 10–15 minute Loom from your manager introducing the team, sprint cadence, and your 30-day ramp goals. Reply async with one question.', due_offset_days: 1, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Async Communication Handbook', description: 'Read the async comms handbook — when to write, when to call, response SLAs.', task_type: 'info', phase: 'Week 1 — Async Foundations', content_body: 'Slack vs Notion vs Loom vs synchronous meeting decision tree, response SLAs, urgency labels, default-to-public channels, no-DM rule.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Written-First Culture: Docs, RFCs, Decision Logs', description: 'Study how decisions are made — written RFCs, ADRs, and the decision log.', task_type: 'info', phase: 'Week 1 — Async Foundations', content_body: 'RFC template, ADR (Architecture Decision Records) format, weekly decision log review, comment-driven review culture, "disagree and commit" norms.', due_offset_days: 4, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Source Control, CI/CD & Cloud Console Access', description: 'IT confirms GitHub, CI/CD pipelines, and read-only cloud console access are working.', task_type: 'approval', phase: 'Week 1 — Async Foundations', content_body: 'GitHub org membership + SSO, CI/CD pipeline read access, cloud console read-only role (AWS/GCP/Azure), secret manager scoped access.', due_offset_days: 3, required: true, approval_required: true, assignee_type: 'it', order: 8 },
      { title: 'Virtual Coffee Roulette — Three Peers, Three Time Zones', description: 'Book three 20-minute coffees with peers in different time zones.', task_type: 'meeting', phase: 'Week 1 — Async Foundations', content_body: 'Book three 20-minute virtual coffees with peers across at least three time zones. Goal: faces to names, no agenda required.', due_offset_days: 5, required: false, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'On-Call from Anywhere: PagerDuty & Runbooks', description: 'Read the on-call handbook, runbook index, and incident response process.', task_type: 'info', phase: 'Week 1 — Async Foundations', content_body: 'PagerDuty schedule, escalation policy, incident command roles, runbook library, post-incident review template, on-call compensation policy.', due_offset_days: 6, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: 'Local Dev Environment Screenshot', description: 'Get the app running locally and upload a screenshot proving it works end-to-end.', task_type: 'upload', phase: 'Week 1 — Async Foundations', content_body: 'Clone the monorepo, run setup script, get the app running locally with seed data. Upload a screenshot of the local app + a passing test run.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'Architecture Deep Dive — Self-Paced Loom Library', description: 'Work through the recorded architecture deep-dive Looms at your own pace.', task_type: 'info', phase: 'Weeks 2–4 — Ship & Integrate', content_body: 'Loom playlist covering system map, data models, API contracts, third-party integrations, infrastructure overview. Comment async with questions.', due_offset_days: 8, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Async Pair-Programming Session', description: 'Pair with your onboarding buddy on a small task using Tuple, VS Code Live Share, or Code With Me.', task_type: 'meeting', phase: 'Weeks 2–4 — Ship & Integrate', content_body: 'Two-hour pairing session with your assigned buddy using async-friendly tooling. Goal: working knowledge of one feature area.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'buddy', order: 13 },
      { title: 'First Pull Request Merged — Week 1 Ship Goal', description: 'Open, get reviewed, and merge your first PR — the remote-first "Day-5 ship" tradition.', task_type: 'upload', phase: 'Weeks 2–4 — Ship & Integrate', content_body: 'Pick a "good-first-issue" ticket. Open a PR within your first week. Upload the merged PR link as proof.', due_offset_days: 7, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: 'Shadow an On-Call Rotation (Read-Only)', description: 'Shadow a senior engineer\'s on-call rotation — observe, do not respond.', task_type: 'meeting', phase: 'Weeks 2–4 — Ship & Integrate', content_body: 'Read-only PagerDuty access for a 24-hour window during a peer\'s rotation. Join incident war-rooms as silent observer. Write a 1-page reflection.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
      { title: 'Remote Working Friction Survey', description: 'Report what is and isn\'t working in your remote setup — tools, comms, isolation.', task_type: 'form', phase: 'Weeks 2–4 — Ship & Integrate', content_body: 'Tools causing friction, time-zone pain points, missing async habits, isolation signals, suggestions for the handbook.', due_offset_days: 21, required: true, approval_required: false, assignee_type: 'new_hire', order: 16 },
      { title: '30-Day Remote Reflection', description: 'Share your honest reflection on the first 30 days of fully remote onboarding.', task_type: 'form', phase: 'Weeks 2–4 — Ship & Integrate', content_body: 'Reflect on async ramp, written culture adoption, on-call readiness, peer connection, and one thing you would change about the program.', due_offset_days: 30, required: true, approval_required: false, assignee_type: 'new_hire', order: 17 },
    ],
  },

  // ── 6. Executive Onboarding — First 90 Days ──────────────────────────────────
  {
    id: 'executive-90',
    title: 'Executive Onboarding — First 90 Days',
    subtitle: 'C-suite & VP-level integration with listening tour and board prep',
    description:
      'A structured 90-day integration for C-suite and VP-level hires. Follows the proven 30/60/90 cadence: listen and map in the first 30 days, diagnose and align in days 31–60, and commit to a strategic plan by day 90 — with board-ready outputs at each milestone.',
    badge: 'Leadership Track',
    estimatedDays: 90,
    category: 'Executive',
    phases: ['Days 1–30 — Listen & Map', 'Days 31–60 — Diagnose & Align', 'Days 61–90 — Decide & Commit'],
    tasks: [
      { title: 'Welcome & Charter from CEO / Board', description: 'Read your appointment letter, charter, and the mandate set by the CEO or Board.', task_type: 'info', phase: 'Days 1–30 — Listen & Map', content_body: 'Charter document, mandate from CEO/Board, success criteria for year one, scope of authority, and any explicit non-goals for the first 90 days.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Executive Compensation & D&O Documents Signed', description: 'Upload signed compensation package, equity grants, D&O indemnification, and confidentiality agreements.', task_type: 'upload', phase: 'Days 1–30 — Listen & Map', content_body: 'Executive employment agreement, equity grant documents, D&O insurance acknowledgment, executive confidentiality and non-compete agreements where applicable.', due_offset_days: 2, required: true, approval_required: false, assignee_type: 'new_hire', order: 2 },
      { title: 'Onboarding Kickoff with Board Chair / CEO', description: 'A 60-minute kickoff with the Board Chair or CEO covering mandate, sponsorship, and red lines.', task_type: 'meeting', phase: 'Days 1–30 — Listen & Map', content_body: '60-minute kickoff covering mandate clarity, sponsorship commitments, communication cadence with CEO/Board, decision rights, and explicit red lines for the first 90 days.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: 'Stakeholder Map — Reports, Peers, Board', description: 'Document your full stakeholder graph and prioritise your first 60 days of relationship-building.', task_type: 'form', phase: 'Days 1–30 — Listen & Map', content_body: 'Direct reports, executive peers, board members, top investors, key customers, regulators (if applicable). For each: priorities, communication preference, history with the role, and a 90-day engagement plan.', due_offset_days: 7, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: 'Listening Tour — 1:1s with Every Direct Report', description: 'A structured 1:1 with each direct report using the same listening framework.', task_type: 'meeting', phase: 'Days 1–30 — Listen & Map', content_body: '60–90 minute structured 1:1 with each direct report. Same questions for every conversation: what is working, what is broken, what would you change in your first 90 days, what is the unspoken truth.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Cross-Functional Peer 1:1s (CEO, CFO, CRO, CTO, CPO)', description: '45-minute 1:1s with each executive peer to understand inter-dependencies.', task_type: 'meeting', phase: 'Days 1–30 — Listen & Map', content_body: '45-minute 1:1 with each executive peer. Topics: how do we work together, what do you need from this role, what would success look like in 12 months, what are the historical friction points.', due_offset_days: 21, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Financials, KPIs & Strategic Plan Deep Dive', description: 'Study the financials, top KPIs, current strategic plan, and last 3 years of performance.', task_type: 'info', phase: 'Days 1–30 — Listen & Map', content_body: 'P&L, balance sheet, cash flow, unit economics, top 10 KPIs, current strategic plan, last 3 years of performance vs plan, top 3 competitive threats, current burn/runway if applicable.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Board Materials & Last 4 Board Meeting Minutes', description: 'Read the last four board packs and meeting minutes to absorb governance context.', task_type: 'info', phase: 'Days 1–30 — Listen & Map', content_body: 'Last 4 board packs, minutes, action items tracker, audit committee minutes, compensation committee charter, board calendar, and your scheduled board engagements for the year.', due_offset_days: 21, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Customer / Beneficiary Listening Sessions', description: 'Conduct 5–10 customer or beneficiary conversations — directly, without filters.', task_type: 'meeting', phase: 'Days 31–60 — Diagnose & Align', content_body: '5–10 direct conversations with customers, beneficiaries, or end users without filters. Mix of advocates, detractors, and churned accounts. Output: synthesis memo on what is true that leadership may not be hearing.', due_offset_days: 45, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: '30-Day Findings Memo to CEO', description: 'Submit a confidential 30-day findings memo to the CEO with observations and open questions.', task_type: 'form', phase: 'Days 31–60 — Diagnose & Align', content_body: 'Confidential 30-day memo to the CEO: what is true, what is broken, what is unclear, where you need more time, and what early decisions you are considering. Format: 5 pages max.', due_offset_days: 35, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: 'First Board / Leadership Update Presentation', description: 'Deliver your first formal update to the board or executive team — observations and direction.', task_type: 'meeting', phase: 'Days 31–60 — Diagnose & Align', content_body: 'First formal update to the board or executive team. Tone: confident observations, not yet conclusions. Cover top 3 findings, top 3 risks, and the direction of travel for the next 30 days.', due_offset_days: 50, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'Compliance, Legal, Risk & Audit Briefing', description: 'A formal briefing with General Counsel, Head of Risk, and Head of Audit.', task_type: 'info', phase: 'Days 31–60 — Diagnose & Align', content_body: 'Briefing with General Counsel, Head of Risk, and Head of Audit. Topics: open litigation, regulatory exposure, current audit findings, top compliance risks, and any restricted topics or markets.', due_offset_days: 45, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Direct Report Structure & Team Decisions Reviewed with CEO', description: 'Review and get sign-off on any proposed org structure changes or key team decisions.', task_type: 'approval', phase: 'Days 31–60 — Diagnose & Align', content_body: 'Review of proposed direct-report changes, leadership hires, role consolidations, or removals with CEO. No structural changes go live before this approval.', due_offset_days: 60, required: true, approval_required: true, assignee_type: 'manager', order: 13 },
      { title: '30-60-90 Strategic Plan Document', description: 'Upload your formal 30-60-90 strategic plan with priorities, metrics, and resource needs.', task_type: 'upload', phase: 'Days 61–90 — Decide & Commit', content_body: 'Formal 30-60-90 plan covering: top 3 strategic priorities, success metrics for each, resource needs, dependencies on peers, board commitments, and what you are explicitly de-prioritising.', due_offset_days: 75, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: '90-Day Strategy Presentation to Board / Exec Team', description: 'Present your 90-day plan formally to the board or executive team for endorsement.', task_type: 'meeting', phase: 'Days 61–90 — Decide & Commit', content_body: 'Formal presentation of the 30-60-90 plan to the board or executive team. Outcome: endorsement, alignment on success metrics, and explicit commitments from peers.', due_offset_days: 85, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
      { title: '90-Day Self-Assessment & Forward Commitments', description: 'Submit your honest self-assessment of the first 90 days and explicit forward commitments.', task_type: 'form', phase: 'Days 61–90 — Decide & Commit', content_body: 'Self-assessment of integration quality, where you have built trust, where you are still building it, biggest surprises, biggest regrets, and explicit commitments for the next 90 days.', due_offset_days: 90, required: true, approval_required: false, assignee_type: 'new_hire', order: 16 },
    ],
  },

  // ── 7. HR Business Partner Onboarding ────────────────────────────────────────
  {
    id: 'hr-business-partner',
    title: 'HR Business Partner Onboarding',
    subtitle: 'Equip new HRBPs to advise leaders and handle ER cases in 60 days',
    description:
      'A 60-day ramp for HR Business Partners joining a People function. Covers policy and HRIS mastery, client-group immersion, employee relations case handling, and co-facilitating talent review or compensation rounds — ending with the HRBP ready to advise their leaders independently.',
    badge: 'HR Essentials',
    estimatedDays: 60,
    category: 'HR',
    phases: ['Week 1 — Policy & Systems', 'Weeks 2–4 — Client Group Immersion', 'Weeks 5–8 — Independent Advisor'],
    tasks: [
      { title: 'Welcome & People Function Overview', description: 'Read the welcome packet covering the People team\'s mission, structure, and operating model.', task_type: 'info', phase: 'Week 1 — Policy & Systems', content_body: 'People function mission, operating model (HRBP / CoE / Shared Services split), team structure, leadership team, current strategic priorities, and your client group.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'HRIS, ATS & Case Management Access', description: 'IT provisions Workday/BambooHR, Greenhouse, and the ER case management system.', task_type: 'approval', phase: 'Week 1 — Policy & Systems', content_body: 'Provision access to HRIS (Workday / BambooHR / HiBob), ATS (Greenhouse / Lever / Ashby), ER case management (HRAcuity / ServiceNow), performance system, comp tooling.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 2 },
      { title: 'Signed Confidentiality & Conflict of Interest Agreement', description: 'Upload signed HR-specific confidentiality and conflict of interest agreements.', task_type: 'upload', phase: 'Week 1 — Policy & Systems', content_body: 'HR-specific confidentiality covering employee data, ER investigations, compensation information, and conflict of interest declarations for hiring or promotion decisions.', due_offset_days: 1, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: 'Employee Handbook & Policy Library Deep Dive', description: 'Read the full employee handbook and policy library — required before advising any leader.', task_type: 'info', phase: 'Week 1 — Policy & Systems', content_body: 'Full employee handbook, leave policies, working time, code of conduct, grievance and disciplinary procedure, anti-harassment, remote work, parental leave, accommodations.', due_offset_days: 4, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: 'Local Employment Law & Compliance Primer', description: 'Complete the jurisdiction-specific employment law primer for the regions you support.', task_type: 'info', phase: 'Week 1 — Policy & Systems', content_body: 'Local employment law primer covering hiring, termination, working time, family rights, discrimination, data protection, and any sector-specific regulations. Tailored to the regions you cover.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: '1:1 with Head of People', description: 'A 60-minute kickoff with the Head of People covering mandate, client group, and expectations.', task_type: 'meeting', phase: 'Week 1 — Policy & Systems', content_body: '60-minute kickoff: mandate, client group definition, expectations for first 90 days, escalation paths, coaching cadence, and current hot topics in the People agenda.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Shadow 3 Senior HRBP Conversations', description: 'Observe a senior HRBP in three different conversation types — coaching, ER, and comp.', task_type: 'meeting', phase: 'Weeks 2–4 — Client Group Immersion', content_body: 'Shadow three conversations: one leader coaching session, one employee relations intake, one compensation or promotion discussion. Note language, framing, and escalation triggers.', due_offset_days: 12, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Client Group Map — Leaders, Teams, Hot Spots', description: 'Document your client group: leaders, teams, headcount, attrition hot spots, and open ER cases.', task_type: 'form', phase: 'Weeks 2–4 — Client Group Immersion', content_body: 'For your client group: org chart, leader profiles, headcount, attrition trends (last 12 months), open requisitions, open ER cases, recent engagement scores, known hot spots.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Intro Meetings with Assigned Business Leaders', description: 'A 30–45 minute intro with each leader you support — listen, do not advise yet.', task_type: 'meeting', phase: 'Weeks 2–4 — Client Group Immersion', content_body: '30–45 minute intro with each leader. Listening mode: what is the team\'s biggest people priority, what has worked from HR partnership, what has not, communication preference. No advice in this round.', due_offset_days: 18, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Compensation Bands, Levelling & Promotion Cycle', description: 'Study the comp framework — bands, levelling guide, promotion criteria, and cycle calendar.', task_type: 'info', phase: 'Weeks 2–4 — Client Group Immersion', content_body: 'Compensation philosophy, salary bands by level and geography, levelling guide, promotion criteria, comp cycle calendar, equity refresh policy, and the off-cycle adjustment process.', due_offset_days: 21, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: 'Performance Management & Calibration Framework', description: 'Learn the performance management cycle, ratings, calibration, and PIP procedure.', task_type: 'info', phase: 'Weeks 2–4 — Client Group Immersion', content_body: 'Performance cycle calendar, rating definitions, calibration mechanics, performance improvement plan procedure, separation pathways, and how performance feeds into comp and promotions.', due_offset_days: 25, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'First ER Case Handled — Manager Co-Sign', description: 'Lead your first employee relations case end-to-end with senior HRBP co-signing each step.', task_type: 'approval', phase: 'Weeks 5–8 — Independent Advisor', content_body: 'Lead one ER case end-to-end: intake, investigation plan, fact-finding, recommendation, documentation. Senior HRBP co-signs each major step. Suitable for grade: informal complaint or policy clarification.', due_offset_days: 35, required: true, approval_required: true, assignee_type: 'manager', order: 12 },
      { title: 'Draft Talent Review Pack for One Client Group', description: 'Build a draft talent review pack — strengths, risks, succession, and development moves.', task_type: 'upload', phase: 'Weeks 5–8 — Independent Advisor', content_body: 'Draft talent review pack for one client team: 9-box, succession risks, top development moves, retention risks, diversity lens. Reviewed with the leader and Head of People before finalising.', due_offset_days: 42, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'Co-Facilitate a Calibration or Comp Round', description: 'Co-facilitate a live calibration or compensation round alongside a senior HRBP.', task_type: 'meeting', phase: 'Weeks 5–8 — Independent Advisor', content_body: 'Co-facilitate a live calibration or comp round. Responsibilities: prep materials, manage agenda, capture decisions, surface diversity and consistency questions. Senior HRBP holds the room.', due_offset_days: 50, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: 'DEI, Investigations & Whistleblowing Procedures', description: 'Complete the formal training on DEI, investigations, and whistleblowing — required for ER work.', task_type: 'info', phase: 'Weeks 5–8 — Independent Advisor', content_body: 'DEI strategy, investigation procedure (intake, fact-finding, weighing evidence, documentation), whistleblowing protections, retaliation prevention, and when to escalate to Legal or External Counsel.', due_offset_days: 30, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
      { title: '60-Day HRBP Self-Review & Forward Commitments', description: 'Submit your reflection on the first 60 days and explicit commitments for your client group.', task_type: 'form', phase: 'Weeks 5–8 — Independent Advisor', content_body: 'Self-review of policy mastery, client trust built, ER readiness, calibration confidence, and biggest gaps. Forward commitments: three priorities for your client group in the next 60 days.', due_offset_days: 60, required: true, approval_required: false, assignee_type: 'new_hire', order: 16 },
    ],
  },

  // ── 8. Volunteer Coordinator Track ───────────────────────────────────────────
  {
    id: 'volunteer-coordinator',
    title: 'Volunteer Coordinator Track',
    subtitle: 'Equip coordinators to recruit, train, and run first community event in 45 days',
    description:
      'A 45-day ramp for new Volunteer Coordinators. Covers safeguarding, recruitment channels, volunteer management tooling, induction delivery, and ends with the coordinator co-leading their first community event — backed by a documented risk assessment and feedback synthesis.',
    badge: 'Community Ready',
    estimatedDays: 45,
    category: 'Volunteer',
    phases: ['Week 1 — Safeguarding & Foundations', 'Weeks 2–3 — Recruitment & Tooling', 'Weeks 4–6 — Run the First Event'],
    tasks: [
      { title: 'Welcome & Volunteer Programme Overview', description: 'Read your welcome packet covering the programme\'s mission, history, and current volunteer base.', task_type: 'info', phase: 'Week 1 — Safeguarding & Foundations', content_body: 'Programme mission, volunteer journey map, current volunteer base by segment, top volunteer roles, retention metrics, and the programme\'s priorities for the year.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Safeguarding for Volunteer Programmes (Mandatory)', description: 'Complete the mandatory safeguarding module — required before any volunteer-facing work.', task_type: 'info', phase: 'Week 1 — Safeguarding & Foundations', content_body: 'Safeguarding definitions, power dynamics specific to volunteer programmes, recognising and reporting concerns, safer recruitment, and the escalation pathway to the Designated Safeguarding Lead.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 2 },
      { title: 'DBS / Background Check & References Submitted', description: 'Upload your DBS or equivalent background check and two professional references.', task_type: 'upload', phase: 'Week 1 — Safeguarding & Foundations', content_body: 'DBS check (Enhanced where applicable), two professional references, and any role-specific safeguarding declarations. Must be cleared before lone working with volunteers or beneficiaries.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: 'Volunteer Management System Access', description: 'IT provisions Better Impact, Volgistics, or equivalent volunteer management tooling.', task_type: 'approval', phase: 'Week 1 — Safeguarding & Foundations', content_body: 'Provision access to the volunteer management system (Better Impact, Volgistics, Salesforce NPSP), email, scheduling tools, communications platform, and any event management software.', due_offset_days: 4, required: true, approval_required: true, assignee_type: 'it', order: 4 },
      { title: '1:1 with Volunteer Programme Manager', description: 'A 60-minute kickoff with the Volunteer Programme Manager covering your remit and first event.', task_type: 'meeting', phase: 'Week 1 — Safeguarding & Foundations', content_body: '60-minute kickoff: your remit, assigned volunteer roles, first community event target, escalation paths, coaching cadence, and current programme hot spots.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Volunteer Recruitment Channels & Audience Personas', description: 'Study the recruitment channels — universities, faith groups, corporates, online — and the personas they reach.', task_type: 'info', phase: 'Weeks 2–3 — Recruitment & Tooling', content_body: 'Channel matrix: universities, faith groups, corporates, retiree networks, online platforms (Do-it, Reach Volunteering, LinkedIn). Conversion rates, persona fit, and historical retention by channel.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Draft Volunteer Role Description for One Opportunity', description: 'Draft a complete role description for one open volunteer opportunity using the standard template.', task_type: 'form', phase: 'Weeks 2–3 — Recruitment & Tooling', content_body: 'Draft using the standard template: purpose, key tasks, time commitment, location, skills required, training provided, support structure, expenses policy, and safeguarding context.', due_offset_days: 12, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Volunteer Onboarding & Induction Playbook', description: 'Read the volunteer induction playbook — the standard journey from sign-up to first shift.', task_type: 'info', phase: 'Weeks 2–3 — Recruitment & Tooling', content_body: 'Sign-up → application screening → references → safeguarding check → induction session → buddy assignment → first shift → 30-day check-in. SLAs and standard email templates included.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Shadow a Volunteer Induction Session', description: 'Observe a senior coordinator running a live induction session for new volunteers.', task_type: 'meeting', phase: 'Weeks 2–3 — Recruitment & Tooling', content_body: 'Shadow a live induction (in-person or remote). Note: opening, safeguarding framing, role expectations, Q&A handling, and how the coordinator builds early commitment.', due_offset_days: 15, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Retention, Recognition & Volunteer Wellbeing', description: 'Learn the retention and recognition framework — what keeps volunteers engaged long-term.', task_type: 'info', phase: 'Weeks 2–3 — Recruitment & Tooling', content_body: 'Retention drivers, recognition tiers, milestone touch-points, wellbeing check-ins, exit interview process, and how to spot early disengagement signals.', due_offset_days: 18, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: 'Event Plan Document for First Community Event', description: 'Upload your event plan: objectives, volunteers needed, logistics, comms, and contingencies.', task_type: 'upload', phase: 'Weeks 4–6 — Run the First Event', content_body: 'Event plan document: objective, target beneficiaries, volunteer roster, logistics (venue, transport, equipment), comms timeline, contingencies, and post-event feedback plan.', due_offset_days: 28, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'Risk Assessment & Insurance Confirmed for Event', description: 'Complete the risk assessment and confirm public liability insurance covers the event.', task_type: 'approval', phase: 'Weeks 4–6 — Run the First Event', content_body: 'Full risk assessment (venue, activities, transport, weather, vulnerable participants), public liability insurance confirmation, first aid cover, and emergency contact tree. Programme Manager sign-off required.', due_offset_days: 30, required: true, approval_required: true, assignee_type: 'manager', order: 12 },
      { title: 'Deliver First Community Event (Co-Led)', description: 'Co-lead your first community event with a senior coordinator as backup.', task_type: 'meeting', phase: 'Weeks 4–6 — Run the First Event', content_body: 'Co-lead the first event with a senior coordinator. Responsibilities: brief volunteers, hold the schedule, manage issues live, debrief volunteers afterwards. Senior coordinator handles escalations.', due_offset_days: 35, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'Volunteer Feedback Survey Collated & Synthesised', description: 'Collect, collate, and synthesise volunteer feedback into a 1-page summary memo.', task_type: 'form', phase: 'Weeks 4–6 — Run the First Event', content_body: 'Distribute the post-event survey, collate responses, and write a 1-page memo: what worked, what did not, retention risks, recognition moments, and the three things to change for the next event.', due_offset_days: 40, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: '45-Day Coordinator Self-Review', description: 'Submit your reflection on the first 45 days — confidence, gaps, and forward commitments.', task_type: 'form', phase: 'Weeks 4–6 — Run the First Event', content_body: 'Self-review of safeguarding confidence, recruitment readiness, event-running ability, volunteer relationships built, biggest gaps, and three priorities for the next 45 days.', due_offset_days: 45, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
    ],
  },

  // ── 9. Summer Internship Program — 8 Weeks ───────────────────────────────────
  {
    id: 'summer-internship',
    title: 'Summer Internship Program — 8 Weeks',
    subtitle: 'Structured 8-week internship with mentor pairing and capstone delivery',
    description:
      'A structured 8-week summer internship programme covering orientation, mentor pairing, skill-building workshops, and a capstone project — ending with a formal presentation to cohort and leadership. Designed for interns to ship one meaningful deliverable and leave with a clear performance signal.',
    badge: 'Intern Favourite',
    estimatedDays: 56,
    category: 'Internship',
    phases: ['Week 1 — Orientation & Pairing', 'Weeks 2–4 — Skill Building & Capstone Scope', 'Weeks 5–8 — Build & Present'],
    tasks: [
      { title: 'Welcome & Internship Programme Overview', description: 'Read your welcome packet covering the 8-week journey, deliverables, and expectations.', task_type: 'info', phase: 'Week 1 — Orientation & Pairing', content_body: 'Welcome packet covering the 8-week journey, cohort calendar, key milestones, deliverables, success criteria, conversion pathway (if applicable), and how mentors and managers will evaluate progress.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Right-to-Work, ID & Internship Agreement Signed', description: 'Upload your right-to-work documents, ID, and signed internship agreement.', task_type: 'upload', phase: 'Week 1 — Orientation & Pairing', content_body: 'Right-to-work verification, government ID, signed internship agreement, tax forms, bank details for stipend, emergency contact, and any university placement paperwork.', due_offset_days: 2, required: true, approval_required: false, assignee_type: 'new_hire', order: 2 },
      { title: 'Laptop, Email & Tool Access Provisioned', description: 'IT confirms laptop, email, and tool access are working before day 2.', task_type: 'approval', phase: 'Week 1 — Orientation & Pairing', content_body: 'Laptop set up with MDM, email + SSO provisioned, collaboration tools (Slack/Teams, Notion/Confluence, drive), repo or domain-specific tools scoped to the internship project. No production access by default.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 3 },
      { title: 'Mentor Pairing Kickoff Call', description: 'A 45-minute kickoff with your assigned mentor covering working style and meeting cadence.', task_type: 'meeting', phase: 'Week 1 — Orientation & Pairing', content_body: '45-minute kickoff with your mentor. Topics: mentor\'s background, working style, weekly cadence, what good mentorship looks like to you, how to ask for help, and what is off-limits to ask managers.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: 'Personal Learning Goals & Skills Self-Assessment', description: 'Submit three personal learning goals and a self-assessment of your starting skill level.', task_type: 'form', phase: 'Week 1 — Orientation & Pairing', content_body: 'Three personal learning goals for the internship, a self-assessment of your starting skill level across the role\'s core competencies, and the specific feedback you would value most from mentor and manager.', due_offset_days: 4, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Cohort Welcome Session & Intern Meet-and-Greet', description: 'Attend the cohort welcome session and meet the rest of your intern class.', task_type: 'meeting', phase: 'Week 1 — Orientation & Pairing', content_body: 'Cohort welcome session with the programme lead, leadership introductions, intern cohort meet-and-greet, social hour, and an overview of cohort-wide events (lunch & learns, exec speaker series, end-of-programme showcase).', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Department & Team Context Deep Dive', description: 'Study your host department\'s mission, structure, current priorities, and recent work.', task_type: 'info', phase: 'Weeks 2–4 — Skill Building & Capstone Scope', content_body: 'Host department mission, team structure, current priorities, recent shipped work, key stakeholders, and how your internship project connects to the team\'s broader goals.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Skill-Building Workshops (3 Sessions)', description: 'Attend three skill-building workshops tailored to the internship cohort.', task_type: 'meeting', phase: 'Weeks 2–4 — Skill Building & Capstone Scope', content_body: 'Three cohort workshops covering core skills (e.g. communicating with stakeholders, structured problem-solving, presenting to leadership) plus any role-specific technical sessions. Attendance and short reflection required.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Capstone Project Scoping Document', description: 'Draft a 2-page scoping document for your capstone project — problem, approach, success metrics.', task_type: 'upload', phase: 'Weeks 2–4 — Skill Building & Capstone Scope', content_body: '2-page scoping document: problem statement, why it matters, proposed approach, success metrics, in-scope vs out-of-scope, dependencies, risks, and a week-by-week timeline through to final presentation.', due_offset_days: 18, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Capstone Scope Approved by Mentor & Manager', description: 'Mentor and manager review and formally approve your capstone scope before build begins.', task_type: 'approval', phase: 'Weeks 2–4 — Skill Building & Capstone Scope', content_body: 'Joint review with mentor and manager. Outcome: signed-off scope, agreed success metrics, weekly check-in plan, and any explicit constraints (no production deploys, no customer-facing comms, etc.). No build work begins before this approval.', due_offset_days: 21, required: true, approval_required: true, assignee_type: 'manager', order: 10 },
      { title: 'Mid-Program Mentor Check-in', description: 'A formal mid-program check-in with your mentor on progress, blockers, and learning goals.', task_type: 'meeting', phase: 'Weeks 2–4 — Skill Building & Capstone Scope', content_body: 'Formal mid-program check-in with your mentor. Review of learning goals, progress on capstone, blockers, peer relationships, wellbeing, and what would make the remaining weeks most valuable.', due_offset_days: 21, required: true, approval_required: false, assignee_type: 'buddy', order: 11 },
      { title: 'Weekly Mentor 1:1s', description: 'Hold weekly 30-minute 1:1s with your mentor through the build phase.', task_type: 'meeting', phase: 'Weeks 5–8 — Build & Present', content_body: 'Weekly 30-minute 1:1s with your mentor through the build phase. Agenda template provided: progress, blockers, asks, learning moments, and one piece of feedback in either direction.', due_offset_days: 35, required: true, approval_required: false, assignee_type: 'buddy', order: 12 },
      { title: 'Capstone Mid-Build Progress Demo', description: 'Demo your capstone progress at the half-way point — proof of working slice, not polish.', task_type: 'upload', phase: 'Weeks 5–8 — Build & Present', content_body: 'Mid-build demo: a working slice of the capstone (not polish). Upload screenshots, a short video, or a deployed prototype link. Mentor and manager comment async with feedback to incorporate before the final.', due_offset_days: 35, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'Final Capstone Deliverable Submitted', description: 'Upload your final capstone — code, document, deck, or whatever your scope defined.', task_type: 'upload', phase: 'Weeks 5–8 — Build & Present', content_body: 'Final capstone deliverable as defined in your scope document: code in a repo, a polished document, a deck, a Figma file, or whatever the scope defined. Includes a 1-page README explaining what it is and how to use it.', due_offset_days: 52, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: 'Final Capstone Presentation to Cohort & Leadership', description: 'Present your capstone to the intern cohort and leadership at the end-of-programme showcase.', task_type: 'meeting', phase: 'Weeks 5–8 — Build & Present', content_body: '15-minute final presentation at the end-of-programme showcase. Audience: intern cohort, mentors, managers, and invited leadership. Format: problem, approach, demo, results, what you learned, what you would do next.', due_offset_days: 55, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
      { title: 'Intern Exit Survey & Programme Feedback', description: 'Submit your honest exit survey on the internship — mentorship, project, cohort, and conversion interest.', task_type: 'form', phase: 'Weeks 5–8 — Build & Present', content_body: 'Exit survey covering mentorship quality, manager support, project scoping, cohort experience, biggest growth moments, biggest frustrations, conversion interest (where applicable), and three specific suggestions for next year\'s programme.', due_offset_days: 56, required: true, approval_required: false, assignee_type: 'new_hire', order: 16 },
    ],
  },

  // ── 10. Customer Success Manager Onboarding ──────────────────────────────────
  {
    id: 'customer-success-manager',
    title: 'Customer Success Manager Onboarding',
    subtitle: 'Equip new CSMs to own a book and run a QBR in 60 days',
    description:
      'A 60-day ramp for new Customer Success Managers. Covers product mastery, stack setup, account portfolio handover, customer call shadowing, QBR certification, and ends with the CSM owning a full book of business and delivering their first live Quarterly Business Review independently.',
    badge: 'Retention Track',
    estimatedDays: 60,
    category: 'General',
    phases: ['Week 1 — Product & Stack Mastery', 'Weeks 2–4 — Book Handover & Shadowing', 'Weeks 5–8 — Solo CSM Cadence'],
    tasks: [
      { title: 'Welcome & CS Org Operating Model', description: 'Read your welcome packet covering the CS team\'s mission, segments, and hand-off model.', task_type: 'info', phase: 'Week 1 — Product & Stack Mastery', content_body: 'CS function mission, operating model (high-touch / tech-touch / hybrid), segment definitions, hand-off model with Sales and Support, target NRR, and the priorities for the current quarter.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'CRM, CS Platform & Product Analytics Access', description: 'IT provisions Salesforce, Gainsight or ChurnZero, product analytics, and Zoom/Gong.', task_type: 'approval', phase: 'Week 1 — Product & Stack Mastery', content_body: 'Provision access to Salesforce, CS platform (Gainsight / ChurnZero / Catalyst / Vitally), product analytics (Mixpanel / Amplitude / Pendo), Zoom or Gong/Chorus for call recording, and any usage-data warehouse views.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 2 },
      { title: 'CSM Profile, Verticals & Language Preferences', description: 'Submit your background, vertical strengths, and language fluencies for portfolio assignment.', task_type: 'form', phase: 'Week 1 — Product & Stack Mastery', content_body: 'Background, prior CS experience, strongest verticals, language fluencies, time zone overlap with key customer regions, willingness to travel, and any account size preference.', due_offset_days: 1, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: 'Product Mastery — Self-Paced Certification', description: 'Complete the product certification covering every major feature and the demo flow.', task_type: 'info', phase: 'Week 1 — Product & Stack Mastery', content_body: 'Self-paced product certification covering every major feature, common use cases, integration points, edge cases, and the standard demo flow. Includes a short knowledge check at the end of each module.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: '1:1 with Head of Customer Success', description: 'A 60-minute kickoff with the Head of CS covering portfolio, expectations, and the first 90 days.', task_type: 'meeting', phase: 'Week 1 — Product & Stack Mastery', content_body: '60-minute kickoff with the Head of CS. Topics: portfolio assignment, expectations, weekly cadence, success metrics (NRR, GRR, NPS, adoption), escalation paths, and the priorities for the first 90 days.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Customer Health Scoring & Lifecycle Stages', description: 'Learn the health scoring model and the lifecycle stages customers move through.', task_type: 'info', phase: 'Weeks 2–4 — Book Handover & Shadowing', content_body: 'Health scoring model (inputs, weights, thresholds), lifecycle stages (onboarding → adoption → expansion → renewal), red/yellow/green playbook triggers, and how health rolls up to NRR forecasting.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Account Portfolio Handover from Outgoing CSM', description: 'A formal portfolio handover from the outgoing CSM — one walkthrough per priority account.', task_type: 'meeting', phase: 'Weeks 2–4 — Book Handover & Shadowing', content_body: 'Formal handover from the outgoing CSM. One 30-minute walkthrough per priority account covering: stakeholder map, contract terms, current health, open issues, renewal date, expansion opportunities, and political dynamics.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Shadow 3 Customer Calls (Renewal, QBR, Onboarding)', description: 'Listen in on three customer calls covering the three highest-stakes call types.', task_type: 'meeting', phase: 'Weeks 2–4 — Book Handover & Shadowing', content_body: 'Shadow three different call types: one renewal conversation, one Quarterly Business Review, and one onboarding kickoff. Take notes on opener, narrative arc, data shown, objection handling, and next steps committed.', due_offset_days: 18, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Retention & Churn Playbook', description: 'Read the retention and churn playbook — early warning signals, save plays, and escalations.', task_type: 'info', phase: 'Weeks 2–4 — Book Handover & Shadowing', content_body: 'Early warning signals, the standard set of save plays, executive escalation pathway, when to bring in product or engineering, churn root-cause categories, and the post-churn debrief process.', due_offset_days: 21, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Draft QBR Deck for One Assigned Account', description: 'Draft a complete QBR deck for one of your assigned accounts using the standard template.', task_type: 'upload', phase: 'Weeks 2–4 — Book Handover & Shadowing', content_body: 'Draft a full QBR deck using the standard template for one assigned account: usage and value delivered, business outcomes, roadmap alignment, open risks, expansion ideas, and proposed commitments for the next quarter.', due_offset_days: 25, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: 'QBR Certification — Manager Sign-Off', description: 'Deliver your draft QBR live to your manager and get certified before customer delivery.', task_type: 'approval', phase: 'Weeks 2–4 — Book Handover & Shadowing', content_body: 'Live 20-minute QBR delivery to your manager, followed by 10 minutes of role-played customer objections. Pass criteria: confident narrative, data accuracy, value framing, three objections handled, clear next steps.', due_offset_days: 30, required: true, approval_required: true, assignee_type: 'manager', order: 11 },
      { title: 'First Solo Customer Call — Manager Listening', description: 'Run your first solo customer call with your manager listening on Gong for coaching.', task_type: 'meeting', phase: 'Weeks 5–8 — Solo CSM Cadence', content_body: 'First solo customer call with manager listening on Gong/Chorus. Choose a lower-stakes call (check-in or adoption review). Immediate debrief afterwards focused on framing, listening, and follow-through.', due_offset_days: 35, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Deliver First Live QBR', description: 'Deliver your first live QBR to a real customer — manager attends as backup, not co-pilot.', task_type: 'meeting', phase: 'Weeks 5–8 — Solo CSM Cadence', content_body: 'Deliver your first live QBR to a real customer. Manager attends as silent backup, not co-pilot. You hold the meeting. Debrief afterwards on what worked, what didn\'t, and the commitments captured.', due_offset_days: 45, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'Account Plans Submitted for Top 5 Accounts', description: 'Upload account plans for your top 5 accounts — stakeholders, goals, risks, and 90-day actions.', task_type: 'upload', phase: 'Weeks 5–8 — Solo CSM Cadence', content_body: 'Account plans for your top 5 accounts using the standard template: executive sponsor, stakeholder map, customer goals, success metrics, current health, top risks, expansion opportunities, and explicit 90-day actions.', due_offset_days: 50, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: 'Weekly Buddy Check-ins', description: 'Complete weekly check-ins with your senior CSM buddy through the solo phase.', task_type: 'meeting', phase: 'Weeks 5–8 — Solo CSM Cadence', content_body: '30-minute weekly check-ins with your assigned senior CSM buddy through the solo phase. Topics: open issues, pipeline at risk, customer pushback, escalation choices, and one moment of customer value you observed.', due_offset_days: 40, required: false, approval_required: false, assignee_type: 'buddy', order: 15 },
      { title: '60-Day CSM Self-Review', description: 'Submit your reflection on the first 60 days — confidence, gaps, and forward commitments.', task_type: 'form', phase: 'Weeks 5–8 — Solo CSM Cadence', content_body: 'Self-review of product mastery, QBR confidence, customer relationships built, health-score accuracy, hardest objection types, biggest gaps, and three priorities for the next 60 days.', due_offset_days: 60, required: true, approval_required: false, assignee_type: 'new_hire', order: 16 },
    ],
  },

  // ── 11. Data Analyst & Data Scientist Onboarding ─────────────────────────────
  {
    id: 'data-analyst',
    title: 'Data Analyst & Data Scientist Onboarding',
    subtitle: 'Ship a first dashboard and own a stakeholder request end-to-end in 30 days',
    description:
      'A 30-day ramp for new Data Analysts and Data Scientists. Covers warehouse and BI stack setup, data dictionary mastery, modelling conventions, and shipping a first dashboard against a real stakeholder need — ending with the analyst owning a complete request from intake to insight memo.',
    badge: 'Analytics Ready',
    estimatedDays: 30,
    category: 'Technology',
    phases: ['Week 1 — Stack & Data Map', 'Weeks 2–3 — First Dashboard & Patterns', 'Week 4 — Own a Stakeholder Request'],
    tasks: [
      { title: 'Welcome & Data Function Operating Model', description: 'Read the welcome packet covering the data team\'s mission, structure, and operating model.', task_type: 'info', phase: 'Week 1 — Stack & Data Map', content_body: 'Data function mission, operating model (centralised / embedded / hybrid), team structure, decision rights, request intake process, and the priorities for the current quarter.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Warehouse, BI Tool & Notebook Access', description: 'IT provisions Snowflake/BigQuery, Looker/Tableau/Mode, dbt, and Jupyter/Hex access.', task_type: 'approval', phase: 'Week 1 — Stack & Data Map', content_body: 'Provision access to the data warehouse (Snowflake / BigQuery / Redshift), BI tool (Looker / Tableau / Mode / Metabase), dbt Cloud or repo, notebook environment (Jupyter / Hex / Databricks), git, and any scoped PII or finance schemas.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 2 },
      { title: 'Data Access & Privacy Agreement Signed', description: 'Upload signed data access agreement covering PII handling, exports, and acceptable use.', task_type: 'upload', phase: 'Week 1 — Stack & Data Map', content_body: 'Data access agreement covering PII handling, data classification levels, export and sharing rules, retention and deletion duties, and acceptable use. Required before any access to customer data.', due_offset_days: 1, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: 'Data Stack Architecture & Pipeline Overview', description: 'Study the end-to-end data stack — ingestion, warehouse, transformation, and serving layers.', task_type: 'info', phase: 'Week 1 — Stack & Data Map', content_body: 'End-to-end stack diagram: ingestion (Fivetran / Airbyte / custom), warehouse, transformation (dbt), orchestration (Airflow / Dagster / Prefect), reverse ETL, BI, and how product analytics tools feed in.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: '1:1 with Head of Data', description: 'A 45-minute kickoff with the Head of Data covering remit, stakeholders, and the first 30 days.', task_type: 'meeting', phase: 'Week 1 — Stack & Data Map', content_body: '45-minute kickoff with the Head of Data: remit, stakeholder portfolio, expected output cadence, success metrics, escalation paths, and the top three data questions the org is trying to answer right now.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Data Dictionary, Source Tables & Naming Conventions', description: 'Read the data dictionary and learn the source tables, key entities, and naming conventions.', task_type: 'info', phase: 'Week 1 — Stack & Data Map', content_body: 'Data dictionary, top 20 source tables, core entity definitions (user, account, event, subscription, etc.), naming conventions, primary and foreign keys, and the documented quirks or known gotchas in the data.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Modelling Conventions — dbt, Semantic Layer, Style Guide', description: 'Study the modelling conventions: dbt project structure, semantic layer, and style guide.', task_type: 'info', phase: 'Weeks 2–3 — First Dashboard & Patterns', content_body: 'dbt project structure (staging / intermediate / marts), tests and documentation expectations, semantic layer definitions, SQL style guide, model naming conventions, and the standard for materialisations and incremental models.', due_offset_days: 8, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Shadow 2 Stakeholder Meetings (PM, Marketing, Finance)', description: 'Observe a senior analyst run two stakeholder meetings across different functions.', task_type: 'meeting', phase: 'Weeks 2–3 — First Dashboard & Patterns', content_body: 'Shadow two stakeholder meetings (e.g. Product, Marketing, Finance, Operations). Note: how the analyst frames the question, scopes the work, manages expectations, and what gets followed up in writing afterwards.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'First SQL Query in Production-Style Review', description: 'Submit your first SQL query for a senior analyst review using the standard PR template.', task_type: 'upload', phase: 'Weeks 2–3 — First Dashboard & Patterns', content_body: 'Pick a simple analytical question. Write the SQL, document assumptions, submit for review using the standard PR template, and incorporate review feedback. Goal: learn the team\'s review style on a low-stakes question.', due_offset_days: 12, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'First Dashboard Shipped — Real Stakeholder Need', description: 'Ship a real dashboard against a real stakeholder need — small scope, end-to-end ownership.', task_type: 'upload', phase: 'Weeks 2–3 — First Dashboard & Patterns', content_body: 'Pick a real stakeholder need (intentionally small scope). Build the dashboard end-to-end: clarify the question, model the data, build the view, write the README, share with the stakeholder, and capture their feedback.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: 'Experimentation, Causal Inference & Pitfalls Primer', description: 'Read the team\'s primer on experimentation, causal inference, and common analytical pitfalls.', task_type: 'info', phase: 'Weeks 2–3 — First Dashboard & Patterns', content_body: 'Primer on A/B testing setup, sample size and power, common biases (selection, survivorship, Simpson\'s paradox), causal inference techniques used by the team, and a catalogue of past mistakes and what was learned.', due_offset_days: 16, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'First dbt Model PR Merged', description: 'Open and merge your first dbt model PR with tests and documentation.', task_type: 'approval', phase: 'Weeks 2–3 — First Dashboard & Patterns', content_body: 'Open a dbt PR adding or extending a model. Required: schema test coverage on key columns, model documentation, follows the style guide, and a clear PR description. Senior analyst or data engineer approves before merge.', due_offset_days: 18, required: true, approval_required: true, assignee_type: 'it', order: 12 },
      { title: 'Own First Stakeholder Request — Intake to Delivery', description: 'Take one stakeholder request through the full intake-to-delivery cycle as the lead analyst.', task_type: 'meeting', phase: 'Week 4 — Own a Stakeholder Request', content_body: 'Own one full stakeholder request: intake call, scoping document, build, mid-build check-in, delivery, and follow-up. You are the lead analyst — senior analyst is silent observer for the calls.', due_offset_days: 25, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'Insight Memo Shared with Stakeholder & Leadership', description: 'Write and share a 1-page insight memo summarising findings, caveats, and next steps.', task_type: 'upload', phase: 'Week 4 — Own a Stakeholder Request', content_body: '1-page insight memo: the question, the answer, the most important caveats, the decision implied, and the next analyses worth running. Shared with the stakeholder and one level of leadership above.', due_offset_days: 27, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: 'Buddy Weekly Check-ins', description: 'Complete weekly check-ins with your senior analyst buddy through ramp.', task_type: 'meeting', phase: 'Week 4 — Own a Stakeholder Request', content_body: '30-minute weekly check-ins with your assigned senior analyst buddy through the 30 days. Topics: SQL patterns, modelling choices, stakeholder pushback, scope creep, and one analytical moment you wanted a second opinion on.', due_offset_days: 21, required: false, approval_required: false, assignee_type: 'buddy', order: 15 },
      { title: '30-Day Data Self-Review', description: 'Submit your reflection on the first 30 days — confidence, gaps, and forward commitments.', task_type: 'form', phase: 'Week 4 — Own a Stakeholder Request', content_body: 'Self-review of SQL and modelling confidence, dashboard quality, stakeholder communication, biggest analytical surprises, hardest patterns to learn, and three priorities for the next 30 days.', due_offset_days: 30, required: true, approval_required: false, assignee_type: 'new_hire', order: 16 },
    ],
  },

  // ── 12. Field Worker & Program Officer Onboarding ────────────────────────────
  {
    id: 'field-program-officer',
    title: 'Field Worker & Program Officer Onboarding',
    subtitle: 'From safeguarding to first program report in 45 days',
    description:
      'A 45-day ramp for new Field Workers and Program Officers in NGO and development settings. Covers safeguarding, donor reporting, theory of change, monitoring & evaluation, and ends with the officer running their first independent field visit and delivering a donor-ready program report.',
    badge: 'Field Ready',
    estimatedDays: 45,
    category: 'NGO & Non-Profit',
    phases: ['Week 1 — Safeguarding & Compliance', 'Weeks 2–3 — Program Context & Field Prep', 'Weeks 4–6 — Field Delivery & Reporting'],
    tasks: [
      { title: 'Welcome & Program Portfolio Overview', description: 'Read your welcome packet covering the program portfolio, beneficiaries, and your assigned program.', task_type: 'info', phase: 'Week 1 — Safeguarding & Compliance', content_body: 'Program portfolio overview, beneficiary populations served, geographic footprint, your assigned program, donor mix, partnership ecosystem, and the program\'s priorities for the current funding cycle.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Safeguarding & Code of Conduct (Mandatory)', description: 'Complete the mandatory safeguarding training — required before any contact with beneficiaries.', task_type: 'info', phase: 'Week 1 — Safeguarding & Compliance', content_body: 'Safeguarding policy, code of conduct, power dynamics in development contexts, PSEA (Protection from Sexual Exploitation and Abuse), reporting pathways, and the role of the Designated Safeguarding Lead.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 2 },
      { title: 'DBS/Background Check, References & Medical Clearance', description: 'Upload your enhanced background check, professional references, and medical/travel clearance.', task_type: 'upload', phase: 'Week 1 — Safeguarding & Compliance', content_body: 'Enhanced DBS or equivalent background check, two professional references, occupational health clearance, vaccinations record for assigned regions, and any field-specific medical declarations. Required before any field work.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: 'Field Tools & Mobile Data Collection Access', description: 'IT provisions KoboToolbox, ODK, the M&E platform, and offline-capable mobile tooling.', task_type: 'approval', phase: 'Week 1 — Safeguarding & Compliance', content_body: 'Provision KoboToolbox or ODK Collect, the M&E platform (CommCare / Salesforce NPSP / DHIS2), encrypted device, offline maps, satellite messenger access where applicable, and secure cloud storage for field data.', due_offset_days: 4, required: true, approval_required: true, assignee_type: 'it', order: 4 },
      { title: 'Donor Reporting Basics & Restricted Funding Rules', description: 'Learn the basics of donor reporting and the rules around restricted funding.', task_type: 'info', phase: 'Week 1 — Safeguarding & Compliance', content_body: 'Donor mix overview (institutional, foundation, individual), reporting calendar, restricted vs unrestricted funding rules, eligible cost categories, branding requirements, and the consequences of donor non-compliance.', due_offset_days: 6, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: '1:1 with Program Manager', description: 'A 60-minute kickoff with your Program Manager covering remit, field plan, and reporting cadence.', task_type: 'meeting', phase: 'Week 1 — Safeguarding & Compliance', content_body: '60-minute kickoff: program remit, geographic and beneficiary scope, weekly cadence, reporting expectations, escalation paths, field travel plan, and the priorities for the first 45 days.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Theory of Change & Logframe for Your Program', description: 'Study the theory of change and logical framework for your assigned program.', task_type: 'info', phase: 'Weeks 2–3 — Program Context & Field Prep', content_body: 'Program theory of change diagram, key assumptions, logframe (goal, outcomes, outputs, activities, indicators), evidence base behind the causal pathway, and the personal role you play in delivering each outcome.', due_offset_days: 12, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'M&E Framework — Indicators, Baselines & Data Quality', description: 'Learn the monitoring & evaluation framework — indicators, baseline values, and data quality standards.', task_type: 'info', phase: 'Weeks 2–3 — Program Context & Field Prep', content_body: 'M&E framework: indicator definitions, calculation methods, baseline values, target values, data sources, collection frequency, data quality assurance checks, and how data feeds into donor reports.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Security Briefing & Travel Approval (HEAT / Field SOPs)', description: 'Complete the security briefing and obtain formal travel approval before any field deployment.', task_type: 'meeting', phase: 'Weeks 2–3 — Program Context & Field Prep', content_body: 'Security briefing covering field SOPs, HEAT training status, vehicle and movement protocols, communication tree, evacuation plan, psychosocial support, and formal travel approval from the Security Focal Point.', due_offset_days: 16, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Shadow a Senior Officer on a Field Visit', description: 'Accompany a senior Program Officer on a full field visit — observe, do not lead.', task_type: 'meeting', phase: 'Weeks 2–3 — Program Context & Field Prep', content_body: 'Accompany a senior officer on a full field visit. Observe: community entry protocols, consent practices, data collection in context, beneficiary engagement, partner handling, and the post-visit debrief and documentation.', due_offset_days: 18, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: 'Beneficiary Consent & Data Handling Sign-Off', description: 'Demonstrate consent and data handling fluency — required sign-off from Program Manager.', task_type: 'approval', phase: 'Weeks 2–3 — Program Context & Field Prep', content_body: 'Demonstration of informed consent process (including with vulnerable groups and minors), photo and story consent, secure data handling on device and in cloud, and the data destruction process. Program Manager signs off.', due_offset_days: 20, required: true, approval_required: true, assignee_type: 'manager', order: 11 },
      { title: 'Conduct First Independent Field Visit', description: 'Lead your first independent field visit — senior officer remains reachable for support.', task_type: 'meeting', phase: 'Weeks 4–6 — Field Delivery & Reporting', content_body: 'Lead a full field visit independently. Senior officer remains reachable for support but does not travel. Responsibilities: community entry, consent, scheduled activities, data collection, beneficiary safeguarding, and post-visit debrief on return.', due_offset_days: 28, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Field Data Collected, Cleaned & Uploaded', description: 'Upload cleaned field data into the M&E system — passing data quality assurance checks.', task_type: 'upload', phase: 'Weeks 4–6 — Field Delivery & Reporting', content_body: 'Upload cleaned field data into the M&E platform. Required: completeness check, plausibility check, indicator alignment, photo and consent records linked, and any anomalies flagged for the M&E Officer.', due_offset_days: 32, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'First Program Report Submitted (Internal + Donor-Ready)', description: 'Submit your first program report — both internal narrative and donor-ready version.', task_type: 'upload', phase: 'Weeks 4–6 — Field Delivery & Reporting', content_body: 'First program report in two versions: internal narrative (honest, includes setbacks and adaptations) and donor-ready version (aligned to the donor template, brand-compliant, indicator progress, beneficiary stories with consent).', due_offset_days: 40, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: 'Partner & Community Stakeholder Introductions', description: 'Make formal introductions with partner organisations and key community stakeholders.', task_type: 'meeting', phase: 'Weeks 4–6 — Field Delivery & Reporting', content_body: 'Formal introductions with partner organisations (sub-grantees, implementing partners), key community stakeholders (local leaders, women\'s groups, youth groups), and any government counterparts for your program area.', due_offset_days: 35, required: false, approval_required: false, assignee_type: 'new_hire', order: 15 },
      { title: '45-Day Field Officer Self-Review', description: 'Submit your reflection on the first 45 days — safeguarding, field readiness, and gaps.', task_type: 'form', phase: 'Weeks 4–6 — Field Delivery & Reporting', content_body: 'Self-review of safeguarding confidence, field readiness, M&E fluency, donor reporting quality, partner relationships, ethical dilemmas faced, and three priorities for the next 45 days.', due_offset_days: 45, required: true, approval_required: false, assignee_type: 'new_hire', order: 16 },
    ],
  },

  // ── 13. Marketing Manager Onboarding ─────────────────────────────────────────
  {
    id: 'marketing-manager',
    title: 'Marketing Manager Onboarding',
    subtitle: 'From brand mastery to first campaign brief in 45 days',
    description:
      'A 45-day ramp for new Marketing Managers. Covers brand voice and visual identity, the MarTech stack, ICP and positioning, competitor and attribution context, and ends with the manager owning their first campaign brief from approval to first content shipped.',
    badge: 'Campaign Ready',
    estimatedDays: 45,
    category: 'General',
    phases: ['Week 1 — Brand & MarTech Foundations', 'Weeks 2–3 — Audit & Strategy Context', 'Weeks 4–6 — First Campaign Brief'],
    tasks: [
      { title: 'Welcome & Marketing Operating Model', description: 'Read your welcome packet covering the marketing team\'s mission, structure, and operating model.', task_type: 'info', phase: 'Week 1 — Brand & MarTech Foundations', content_body: 'Marketing function mission, operating model (centralised / pod / hybrid), team structure, decision rights, agency partners, current priorities for the quarter, and how marketing connects with Sales, Product, and Customer Success.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'MarTech Stack Access', description: 'IT provisions HubSpot/Marketo, GA, CMS, Figma, ad platforms, and analytics tooling.', task_type: 'approval', phase: 'Week 1 — Brand & MarTech Foundations', content_body: 'Provision access to marketing automation (HubSpot / Marketo / Pardot), CRM, GA4, CMS (Webflow / WordPress / Contentful), Figma, ad platforms (Google Ads / LinkedIn Ads / Meta), SEO tools, and any product-led growth analytics.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 2 },
      { title: 'Marketing Profile, Channels & Specialisms', description: 'Submit your background, channel strengths, and the campaign types you have run.', task_type: 'form', phase: 'Week 1 — Brand & MarTech Foundations', content_body: 'Background, prior MarTech experience, strongest channels (paid, content, lifecycle, brand, events, ABM, PR), campaign types you have led, language fluencies, and any sector specialisms.', due_offset_days: 1, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: 'Brand Guidelines, Voice & Visual Identity', description: 'Study the brand book — voice, tone, visual identity, and the guardrails on creative work.', task_type: 'info', phase: 'Week 1 — Brand & MarTech Foundations', content_body: 'Brand book: voice and tone principles, vocabulary and banned phrases, visual identity (logo, typography, colour, photography), accessibility standards, and the approval workflow for any creative that breaks the guardrails.', due_offset_days: 4, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: '1:1 with Head of Marketing', description: 'A 60-minute kickoff with the Head of Marketing covering remit, expectations, and the first 90 days.', task_type: 'meeting', phase: 'Week 1 — Brand & MarTech Foundations', content_body: '60-minute kickoff: remit, channel ownership, expectations, success metrics (pipeline, MQLs, brand lift, retention assist), weekly cadence, escalation paths, and the top three priorities for the first 90 days.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Current Campaign Calendar & Funnel Map', description: 'Study the current campaign calendar, funnel map, and the metrics tracked at each stage.', task_type: 'info', phase: 'Week 1 — Brand & MarTech Foundations', content_body: 'Current campaign calendar (next 90 days), funnel map (awareness → consideration → conversion → retention → advocacy), top metrics per stage, conversion benchmarks, and the campaigns currently in market.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'ICP, Positioning & Messaging Framework', description: 'Master the ideal customer profile, positioning statement, and the messaging framework.', task_type: 'info', phase: 'Weeks 2–3 — Audit & Strategy Context', content_body: 'ICP firmographics, top buyer personas (with pains, gains, jobs to be done), positioning statement, category context, messaging framework by persona and stage, and the proof points and customer quotes that back each claim.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Competitor Audit Document', description: 'Upload a competitor audit covering the top 3–5 competitors\' messaging, channels, and recent moves.', task_type: 'upload', phase: 'Weeks 2–3 — Audit & Strategy Context', content_body: 'Competitor audit document covering top 3–5 competitors: positioning, top messages, channels in use, recent campaigns, pricing approach, content engine, and the gaps in their strategy that the brand can exploit.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'MarTech Stack Deep Dive & Attribution Model', description: 'Learn how the stack is wired — lead flow, scoring, attribution, and reporting plumbing.', task_type: 'info', phase: 'Weeks 2–3 — Audit & Strategy Context', content_body: 'End-to-end stack: form capture, lead routing, lead scoring, CRM sync, attribution model (first / last / multi-touch / W-shaped), reporting cadence, and the known data quirks the team works around.', due_offset_days: 16, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Shadow Cross-Functional Sync (Sales, Product, CS)', description: 'Observe the recurring cross-functional sync where marketing, sales, product, and CS align.', task_type: 'meeting', phase: 'Weeks 2–3 — Audit & Strategy Context', content_body: 'Shadow the recurring cross-functional sync. Note: how pipeline is debated, how product launches are coordinated, how CS feedback enters campaigns, and what gets followed up in writing afterwards.', due_offset_days: 18, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: 'Performance Benchmarks & Channel Economics', description: 'Study the channel-level economics — CAC, payback period, content benchmarks, and ROI thresholds.', task_type: 'info', phase: 'Weeks 2–3 — Audit & Strategy Context', content_body: 'Channel economics: CAC by channel, payback period, conversion benchmarks by stage, content benchmarks (open rates, CTR, dwell time), ROI thresholds for spend approval, and the budget envelope for the current quarter.', due_offset_days: 21, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'First Campaign Brief Drafted', description: 'Draft a full campaign brief using the standard template — objective, audience, channels, success metrics.', task_type: 'upload', phase: 'Weeks 4–6 — First Campaign Brief', content_body: 'Full campaign brief using the standard template: objective, target audience, key message, channels and tactics, content needs, timeline, budget, success metrics, dependencies, and explicit non-goals.', due_offset_days: 30, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Campaign Brief Approved by Head of Marketing', description: 'Walk the Head of Marketing through your campaign brief and get formal sign-off.', task_type: 'approval', phase: 'Weeks 4–6 — First Campaign Brief', content_body: 'Live 20-minute walkthrough of the campaign brief with the Head of Marketing, followed by 10 minutes of objections. Pass criteria: clear objective, audience fit, message alignment, realistic timeline, defensible metrics. Sign-off captured in writing.', due_offset_days: 35, required: true, approval_required: true, assignee_type: 'manager', order: 13 },
      { title: 'Stakeholder Alignment for First Campaign', description: 'Run alignment meetings with Sales, Product, and CS so the campaign launches without surprises.', task_type: 'meeting', phase: 'Weeks 4–6 — First Campaign Brief', content_body: 'Alignment meetings with Sales (lead handoff, talk tracks), Product (feature claims, launch dependencies), and CS (customer impact, expansion stories). Outcomes: written commitments captured in the campaign brief.', due_offset_days: 38, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: 'First Content Piece Shipped (Blog, Email, or Landing Page)', description: 'Ship the first content piece for your campaign — fully on-brand, approved, and live.', task_type: 'upload', phase: 'Weeks 4–6 — First Campaign Brief', content_body: 'Ship the first content piece: blog, email, landing page, or short-form social. Required: brand-compliant, legal-approved where needed, tracking in place, and a screenshot or live URL uploaded as proof.', due_offset_days: 42, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
      { title: '45-Day Marketing Self-Review', description: 'Submit your reflection on the first 45 days — confidence, gaps, and forward commitments.', task_type: 'form', phase: 'Weeks 4–6 — First Campaign Brief', content_body: 'Self-review of brand fluency, MarTech stack confidence, campaign planning quality, cross-functional partnership, biggest surprises, hardest patterns to learn, and three priorities for the next 45 days.', due_offset_days: 45, required: true, approval_required: false, assignee_type: 'new_hire', order: 16 },
    ],
  },

  // ── 14. Social Media Manager Onboarding ──────────────────────────────────────
  {
    id: 'social-media-manager',
    title: 'Social Media Manager Onboarding',
    subtitle: 'From brand voice to first published campaign in 45 days',
    description:
      'A 45-day ramp for new Social Media Managers. Covers brand voice, channel stack mastery, community management, crisis comms, content calendar, and ends with the manager shipping their first multi-channel social campaign with approval workflows in place.',
    badge: 'Channel Ready',
    estimatedDays: 45,
    category: 'General',
    phases: ['Week 1 — Brand & Stack', 'Weeks 2–3 — Calendar & Listening', 'Weeks 4–6 — First Campaign'],
    tasks: [
      { title: 'Welcome & Social Strategy Overview', description: 'Read your welcome packet covering the social strategy, channel mix, and audience priorities.', task_type: 'info', phase: 'Week 1 — Brand & Stack', content_body: 'Social strategy overview, channel mix (Meta, LinkedIn, TikTok, X, YouTube, Threads), audience priorities, paid vs organic split, current campaigns, and how social ladders up to wider marketing and brand goals.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Social Stack Access (Scheduler, Listening, Analytics)', description: 'IT provisions Sprout / Hootsuite / Later, Brandwatch, native channel admin access, and design tools.', task_type: 'approval', phase: 'Week 1 — Brand & Stack', content_body: 'Provision scheduling tool (Sprout / Hootsuite / Later / Buffer), listening tool (Brandwatch / Meltwater / Sprinklr), native admin access on every owned channel, paid social access, Canva or Figma, and link-tracking tooling.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 2 },
      { title: 'Brand Voice & Visual Identity for Social', description: 'Study the brand voice guide and the social-specific visual identity (templates, ratios, motion).', task_type: 'info', phase: 'Week 1 — Brand & Stack', content_body: 'Brand voice principles tailored to social, vocabulary and banned phrases, visual identity (aspect ratios, templates, motion guidelines, music licensing, hashtag system), and the approval pathway for off-template creative.', due_offset_days: 4, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: 'Channel Personas & Posting Cadence', description: 'Learn how voice and cadence shift per channel — and which channel does which job.', task_type: 'info', phase: 'Week 1 — Brand & Stack', content_body: 'Per-channel persona, cadence, and role (e.g. LinkedIn for thought leadership, TikTok for top-of-funnel reach, X for community signal). Posting frequency, best-performing formats, and the historical lift drivers by channel.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: '1:1 with Head of Marketing / Brand', description: 'A 45-minute kickoff covering remit, ownership, and expectations for the first 90 days.', task_type: 'meeting', phase: 'Week 1 — Brand & Stack', content_body: '45-minute kickoff: remit, channel ownership, success metrics, weekly cadence, escalation paths, paid budget envelope, and the priorities for the first 90 days.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Community Management Playbook', description: 'Read the community management playbook — response times, tone, escalation criteria.', task_type: 'info', phase: 'Weeks 2–3 — Calendar & Listening', content_body: 'Response time SLAs, default response templates, tone calibration, when to publicly engage vs DM, escalation criteria, customer-service hand-off process, and the language reserved for legal or PR review.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Crisis Communications Protocol', description: 'Study the crisis comms protocol — required reading before posting anything publicly.', task_type: 'info', phase: 'Weeks 2–3 — Calendar & Listening', content_body: 'Crisis tiers, decision tree, social listening alerts, dark site procedures, holding statements, approval chain (Comms / Legal / Exec), and post-crisis review process. Read before posting publicly.', due_offset_days: 12, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Audit Current Channels & Performance', description: 'Upload an audit of current channels — performance, gaps, tone consistency, and opportunities.', task_type: 'upload', phase: 'Weeks 2–3 — Calendar & Listening', content_body: 'Audit document covering each channel\'s follower growth, engagement, top-performing content, gaps in posting cadence, tone consistency, and three concrete opportunities to lift performance in the next 90 days.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Draft 30-Day Content Calendar', description: 'Draft a 30-day content calendar mapping content pillars to channels, dates, and owners.', task_type: 'upload', phase: 'Weeks 2–3 — Calendar & Listening', content_body: '30-day content calendar with content pillars, channel allocation, posting dates, copy direction, creative direction, paid promotion plan, and clearly named owner per asset.', due_offset_days: 18, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Influencer, UGC & Partnership Policy', description: 'Learn the influencer, UGC, and partnership policy — including disclosure and rights management.', task_type: 'info', phase: 'Weeks 2–3 — Calendar & Listening', content_body: 'Influencer engagement tiers, UGC rights and consent, disclosure requirements per region (#ad, paid partnership labels), contract templates, payment thresholds, and the brand-safety review process.', due_offset_days: 20, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: 'First Post Approved & Published', description: 'Get your first post approved and published — full approval workflow followed.', task_type: 'approval', phase: 'Weeks 4–6 — First Campaign', content_body: 'Publish your first piece of content end-to-end: copy, creative, alt-text, link tracking, approval routing through Brand and Legal where needed, scheduled and published live. Approval captured in the workflow tool.', due_offset_days: 25, required: true, approval_required: true, assignee_type: 'manager', order: 11 },
      { title: 'First Campaign Brief Drafted', description: 'Draft your first multi-channel social campaign brief using the standard template.', task_type: 'upload', phase: 'Weeks 4–6 — First Campaign', content_body: 'Standard campaign brief: objective, target audience, channel mix, creative direction, paid plan and budget, hashtags, success metrics, content cascade plan, and the launch and reporting timeline.', due_offset_days: 30, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Shadow Listening Review & Insight Memo', description: 'Run a listening review and write a 1-page insight memo of what audiences are saying.', task_type: 'meeting', phase: 'Weeks 4–6 — First Campaign', content_body: 'Run a structured social listening review across owned channels, competitors, and category. Output: a 1-page memo of what audiences are saying, sentiment trends, emerging narratives, and recommended responses.', due_offset_days: 35, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'Ship First Multi-Channel Campaign', description: 'Launch your first multi-channel campaign — content live across all planned channels.', task_type: 'upload', phase: 'Weeks 4–6 — First Campaign', content_body: 'Launch your first campaign across the planned channels. Required: assets approved, scheduled, link tracking in place, community response plan ready, and proof of going-live captured as screenshots or live URLs.', due_offset_days: 42, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: '45-Day Social Self-Review', description: 'Submit your reflection on the first 45 days — confidence, gaps, and forward commitments.', task_type: 'form', phase: 'Weeks 4–6 — First Campaign', content_body: 'Self-review of brand fluency, channel craft, community management confidence, crisis readiness, campaign planning quality, and three priorities for the next 45 days.', due_offset_days: 45, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
    ],
  },

  // ── 15. Generic Intern Onboarding ────────────────────────────────────────────
  {
    id: 'generic-intern',
    title: 'Generic Intern Onboarding',
    subtitle: 'Role-agnostic 30-day intern induction with mentor pairing',
    description:
      'A flexible 30-day onboarding for interns across any department. Covers welcome and admin, mentor pairing, department immersion, a small ownership project, and an exit reflection — designed so any team can drop a new intern in without rebuilding the journey from scratch.',
    badge: 'Quick Start',
    estimatedDays: 30,
    category: 'Internship',
    phases: ['Week 1 — Welcome & Setup', 'Weeks 2–3 — Immersion & Ownership', 'Week 4 — Wrap & Reflect'],
    tasks: [
      { title: 'Welcome & Internship Expectations', description: 'Read your welcome packet covering the 30-day journey, expectations, and the kind of feedback to expect.', task_type: 'info', phase: 'Week 1 — Welcome & Setup', content_body: 'Welcome packet covering the 30-day journey, weekly cadence, expectations, feedback approach, conversion criteria where applicable, and the cohort calendar.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Right-to-Work, ID & Internship Agreement Signed', description: 'Upload your right-to-work documents, ID, and signed internship agreement.', task_type: 'upload', phase: 'Week 1 — Welcome & Setup', content_body: 'Right-to-work verification, ID, signed internship agreement, tax forms, bank details for stipend, emergency contact, and any university or placement paperwork.', due_offset_days: 2, required: true, approval_required: false, assignee_type: 'new_hire', order: 2 },
      { title: 'Laptop, Email & Tool Access Provisioned', description: 'IT confirms laptop, email, and the basic tool set are working before day 2.', task_type: 'approval', phase: 'Week 1 — Welcome & Setup', content_body: 'Laptop set up, email and SSO provisioned, collaboration tools (Slack/Teams, Notion/Confluence, drive), and any role-scoped tooling. No production access by default for interns.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 3 },
      { title: 'Mentor Pairing Kickoff Call', description: 'A 30-minute kickoff with your assigned mentor covering cadence and how to ask for help.', task_type: 'meeting', phase: 'Week 1 — Welcome & Setup', content_body: '30-minute mentor kickoff: working style, weekly check-in time, how to ask for help, what is on and off limits to ask managers, and what good mentorship looks like to you.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: 'Personal Learning Goals & Self-Assessment', description: 'Submit three personal learning goals and a starting skills self-assessment.', task_type: 'form', phase: 'Week 1 — Welcome & Setup', content_body: 'Three personal learning goals, starting skill self-assessment across the role\'s core competencies, and the specific feedback you would value most from mentor and manager.', due_offset_days: 4, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Team Meet-and-Greet & Buddy Coffee', description: 'Meet your immediate team and have a 1:1 coffee with your assigned buddy.', task_type: 'meeting', phase: 'Week 1 — Welcome & Setup', content_body: 'Group meet-and-greet with your immediate team and a 1:1 coffee or virtual call with your assigned buddy. No agenda required — faces to names.', due_offset_days: 5, required: false, approval_required: false, assignee_type: 'buddy', order: 6 },
      { title: 'Department Context Deep Dive', description: 'Study your host department\'s mission, structure, current priorities, and recent work.', task_type: 'info', phase: 'Weeks 2–3 — Immersion & Ownership', content_body: 'Host department mission, team structure, current priorities, recent shipped work, key stakeholders, and how your work connects to the team\'s broader goals.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Shadow 2 Team Rituals (Standup, Review, Planning)', description: 'Observe two recurring team rituals to learn how the team actually works.', task_type: 'meeting', phase: 'Weeks 2–3 — Immersion & Ownership', content_body: 'Shadow two recurring team rituals (e.g. standup, sprint review, planning, retro, weekly review). Note the cadence, language, decision-making style, and what gets followed up afterwards.', due_offset_days: 12, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Small Ownership Project Scoped', description: 'Submit a 1-page scope for a small project you will own end-to-end during the internship.', task_type: 'upload', phase: 'Weeks 2–3 — Immersion & Ownership', content_body: '1-page scope: problem, why it matters, proposed approach, success metrics, what is in vs out of scope, dependencies, and a clear timeline through to the end of the internship.', due_offset_days: 15, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Project Scope Approved by Mentor & Manager', description: 'Mentor and manager review and formally approve your project scope before build begins.', task_type: 'approval', phase: 'Weeks 2–3 — Immersion & Ownership', content_body: 'Joint review with mentor and manager. Outcome: signed-off scope, agreed success metrics, weekly check-in plan, and any explicit constraints. No build work begins before this approval.', due_offset_days: 18, required: true, approval_required: true, assignee_type: 'manager', order: 10 },
      { title: 'Mid-Program Mentor Check-in', description: 'A mid-internship check-in with your mentor on progress, blockers, and learning goals.', task_type: 'meeting', phase: 'Weeks 2–3 — Immersion & Ownership', content_body: 'Mid-internship check-in with mentor: progress on goals, blockers, peer relationships, wellbeing, and what would make the remaining weeks most valuable.', due_offset_days: 18, required: true, approval_required: false, assignee_type: 'buddy', order: 11 },
      { title: 'Project Mid-Build Demo to Team', description: 'Demo your project progress mid-build — working slice, not polish.', task_type: 'meeting', phase: 'Weeks 2–3 — Immersion & Ownership', content_body: '15-minute mid-build demo to your immediate team. Goal: surface assumptions early and gather feedback before final delivery.', due_offset_days: 20, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Final Project Deliverable Submitted', description: 'Upload your final project deliverable as defined in your scope document.', task_type: 'upload', phase: 'Week 4 — Wrap & Reflect', content_body: 'Final deliverable as defined in your scope: document, deck, code in a repo, design file, or whatever the scope agreed. Includes a 1-page README explaining what it is and what would come next.', due_offset_days: 27, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'Final Presentation to Team & Manager', description: 'Present your final project to your team — problem, approach, outcome, learnings.', task_type: 'meeting', phase: 'Week 4 — Wrap & Reflect', content_body: '10–15 minute final presentation: problem, approach, demo or outcome, what you learned, and what you would do next. Audience: immediate team, mentor, manager.', due_offset_days: 29, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: 'Intern Exit Survey & Programme Feedback', description: 'Submit your honest exit survey on the internship — mentorship, project, team, and learning.', task_type: 'form', phase: 'Week 4 — Wrap & Reflect', content_body: 'Exit survey covering mentorship quality, manager support, project scoping, team experience, biggest growth moments, biggest frustrations, conversion interest where applicable, and three specific suggestions for the programme.', due_offset_days: 30, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
    ],
  },

  // ── 16. Program Coordinator (NGO) ────────────────────────────────────────────
  {
    id: 'program-coordinator-ngo',
    title: 'Program Coordinator (NGO) Onboarding',
    subtitle: 'Generalist coordinator ramp covering logistics, comms, and reporting',
    description:
      'A 45-day ramp for NGO Program Coordinators. Covers safeguarding, logistics, partner and volunteer coordination, internal reporting, and ends with the coordinator running scheduling, comms, and reporting for one workstream independently.',
    badge: 'Coordinator Ready',
    estimatedDays: 45,
    category: 'NGO & Non-Profit',
    phases: ['Week 1 — Policies & Setup', 'Weeks 2–3 — Workstream Immersion', 'Weeks 4–6 — Coordinate Independently'],
    tasks: [
      { title: 'Welcome & Program Overview', description: 'Read your welcome packet covering the programme portfolio, partners, and your assigned workstream.', task_type: 'info', phase: 'Week 1 — Policies & Setup', content_body: 'Programme overview, beneficiary populations, partner ecosystem, your assigned workstream, key milestones, donor mix, and the priorities for the current funding cycle.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Safeguarding & Code of Conduct (Mandatory)', description: 'Complete the mandatory safeguarding training before any beneficiary or partner contact.', task_type: 'info', phase: 'Week 1 — Policies & Setup', content_body: 'Safeguarding policy, code of conduct, power dynamics, recognising and reporting concerns, PSEA, and the role of the Designated Safeguarding Lead.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 2 },
      { title: 'Signed Confidentiality & Compliance Documents', description: 'Upload signed confidentiality and compliance documents covering programme data.', task_type: 'upload', phase: 'Week 1 — Policies & Setup', content_body: 'Signed confidentiality covering programme data, beneficiary information, donor information, and any sub-grantee financial data. Conflict of interest declaration included.', due_offset_days: 4, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: 'Systems Access (Email, CRM, Drive, Project Tracker)', description: 'IT provisions email, CRM, drive, expense tooling, and the project tracker.', task_type: 'approval', phase: 'Week 1 — Policies & Setup', content_body: 'Provision email and SSO, programme CRM (Salesforce NPSP / Civi / Bonterra), drive and document workspace, expense and procurement tooling, project tracker (Asana / Monday / Trello), and any volunteer database.', due_offset_days: 4, required: true, approval_required: true, assignee_type: 'it', order: 4 },
      { title: '1:1 with Program Manager', description: 'A 45-minute kickoff with your Program Manager covering remit, cadence, and expectations.', task_type: 'meeting', phase: 'Week 1 — Policies & Setup', content_body: '45-minute kickoff: workstream remit, weekly cadence, expectations, escalation paths, key dependencies, and the priorities for the first 45 days.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Workstream Map — Activities, Partners, Stakeholders', description: 'Document the workstream\'s activities, partners, and key stakeholders.', task_type: 'form', phase: 'Weeks 2–3 — Workstream Immersion', content_body: 'For your workstream: activities calendar, partner organisations, sub-grantees, internal teams involved, key stakeholders, decision-makers, and where you fit in the coordination web.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Logistics, Procurement & Expense Procedures', description: 'Learn the logistics, procurement, and expense procedures used across the programme.', task_type: 'info', phase: 'Weeks 2–3 — Workstream Immersion', content_body: 'Procurement thresholds and routes, preferred supplier list, expense and per diem rules, travel approval pathway, event logistics templates, and the documentation standard auditors expect.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Donor Compliance Basics', description: 'Read the donor compliance primer relevant to your workstream\'s funders.', task_type: 'info', phase: 'Weeks 2–3 — Workstream Immersion', content_body: 'Donor compliance primer: eligible costs, branding rules, procurement requirements, reporting calendar, audit expectations, and the consequences of donor non-compliance.', due_offset_days: 16, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Shadow a Coordinator on a Live Event or Visit', description: 'Accompany a senior coordinator on a real event, partner visit, or beneficiary engagement.', task_type: 'meeting', phase: 'Weeks 2–3 — Workstream Immersion', content_body: 'Shadow a senior coordinator on a real event, partner visit, or beneficiary engagement. Observe community entry, logistics handling, partner management, and the post-event documentation.', due_offset_days: 18, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Partner & Volunteer Introductions Made', description: 'Make formal introductions to the partners and volunteers in your workstream.', task_type: 'meeting', phase: 'Weeks 2–3 — Workstream Immersion', content_body: 'Formal introductions to the partner organisations and volunteer leads in your workstream. 20-minute calls covering remit, working style, expectations, and how you can best support each other.', due_offset_days: 21, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: 'Workstream Calendar & Comms Plan Drafted', description: 'Draft the next-30-day calendar and stakeholder comms plan for your workstream.', task_type: 'upload', phase: 'Weeks 4–6 — Coordinate Independently', content_body: 'Next 30-day calendar for your workstream and a stakeholder comms plan covering: who hears what, by when, through which channel, and which updates require manager review before sending.', due_offset_days: 28, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'First Internal Report Submitted', description: 'Submit your first internal monthly report covering activities, indicators, and risks.', task_type: 'upload', phase: 'Weeks 4–6 — Coordinate Independently', content_body: 'First internal monthly report: activities completed, indicator progress, partner and volunteer status, key risks, decisions needed from the Program Manager, and the priorities for the coming month.', due_offset_days: 35, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Coordinate a Live Activity Independently', description: 'Coordinate a live workstream activity independently — Program Manager reachable, not present.', task_type: 'meeting', phase: 'Weeks 4–6 — Coordinate Independently', content_body: 'Coordinate one live activity (training session, partner workshop, beneficiary event) independently. Responsibilities: logistics, agenda, on-site decisions, attendance, and documentation. Program Manager is reachable but not present.', due_offset_days: 40, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'Expense & Documentation Pack Cleared', description: 'Submit a clean expense and documentation pack for the activity you coordinated.', task_type: 'approval', phase: 'Weeks 4–6 — Coordinate Independently', content_body: 'Expense and documentation pack for the activity: receipts, attendance records, photo and consent records, partner sign-offs, and any procurement paperwork. Cleared by the Finance focal point.', due_offset_days: 42, required: true, approval_required: true, assignee_type: 'manager', order: 14 },
      { title: '45-Day Coordinator Self-Review', description: 'Submit your reflection on the first 45 days — confidence, gaps, and forward commitments.', task_type: 'form', phase: 'Weeks 4–6 — Coordinate Independently', content_body: 'Self-review of safeguarding confidence, logistics fluency, partner relationships built, reporting quality, hardest moments, biggest gaps, and three priorities for the next 45 days.', due_offset_days: 45, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
    ],
  },

  // ── 17. NGO Program Manager Onboarding ───────────────────────────────────────
  {
    id: 'ngo-program-manager',
    title: 'NGO Program Manager Onboarding',
    subtitle: 'Lead a program portfolio, budget, and team in 60 days',
    description:
      'A 60-day onboarding for NGO Program Managers stepping into a leadership role. Covers safeguarding, donor and budget context, team handover, partner relationships, and ends with the PM owning their portfolio\'s monthly review, budget burn, and forward 90-day plan.',
    badge: 'Leadership Track',
    estimatedDays: 60,
    category: 'NGO & Non-Profit',
    phases: ['Week 1 — Policies & Mandate', 'Weeks 2–4 — Portfolio & Team Immersion', 'Weeks 5–8 — Own the Portfolio'],
    tasks: [
      { title: 'Welcome & Programme Portfolio Charter', description: 'Read your appointment letter, charter, and the portfolio you are stepping into.', task_type: 'info', phase: 'Week 1 — Policies & Mandate', content_body: 'Charter document, portfolio scope, donor mix, current strategic priorities, success criteria for year one, and any explicit non-goals for the first 90 days.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Safeguarding, PSEA & Code of Conduct (Mandatory)', description: 'Complete the mandatory safeguarding and PSEA training for programme leadership.', task_type: 'info', phase: 'Week 1 — Policies & Mandate', content_body: 'Safeguarding policy, PSEA, code of conduct, leadership accountability for safe programming, reporting pathways, and the role of the Designated Safeguarding Lead and external referrals.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 2 },
      { title: 'Signed Senior Confidentiality, COI & Authority Documents', description: 'Upload signed confidentiality, conflict of interest, and delegated authority documents.', task_type: 'upload', phase: 'Week 1 — Policies & Mandate', content_body: 'Senior confidentiality covering programme, donor and HR information; conflict of interest declaration; delegated authority documents covering signing limits, hiring limits, and procurement thresholds.', due_offset_days: 4, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: 'Systems & Authority Access Provisioned', description: 'IT and Finance provision systems access and confirm your delegated financial limits.', task_type: 'approval', phase: 'Week 1 — Policies & Mandate', content_body: 'Email and SSO, CRM, finance and budget tooling, project tracker, HR system viewer rights, sub-grant management system, plus delegated financial authority encoded in the procurement and expense systems.', due_offset_days: 4, required: true, approval_required: true, assignee_type: 'it', order: 4 },
      { title: 'Kickoff with Country Director / Head of Programs', description: 'A 60-minute kickoff covering mandate, expectations, and the priorities for the first 90 days.', task_type: 'meeting', phase: 'Week 1 — Policies & Mandate', content_body: '60-minute kickoff: mandate, expectations, decision rights, weekly cadence, escalation paths, and the top three priorities for the first 90 days.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Donor Portfolio & Reporting Calendar Deep Dive', description: 'Study the donor portfolio — funding agreements, reporting calendar, and compliance hotspots.', task_type: 'info', phase: 'Weeks 2–4 — Portfolio & Team Immersion', content_body: 'Donor portfolio: every active grant, funding agreement, restricted vs unrestricted split, reporting calendar, compliance hotspots, audit history, and the renewal pipeline.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Budget, Burn Rate & Forecast Walkthrough', description: 'Walk through the portfolio budget, burn rate, and forecast with the Finance Business Partner.', task_type: 'meeting', phase: 'Weeks 2–4 — Portfolio & Team Immersion', content_body: 'Walkthrough with Finance Business Partner: budget by grant, current burn rate, variance vs plan, committed costs, forecast, and the top risks to budget realisation in the coming quarter.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: '1:1 with Every Direct Report', description: 'Structured 1:1s with each direct report using the same listening framework.', task_type: 'meeting', phase: 'Weeks 2–4 — Portfolio & Team Immersion', content_body: '60-minute 1:1 with each direct report. Same questions for every conversation: what is working, what is broken, what would you change in the first 90 days, what is the unspoken truth.', due_offset_days: 18, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Partner & Sub-Grantee Introductions', description: 'Formal 30-minute intros with each major partner and sub-grantee.', task_type: 'meeting', phase: 'Weeks 2–4 — Portfolio & Team Immersion', content_body: '30-minute intro with each major partner and sub-grantee covering: relationship history, current obligations, friction points, what is going well, and what they need from the new PM.', due_offset_days: 21, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Stakeholder & Risk Map', description: 'Document the full stakeholder graph and the top portfolio risks with mitigation plans.', task_type: 'form', phase: 'Weeks 2–4 — Portfolio & Team Immersion', content_body: 'Stakeholder map (donors, partners, government counterparts, internal teams, board) and risk register (programme delivery, financial, compliance, safeguarding, reputational) with current mitigation status.', due_offset_days: 25, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: '30-Day Findings Memo to Director', description: 'Submit a confidential 30-day findings memo to the Country Director or Head of Programs.', task_type: 'form', phase: 'Weeks 2–4 — Portfolio & Team Immersion', content_body: 'Confidential 30-day memo: what is true, what is broken, what is unclear, where you need more time, and what early decisions you are considering. 5 pages max.', due_offset_days: 30, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'Run Your First Portfolio Monthly Review', description: 'Lead your first portfolio monthly review with team, partners, and finance.', task_type: 'meeting', phase: 'Weeks 5–8 — Own the Portfolio', content_body: 'Lead the first monthly portfolio review: programme progress, indicator status, budget burn, risks, donor compliance status, decisions needed. Attendees: direct reports, finance, key partners.', due_offset_days: 40, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Forward 90-Day Plan Document', description: 'Upload your formal 90-day plan covering priorities, metrics, dependencies, and resource needs.', task_type: 'upload', phase: 'Weeks 5–8 — Own the Portfolio', content_body: 'Formal forward plan: top three priorities, success metrics, resource needs, dependencies, donor commitments, what you are explicitly deprioritising, and the escalation triggers you commit to using.', due_offset_days: 50, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'Forward Plan Approved by Director', description: 'Walk the Director through the 90-day plan and get formal endorsement.', task_type: 'approval', phase: 'Weeks 5–8 — Own the Portfolio', content_body: 'Live 30-minute walkthrough of the 90-day plan with the Country Director or Head of Programs, followed by structured Q&A. Outcome: endorsement, alignment on success metrics, and any added commitments.', due_offset_days: 55, required: true, approval_required: true, assignee_type: 'manager', order: 14 },
      { title: '60-Day Self-Review & Forward Commitments', description: 'Submit your reflection on the first 60 days — leadership, gaps, and explicit commitments.', task_type: 'form', phase: 'Weeks 5–8 — Own the Portfolio', content_body: 'Self-review of integration quality, where you have built trust, biggest surprises, hardest decisions, biggest gaps, and explicit commitments for the next 60 days.', due_offset_days: 60, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
    ],
  },

  // ── 18. Office & Operations Coordinator Onboarding ───────────────────────────
  {
    id: 'operations-coordinator',
    title: 'Office & Operations Coordinator Onboarding',
    subtitle: 'Equip new ops coordinators to run the office and core processes in 30 days',
    description:
      'A 30-day ramp for new Office and Operations Coordinators. Covers facilities, vendor management, expense and procurement workflows, internal events, and ends with the coordinator owning the office and core operations cadence end-to-end.',
    badge: 'Ops Ready',
    estimatedDays: 30,
    category: 'General',
    phases: ['Week 1 — Systems & Suppliers', 'Weeks 2–3 — Processes & Cadence', 'Week 4 — Run the Office'],
    tasks: [
      { title: 'Welcome & Operations Remit Overview', description: 'Read your welcome packet covering the ops function\'s remit, services, and SLAs.', task_type: 'info', phase: 'Week 1 — Systems & Suppliers', content_body: 'Operations remit: facilities, vendor management, expense workflows, internal events, travel, health and safety, business continuity, and the SLAs the team commits to internally.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Operations Stack Access (Ticketing, Expenses, Procurement)', description: 'IT provisions the ticketing, expense, procurement, and facilities systems.', task_type: 'approval', phase: 'Week 1 — Systems & Suppliers', content_body: 'Provision ticketing system (Jira / Freshservice / Linear), expense system (Spendesk / Pleo / Concur / Brex), procurement tool, facilities and visitor management, travel booking tool, and signing access for sub-thresholds.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 2 },
      { title: 'Supplier & Contract Register Review', description: 'Study the supplier register, key contracts, renewal dates, and points of contact.', task_type: 'info', phase: 'Week 1 — Systems & Suppliers', content_body: 'Supplier register, top 20 active contracts, renewal dates and notice periods, escalation contacts, payment terms, and the historical issues per supplier.', due_offset_days: 4, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: '1:1 with Head of Operations', description: 'A 45-minute kickoff covering remit, cadence, and the priorities for the first 30 days.', task_type: 'meeting', phase: 'Week 1 — Systems & Suppliers', content_body: '45-minute kickoff: remit, weekly cadence, expectations, escalation paths, current operational pain points, and the priorities for the first 30 days.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: 'Health, Safety & Business Continuity Briefing', description: 'Complete the mandatory health, safety, and business continuity briefing.', task_type: 'info', phase: 'Week 1 — Systems & Suppliers', content_body: 'Fire procedures, evacuation routes, first aid responders, incident reporting, safety inductions for new starters, business continuity playbook, and the disaster recovery contact tree.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Expense & Procurement Process Deep Dive', description: 'Learn the expense and procurement processes, thresholds, and required documentation.', task_type: 'info', phase: 'Weeks 2–3 — Processes & Cadence', content_body: 'Expense categories and rules, per diem policy, procurement thresholds and routes, three-quote rule, preferred supplier policy, purchase order process, and the audit-grade documentation standard.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Internal Event Playbook & Calendar', description: 'Study the internal event playbook and the next-90-day events calendar.', task_type: 'info', phase: 'Weeks 2–3 — Processes & Cadence', content_body: 'Internal event playbook (all-hands, off-sites, team socials, customer events, holiday events), budget envelopes, supplier list, run-of-show templates, and the next-90-day events calendar.', due_offset_days: 12, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Shadow Supplier Review or Office Walkthrough', description: 'Shadow a senior coordinator on a live supplier review or weekly office walkthrough.', task_type: 'meeting', phase: 'Weeks 2–3 — Processes & Cadence', content_body: 'Shadow either a supplier review meeting or the weekly office walkthrough. Note: what is checked, how issues are logged, and the conversational style with suppliers and facilities staff.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Standard Operating Procedure Audit', description: 'Audit the existing SOPs and upload a list of gaps, outdated steps, and quick wins.', task_type: 'upload', phase: 'Weeks 2–3 — Processes & Cadence', content_body: 'Audit document: a list of existing SOPs, outdated steps, missing SOPs that should exist, three quick wins you could ship in week 4, and three structural improvements that need owner alignment.', due_offset_days: 18, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'New Starter Setup Process Walkthrough', description: 'Walk through the new starter setup process with People Ops — the part you will own.', task_type: 'meeting', phase: 'Weeks 2–3 — Processes & Cadence', content_body: 'Walkthrough with People Ops covering the new starter setup process: desk, equipment, swag, building access, office tour, welcome lunch, and the documentation handed to the new starter on day 1.', due_offset_days: 20, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: 'Run Weekly Office Walkthrough Independently', description: 'Run the weekly office walkthrough end-to-end — log issues, raise tickets, follow up.', task_type: 'meeting', phase: 'Week 4 — Run the Office', content_body: 'Run the weekly office walkthrough independently: check facilities, meeting rooms, kitchens, signage, accessibility. Log every issue as a ticket, assign owner, follow up on overdue tickets.', due_offset_days: 24, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'Coordinate One Internal Event Independently', description: 'Coordinate one internal event end-to-end — agenda, logistics, suppliers, day-of run.', task_type: 'meeting', phase: 'Week 4 — Run the Office', content_body: 'Coordinate one internal event end-to-end: agenda, logistics, suppliers, budget tracking, run-of-show, day-of management, and post-event feedback gathering.', due_offset_days: 27, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Expense & Receipts Reconciliation Cleared', description: 'Reconcile the month\'s expenses and receipts and clear them with Finance.', task_type: 'approval', phase: 'Week 4 — Run the Office', content_body: 'Month-end expense and receipts reconciliation: chase missing receipts, code expenses correctly, escalate exceptions, and present the reconciled pack to Finance for sign-off.', due_offset_days: 28, required: true, approval_required: true, assignee_type: 'manager', order: 13 },
      { title: 'Update or Author One SOP', description: 'Upload an updated or newly authored SOP for one process you now own.', task_type: 'upload', phase: 'Week 4 — Run the Office', content_body: 'Upload one SOP using the standard template: purpose, scope, steps, exceptions, owner, review cadence. Focus on a process you actually ran during your ramp.', due_offset_days: 29, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: '30-Day Operations Self-Review', description: 'Submit your reflection on the first 30 days — confidence, gaps, and forward commitments.', task_type: 'form', phase: 'Week 4 — Run the Office', content_body: 'Self-review of systems fluency, supplier relationships, process confidence, event-running ability, biggest gaps, and three priorities for the next 30 days.', due_offset_days: 30, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
    ],
  },

  // ── 19. Administrative Assistant Onboarding ──────────────────────────────────
  {
    id: 'admin-assistant',
    title: 'Administrative Assistant Onboarding',
    subtitle: 'Master calendars, comms, and exec support in 30 days',
    description:
      'A 30-day ramp for new Administrative Assistants. Covers calendar craft, inbox triage, travel and expenses, document workflows, and ends with the AA running the assigned executive\'s diary and weekly cadence independently.',
    badge: 'Admin Ready',
    estimatedDays: 30,
    category: 'General',
    phases: ['Week 1 — Tools & Style', 'Weeks 2–3 — Cadence & Workflows', 'Week 4 — Own the Diary'],
    tasks: [
      { title: 'Welcome & Role Expectations', description: 'Read your welcome packet covering the AA role, the exec(s) you support, and expectations.', task_type: 'info', phase: 'Week 1 — Tools & Style', content_body: 'AA role expectations, the executive(s) you support, working style and preferences (calendar, comms, travel), confidentiality expectations, and the SLAs the AA team commits to internally.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Tools Access (Calendar, Mail, Travel, Expenses)', description: 'IT provisions calendar, mail, travel booking, and expense systems with delegated access.', task_type: 'approval', phase: 'Week 1 — Tools & Style', content_body: 'Provision calendar and mail (with delegate access where applicable), travel booking tool, expense system, document workspace, scheduling assistant (Calendly / SavvyCal), and signing access for sub-thresholds.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 2 },
      { title: 'Signed Confidentiality & Data Handling Agreement', description: 'Upload signed confidentiality covering exec communications and sensitive documents.', task_type: 'upload', phase: 'Week 1 — Tools & Style', content_body: 'Confidentiality covering exec communications, sensitive documents, board materials, HR information, and conflict of interest declaration.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: '1:1 with Assigned Executive(s)', description: 'A 45-minute kickoff with the executive(s) you support covering working style and preferences.', task_type: 'meeting', phase: 'Week 1 — Tools & Style', content_body: '45-minute kickoff with each assigned executive: working style, calendar preferences, inbox preferences, travel preferences, decision rights you can exercise on their behalf, and red lines.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: 'Calendar Etiquette & Style Guide', description: 'Study the calendar etiquette guide — focus time, meeting types, no-meeting blocks.', task_type: 'info', phase: 'Week 1 — Tools & Style', content_body: 'Calendar etiquette: focus time blocks, meeting types and durations, default agendas, recurring no-meeting blocks, travel buffers, time-zone defaults, and the rules for declining or rescheduling on the exec\'s behalf.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Inbox Triage Playbook', description: 'Read the inbox triage playbook — what to action, archive, escalate, or draft a reply for.', task_type: 'info', phase: 'Weeks 2–3 — Cadence & Workflows', content_body: 'Inbox triage rules: what to action immediately, what to archive, what to escalate, what to draft a reply for, label and folder system, response time SLAs, and the standard templates for common requests.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Travel Booking & Itinerary Standard', description: 'Learn the travel booking process, itinerary standard, and the policy thresholds.', task_type: 'info', phase: 'Weeks 2–3 — Cadence & Workflows', content_body: 'Travel booking flow, preferred suppliers, cabin and accommodation policy, ground transport rules, itinerary template, traveller tracking, and the emergency protocol.', due_offset_days: 12, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Document & Meeting-Notes Workflow', description: 'Study the document workflow — naming conventions, storage, sharing, and meeting notes.', task_type: 'info', phase: 'Weeks 2–3 — Cadence & Workflows', content_body: 'Document workflow: naming conventions, folder structure, sharing rules, version control, meeting-notes template, action capture, and the rules for handling sensitive or board-level documents.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Shadow a Senior AA for One Full Day', description: 'Shadow a senior Admin Assistant for one full day across calendar, inbox, and meetings.', task_type: 'meeting', phase: 'Weeks 2–3 — Cadence & Workflows', content_body: 'Spend a full day shadowing a senior AA. Observe the calendar choices, inbox triage decisions, meeting prep flow, expense reconciliation, and how they handle exec interrupts.', due_offset_days: 16, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Draft an Exec Weekly Briefing', description: 'Draft and share a sample weekly briefing for your exec — meetings, priorities, prep.', task_type: 'upload', phase: 'Weeks 2–3 — Cadence & Workflows', content_body: 'Draft a sample weekly briefing using the standard template: the week ahead, meeting prep needed, decisions awaiting the exec, travel notes, and an agenda for the Monday 1:1 with the exec.', due_offset_days: 20, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: 'Take Over Calendar Management Independently', description: 'Take over the exec\'s calendar independently for one full week.', task_type: 'meeting', phase: 'Week 4 — Own the Diary', content_body: 'Run the exec\'s calendar independently for one week: accept and decline requests, protect focus time, manage conflicts, batch meetings, and surface conflicts proactively to the exec.', due_offset_days: 24, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'Manage One Round of Travel End-to-End', description: 'Book and manage one round of travel for the exec end-to-end, including itinerary.', task_type: 'meeting', phase: 'Week 4 — Own the Diary', content_body: 'Book and manage one round of travel end-to-end: flights, accommodation, ground transport, dietary requirements, itinerary, traveller tracking, and a one-page briefing pack for the trip.', due_offset_days: 26, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Expense Reconciliation Cleared with Finance', description: 'Reconcile the exec\'s recent expenses and clear them with Finance.', task_type: 'approval', phase: 'Week 4 — Own the Diary', content_body: 'Reconcile the exec\'s recent expenses: receipts, coding, policy compliance, exceptions. Present the reconciled pack to Finance for sign-off.', due_offset_days: 28, required: true, approval_required: true, assignee_type: 'manager', order: 13 },
      { title: 'Author or Update One AA SOP', description: 'Upload one SOP you updated or authored for a process you now own.', task_type: 'upload', phase: 'Week 4 — Own the Diary', content_body: 'Upload one SOP using the standard template (purpose, scope, steps, exceptions, owner, review cadence) for a process you actually ran during ramp.', due_offset_days: 29, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: '30-Day AA Self-Review', description: 'Submit your reflection on the first 30 days — confidence, gaps, and forward commitments.', task_type: 'form', phase: 'Week 4 — Own the Diary', content_body: 'Self-review of calendar craft, inbox triage, travel readiness, document discipline, exec relationship, biggest gaps, and three priorities for the next 30 days.', due_offset_days: 30, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
    ],
  },

  // ── 20. Project Manager Onboarding ───────────────────────────────────────────
  {
    id: 'project-manager',
    title: 'Project Manager Onboarding',
    subtitle: 'Lead a cross-functional project from kickoff to delivery in 45 days',
    description:
      'A 45-day ramp for new cross-functional Project Managers. Covers methodology, tooling, stakeholder mapping, risk and dependency tracking, and ends with the PM running a real project from kickoff through to a stage-gate review with the steering committee.',
    badge: 'Delivery Ready',
    estimatedDays: 45,
    category: 'General',
    phases: ['Week 1 — Methodology & Tools', 'Weeks 2–3 — Stakeholders & Discovery', 'Weeks 4–6 — Lead a Project'],
    tasks: [
      { title: 'Welcome & Delivery Function Overview', description: 'Read your welcome packet covering the PMO\'s operating model, methodology, and current portfolio.', task_type: 'info', phase: 'Week 1 — Methodology & Tools', content_body: 'PMO operating model, project methodology (Agile / Waterfall / Hybrid), portfolio overview, stage-gate framework, governance bodies, decision rights, and the priorities for the current quarter.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'PM Tooling Access (Tracker, Roadmap, Docs)', description: 'IT provisions Jira/Asana, the roadmap tool, drive, time tracking, and reporting BI.', task_type: 'approval', phase: 'Week 1 — Methodology & Tools', content_body: 'Provision project tracker (Jira / Asana / Monday / ClickUp), roadmap tool (ProductBoard / Aha / native), drive and document workspace, time-tracking system, and the PMO reporting BI views.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 2 },
      { title: 'Project Management Methodology Primer', description: 'Study the team\'s project methodology, ceremonies, and stage-gate process.', task_type: 'info', phase: 'Week 1 — Methodology & Tools', content_body: 'Methodology principles, project lifecycle stages, gate criteria, standard ceremonies (kickoff, weekly status, stage-gate review, retrospective), RACI conventions, and the tailoring rules for small vs large projects.', due_offset_days: 4, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: '1:1 with Head of PMO / Delivery', description: 'A 45-minute kickoff with the Head of PMO covering remit, projects assigned, and expectations.', task_type: 'meeting', phase: 'Week 1 — Methodology & Tools', content_body: '45-minute kickoff: remit, projects assigned, weekly cadence, expectations, escalation paths, success metrics (on-time delivery, scope adherence, stakeholder NPS), and the priorities for the first 45 days.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: 'Portfolio & Stage-Gate Reporting Walkthrough', description: 'Walk through the portfolio reporting and stage-gate reports with a senior PM.', task_type: 'meeting', phase: 'Week 1 — Methodology & Tools', content_body: 'Walkthrough with senior PM: portfolio dashboard, stage-gate report formats, status conventions (RAG ratings), risk register format, decision log standard, and the rhythm of governance forums.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Project Charter & Stakeholder Map', description: 'Draft the charter and stakeholder map for your assigned project.', task_type: 'form', phase: 'Weeks 2–3 — Stakeholders & Discovery', content_body: 'For your assigned project: charter (objectives, scope, success metrics, constraints), stakeholder map (sponsor, steering committee, working group, end users), and engagement preferences for each stakeholder.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Stakeholder Discovery Interviews', description: 'Run discovery interviews with key stakeholders to surface goals, constraints, and risks.', task_type: 'meeting', phase: 'Weeks 2–3 — Stakeholders & Discovery', content_body: '30-minute discovery interviews with key stakeholders. Same questions for everyone: what success looks like, what could derail this project, what is unspoken, what dependencies you depend on, what you need from the PM.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Project Plan, Milestones & Dependencies', description: 'Build the project plan with milestones, dependencies, and a realistic timeline.', task_type: 'upload', phase: 'Weeks 2–3 — Stakeholders & Discovery', content_body: 'Project plan covering: workstreams, milestones, dependencies, critical path, resource plan, assumptions, and a realistic timeline with contingency. Drafted with the working group, not in isolation.', due_offset_days: 18, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Risk Register & Mitigation Plan', description: 'Build the risk register with mitigation plans, owners, and review cadence.', task_type: 'upload', phase: 'Weeks 2–3 — Stakeholders & Discovery', content_body: 'Risk register: each risk scored on likelihood and impact, mitigation plan, owner, review cadence, and the criteria that trigger escalation to the steering committee.', due_offset_days: 20, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Project Plan & Risks Approved by Sponsor', description: 'Walk the sponsor through the project plan and risk register and get sign-off to proceed.', task_type: 'approval', phase: 'Weeks 2–3 — Stakeholders & Discovery', content_body: 'Live 30-minute walkthrough with the project sponsor. Pass criteria: clear scope, realistic timeline, named owners, top risks understood and mitigated, governance cadence agreed. Sign-off captured in writing.', due_offset_days: 22, required: true, approval_required: true, assignee_type: 'manager', order: 10 },
      { title: 'Run the Project Kickoff Meeting', description: 'Run the project kickoff meeting end-to-end with the full working group.', task_type: 'meeting', phase: 'Weeks 4–6 — Lead a Project', content_body: 'Run the kickoff meeting: charter walkthrough, plan and milestones, dependencies, risks, governance cadence, working agreements, decision rights, and explicit commitments captured. Notes circulated within 24 hours.', due_offset_days: 28, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'First Weekly Status Report Published', description: 'Publish your first weekly status report using the standard template.', task_type: 'upload', phase: 'Weeks 4–6 — Lead a Project', content_body: 'Weekly status using the standard template: RAG rating, milestones hit and missed, decisions needed, top risks, blockers, asks, and the focus for the coming week. Published every Friday.', due_offset_days: 32, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Run a Stage-Gate Review with Steering Committee', description: 'Run a stage-gate review with the steering committee — decision captured in writing.', task_type: 'meeting', phase: 'Weeks 4–6 — Lead a Project', content_body: 'Stage-gate review with the steering committee: progress against plan, value delivered, decisions needed, scope or budget changes proposed. Decision captured in writing in the decision log.', due_offset_days: 40, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'Retrospective Run & Actions Captured', description: 'Run a retrospective with the working group and capture concrete actions for the next stage.', task_type: 'meeting', phase: 'Weeks 4–6 — Lead a Project', content_body: 'Run a retrospective with the working group: what worked, what did not, what to keep, what to change. Capture concrete actions with owners and due dates, and follow up the next week.', due_offset_days: 43, required: true, approval_required: false, assignee_type: 'new_hire', order: 14 },
      { title: '45-Day PM Self-Review', description: 'Submit your reflection on the first 45 days — confidence, gaps, and forward commitments.', task_type: 'form', phase: 'Weeks 4–6 — Lead a Project', content_body: 'Self-review of methodology fluency, stakeholder trust built, planning quality, risk handling, governance confidence, biggest gaps, and three priorities for the next 45 days.', due_offset_days: 45, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
    ],
  },

  // ── 21. Communications Officer (NGO) ──────────────────────────────────────────
  {
    id: 'communications-officer',
    title: 'Communications Officer Onboarding',
    subtitle: 'Carry the brand voice and ship your first NGO campaign in 45 days',
    description:
      'A 45-day ramp for Communications Officers in an NGO context. Covers safeguarding, brand voice, donor-facing comms, beneficiary dignity, media relations, and ends with the new hire shipping a complete campaign — press release, social plan, and donor update — through the standard approval flow.',
    badge: 'Comms Ready',
    estimatedDays: 45,
    category: 'NGO & Non-Profit',
    phases: ['Week 1 — Brand & Comms Foundations', 'Weeks 2–3 — Storytelling & Stakeholders', 'Weeks 4–6 — Ship Campaigns'],
    tasks: [
      { title: 'Welcome & Mission, Values, Theory of Change', description: 'Read the welcome packet covering mission, values, theory of change, and the audiences you serve.', task_type: 'info', phase: 'Week 1 — Brand & Comms Foundations', content_body: 'Mission, vision, values, theory of change, beneficiary geographies, donor audiences, partner ecosystem, and the strategic priorities the comms function is supporting this year.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Safeguarding & Ethical Storytelling Training', description: 'Complete safeguarding training and the ethical-storytelling module — required before any field content.', task_type: 'info', phase: 'Week 1 — Brand & Comms Foundations', content_body: 'Safeguarding policy, code of conduct, ethical storytelling principles, beneficiary dignity, informed consent, image and name use rules, anonymisation rules, and the escalation path for any disclosure.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 2 },
      { title: 'Tooling Access (CMS, Email, Social, Design)', description: 'IT provisions CMS, email platform, social schedulers, design tools, and the press contacts CRM.', task_type: 'approval', phase: 'Week 1 — Brand & Comms Foundations', content_body: 'Provision CMS, email platform (Mailchimp / HubSpot / Salesforce Marketing Cloud), social schedulers (Buffer / Sprout / Hootsuite), design suite (Canva / Adobe Express / Figma), and the press contacts CRM.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 3 },
      { title: 'Brand Voice, Visual Identity & Style Guide', description: 'Study the brand voice, visual identity, and the language style guide — including the do-not-use list.', task_type: 'info', phase: 'Week 1 — Brand & Comms Foundations', content_body: 'Brand voice, tone by audience (donors, beneficiaries, peers, press), visual identity (logo use, colour, typography, photography style), language style guide (capitalisation, person-first language, sector vocabulary), and the do-not-use list.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: '1:1 with Head of Communications', description: 'A 45-minute kickoff with the Head of Communications on remit, calendar, and expectations.', task_type: 'meeting', phase: 'Week 1 — Brand & Comms Foundations', content_body: '45-minute kickoff: remit, content calendar, weekly cadence, expectations, escalation paths, reputational-risk handling, and the priorities for the first 45 days.', due_offset_days: 4, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Content Audit & Channel Performance Review', description: 'Audit existing content and channel performance from the last 12 months and write a short brief.', task_type: 'upload', phase: 'Weeks 2–3 — Storytelling & Stakeholders', content_body: 'Audit website, blog, email, social, and donor reports from the last 12 months. Brief: what is working, what is stale, where audiences are engaging, where the brand voice is drifting, and three concrete opportunities for the next quarter.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Beneficiary Story Interview (Ethically Sourced)', description: 'Conduct one beneficiary story interview through the proper consent and safeguarding flow.', task_type: 'meeting', phase: 'Weeks 2–3 — Storytelling & Stakeholders', content_body: 'One full story-gathering cycle: identify the story with the programme team, obtain written informed consent through the standard form, conduct the interview with a safeguarding lead present, anonymise as required, and submit the raw notes for approval before drafting.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Donor & Stakeholder Communications Map', description: 'Build a map of donor and stakeholder audiences, their cadence, and the messages each receives.', task_type: 'form', phase: 'Weeks 2–3 — Storytelling & Stakeholders', content_body: 'Communications map: major donors, institutional funders, retail supporters, peer NGOs, government, press, and beneficiaries. For each: cadence, channel, what they care about, and who internally owns the relationship.', due_offset_days: 16, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Media Relations & Press List Walkthrough', description: 'Walk through the press list and the standard media-handling protocol with the Head of Comms.', task_type: 'meeting', phase: 'Weeks 2–3 — Storytelling & Stakeholders', content_body: 'Press list (national, regional, trade, sector outlets), embargo handling, spokesperson list, on-record vs background rules, crisis-comms protocol, and the approval chain for any media engagement.', due_offset_days: 18, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Draft Press Release (Sample Story)', description: 'Draft a press release on a recent programme milestone using the standard template.', task_type: 'upload', phase: 'Weeks 2–3 — Storytelling & Stakeholders', content_body: 'Press release on a recent milestone: headline, dateline, lede, supporting quotes from spokesperson and beneficiary (consented), programme context, boilerplate, and contact details — all in the house template.', due_offset_days: 20, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: 'Campaign Brief Approved by Comms Lead', description: 'Pitch and get approval on the brief for your first end-to-end campaign.', task_type: 'approval', phase: 'Weeks 4–6 — Ship Campaigns', content_body: 'Campaign brief covering: objective, audiences, key messages, channels (press, email, social, web), assets needed, timing, KPIs, risks, and the named approver chain. Comms lead signs off in writing before any content is produced.', due_offset_days: 25, required: true, approval_required: true, assignee_type: 'manager', order: 11 },
      { title: 'Ship First Donor Update Email', description: 'Write, route for approval, and send your first donor update email through the standard flow.', task_type: 'upload', phase: 'Weeks 4–6 — Ship Campaigns', content_body: 'Donor update email: brand-compliant, beneficiary-dignified, lead with impact, programme team approved, finance reviewed for any fundraising figures, and sent through the standard email platform with tracking in place.', due_offset_days: 32, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Ship First Social Campaign (3-Post Series)', description: 'Ship a 3-post social campaign across the right channels with the approved brand voice.', task_type: 'upload', phase: 'Weeks 4–6 — Ship Campaigns', content_body: '3-post social campaign with planned cadence across the right channels (LinkedIn, Instagram, X, others as relevant). Brand-compliant, accessibility-checked (alt-text, captions), engagement plan in place, and a short post-mortem written within 7 days of the final post.', due_offset_days: 38, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'Buddy Weekly Check-ins', description: 'Complete weekly check-ins with a senior comms colleague through the 45 days.', task_type: 'meeting', phase: 'Weeks 4–6 — Ship Campaigns', content_body: '30-minute weekly check-ins with your assigned senior comms buddy. Topics: drafts in progress, brand voice questions, hard ethical calls, donor sensitivities, and one moment of impact you want a second opinion on.', due_offset_days: 40, required: false, approval_required: false, assignee_type: 'buddy', order: 14 },
      { title: '45-Day Comms Self-Review', description: 'Submit your reflection on the first 45 days — confidence, gaps, and forward commitments.', task_type: 'form', phase: 'Weeks 4–6 — Ship Campaigns', content_body: 'Self-review of brand fluency, safeguarding confidence, storytelling craft, donor-comms readiness, media-handling confidence, biggest gaps, and three priorities for the next 45 days.', due_offset_days: 45, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
    ],
  },

  // ── 22. Fundraising & Development Officer (NGO) ──────────────────────────────
  {
    id: 'fundraising-officer',
    title: 'Fundraising & Development Officer Onboarding',
    subtitle: 'Build a donor pipeline and submit your first grant proposal in 45 days',
    description:
      'A 45-day ramp for NGO Fundraising and Development Officers. Covers donor ethics, CRM hygiene, donor segmentation, grant writing fundamentals, and ends with the officer submitting a real, internally-approved grant proposal and a stewardship plan for an existing donor.',
    badge: 'Pipeline Ready',
    estimatedDays: 45,
    category: 'NGO & Non-Profit',
    phases: ['Week 1 — Donor Foundations', 'Weeks 2–3 — Pipeline & Stewardship', 'Weeks 4–6 — Write & Submit'],
    tasks: [
      { title: 'Welcome & Funding Model Overview', description: 'Read the welcome packet covering the funding model, donor mix, and growth ambitions.', task_type: 'info', phase: 'Week 1 — Donor Foundations', content_body: 'Funding model, donor mix (institutional, trusts and foundations, major donors, corporates, retail), current pipeline, growth ambitions, restricted vs unrestricted income split, and the strategic priorities the fundraising function is supporting.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'Donor Ethics, Due Diligence & Acceptance Policy', description: 'Complete training on donor ethics, due diligence, and the gift acceptance policy.', task_type: 'info', phase: 'Week 1 — Donor Foundations', content_body: 'Donor ethics framework, due diligence procedure, gift acceptance policy, prohibited sources, reputational-risk handling, anonymity and naming rules, and the escalation path for any sensitive donor.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 2 },
      { title: 'CRM & Fundraising Tools Access', description: 'IT provisions the donor CRM, proposal library, prospect research tools, and finance reporting views.', task_type: 'approval', phase: 'Week 1 — Donor Foundations', content_body: 'Provision donor CRM (Salesforce NPSP / Raiser\'s Edge / Bloomerang / Salsa / DonorPerfect), proposal library, prospect research tools (Foundation Directory / Candid / Instrumentl), and the finance reporting views for restricted-fund tracking.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'it', order: 3 },
      { title: '1:1 with Director of Development', description: 'A 45-minute kickoff with the Director of Development on portfolio, targets, and expectations.', task_type: 'meeting', phase: 'Week 1 — Donor Foundations', content_body: '45-minute kickoff: portfolio assigned, income targets, weekly cadence, expectations on prospecting volume, stewardship rhythm, proposal pipeline, escalation paths, and the priorities for the first 45 days.', due_offset_days: 4, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: 'Case for Support & Programme Costings', description: 'Study the case for support and the programme costings you will be raising for.', task_type: 'info', phase: 'Week 1 — Donor Foundations', content_body: 'Case for support, programme-level costings, restricted budget templates, unit-cost figures (cost per beneficiary, cost per intervention), match-funding rules, and the indirect-cost recovery policy.', due_offset_days: 5, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'CRM Hygiene Walkthrough', description: 'Walk through the CRM with the database lead — how records, gifts, and stewardship are tracked.', task_type: 'meeting', phase: 'Weeks 2–3 — Pipeline & Stewardship', content_body: 'CRM walkthrough with the database lead: record standards, gift coding, soft-credits, stewardship touchpoints, opt-in and GDPR compliance, and the reports the team uses for forecasting and board updates.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Prospect Research on 10 Funders', description: 'Conduct prospect research on 10 prospective funders and submit a short brief on each.', task_type: 'upload', phase: 'Weeks 2–3 — Pipeline & Stewardship', content_body: 'Prospect research on 10 funders matched to the strategy: funding priorities, average grant size, application windows, past grantees, restrictions, contact route in, due-diligence flags, and a one-line fit rationale. Logged into the CRM with the standard prospecting tags.', due_offset_days: 14, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Shadow a Donor Stewardship Meeting', description: 'Shadow a senior fundraiser on a real donor or funder stewardship meeting.', task_type: 'meeting', phase: 'Weeks 2–3 — Pipeline & Stewardship', content_body: 'Shadow a senior fundraiser on a real stewardship meeting (or donor visit) with informed consent of the donor. Take notes silently, debrief afterwards on cues you noticed, language used, next steps captured, and how the relationship was logged in the CRM.', due_offset_days: 16, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Stewardship Plan for One Existing Donor', description: 'Draft a 12-month stewardship plan for one existing donor in your portfolio.', task_type: 'form', phase: 'Weeks 2–3 — Pipeline & Stewardship', content_body: 'Stewardship plan for one existing donor: relationship history, motivations, touchpoint cadence, named asks, reports owed, milestones for upgrade, risks, and the team members who will support specific touchpoints.', due_offset_days: 20, required: true, approval_required: false, assignee_type: 'new_hire', order: 9 },
      { title: 'Grant Writing Fundamentals & Style Guide', description: 'Complete the grant writing fundamentals module and study the proposal style guide.', task_type: 'info', phase: 'Weeks 2–3 — Pipeline & Stewardship', content_body: 'Grant writing fundamentals: problem statement, theory of change, activities, outputs, outcomes, monitoring and evaluation, sustainability, budget narrative. Proposal style guide: tone, person-first language, evidence requirements, and the do-not-claim list.', due_offset_days: 18, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: 'Proposal Outline Approved by Director', description: 'Pitch and get approval on the outline for the proposal you will submit.', task_type: 'approval', phase: 'Weeks 4–6 — Write & Submit', content_body: 'Proposal outline covering: funder, programme, requested amount, restricted budget lines, theory of change, M&E plan, named partners, risks, and the approval chain. Director of Development signs off in writing before full drafting begins.', due_offset_days: 25, required: true, approval_required: true, assignee_type: 'manager', order: 11 },
      { title: 'Full Proposal Drafted with Programme & Finance', description: 'Draft the full proposal in collaboration with the programme team and finance.', task_type: 'upload', phase: 'Weeks 4–6 — Write & Submit', content_body: 'Full proposal drafted with programme leads (technical content, M&E framework, partners) and finance (restricted budget, indirect-cost recovery, audit-ready figures). Drafted in the standard template with track changes from at least two reviewers.', due_offset_days: 35, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'Submit First Grant Proposal', description: 'Submit the proposal to the funder through the proper channel before the deadline.', task_type: 'upload', phase: 'Weeks 4–6 — Write & Submit', content_body: 'Submit the proposal to the funder through their portal or by their required channel before the deadline. Confirmation of submission uploaded as proof, CRM updated with submission status, and a stewardship touchpoint scheduled for follow-up.', due_offset_days: 42, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'Buddy Weekly Check-ins', description: 'Complete weekly check-ins with a senior fundraiser buddy through the 45 days.', task_type: 'meeting', phase: 'Weeks 4–6 — Write & Submit', content_body: '30-minute weekly check-ins with your assigned senior fundraiser buddy. Topics: pipeline progress, hard donor calls, restricted vs unrestricted tensions, ethical dilemmas, and one moment of donor relationship-building you want a second opinion on.', due_offset_days: 40, required: false, approval_required: false, assignee_type: 'buddy', order: 14 },
      { title: '45-Day Fundraising Self-Review', description: 'Submit your reflection on the first 45 days — confidence, gaps, and forward commitments.', task_type: 'form', phase: 'Weeks 4–6 — Write & Submit', content_body: 'Self-review of donor ethics fluency, CRM discipline, prospect research craft, stewardship confidence, proposal writing readiness, biggest gaps, and three priorities for the next 45 days.', due_offset_days: 45, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
    ],
  },

  // ── 23. First-Time People Manager ─────────────────────────────────────────────
  {
    id: 'first-time-manager',
    title: 'First-Time People Manager Onboarding',
    subtitle: 'Become a confident first-time people manager in 60 days',
    description:
      'A 60-day ramp for newly-promoted or newly-hired first-time people managers. Covers management mindset, 1:1 cadence, feedback craft, performance expectations, hiring fundamentals, and ends with the new manager running a full performance cycle for one direct report under coaching from HR and their own manager.',
    badge: 'Manager Ready',
    estimatedDays: 60,
    category: 'General',
    phases: ['Weeks 1–2 — Mindset & 1:1s', 'Weeks 3–5 — Feedback & Performance', 'Weeks 6–8 — Hire, Coach, Decide'],
    tasks: [
      { title: 'Welcome to People Management — Role Shift', description: 'Read the welcome packet on the shift from individual contributor to people manager.', task_type: 'info', phase: 'Weeks 1–2 — Mindset & 1:1s', content_body: 'The role shift: your output is now your team\'s output. New responsibilities (team direction, 1:1s, feedback, performance, hiring, retention, growth), new boundaries (confidentiality, line-management vs friendship), and the manager values the company expects.', due_offset_days: 0, required: true, approval_required: false, assignee_type: 'new_hire', order: 1 },
      { title: 'People Manager Tooling Access (HRIS, Performance, Hiring)', description: 'IT and HR provision HRIS, performance tools, hiring tools, and the manager handbook.', task_type: 'approval', phase: 'Weeks 1–2 — Mindset & 1:1s', content_body: 'Provision HRIS (BambooHR / Workday / HiBob / Personio) with line-manager permissions, performance tools (Lattice / 15Five / Leapsome / CultureAmp), hiring tools (Greenhouse / Ashby / Lever), and access to the manager handbook and policy library.', due_offset_days: 2, required: true, approval_required: true, assignee_type: 'hr', order: 2 },
      { title: 'Manager Code of Conduct & Confidentiality', description: 'Complete training on the manager code of conduct, confidentiality, and the legal essentials.', task_type: 'info', phase: 'Weeks 1–2 — Mindset & 1:1s', content_body: 'Manager code of conduct, confidentiality expectations, anti-discrimination and anti-harassment basics, reasonable adjustments, mental-health-at-work expectations, and the escalation path for any disclosure that crosses a legal or safeguarding line.', due_offset_days: 4, required: true, approval_required: false, assignee_type: 'new_hire', order: 3 },
      { title: '1:1 with Your Own Manager — Expectations', description: 'A 45-minute kickoff with your own manager on remit, success measures, and the team you are taking on.', task_type: 'meeting', phase: 'Weeks 1–2 — Mindset & 1:1s', content_body: '45-minute kickoff with your own manager: team remit, success measures for the next 60 days, known team dynamics, named risks, where you have authority and where you must escalate, and the rhythm of your own 1:1s with them.', due_offset_days: 3, required: true, approval_required: false, assignee_type: 'new_hire', order: 4 },
      { title: 'First 1:1s with Each Direct Report', description: 'Run a structured first 1:1 with every direct report in the first two weeks.', task_type: 'meeting', phase: 'Weeks 1–2 — Mindset & 1:1s', content_body: 'A 45-minute structured first 1:1 with each direct report. Same questions for everyone: what they are working on, what they need, what is in their way, what they want to grow into, how they like to be managed, and what they need from you this quarter. Notes captured in the standard 1:1 template.', due_offset_days: 10, required: true, approval_required: false, assignee_type: 'new_hire', order: 5 },
      { title: 'Weekly 1:1 Cadence Set & Calendared', description: 'Set and calendar weekly 1:1s with every direct report on a regular cadence.', task_type: 'form', phase: 'Weeks 1–2 — Mindset & 1:1s', content_body: 'Weekly 1:1s calendared with each direct report at a regular time, with a shared running agenda doc per report, owned by them. Standard structure: their topics first, your topics second, growth thread third, action items captured at the end.', due_offset_days: 12, required: true, approval_required: false, assignee_type: 'new_hire', order: 6 },
      { title: 'Feedback Fundamentals Training (SBI / Radical Candor)', description: 'Complete feedback fundamentals training — frameworks, language, common traps.', task_type: 'info', phase: 'Weeks 3–5 — Feedback & Performance', content_body: 'Feedback fundamentals: SBI (Situation-Behaviour-Impact), Radical Candor quadrants, distinguishing observation from judgement, separating performance from person, common traps (sandwiching, third-party feedback, late feedback), and the high-stakes feedback flow.', due_offset_days: 18, required: true, approval_required: false, assignee_type: 'new_hire', order: 7 },
      { title: 'Deliver One Piece of Constructive Feedback', description: 'Deliver one piece of real constructive feedback to a direct report and reflect on it.', task_type: 'meeting', phase: 'Weeks 3–5 — Feedback & Performance', content_body: 'Deliver one piece of real constructive feedback to a direct report using the SBI structure. Prepare in writing first. Deliver in a private 1:1. Capture how it landed, what you would do differently next time, and any follow-up you owe.', due_offset_days: 22, required: true, approval_required: false, assignee_type: 'new_hire', order: 8 },
      { title: 'Performance Cycle, Levels & Calibration Walkthrough', description: 'Walk through the performance cycle, levelling framework, and calibration process with HR.', task_type: 'meeting', phase: 'Weeks 3–5 — Feedback & Performance', content_body: 'HR walkthrough: performance cycle (goals, mid-year, year-end), levelling framework, calibration process, compensation and promotion principles, performance-improvement plans, exit decisions, and the role managers play vs the role HR plays in each.', due_offset_days: 25, required: true, approval_required: false, assignee_type: 'hr', order: 9 },
      { title: 'Goals Set & Documented for Each Direct Report', description: 'Co-create and document quarterly goals for each direct report in the performance tool.', task_type: 'upload', phase: 'Weeks 3–5 — Feedback & Performance', content_body: 'Quarterly goals co-created with each direct report. SMART, written in the performance tool, linked to team objectives, with explicit success criteria, milestones, and a check-in rhythm. Reviewed and approved by your own manager.', due_offset_days: 32, required: true, approval_required: false, assignee_type: 'new_hire', order: 10 },
      { title: 'Hiring & Interviewing Fundamentals', description: 'Complete the hiring and interviewing fundamentals — structured interviews, scorecards, bias.', task_type: 'info', phase: 'Weeks 6–8 — Hire, Coach, Decide', content_body: 'Hiring fundamentals: writing a role scorecard, structured interviewing, behavioural questions, evidence-based decision-making, bias awareness, debrief discipline, and the legal do-not-ask list. Standard interview kit and rubric for your function.', due_offset_days: 38, required: true, approval_required: false, assignee_type: 'new_hire', order: 11 },
      { title: 'Run One Structured Interview with Debrief', description: 'Run one structured interview using the standard rubric and write a full debrief.', task_type: 'meeting', phase: 'Weeks 6–8 — Hire, Coach, Decide', content_body: 'Run one structured interview from the live pipeline (or a panel observation if no live pipeline). Use the standard rubric. Write a full debrief: evidence captured per competency, recommendation, confidence level, and named gaps. Compare your debrief with the panel.', due_offset_days: 45, required: true, approval_required: false, assignee_type: 'new_hire', order: 12 },
      { title: 'First Manager-Led Performance Conversation', description: 'Run a full performance conversation with one direct report — coached by HR.', task_type: 'meeting', phase: 'Weeks 6–8 — Hire, Coach, Decide', content_body: 'Run a full performance conversation with one direct report. Prepared in writing, calibrated with your own manager, reviewed by HR before the conversation. Cover: strengths, growth areas, evidence, agreed actions, and follow-up rhythm. HR debriefs you afterwards.', due_offset_days: 52, required: true, approval_required: false, assignee_type: 'new_hire', order: 13 },
      { title: 'Manager Buddy Weekly Check-ins', description: 'Complete weekly check-ins with an experienced manager buddy through the 60 days.', task_type: 'meeting', phase: 'Weeks 6–8 — Hire, Coach, Decide', content_body: '30-minute weekly check-ins with your assigned experienced manager buddy. Topics: hard 1:1s, tricky feedback you owe, performance worries, hiring choices, and one moment of management you wanted a second opinion on. Confidential by default.', due_offset_days: 56, required: false, approval_required: false, assignee_type: 'buddy', order: 14 },
      { title: '60-Day Manager Self-Review & Forward Commitments', description: 'Submit your reflection on the first 60 days as a manager — confidence, gaps, and commitments.', task_type: 'form', phase: 'Weeks 6–8 — Hire, Coach, Decide', content_body: 'Self-review of 1:1 quality, feedback confidence, performance-conversation readiness, hiring craft, team trust built, biggest surprises, biggest gaps, and three explicit commitments for the next 60 days as a people manager.', due_offset_days: 60, required: true, approval_required: false, assignee_type: 'new_hire', order: 15 },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<TaskType, string> = {
  info: 'Read',
  form: 'Form',
  upload: 'Upload',
  approval: 'Approval',
  meeting: 'Meeting',
};

const TYPE_ICON: Record<TaskType, React.ReactNode> = {
  info: <Info size={12} className="text-gray-500" />,
  form: <FileText size={12} className="text-gray-500" />,
  upload: <Upload size={12} className="text-gray-500" />,
  approval: <CheckCircle2 size={12} className="text-gray-500" />,
  meeting: <Calendar size={12} className="text-gray-500" />,
};

const ASSIGNEE_LABEL: Record<AssigneeType, string> = {
  new_hire: 'You', manager: 'Manager', buddy: 'Buddy',
  hr: 'HR', it: 'IT', dept_admin: 'Dept Admin',
};

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtRelative(iso: string) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

const CATEGORY_OPTIONS = [
  { value: 'Technology', label: 'Technology' },
  { value: 'NGO & Non-Profit', label: 'NGO & Non-Profit' },
  { value: 'Sales', label: 'Sales' },
  { value: 'HR', label: 'HR' },
  { value: 'Executive', label: 'Executive' },
  { value: 'General', label: 'General' },
];

// ── Dropdown Component ─────────────────────────────────────────────────────────

interface DropdownOption { value: string; label: string }

function Dropdown({
  value, options, placeholder, onChange,
}: {
  value: string;
  options: DropdownOption[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-gray-200 rounded-lg text-gray-600 bg-white hover:border-gray-400 whitespace-nowrap transition-colors"
      >
        <span>{selected?.label || placeholder}</span>
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px] py-1 max-h-[280px] overflow-y-auto">
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 ${!value ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
          >
            {placeholder}
          </button>
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 ${o.value === value ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Row Menu (3-dot dropdown) ──────────────────────────────────────────────────

function RowMenu({
  tmpl, onEdit, onClone, onToggle, onDelete,
}: {
  tmpl: OnboardingTemplate;
  onEdit: () => void;
  onClone: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.right - 160 });
    function onDoc(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[160px]"
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-gray-700 hover:bg-gray-50"
          >
            <Pencil size={12} className="text-gray-500" /> Edit
          </button>
          <button
            onClick={() => { setOpen(false); onClone(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-gray-700 hover:bg-gray-50"
          >
            <Copy size={12} className="text-gray-500" /> Duplicate
          </button>
          <button
            onClick={() => { setOpen(false); onToggle(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-gray-700 hover:bg-gray-50"
          >
            <Eye size={12} className="text-gray-500" /> {tmpl.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <div className="h-px bg-gray-100 my-1" />
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-red-600 hover:bg-red-50"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </>
  );
}

// ── Phase Accordion (for Preview) ──────────────────────────────────────────────

function PhaseAccordion({ tasks, defaultOpen = false }: { tasks: BlueprintTask[]; defaultOpen?: boolean }) {
  const phases = [...new Set(tasks.map(t => t.phase))];
  const [open, setOpen] = useState<string | null>(defaultOpen ? phases[0] : null);

  return (
    <div className="space-y-2">
      {phases.map(phase => {
        const phaseTasks = tasks.filter(t => t.phase === phase);
        const isOpen = open === phase;
        const typeBreakdown = (['info', 'form', 'upload', 'approval', 'meeting'] as TaskType[])
          .map(ty => ({ ty, count: phaseTasks.filter(t => t.task_type === ty).length }))
          .filter(x => x.count > 0);

        return (
          <div key={phase} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(isOpen ? null : phase)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-white hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-gray-700">
                    {phases.indexOf(phase) + 1}
                  </span>
                </div>
                <div>
                  <p className="text-[12.5px] font-semibold text-gray-800">{phase}</p>
                  <p className="text-[10.5px] text-gray-400">{phaseTasks.length} tasks</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-2 text-[10.5px] text-gray-500">
                  {typeBreakdown.map(({ ty, count }) => (
                    <span key={ty}>{count}× {TYPE_LABEL[ty]}</span>
                  ))}
                </div>
                {isOpen
                  ? <ChevronUp size={13} className="text-gray-400" />
                  : <ChevronDown size={13} className="text-gray-400" />
                }
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 divide-y divide-gray-50 bg-gray-50/40">
                {phaseTasks.map((task, i) => (
                  <div key={i} className="px-4 py-2.5 flex gap-3">
                    <div className="mt-0.5 shrink-0">{TYPE_ICON[task.task_type]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] font-semibold text-gray-800 leading-snug">{task.title}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10.5px] text-gray-500">{TYPE_LABEL[task.task_type]}</span>
                          <span className="text-[10px] text-gray-300">·</span>
                          <span className="text-[10.5px] text-gray-500">
                            {task.due_offset_days === 0 ? 'Day 1' : `Day ${task.due_offset_days}`}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{task.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-500">→ {ASSIGNEE_LABEL[task.assignee_type]}</span>
                        {!task.required && <span className="text-[10px] text-gray-400 italic">optional</span>}
                        {task.approval_required && <span className="text-[10px] text-gray-600 font-medium">needs approval</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Preview Modal (Monochromatic) ──────────────────────────────────────────────

function PreviewModal({
  blueprint, onClose, onUse,
}: {
  blueprint: Blueprint;
  onClose: () => void;
  onUse: () => void;
}) {
  const bp = blueprint;
  const phases = [...new Set(bp.tasks.map(t => t.phase))];
  const icon = BLUEPRINT_ICONS[bp.id] ?? <Sparkles size={16} className="text-gray-700" />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{bp.category}</p>
              <h2 className="text-[15px] font-bold text-gray-900 leading-tight">{bp.title}</h2>
              <p className="text-[12px] text-gray-500 mt-0.5">{bp.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 flex gap-4 shrink-0">
          {[
            `${bp.tasks.length} tasks`,
            `${phases.length} phases`,
            `${bp.estimatedDays}-day programme`,
            'Multi-assignee',
          ].map((s, i) => (
            <span key={i} className="text-[11.5px] text-gray-600">{s}</span>
          ))}
        </div>

        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <p className="text-[12.5px] text-gray-600 leading-relaxed">{bp.description}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Full Task Breakdown</p>
          <PhaseAccordion tasks={bp.tasks} defaultOpen />
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
          <p className="text-[11.5px] text-gray-500">All tasks can be edited after creation</p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-[12px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={onUse}
              className="px-4 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Sparkles size={11} /> Use This Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Import Modal (Monochromatic) ───────────────────────────────────────────────

type ImportStep = 'name' | 'importing' | 'done' | 'error';

function ImportModal({
  blueprint, onClose,
}: {
  blueprint: Blueprint;
  onClose: (created?: boolean) => void;
}) {
  const navigate = useNavigate();
  const bp = blueprint;

  const [step, setStep] = useState<ImportStep>('name');
  const [customName, setCustomName] = useState(bp.title);
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState('');
  const [errMsg, setErrMsg] = useState('');

  async function runImport() {
    if (!customName.trim()) return;
    setStep('importing');
    setProgress(0);

    try {
      setCurrentTask('Creating template…');
      const template = await orgApi.createTemplate({
        name: customName.trim(),
        description: bp.description,
        category: bp.category,
        is_active: true,
      });

      const total = bp.tasks.length;
      for (let i = 0; i < total; i++) {
        const task = bp.tasks[i];
        setCurrentTask(`Adding task ${i + 1} of ${total}: "${task.title}"`);
        setProgress(Math.round(((i + 1) / (total + 1)) * 100));
        await orgApi.addTaskItem(template.id, {
          title: task.title,
          description: task.description,
          task_type: task.task_type,
          phase: task.phase,
          content_body: task.content_body,
          due_offset_days: task.due_offset_days,
          required: task.required,
          approval_required: task.approval_required,
          assignee_type: task.assignee_type,
          order: task.order,
        });
      }

      setProgress(100);
      setCurrentTask('Done!');
      setStep('done');
    } catch {
      setErrMsg('Something went wrong while creating the template. Please try again.');
      setStep('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
        {step === 'name' && (
          <>
            <div className="px-5 pt-5 pb-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-2.5">
                <Sparkles size={16} className="text-gray-700" />
              </div>
              <h3 className="text-[15px] font-bold text-gray-900">Name your template</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">
                Give it a name that fits your organisation. You can edit tasks after creation.
              </p>
            </div>
            <div className="px-5 pb-4">
              <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Template Name</label>
              <input
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 transition"
                placeholder="e.g. Engineering Onboarding 2025"
                autoFocus
              />
              <p className="text-[11px] text-gray-400 mt-1.5">
                {bp.tasks.length} tasks across {[...new Set(bp.tasks.map(t => t.phase))].length} phases will be created.
              </p>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => onClose()}
                className="flex-1 py-2 text-[12px] font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!customName.trim()}
                onClick={runImport}
                className="flex-1 py-2 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg disabled:opacity-40 transition flex items-center justify-center gap-1.5"
              >
                <Sparkles size={11} /> Create Template
              </button>
            </div>
          </>
        )}

        {step === 'importing' && (
          <div className="px-5 py-7 flex flex-col items-center text-center">
            <div className="relative w-14 h-14 mb-4">
              <Loader2 size={48} className="text-gray-700 animate-spin" />
            </div>
            <p className="text-[14px] font-bold text-gray-900 mb-1">Building your template…</p>
            <p className="text-[11.5px] text-gray-500 mb-3 max-w-[260px] leading-relaxed">{currentTask}</p>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-700 rounded-full transition-all duration-400"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-2">{progress}% complete</p>
          </div>
        )}

        {step === 'done' && (
          <div className="px-5 py-7 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Check size={24} className="text-gray-700" strokeWidth={2.5} />
            </div>
            <p className="text-[15px] font-bold text-gray-900 mb-1">Template Created</p>
            <p className="text-[12px] text-gray-600 mb-1">
              <span className="font-semibold">"{customName}"</span> is ready with all {bp.tasks.length} tasks.
            </p>
            <p className="text-[11.5px] text-gray-400 mb-5">
              You can now assign it to new team members from the Onboarding Management page.
            </p>
            <div className="flex gap-2 w-full">
              <button
                onClick={() => onClose(true)}
                className="flex-1 py-2 text-[12px] font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Stay Here
              </button>
              <button
                onClick={() => navigate('/org/task-templates')}
                className="flex-1 py-2 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition flex items-center justify-center gap-1.5"
              >
                View Templates <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="px-5 py-7 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-3">
              <X size={24} className="text-red-500" />
            </div>
            <p className="text-[15px] font-bold text-gray-900 mb-1">Something went wrong</p>
            <p className="text-[11.5px] text-gray-500 mb-5">{errMsg}</p>
            <div className="flex gap-2 w-full">
              <button
                onClick={() => onClose()}
                className="flex-1 py-2 text-[12px] font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setStep('name'); setErrMsg(''); }}
                className="flex-1 py-2 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Template Form Modal (Create / Edit) ────────────────────────────────────────

function TemplateFormModal({
  tmpl, departments, onClose, onSaved,
}: {
  tmpl: OnboardingTemplate | null;
  departments: Department[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!tmpl;
  const [name, setName] = useState(tmpl?.name ?? '');
  const [description, setDescription] = useState(tmpl?.description ?? '');
  const [category, setCategory] = useState(tmpl?.category ?? '');
  const [departmentId, setDepartmentId] = useState<string>(tmpl?.department_id ? String(tmpl.department_id) : '');
  const [visibleTo, setVisibleTo] = useState(tmpl?.visible_to ?? 'all');
  const [isActive, setIsActive] = useState(tmpl?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!name.trim()) {
      setErr('Name is required');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        category: category || '',
        department_id: departmentId ? Number(departmentId) : null,
        visible_to: visibleTo,
        is_active: isActive,
      };
      if (isEdit && tmpl) {
        await orgApi.updateTemplate(tmpl.id, payload);
      } else {
        await orgApi.createTemplate(payload);
      }
      onSaved();
      onClose();
    } catch {
      setErr('Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-[15px] font-bold text-gray-900">{isEdit ? 'Edit Template' : 'Create New Template'}</h3>
          <p className="text-[12px] text-gray-500 mt-0.5">
            {isEdit ? 'Update template details below.' : 'Set up a new onboarding template. Add tasks afterwards.'}
          </p>
        </div>

        <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              placeholder="e.g. Engineering Onboarding 2026"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none"
              placeholder="Short description of the template"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-2.5 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
              >
                <option value="">None</option>
                {CATEGORY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Department</label>
              <select
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                className="w-full px-2.5 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5">Visible To</label>
            <input
              type="text"
              value={visibleTo}
              onChange={e => setVisibleTo(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
              placeholder="all"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-3.5 h-3.5 accent-gray-900"
            />
            <span className="text-[12px] text-gray-700">Active (visible to admins)</span>
          </label>

          {err && <p className="text-[11.5px] text-red-600">{err}</p>}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-[12px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="px-4 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg disabled:opacity-40 flex items-center gap-1.5"
          >
            {saving && <Loader2 size={11} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────

function DeleteConfirm({
  tmpl, onCancel, onConfirm,
}: {
  tmpl: OnboardingTemplate;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    await onConfirm();
    setBusy(false);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-5">
        <h3 className="text-[14px] font-bold text-gray-900 mb-1">Delete Template?</h3>
        <p className="text-[12px] text-gray-600 mb-4">
          Are you sure you want to delete <span className="font-semibold text-gray-900">"{tmpl.name}"</span>? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-[12px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={go}
            disabled={busy}
            className="px-4 py-1.5 text-[12px] font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5"
          >
            {busy && <Loader2 size={11} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Template Card (Featured Row, Monochromatic) ────────────────────────────────

function TemplateCard({
  bp, onPreview, onUse,
}: {
  bp: Blueprint;
  onPreview: () => void;
  onUse: () => void;
}) {
  const phases = [...new Set(bp.tasks.map(t => t.phase))];
  const icon = BLUEPRINT_ICONS[bp.id] ?? <Sparkles size={16} className="text-gray-700" />;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest">{bp.category}</p>
            <h3 className="text-[13px] font-bold text-gray-900 leading-snug mt-0.5 truncate">{bp.title}</h3>
          </div>
        </div>
        <button className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 shrink-0">
          <MoreHorizontal size={13} />
        </button>
      </div>

      <p className="text-[11.5px] text-gray-500 leading-relaxed line-clamp-2">{bp.subtitle}</p>

      <div className="flex items-center gap-2 text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          <BookOpen size={11} className="text-gray-400" /> {bp.tasks.length} tasks
        </span>
        <span className="text-gray-300">·</span>
        <span>{phases.length} phases</span>
        <span className="text-gray-300">·</span>
        <span>{bp.estimatedDays} days</span>
      </div>

      <div className="flex gap-2 mt-auto pt-1">
        <button
          onClick={onPreview}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11.5px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <Play size={10} fill="currentColor" /> Preview
        </button>
        <button
          onClick={onUse}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11.5px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <Sparkles size={10} /> Use Template
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const TABS = ['All', 'Technology', 'NGO & Non-Profit'] as const;
type Tab = typeof TABS[number];
const PAGE_SIZE = 10;
const BLUEPRINT_PAGE_SIZE = 6;

export default function OrgTemplateHub() {
  const navigate = useNavigate();

  // Data
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // UI State
  const [activeTab, setActiveTab] = useState<Tab>('All');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [bpPage, setBpPage] = useState(1);

  // Modals
  const [previewBp, setPreviewBp] = useState<Blueprint | null>(null);
  const [importBp, setImportBp] = useState<Blueprint | null>(null);
  const [importDone, setImportDone] = useState(false);
  const [editTmpl, setEditTmpl] = useState<OnboardingTemplate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OnboardingTemplate | null>(null);

  // Import file picker
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      const [t, d] = await Promise.all([orgApi.getTemplates(), orgApi.getDepartments()]);
      setTemplates(t);
      setDepartments(d);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Filtered blueprints (featured row)
  const filteredBlueprints = useMemo(() => {
    return BLUEPRINTS.filter(bp => {
      if (activeTab !== 'All' && bp.category !== activeTab) return false;
      if (search && !bp.title.toLowerCase().includes(search.toLowerCase()) &&
          !bp.subtitle.toLowerCase().includes(search.toLowerCase())) return false;
      if (catFilter && bp.category !== catFilter) return false;
      // Blueprints aren't tied to a department — hide cards when a department filter is set.
      if (deptFilter) return false;
      // Blueprints are conceptually always "active" starter templates — hide when filtering to inactive.
      if (statusFilter === 'inactive') return false;
      return true;
    });
  }, [activeTab, search, catFilter, deptFilter, statusFilter]);

  // Blueprint pagination
  const bpTotalPages = Math.max(1, Math.ceil(filteredBlueprints.length / BLUEPRINT_PAGE_SIZE));
  const pagedBlueprints = useMemo(
    () => filteredBlueprints.slice((bpPage - 1) * BLUEPRINT_PAGE_SIZE, bpPage * BLUEPRINT_PAGE_SIZE),
    [filteredBlueprints, bpPage]
  );
  useEffect(() => { if (bpPage > bpTotalPages) setBpPage(1); }, [bpPage, bpTotalPages]);

  const bpPageNumbers = useMemo(() => {
    if (bpTotalPages <= 7) return Array.from({ length: bpTotalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (bpPage > 3) pages.push('...' as const);
    for (let i = Math.max(2, bpPage - 1); i <= Math.min(bpTotalPages - 1, bpPage + 1); i++) pages.push(i);
    if (bpPage < bpTotalPages - 2) pages.push('...' as const);
    pages.push(bpTotalPages);
    return pages;
  }, [bpPage, bpTotalPages]);

  // Filtered templates (all templates table)
  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      if (activeTab !== 'All' && (t.category || '') !== activeTab) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
      }
      if (catFilter && (t.category || '') !== catFilter) return false;
      if (deptFilter && String(t.department_id || '') !== deptFilter) return false;
      if (statusFilter === 'active' && !t.is_active) return false;
      if (statusFilter === 'inactive' && t.is_active) return false;
      return true;
    });
  }, [templates, activeTab, search, catFilter, deptFilter, statusFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / PAGE_SIZE));
  const pagedTemplates = useMemo(
    () => filteredTemplates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredTemplates, page]
  );
  useEffect(() => { if (page > totalPages) setPage(1); }, [page, totalPages]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (page > 3) pages.push('...' as const);
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...' as const);
    pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  // Derived stats
  const totalTemplates = templates.length;
  const totalTasks = templates.reduce((s, t) => s + (t.task_count || 0), 0);
  const totalPhases = templates.reduce((s, t) => s + new Set((t.tasks || []).map(x => x.phase)).size, 0);
  const avgDays = totalTemplates > 0
    ? Math.round(
        templates.reduce((s, t) => {
          const max = Math.max(0, ...((t.tasks || []).map(x => x.due_offset_days)));
          return s + max;
        }, 0) / totalTemplates
      )
    : 0;

  const recentTemplates = useMemo(
    () => [...templates].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [templates]
  );

  const categoryCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    templates.forEach(t => {
      const cat = t.category || 'General';
      acc[cat] = (acc[cat] || 0) + 1;
    });
    return acc;
  }, [templates]);

  const topCategories = useMemo(
    () => Object.entries(categoryCounts).sort(([, a], [, b]) => b - a).slice(0, 5),
    [categoryCounts]
  );

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    templates.forEach(t => { if (t.category) set.add(t.category); });
    CATEGORY_OPTIONS.forEach(c => set.add(c.value));
    return Array.from(set).map(v => ({ value: v, label: v }));
  }, [templates]);

  const departmentOptions = useMemo(
    () => departments.map(d => ({ value: String(d.id), label: d.name })),
    [departments]
  );

  // Handlers
  function handlePreviewUse() {
    const bp = previewBp;
    setPreviewBp(null);
    setImportBp(bp);
  }

  function handleImportClose(created?: boolean) {
    setImportBp(null);
    if (created) {
      setImportDone(true);
      refresh();
    }
  }

  async function handleClone(tmpl: OnboardingTemplate) {
    try {
      await orgApi.cloneTemplate(tmpl.id);
      await refresh();
    } catch {
      // swallow
    }
  }

  async function handleToggle(tmpl: OnboardingTemplate) {
    try {
      await orgApi.updateTemplate(tmpl.id, { is_active: !tmpl.is_active });
      await refresh();
    } catch {
      // swallow
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await orgApi.deleteTemplate(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch {
      setDeleteTarget(null);
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await orgApi.importTemplate(json);
      await refresh();
    } catch {
      alert('Could not import this file. Make sure it is a valid template JSON export.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function resetFilters() {
    setSearch('');
    setCatFilter('');
    setDeptFilter('');
    setStatusFilter('');
    setPage(1);
  }

  const hasFilters = !!(search || catFilter || deptFilter || statusFilter);

  return (
    <>
      {previewBp && (
        <PreviewModal blueprint={previewBp} onClose={() => setPreviewBp(null)} onUse={handlePreviewUse} />
      )}
      {importBp && (
        <ImportModal blueprint={importBp} onClose={handleImportClose} />
      )}
      {(createOpen || editTmpl) && (
        <TemplateFormModal
          tmpl={editTmpl}
          departments={departments}
          onClose={() => { setCreateOpen(false); setEditTmpl(null); }}
          onSaved={refresh}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          tmpl={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="max-w-7xl mx-auto">
        {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
        <nav className="flex items-center gap-1 mb-3 text-[11.5px]" aria-label="Breadcrumb">
          <button
            onClick={() => navigate('/org/onboarding-mgmt')}
            className="font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Onboarding Management
          </button>
          <ChevronRight size={11} className="text-gray-300" />
          <button
            onClick={() => navigate('/org/task-templates')}
            className="font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Task Templates
          </button>
          <ChevronRight size={11} className="text-gray-300" />
          <span className="font-semibold text-gray-900">Template Hub</span>
        </nav>

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles size={12} className="text-gray-500" />
              <span className="text-[10.5px] font-bold text-gray-500 uppercase tracking-widest">Template Hub</span>
            </div>
            <h1 className="text-[16px] font-bold text-gray-900">Onboarding Blueprints</h1>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Professionally designed onboarding templates — ready to customise and launch in seconds.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[11px] font-medium text-gray-600 bg-gray-100 rounded-lg">
              {BLUEPRINTS.length} blueprints available
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Upload size={13} /> Import Template
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Plus size={13} /> Create New Template
            </button>
          </div>
        </div>

        {/* ── Success Banner ──────────────────────────────────────────────── */}
        {importDone && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg mb-3">
            <Check size={14} className="text-gray-700 shrink-0" />
            <p className="text-[12px] text-gray-700">
              Template created successfully. Head to{' '}
              <button onClick={() => navigate('/org/task-templates')} className="underline font-semibold hover:text-gray-900">
                Task Templates
              </button>{' '}to assign it to new hires.
            </p>
            <button onClick={() => setImportDone(false)} className="ml-auto text-gray-400 hover:text-gray-700">
              <X size={12} />
            </button>
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-100 mb-4 gap-1">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => { setActiveTab(t); setPage(1); }}
              className={`py-2 px-3 text-[12.5px] font-medium border-b-2 transition-colors ${
                activeTab === t
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Two-Column Body ─────────────────────────────────────────────── */}
        <div className="flex gap-4 items-start">
          {/* LEFT */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 max-w-[280px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search templates..."
                  className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                />
              </div>
              <Dropdown
                value={catFilter}
                placeholder="All Categories"
                options={categoryOptions}
                onChange={(v) => { setCatFilter(v); setPage(1); }}
              />
              <Dropdown
                value={deptFilter}
                placeholder="All Departments"
                options={departmentOptions}
                onChange={(v) => { setDeptFilter(v); setPage(1); }}
              />
              <Dropdown
                value={statusFilter}
                placeholder="All Statuses"
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                onChange={(v) => { setStatusFilter(v); setPage(1); }}
              />
              <button className="flex items-center gap-1 px-3 py-1.5 text-[12px] border border-gray-200 rounded-lg text-gray-600 bg-white hover:bg-gray-50">
                <Filter size={12} /> Filters
              </button>
              {hasFilters && (
                <button
                  onClick={resetFilters}
                  className="text-[11.5px] text-gray-400 hover:text-gray-700 px-1"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Featured Cards Row */}
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pagedBlueprints.map(bp => (
                  <TemplateCard
                    key={bp.id}
                    bp={bp}
                    onPreview={() => setPreviewBp(bp)}
                    onUse={() => setImportBp(bp)}
                  />
                ))}
              </div>
              {filteredBlueprints.length === 0 && (
                <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                  <p className="text-[12px] text-gray-400">No blueprints match your search.</p>
                </div>
              )}
              {filteredBlueprints.length > 0 && bpTotalPages > 1 && (
                <div className="flex items-center justify-between mt-3 px-1">
                  <p className="text-[11.5px] text-gray-500">
                    Showing {(bpPage - 1) * BLUEPRINT_PAGE_SIZE + 1} to {Math.min(bpPage * BLUEPRINT_PAGE_SIZE, filteredBlueprints.length)} of {filteredBlueprints.length} blueprints
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setBpPage(bpPage - 1)}
                      disabled={bpPage === 1}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    {bpPageNumbers.map((p, i) =>
                      p === '...' ? (
                        <span key={`bp-dots-${i}`} className="px-1 text-[12px] text-gray-400">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setBpPage(p)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg text-[12px] font-semibold transition-colors ${
                            p === bpPage
                              ? 'bg-gray-900 text-white'
                              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => setBpPage(bpPage + 1)}
                      disabled={bpPage === bpTotalPages}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* All Templates Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-bold text-gray-900">All Templates</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{filteredTemplates.length} total</p>
                </div>
              </div>

              {loading ? (
                <div className="py-12 flex items-center justify-center">
                  <Loader2 size={18} className="text-gray-400 animate-spin" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-[12px] text-gray-400">No templates yet. Use a blueprint above or create your own.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="w-8 pl-4" />
                        <th className="py-2 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-left">Template Name</th>
                        <th className="py-2 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-left">Category</th>
                        <th className="py-2 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-left">Department</th>
                        <th className="py-2 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">Tasks</th>
                        <th className="py-2 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-center">Phases</th>
                        <th className="py-2 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-left">Duration</th>
                        <th className="py-2 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-left">Status</th>
                        <th className="py-2 px-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-left">Last Updated</th>
                        <th className="py-2 pr-4 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pagedTemplates.map(tmpl => {
                        const phases = new Set((tmpl.tasks || []).map(t => t.phase)).size;
                        const days = Math.max(0, ...((tmpl.tasks || []).map(t => t.due_offset_days)));
                        return (
                          <tr
                            key={tmpl.id}
                            onClick={() => setEditTmpl(tmpl)}
                            className="hover:bg-gray-50/70 cursor-pointer group"
                          >
                            <td className="pl-4 pr-0">
                              <GripVertical size={12} className="text-gray-300 group-hover:text-gray-400" />
                            </td>
                            <td className="py-2 px-3">
                              <p className="text-[12.5px] font-semibold text-gray-900">{tmpl.name}</p>
                              {tmpl.description && (
                                <p className="text-[10.5px] text-gray-400 truncate max-w-[280px]">{tmpl.description}</p>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <span className="text-[12px] text-gray-600">{tmpl.category || 'General'}</span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="text-[12px] text-gray-600">{tmpl.department_name || 'All Departments'}</span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="text-[12px] font-semibold text-gray-700">{tmpl.task_count}</span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="text-[12px] font-semibold text-gray-700">{phases}</span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="text-[12px] text-gray-600">{days} days</span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-gray-700">
                                <span className={`w-1.5 h-1.5 rounded-full ${tmpl.is_active ? 'bg-gray-700' : 'bg-gray-300'}`} />
                                {tmpl.is_active ? 'Active' : 'Draft'}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <p className="text-[11.5px] text-gray-700">{fmtDate(tmpl.updated_at)}</p>
                              {tmpl.updated_by_name && (
                                <p className="text-[10px] text-gray-400">by {tmpl.updated_by_name}</p>
                              )}
                            </td>
                            <td
                              className="py-2 pr-4 text-right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <RowMenu
                                tmpl={tmpl}
                                onEdit={() => setEditTmpl(tmpl)}
                                onClone={() => handleClone(tmpl)}
                                onToggle={() => handleToggle(tmpl)}
                                onDelete={() => setDeleteTarget(tmpl)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {filteredTemplates.length > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100">
                  <p className="text-[11.5px] text-gray-500">
                    Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filteredTemplates.length)} of {filteredTemplates.length} results
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    {pageNumbers.map((p, i) =>
                      p === '...' ? (
                        <span key={`dots-${i}`} className="px-1 text-[11px] text-gray-400">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          className={`w-7 h-7 flex items-center justify-center rounded-md text-[12px] font-semibold transition-colors ${
                            p === page
                              ? 'bg-gray-900 text-white'
                              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                      className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="w-[260px] shrink-0 space-y-3">
            {/* Recent Creations */}
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[12px] font-bold text-gray-900">Recent Creations</p>
                <button
                  onClick={() => navigate('/org/task-templates')}
                  className="text-[10.5px] text-gray-500 hover:text-gray-900"
                >
                  View all
                </button>
              </div>
              {loading ? (
                <div className="py-4 flex items-center justify-center">
                  <Loader2 size={14} className="text-gray-400 animate-spin" />
                </div>
              ) : recentTemplates.length === 0 ? (
                <p className="text-[11px] text-gray-400 py-2">No templates yet.</p>
              ) : (
                <div className="space-y-1">
                  {recentTemplates.slice(0, 5).map(t => (
                    <div
                      key={t.id}
                      onClick={() => setEditTmpl(t)}
                      className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 -mx-1.5 px-1.5 py-1 rounded-md"
                    >
                      <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                        <FileText size={12} className="text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11.5px] font-medium text-gray-800 truncate">{t.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {t.category || 'General'} · {fmtDate(t.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Template Insights */}
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-baseline gap-1 mb-2.5">
                <p className="text-[12px] font-bold text-gray-900">Template Insights</p>
                <span className="text-[10px] text-gray-400">(All Time)</span>
              </div>
              <div className="space-y-2">
                {([
                  ['Total Templates', String(totalTemplates)],
                  ['Total Tasks', String(totalTasks)],
                  ['Total Phases', String(totalPhases)],
                  ['Avg. Completion Time', `${avgDays} days`],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[11.5px] text-gray-500">{label}</span>
                    <span className="text-[12px] font-bold text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Popular Categories */}
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-[12px] font-bold text-gray-900 mb-2.5">Popular Categories</p>
              {topCategories.length === 0 ? (
                <p className="text-[11px] text-gray-400">No data yet.</p>
              ) : (
                <div className="space-y-2">
                  {topCategories.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-[11.5px] text-gray-700">{name}</span>
                      <span className="text-[12px] font-bold text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity (relative time) */}
            {recentTemplates.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-3">
                <p className="text-[12px] font-bold text-gray-900 mb-2">Last Activity</p>
                <p className="text-[11px] text-gray-500">
                  Most recent template created{' '}
                  <span className="font-semibold text-gray-700">{fmtRelative(recentTemplates[0].created_at)}</span>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
