import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, MessageSquare, Users2, ChevronRight,
  MapPin, GraduationCap, Lightbulb, Heart, Target, BookOpen,
  Users, MoreVertical, Quote, ChevronDown, Award,
  TrendingUp, Activity, Kanban, Info, Shield, Ban,
  ChevronUp, X,
} from 'lucide-react';
import { useApiList, useApi } from '../../hooks/useApi';
import { marketplaceApi } from '../../api/marketplace';
import { messagesApi, contactRequestApi, blocksApi } from '../../api/messages';
import { profileViewsApi } from '../../api/profileViews';
import { useAuth } from '../../context/AuthContext';
import type { MarketplaceUser, Conversation } from '../../types';
import { relativeTime } from '../../utils/time';
import Avatar from '../../components/ui/Avatar';
import UserProfileDrawer from '../../components/ui/UserProfileDrawer';
import IntroMessageModal from '../../components/ui/IntroMessageModal';
import MiniChatPopup from '../../components/ui/MiniChatPopup';
import apiClient from '../../api/apiClient';

type RoleFilter = 'all' | 'mentor' | 'student';
type SortKey    = 'recent' | 'alphabetical' | 'completeness';
type InfoModal  = 'howItWorks' | 'guidelines' | null;

const DOMAIN_LABELS: Record<string, string> = {
  stem: 'STEM', business: 'Business & Economics', humanities: 'Humanities',
  medicine: 'Medicine & Health Sciences', law: 'Law', arts: 'Arts & Design',
  social_sciences: 'Social Sciences', other: 'Other',
};
const LEVEL_LABELS: Record<string, string> = {
  undergraduate: 'Undergraduate', masters: "Master's", phd: 'PhD', any: 'Any level',
};

const PAGE_SIZE = 12;

function expertiseIcon(tag: string): React.ReactNode {
  const k = tag.toLowerCase();
  if (k.includes('leadership'))    return <Users size={17} className="text-primary-500" />;
  if (k.includes('project'))       return <Kanban size={17} className="text-purple-500" />;
  if (k.includes('educat'))        return <GraduationCap size={17} className="text-yellow-500" />;
  if (k.includes('entrepreneur'))  return <Lightbulb size={17} className="text-orange-500" />;
  if (k.includes('community'))     return <Heart size={17} className="text-pink-500" />;
  if (k.includes('strateg'))       return <Target size={17} className="text-red-500" />;
  if (k.includes('communication')) return <MessageSquare size={17} className="text-cyan-500" />;
  return <BookOpen size={17} className="text-gray-400" />;
}

function RoleBadge({ role }: { role: string }) {
  const cls = 'bg-primary-100 text-primary-700';
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${cls}`}>
      {role === 'mentor' ? 'MENTOR' : 'MENTEE'}
    </span>
  );
}

// ── FilterDropdown ─────────────────────────────────────────────────────────
function FilterDropdown({ label, active = false, children }: { label: string; active?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium border rounded-lg transition-colors ${active ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-[#e0e0e0] text-gray-600 hover:bg-gray-50 bg-white'}`}
      >
        {label} <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 min-w-[160px] bg-white border border-gray-200 rounded-xl z-20 py-1 max-h-52 overflow-y-auto" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub: string }) {
  return (
    <div className="bg-white border border-[#e0e0e0] rounded-xl px-4 py-3.5 flex items-center gap-3">
      <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="text-[11.5px] text-gray-500">{label}</p>
        <p className="text-[20px] font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-[10.5px] text-green-500 font-medium">↑ {sub}</p>
      </div>
    </div>
  );
}

// ── UserCard ───────────────────────────────────────────────────────────────
const CARD_GRADIENTS = [
  'from-violet-100 to-indigo-100',
  'from-primary-100 to-sky-100',
  'from-emerald-100 to-teal-100',
  'from-orange-100 to-amber-100',
  'from-pink-100 to-rose-100',
  'from-cyan-100 to-primary-100',
];

function UserCard({ user, index, onView, onMessage }: {
  user: MarketplaceUser; index: number; onView: () => void; onMessage: () => void;
}) {
  const name     = `${user.first_name} ${user.last_name}`.trim() || user.username;
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];

  return (
    <div className="bg-white border border-[#e0e0e0] rounded-2xl overflow-hidden flex flex-col hover:border-gray-300 hover:shadow-sm transition-all">
      {/* Banner */}
      <div className={`h-[72px] bg-gradient-to-br ${gradient} relative shrink-0`} />

      {/* Avatar — overlaps banner */}
      <div className="px-4 -mt-7 mb-2 relative">
        <div className="relative inline-block">
          <div className="w-14 h-14 rounded-xl border-2 border-white overflow-hidden bg-gray-100 shadow-sm">
            {user.profile_picture
              ? <img src={user.profile_picture} alt={name} className="w-full h-full object-cover" />
              : <Avatar name={name} size="lg" />}
          </div>
          <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-4 flex flex-col flex-1 gap-1.5">
        {/* Name + role */}
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13.5px] font-bold text-gray-900 leading-snug">{name}</p>
          <RoleBadge role={user.role} />
        </div>

        {/* Headline */}
        {user.headline && (
          <p className="text-[11.5px] text-gray-500 leading-snug line-clamp-1">{user.headline}</p>
        )}

        {/* Bio snippet */}
        {user.bio && (
          <p className="text-[11.5px] text-gray-400 leading-snug line-clamp-2">{user.bio}</p>
        )}

        {/* Expertise (mentor) or field + university (student) */}
        {user.role === 'mentor' && user.expertise && (
          <p className="flex items-center gap-1 text-[11.5px] text-gray-500 line-clamp-1">
            <Lightbulb size={11} className="shrink-0 text-amber-400" />{user.expertise}
          </p>
        )}
        {user.role === 'mentor' && (user.domain || user.preferred_student_level) && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {user.domain && (
              <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-[10.5px] font-semibold rounded-full border border-primary-100">
                {DOMAIN_LABELS[user.domain] ?? user.domain}
              </span>
            )}
            {user.preferred_student_level && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10.5px] rounded-full border border-gray-200">
                {LEVEL_LABELS[user.preferred_student_level] ?? user.preferred_student_level}
              </span>
            )}
          </div>
        )}
        {user.role === 'student' && (user.field_of_study || user.university) && (
          <p className="flex items-center gap-1 text-[11.5px] text-gray-500 line-clamp-1">
            <GraduationCap size={11} className="shrink-0 text-primary-400" />
            {[user.field_of_study, user.university].filter(Boolean).join(' · ')}
          </p>
        )}

        {/* Location */}
        {user.role === 'student' && user.career_stage && (
          <p className="flex items-center gap-1 text-[11.5px] text-gray-400">
            {user.career_stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </p>
        )}

        {/* Tag chips */}
        {user.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {user.tags.slice(0, 3).map(t => (
              <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10.5px] font-medium rounded-md">
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Availability */}
        <p className="flex items-center gap-1.5 text-[11.5px] text-green-600 font-medium mt-0.5">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />Available this week
        </p>

        {/* Action buttons */}
        <div className="flex gap-2 mt-auto pt-1">
          <button
            onClick={onView}
            className="flex-1 py-1.5 text-[12px] font-semibold text-primary-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            View profile
          </button>
          {user.messaging_status !== 'blocked' && (
            <button
              onClick={onMessage}
              className="w-9 flex items-center justify-center text-gray-400 hover:text-primary-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <MessageSquare size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RecentlyJoinedRow ──────────────────────────────────────────────────────
function RecentlyJoinedRow({ user, onView, onMessage, onMenuOpen }: {
  user: MarketplaceUser; onView: () => void; onMessage: () => void;
  onMenuOpen: (e: React.MouseEvent) => void;
}) {
  const name = `${user.first_name} ${user.last_name}`.trim() || user.username;
  return (
    <div className="grid grid-cols-[2fr_1fr_2fr_1.5fr_1fr_1.5fr] gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors items-center">
      <button onClick={onView} className="flex items-center gap-2.5 min-w-0 text-left">
        <Avatar name={name} src={user.profile_picture} size="sm" />
        <p className="text-[12.5px] font-semibold text-gray-900 truncate hover:text-primary-600 transition-colors">{name}</p>
      </button>
      <div><RoleBadge role={user.role} /></div>
      <p className="text-[12px] text-gray-500 truncate">{user.tags.slice(0, 2).join(' • ') || '—'}</p>
      <p className="flex items-center gap-1 text-[12px] text-gray-500 truncate">
        {user.role === 'student' && user.career_stage ? user.career_stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'}
      </p>
      <p className="text-[12px] text-gray-400">{relativeTime(user.date_joined)}</p>
      <div className="flex items-center gap-1.5 justify-end">
        {user.messaging_status !== 'blocked' && (
          <button onClick={onMessage} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors whitespace-nowrap">
            <MessageSquare size={11} />Message
          </button>
        )}
        <button
          onClick={onMenuOpen}
          className="p-1.5 text-gray-300 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <MoreVertical size={13} />
        </button>
      </div>
    </div>
  );
}

// ── InfoModal ──────────────────────────────────────────────────────────────
function InfoModal({ type, onClose }: { type: InfoModal; onClose: () => void }) {
  if (!type) return null;
  const isHowItWorks = type === 'howItWorks';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[520px] bg-white rounded-2xl border border-gray-200 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            {isHowItWorks ? <Info size={16} className="text-primary-500" /> : <Shield size={16} className="text-pink-500" />}
            <p className="text-[15px] font-bold text-gray-900">{isHowItWorks ? 'How it works' : 'Community guidelines'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"><X size={15} /></button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {isHowItWorks ? (
            <>
              <p className="text-[13px] text-gray-500 leading-relaxed">Abroad Mentor connects students with experienced mentors to guide them through the study abroad application process.</p>
              {[
                { step: '1', title: 'Create your profile', desc: 'Complete your profile with your goals, interests, and background so mentors can find the right fit for you.' },
                { step: '2', title: 'Browse the Directory', desc: 'Explore mentors by expertise, availability, and location. Use filters to narrow down your search.' },
                { step: '3', title: 'Connect with a mentor', desc: 'Send a contact request or message directly. Once accepted, you can chat freely and share documents.' },
                { step: '4', title: 'Start your journey', desc: 'Work together on applications, essays, and interview prep. Track your progress in your shared workspace.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-4">
                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[12px] font-bold text-white">{step}</span>
                  </div>
                  <div>
                    <p className="text-[13.5px] font-semibold text-gray-900">{title}</p>
                    <p className="text-[12.5px] text-gray-500 mt-0.5 leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <p className="text-[13px] text-gray-500 leading-relaxed">To keep Abroad Mentor a safe, supportive, and effective space for everyone, we ask all members to follow these guidelines.</p>
              {[
                { icon: '🤝', title: 'Be respectful', desc: 'Treat every member with courtesy and professionalism regardless of background, nationality, or experience level.' },
                { icon: '🎯', title: 'Be genuine', desc: 'Represent yourself and your qualifications honestly. Misleading information undermines trust for everyone.' },
                { icon: '📩', title: 'Respond in a timely manner', desc: 'If you receive a message or request, try to respond within 48 hours — even if it\'s to decline.' },
                { icon: '🔒', title: 'Respect privacy', desc: 'Don\'t share personal information (phone numbers, addresses) shared in private conversations.' },
                { icon: '🚫', title: 'No spam or solicitation', desc: 'Don\'t use this platform to promote unrelated services, products, or paid services outside the platform.' },
                { icon: '🆘', title: 'Report issues', desc: 'If you experience harassment or see a violation, use the report button on any profile or message.' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="text-[18px] shrink-0">{icon}</span>
                  <div>
                    <p className="text-[13px] font-semibold text-gray-900">{title}</p>
                    <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">{desc}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-semibold rounded-lg transition-colors">Got it</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const navigate  = useNavigate();
  const { user: me } = useAuth();

  // ── Data ──────────────────────────────────────────────────────────────
  const { data: allUsers, loading: loadingUsers, refetch: refetchUsers } = useApiList(marketplaceApi.list);
  const { data: conversations, refetch: refetchConvs } = useApi(messagesApi.getConversations, []);
  const { data: contactReqs,   refetch: refetchCRs   } = useApi(contactRequestApi.list, []);
  const { data: blockStatus,   refetch: refetchBlocks } = useApi(blocksApi.list, []);
  const convList = conversations ?? [];

  const convMap = useMemo(() => new Map(convList.map((c: Conversation) => [c.user.id, c])), [convList]);
  const acceptedCrMap = useMemo(() => {
    const m = new Map<number, number>();
    contactReqs?.incoming.filter(cr => cr.status === 'accepted').forEach(cr => m.set(cr.user.id, cr.id));
    contactReqs?.outgoing.filter(cr => cr.status === 'accepted').forEach(cr => m.set(cr.user.id, cr.id));
    return m;
  }, [contactReqs]);

  // ── UI state ───────────────────────────────────────────────────────────
  const [search,           setSearch]          = useState('');
  const [roleFilter,       setRoleFilter]      = useState<RoleFilter>('all');
  const [expertiseFilter,  setExpertiseFilter] = useState('');
  const [locationFilter,   setLocationFilter]  = useState('');
  const [sortBy,           setSortBy]          = useState<SortKey>('recent');
  const [drawerUser,       setDrawerUser]      = useState<MarketplaceUser | null>(null);
  const [introTarget,      setIntroTarget]     = useState<MarketplaceUser | null>(null);
  const [testimonialIdx,   setTestimonialIdx]  = useState(0);
  const [showAllExpertise, setShowAllExpertise] = useState(false);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [infoModal,        setInfoModal]       = useState<InfoModal>(null);
  const [rowMenu,          setRowMenu]         = useState<{ user: MarketplaceUser; x: number; y: number } | null>(null);
  const [miniChat,         setMiniChat]        = useState<{ userId: number; name: string; avatar?: string } | null>(null);
  const [page,             setPage]            = useState(0);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  // Close row menu on outside click / Escape
  useEffect(() => {
    const h = (e: MouseEvent) => { if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) setRowMenu(null); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setRowMenu(null); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, []);

  const openDrawer = (u: MarketplaceUser) => { setDrawerUser(u); profileViewsApi.record(u.id).catch(() => {}); };
  const openRowMenu = (e: React.MouseEvent, u: MarketplaceUser) => {
    e.stopPropagation();
    const menuW = 180, menuH = 130;
    setRowMenu({ user: u, x: Math.min(e.clientX, window.innerWidth - menuW - 8), y: Math.min(e.clientY, window.innerHeight - menuH - 8) });
  };

  // ── Derived data ───────────────────────────────────────────────────────
  const mentors  = useMemo(() => allUsers.filter(u => u.role === 'mentor'), [allUsers]);
  const students = useMemo(() => allUsers.filter(u => u.role === 'student'), [allUsers]);

  const allExpertiseCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of allUsers) for (const t of u.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [allUsers]);
  const expertiseCategories = showAllExpertise ? allExpertiseCategories : allExpertiseCategories.slice(0, 8);

  const recentlyJoined = useMemo(
    () => [...allUsers].sort((a, b) => new Date(b.date_joined).getTime() - new Date(a.date_joined).getTime()).slice(0, 10),
    [allUsers]);

  const allLocationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of allUsers) { const l = (u as any).city; if (l) counts.set(l, (counts.get(l) ?? 0) + 1); }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [allUsers]);
  const displayedLocations = showAllLocations ? allLocationCounts : allLocationCounts.slice(0, 5);

  const allLocations = useMemo(
    () => [...new Set(allUsers.map(u => (u as any).city).filter(Boolean))].sort() as string[], [allUsers]);
  const allExpertise = useMemo(() => [...new Set(allUsers.flatMap(u => u.tags))].sort(), [allUsers]);
  const testimonials = useMemo(() => mentors.filter(u => u.bio && u.bio.length > 30).slice(0, 3), [mentors]);

  // ── Filtered list ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = allUsers.filter(u => {
      const name = `${u.first_name} ${u.last_name} ${u.username}`.toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (expertiseFilter && !u.tags.some(t => t.toLowerCase().includes(expertiseFilter.toLowerCase()))) return false;
      if (locationFilter && (u as any).city !== locationFilter) return false;
      return true;
    });
    if (sortBy === 'alphabetical') list = [...list].sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
    else if (sortBy === 'recent')  list = [...list].sort((a, b) => new Date(b.date_joined).getTime() - new Date(a.date_joined).getTime());
    else                           list = [...list].sort((a, b) => b.profile_completeness - a.profile_completeness);
    return list;
  }, [allUsers, search, roleFilter, expertiseFilter, locationFilter, sortBy]);

  const hasFilters = !!(search || roleFilter !== 'all' || expertiseFilter || locationFilter);
  const resetFilters = () => { setSearch(''); setRoleFilter('all'); setExpertiseFilter(''); setLocationFilter(''); setPage(0); };

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedUsers  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0); }, [search, roleFilter, expertiseFilter, locationFilter, sortBy]);

  // ── Profile path for "Continue" ────────────────────────────────────────
  const profilePath = me?.role === 'mentor' ? '/mentor/profile' : '/student/profile';

  const openMiniChat = (u: MarketplaceUser) => {
    const name = `${u.first_name} ${u.last_name}`.trim() || u.username;
    setMiniChat({ userId: u.id, name, avatar: u.profile_picture ?? undefined });
  };

  // ── Actions ───────────────────────────────────────────────────────────
  const handleMessage = (u: MarketplaceUser) => {
    if (u.messaging_status !== 'blocked') openMiniChat(u);
  };
  const handleBlock = async (u: MarketplaceUser) => {
    await apiClient.initCsrf(); await blocksApi.block(u.id); refetchUsers(); refetchBlocks(); refetchCRs();
  };
  const handleUnblock = async (u: MarketplaceUser) => {
    await apiClient.initCsrf(); await blocksApi.unblock(u.id); refetchUsers(); refetchBlocks();
  };
  const handleUnfriend = async (u: MarketplaceUser) => {
    const crId = acceptedCrMap.get(u.id); if (!crId) return;
    await apiClient.initCsrf(); await contactRequestApi.cancel(crId); refetchUsers(); refetchCRs();
  };
  const handleIntroSent = (userId: number) => {
    setIntroTarget(null);
    refetchConvs();
    const u = allUsers.find(x => x.id === userId);
    if (u) openMiniChat(u);
  };

  // ── Row context menu actions ───────────────────────────────────────────
  const rowMenuIsBlocked = rowMenu ? (blockStatus?.blocked_ids ?? []).includes(rowMenu.user.id) : false;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Info modals ─────────────────────────────────────────────────── */}
      <InfoModal type={infoModal} onClose={() => setInfoModal(null)} />

      {/* ── Mini chat popup ─────────────────────────────────────────────── */}
      {miniChat && (
        <MiniChatPopup
          userId={miniChat.userId}
          userName={miniChat.name}
          userAvatar={miniChat.avatar}
          onClose={() => setMiniChat(null)}
        />
      )}

      {/* ── Row context menu ────────────────────────────────────────────── */}
      {rowMenu && (
        <div
          ref={rowMenuRef}
          className="fixed bg-white border border-gray-200 rounded-xl z-50 py-1.5 w-44"
          style={{ left: rowMenu.x, top: rowMenu.y }}
        >
          <button
            onClick={() => { openDrawer(rowMenu.user); setRowMenu(null); }}
            className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left"
          >
            <Info size={13} className="shrink-0" /> View profile
          </button>
          {rowMenu.user.messaging_status !== 'blocked' && (
            <button
              onClick={() => { handleMessage(rowMenu.user); setRowMenu(null); }}
              className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left"
            >
              <MessageSquare size={13} className="shrink-0" /> Message
            </button>
          )}
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={() => { rowMenuIsBlocked ? handleUnblock(rowMenu.user) : handleBlock(rowMenu.user); setRowMenu(null); }}
            className="w-full flex items-center gap-3 px-4 py-2 text-[13px] text-red-500 hover:bg-red-50 transition-colors text-left"
          >
            <Ban size={13} className="shrink-0" /> {rowMenuIsBlocked ? 'Unblock' : 'Block'}
          </button>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
          <Users2 size={20} className="text-primary-600" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Directory</h1>
        </div>
      </div>


      {/* ── BROWSE TAB ──────────────────────────────────────────────────── */}
      <div className="flex gap-6 items-start">

          {/* ── Main column ───────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, skills, or keywords..."
                  className="w-full pl-8 pr-3 py-2 text-[13px] border border-[#e0e0e0] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <FilterDropdown label={roleFilter === 'all' ? 'All Roles' : roleFilter === 'mentor' ? 'Mentors' : 'Mentees'} active={roleFilter !== 'all'}>
                {(['all', 'mentor', 'student'] as const).map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)}
                    className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-gray-50 ${roleFilter === r ? 'text-primary-600 font-semibold' : 'text-gray-700'}`}>
                    {r === 'all' ? 'All Roles' : r === 'mentor' ? 'Mentors' : 'Mentees'}
                  </button>
                ))}
              </FilterDropdown>
              <FilterDropdown label={expertiseFilter || 'Expertise'} active={!!expertiseFilter}>
                <button onClick={() => setExpertiseFilter('')}
                  className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-gray-50 ${!expertiseFilter ? 'text-primary-600 font-semibold' : 'text-gray-700'}`}>All expertise</button>
                {allExpertise.slice(0, 12).map(e => (
                  <button key={e} onClick={() => setExpertiseFilter(e)}
                    className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-gray-50 ${expertiseFilter === e ? 'text-primary-600 font-semibold' : 'text-gray-700'}`}>{e}</button>
                ))}
              </FilterDropdown>
              {allLocations.length > 0 && (
                <FilterDropdown label={locationFilter || 'Location'} active={!!locationFilter}>
                  <button onClick={() => setLocationFilter('')}
                    className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-gray-50 ${!locationFilter ? 'text-primary-600 font-semibold' : 'text-gray-700'}`}>All locations</button>
                  {allLocations.map(l => (
                    <button key={l} onClick={() => setLocationFilter(l)}
                      className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-gray-50 ${locationFilter === l ? 'text-primary-600 font-semibold' : 'text-gray-700'}`}>{l}</button>
                  ))}
                </FilterDropdown>
              )}
              <FilterDropdown label={sortBy === 'recent' ? 'Recently joined' : sortBy === 'alphabetical' ? 'A → Z' : 'Most complete'} active={false}>
                {([['recent', 'Recently joined'], ['alphabetical', 'A → Z'], ['completeness', 'Most complete']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setSortBy(k)}
                    className={`w-full text-left px-3 py-2 text-[12.5px] hover:bg-gray-50 ${sortBy === k ? 'text-primary-600 font-semibold' : 'text-gray-700'}`}>{l}</button>
                ))}
              </FilterDropdown>
              {hasFilters && (
                <button onClick={resetFilters} className="text-[12.5px] font-semibold text-primary-600 hover:underline px-1">Reset</button>
              )}
            </div>



            {/* All members — paginated grid */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[14px] font-bold text-gray-900">
                    {hasFilters ? `Results (${filtered.length})` : `All members (${filtered.length})`}
                  </p>
                  <p className="text-[12px] text-gray-500 mt-0.5">Mentors and mentees on the platform.</p>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-gray-400">Page {page + 1} of {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-3 py-1.5 text-[12px] font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default transition-colors"
                    >← Prev</button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-3 py-1.5 text-[12px] font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default transition-colors"
                    >Next →</button>
                  </div>
                )}
              </div>

              {pagedUsers.length === 0 ? (
                <div className="bg-white border border-[#e0e0e0] rounded-xl p-10 text-center">
                  <Users2 size={28} className="mx-auto text-gray-200 mb-2" />
                  <p className="text-[13px] text-gray-400">No members match your filters.</p>
                  {hasFilters && (
                    <button onClick={resetFilters} className="mt-2 text-[12.5px] font-semibold text-primary-600 hover:underline">
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {pagedUsers.map((u, i) => (
                    <UserCard
                      key={u.id}
                      user={u}
                      index={page * PAGE_SIZE + i}
                      onView={() => openDrawer(u)}
                      onMessage={() => handleMessage(u)}
                    />
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-4 py-1.5 text-[12px] font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default transition-colors"
                  >← Previous</button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className={`w-8 h-8 text-[12px] font-semibold rounded-lg transition-colors ${
                        i === page ? 'bg-primary-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >{i + 1}</button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-4 py-1.5 text-[12px] font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default transition-colors"
                  >Next →</button>
                </div>
              )}
            </div>

            {/* Explore by expertise */}
            {!hasFilters && allExpertiseCategories.length > 0 && (
              <div className="mb-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Target size={13} className="text-primary-500" />
                      <p className="text-[14px] font-bold text-gray-900">Explore by expertise</p>
                    </div>
                    <p className="text-[12px] text-gray-500 mt-0.5">Find people by what they do best.</p>
                  </div>
                  {allExpertiseCategories.length > 8 && (
                    <button
                      onClick={() => setShowAllExpertise(v => !v)}
                      className="text-[12.5px] font-semibold text-primary-600 hover:underline flex items-center gap-0.5 shrink-0 mt-0.5"
                    >
                      {showAllExpertise ? <><ChevronUp size={13} /> Show less</> : <>View all <ChevronRight size={13} /></>}
                    </button>
                  )}
                </div>
                <div className={`${showAllExpertise ? 'flex flex-wrap gap-3' : 'flex gap-3 overflow-x-auto pb-1 scrollbar-none'}`}>
                  {expertiseCategories.map(([tag, count]) => (
                    <button key={tag} onClick={() => setExpertiseFilter(tag)}
                      className="shrink-0 flex items-center gap-3 px-4 py-3 bg-white border border-[#e0e0e0] rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-colors min-w-[155px]">
                      <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">{expertiseIcon(tag)}</div>
                      <div className="text-left">
                        <p className="text-[12.5px] font-bold text-gray-900 leading-snug">{tag}</p>
                        <p className="text-[11px] text-gray-400">{count} member{count !== 1 ? 's' : ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recently joined / results table */}
            <div>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp size={13} className="text-primary-500" />
                    <p className="text-[14px] font-bold text-gray-900">
                      {hasFilters ? `Results (${filtered.length})` : 'Recently joined'}
                    </p>
                  </div>
                  {!hasFilters && <p className="text-[12px] text-gray-500 mt-0.5">Welcome new faces to the community.</p>}
                </div>
              </div>
              {loadingUsers ? (
                <p className="text-[13px] text-gray-400 py-8 text-center">Loading…</p>
              ) : (hasFilters ? filtered : recentlyJoined).length === 0 ? (
                <p className="text-[13px] text-gray-400 py-8 text-center">No members found.</p>
              ) : (
                <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
                  <div className="grid grid-cols-[2fr_1fr_2fr_1.5fr_1fr_1.5fr] gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50/70">
                    {['Name', 'Role', 'Expertise', 'Location', 'Joined', ''].map((h, i) => (
                      <p key={i} className="text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">{h}</p>
                    ))}
                  </div>
                  {(hasFilters ? filtered : recentlyJoined).map(u => (
                    <RecentlyJoinedRow key={u.id} user={u}
                      onView={() => openDrawer(u)}
                      onMessage={() => handleMessage(u)}
                      onMenuOpen={e => openRowMenu(e, u)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right sidebar ────────────────────────────────────────── */}
          <div className="w-72 shrink-0 space-y-4 sticky top-6">

            {/* Quick start */}
            <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-[13.5px] font-bold text-gray-900">Quick start</p>
              </div>
              {[
                { icon: <Activity size={15} className="text-orange-500" />, title: 'How it works',         sub: 'Learn how the program works',   action: () => setInfoModal('howItWorks') },
                { icon: <Shield  size={15} className="text-pink-500"   />, title: 'Community guidelines', sub: 'Be respectful and kind',        action: () => setInfoModal('guidelines') },
              ].map(({ icon, title, sub, action }) => (
                <button key={title} onClick={action}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-gray-900">{title}</p>
                    <p className="text-[11px] text-gray-400">{sub}</p>
                  </div>
                  <ChevronRight size={13} className="text-gray-300 shrink-0" />
                </button>
              ))}
            </div>

            {/* Find the right match */}
            <div className="bg-white border border-[#e0e0e0] rounded-xl p-4">
              <p className="text-[13.5px] font-bold text-gray-900 mb-1">Find the right match</p>
              <p className="text-[12px] text-gray-500 leading-snug mb-3">
                Answer a few questions and we'll suggest mentors or mentees that fit your goals.
              </p>
              <p className="text-[11.5px] text-gray-400 mb-1.5">2 / 4 completed</p>
              <div className="w-full h-1.5 bg-gray-100 rounded-full mb-3">
                <div className="h-full bg-primary-600 rounded-full" style={{ width: '50%' }} />
              </div>
              <button
                onClick={() => navigate(profilePath)}
                className="w-full py-2 border border-gray-300 rounded-lg text-[12.5px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Continue
              </button>
            </div>

            {/* Top locations */}
            {allLocationCounts.length > 0 && (
              <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-[13.5px] font-bold text-gray-900">Top locations</p>
                </div>
                <div className="px-4 py-1 divide-y divide-gray-50">
                  {displayedLocations.map(([loc, count]) => (
                    <button key={loc} onClick={() => setLocationFilter(loc === locationFilter ? '' : loc)}
                      className={`w-full flex items-center justify-between py-2.5 hover:text-primary-600 transition-colors ${locationFilter === loc ? 'text-primary-600 font-semibold' : ''}`}>
                      <p className="text-[12.5px] text-left truncate">{loc}</p>
                      <p className="text-[12px] font-semibold text-gray-500 shrink-0 ml-2">{count}</p>
                    </button>
                  ))}
                </div>
                {allLocationCounts.length > 5 && (
                  <div className="px-4 pb-3">
                    <button
                      onClick={() => setShowAllLocations(v => !v)}
                      className="text-[12.5px] font-semibold text-primary-600 hover:underline flex items-center gap-1"
                    >
                      {showAllLocations
                        ? <><ChevronUp size={13} /> Show less</>
                        : <>View all locations <ChevronRight size={13} /></>
                      }
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Testimonial */}
            {testimonials.length > 0 && (
              <div className="bg-white border border-[#e0e0e0] rounded-xl p-4">
                <Quote size={18} className="text-primary-400 mb-2" />
                <p className="text-[12.5px] text-gray-700 leading-relaxed italic mb-3">
                  "{testimonials[testimonialIdx]?.bio.slice(0, 130)}{(testimonials[testimonialIdx]?.bio.length ?? 0) > 130 ? '…' : ''}"
                </p>
                <div className="flex items-center gap-2.5 mb-3">
                  <Avatar name={`${testimonials[testimonialIdx].first_name} ${testimonials[testimonialIdx].last_name}`} src={testimonials[testimonialIdx].profile_picture} size="sm" />
                  <div>
                    <p className="text-[12px] font-semibold text-gray-900">
                      {`${testimonials[testimonialIdx].first_name} ${testimonials[testimonialIdx].last_name}`.trim() || testimonials[testimonialIdx].username}
                    </p>
                    <p className="text-[10.5px] text-gray-400">Mentor</p>
                  </div>
                </div>
                {testimonials.length > 1 && (
                  <div className="flex items-center gap-1.5 justify-center">
                    {testimonials.map((_, i) => (
                      <button key={i} onClick={() => setTestimonialIdx(i)}
                        className={`w-2 h-2 rounded-full transition-colors ${i === testimonialIdx ? 'bg-primary-600' : 'bg-gray-200 hover:bg-gray-300'}`} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      {/* ── Profile Drawer ───────────────────────────────────────────────── */}
      {drawerUser && (
        <UserProfileDrawer
          user={drawerUser}
          hasConversation={convMap.has(drawerUser.id)}
          onClose={() => setDrawerUser(null)}
          onMessage={() => { setDrawerUser(null); handleMessage(drawerUser); }}
          onBlock={() => { setDrawerUser(null); handleBlock(drawerUser); }}
          onUnblock={() => { setDrawerUser(null); handleUnblock(drawerUser); }}
          onUnfriend={() => { setDrawerUser(null); handleUnfriend(drawerUser); }}
          acceptedCrId={acceptedCrMap.get(drawerUser.id)}
        />
      )}

      {/* ── Intro Modal ──────────────────────────────────────────────────── */}
      {introTarget && (
        <IntroMessageModal user={introTarget} onClose={() => setIntroTarget(null)} onSent={handleIntroSent} />
      )}
    </div>
  );
}
