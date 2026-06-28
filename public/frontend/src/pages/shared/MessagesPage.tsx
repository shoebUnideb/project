import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, FilePen, SlidersHorizontal, Phone, Video, Info, MoreHorizontal,
  X, Users, MessageSquare, UserPlus, Check,
  Ban, UserCheck, ExternalLink, ChevronDown, Archive,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { messagesApi, contactRequestApi, blocksApi } from '../../api/messages';
import { searchApi } from '../../api/search';
import apiClient, { ApiError } from '../../api/apiClient';
import Avatar from '../../components/ui/Avatar';
import RichTextInput, { type RichTextInputHandle } from '../../components/ui/RichTextInput';
import type { Message, Conversation, BlockStatus, ContactRequestItem } from '../../types';
import {
  COMMON_EMOJIS, loadSet, saveSet, loadMuted, saveMuted, isMutedNow, groupByDate,
} from './messages/messagesUtils';
import { ConversationItem } from './messages/ConversationItem';
import { ConversationContextMenu } from './messages/ConversationContextMenu';
import { NewMessageModal, type SimpleUser } from './messages/NewMessageModal';
import { MessageThread } from './messages/MessageThread';
import { ConversationDetailsPanel } from './messages/ConversationDetailsPanel';

type TabKey = 'all' | 'unread' | 'mentors' | 'teams';

export default function MessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Core chat state ───────────────────────────────────────────────────
  const [conversations,   setConversations]   = useState<Conversation[]>([]);
  const [selectedUserId,  setSelectedUserId]  = useState<number | null>(null);
  const [pendingUser,     setPendingUser]     = useState<SimpleUser | null>(null);
  const [messages,        setMessages]        = useState<Message[]>([]);
  const [input,           setInput]           = useState('');
  const [attachment,      setAttachment]      = useState<File | null>(null);
  const [sending,         setSending]         = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [search,          setSearch]          = useState('');
  const [tab,             setTab]             = useState<TabKey>('all');
  const [showDetails,     setShowDetails]     = useState(false);
  const [showAllFiles,    setShowAllFiles]    = useState(false);

  // ── Contact requests ──────────────────────────────────────────────────
  const [contactReqs,     setContactReqs]     = useState<ContactRequestItem[]>([]);
  const [outgoingCRs,     setOutgoingCRs]     = useState<ContactRequestItem[]>([]);
  const [crSending,       setCrSending]       = useState(false);
  const [crError,         setCrError]         = useState(false);

  // ── Block state ───────────────────────────────────────────────────────
  const [blockStatus,     setBlockStatus]     = useState<BlockStatus>({ blocked_ids: [], blocked_me_ids: [] });

  // ── New-message search modal ──────────────────────────────────────────
  const [showNewMsg,      setShowNewMsg]      = useState(false);
  const [newMsgQuery,     setNewMsgQuery]     = useState('');
  const [newMsgResults,   setNewMsgResults]   = useState<SimpleUser[]>([]);
  const [newMsgLoading,   setNewMsgLoading]   = useState(false);

  // ── Toolbar state ─────────────────────────────────────────────────────
  const [showFilter,      setShowFilter]      = useState(false);
  const [filterUnread,    setFilterUnread]    = useState(false);
  const [showEmoji,       setShowEmoji]       = useState(false);
  const [showHeaderMore,  setShowHeaderMore]  = useState(false);
  const [showDetailsMore, setShowDetailsMore] = useState(false);

  // ── Per-conversation preferences (localStorage) ───────────────────────
  const [pinnedIds,       setPinnedIds]       = useState<Set<number>>(() => loadSet('msgs_pinned'));
  const [archivedIds,     setArchivedIds]     = useState<Set<number>>(() => loadSet('msgs_archived'));
  const [favouriteIds,    setFavouriteIds]    = useState<Set<number>>(() => loadSet('msgs_favourites'));
  const [mutedMap,        setMutedMap]        = useState<Map<number, number | null>>(loadMuted);
  const [manualUnreadIds, setManualUnreadIds] = useState<Set<number>>(new Set());
  const [showArchived,    setShowArchived]    = useState(false);

  // ── Context menu ──────────────────────────────────────────────────────
  const [ctxMenu,         setCtxMenu]         = useState<{ userId: number; x: number; y: number } | null>(null);
  const [ctxMuteOpen,     setCtxMuteOpen]     = useState(false);

  // ── Panel widths (fixed) ──────────────────────────────────────────────
  const leftW = 300;

  // ── Refs ──────────────────────────────────────────────────────────────
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef   = useRef(0);
  const richTextRef       = useRef<RichTextInputHandle>(null);
  const fileInputRef      = useRef<HTMLInputElement>(null);
  const imageInputRef     = useRef<HTMLInputElement>(null);
  const docInputRef       = useRef<HTMLInputElement>(null);
  const pollRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const filterRef         = useRef<HTMLDivElement>(null);
  const headerMoreRef     = useRef<HTMLDivElement>(null);
  const detailsMoreRef    = useRef<HTMLDivElement>(null);
  const newMsgSearchRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctxRef            = useRef<HTMLDivElement>(null);
  const containerRef      = useRef<HTMLDivElement>(null);

  // ── Derived ───────────────────────────────────────────────────────────
  const selectedConv = conversations.find(c => c.user.id === selectedUserId) ?? null;
  const chatTarget   = selectedConv?.user ?? pendingUser;
  const selectedName = chatTarget
    ? `${chatTarget.first_name ?? ''} ${chatTarget.last_name ?? ''}`.trim() || chatTarget.username
    : '';
  const sharedFiles  = messages.filter(m => m.attachment);
  const visibleFiles = showAllFiles ? sharedFiles : sharedFiles.slice(0, 4);
  const grouped      = useMemo(() => groupByDate(messages), [messages]);

  const isBlocked  = blockStatus.blocked_ids.includes(selectedUserId ?? -1);
  const blockedMe  = blockStatus.blocked_me_ids.includes(selectedUserId ?? -1);
  const outgoingCR = outgoingCRs.find(cr => cr.user.id === (selectedUserId ?? -1));

  const ctxConvIsBlocked = ctxMenu ? blockStatus.blocked_ids.includes(ctxMenu.userId) : false;

  // ── Click-outside ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
      if (headerMoreRef.current && !headerMoreRef.current.contains(e.target as Node)) setShowHeaderMore(false);
      if (detailsMoreRef.current && !detailsMoreRef.current.contains(e.target as Node)) setShowDetailsMore(false);
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
        setCtxMuteOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setCtxMenu(null); setCtxMuteOpen(false); }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────
  const loadConversations = async () => {
    try { setConversations(await messagesApi.getConversations()); } catch { /* silent */ }
  };

  const loadContactReqs = async () => {
    try {
      const data = await contactRequestApi.list();
      setContactReqs(data.incoming ?? []);
      setOutgoingCRs(data.outgoing ?? []);
    } catch { /* silent */ }
  };

  const loadBlockStatus = async () => {
    try { setBlockStatus(await blocksApi.list()); } catch { /* silent */ }
  };

  useEffect(() => {
    loadConversations();
    loadContactReqs();
    loadBlockStatus();
  }, []);

  useEffect(() => {
    if (conversations.length > 0 && !selectedUserId) {
      setSelectedUserId(conversations[0].user.id);
    }
  }, [conversations, selectedUserId]);

  const loadMessages = async (uid: number, silent = false) => {
    if (!silent) setLoading(true);
    try { setMessages(await messagesApi.getThread(uid)); }
    catch { if (!silent) setMessages([]); }
    finally { if (!silent) setLoading(false); }
  };

  useEffect(() => {
    if (!selectedUserId) return;
    prevMsgCountRef.current = 0;
    loadMessages(selectedUserId);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadMessages(selectedUserId, true), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedUserId]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const isInitialLoad = prevMsgCountRef.current === 0 && messages.length > 0;
    const isNearBottom  = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isInitialLoad || isNearBottom) el.scrollTop = el.scrollHeight;
    prevMsgCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => { setShowAllFiles(false); }, [selectedUserId]);

  // ── Send / respond ────────────────────────────────────────────────────
  const handleSend = async (_html?: string, text?: string) => {
    const body = text ?? input;
    if (!body.trim() && !attachment) return;
    if (!selectedUserId) return;
    setSending(true);
    await apiClient.initCsrf();
    try {
      await messagesApi.send(selectedUserId, body.trim(), attachment ?? undefined);
      setInput('');
      setAttachment(null);
      setCrError(false);
      setPendingUser(null);
      await loadMessages(selectedUserId, true);
      await loadConversations();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        const detail = ((err.data as Record<string, unknown>)?.detail as string) ?? '';
        if (detail.toLowerCase().includes('contact request')) setCrError(true);
      }
    } finally { setSending(false); }
  };

  const respondToRequest = async (id: number, action: 'accept' | 'decline') => {
    await apiClient.initCsrf();
    await contactRequestApi.respond(id, action);
    await loadContactReqs();
    await loadConversations();
  };

  const handleSendContactRequest = async () => {
    if (!selectedUserId) return;
    setCrSending(true);
    await apiClient.initCsrf();
    try { await contactRequestApi.send(selectedUserId); await loadContactReqs(); }
    finally { setCrSending(false); }
  };

  const handleBlock = async (uid = selectedUserId) => {
    if (!uid) return;
    setShowHeaderMore(false);
    setShowDetailsMore(false);
    await apiClient.initCsrf();
    if (blockStatus.blocked_ids.includes(uid)) {
      await blocksApi.unblock(uid);
    } else {
      await blocksApi.block(uid);
    }
    await loadBlockStatus();
  };

  // ── New-message search ────────────────────────────────────────────────
  const handleNewMsgQueryChange = (q: string) => {
    setNewMsgQuery(q);
    if (newMsgSearchRef.current) clearTimeout(newMsgSearchRef.current);
    if (!q.trim()) { setNewMsgResults([]); return; }
    newMsgSearchRef.current = setTimeout(async () => {
      setNewMsgLoading(true);
      try {
        const data = await searchApi.search(q);
        setNewMsgResults((data.users ?? []).filter(u => u.id !== user?.id));
      } catch { setNewMsgResults([]); }
      finally { setNewMsgLoading(false); }
    }, 300);
  };

  const startConversation = (u: SimpleUser) => {
    setShowNewMsg(false);
    setNewMsgQuery('');
    setNewMsgResults([]);
    setCrError(false);
    setSelectedUserId(u.id);
    const existing = conversations.find(c => c.user.id === u.id);
    if (existing) { setPendingUser(null); }
    else { setPendingUser(u); setMessages([]); }
  };

  const selectConv = (uid: number) => {
    setSelectedUserId(uid);
    setPendingUser(null);
    setCrError(false);
    setManualUnreadIds(prev => { const n = new Set(prev); n.delete(uid); return n; });
  };

  const insertEmoji = (emoji: string) => { richTextRef.current?.insertText(emoji); setShowEmoji(false); };

  // ── Context menu actions ──────────────────────────────────────────────
  const closeCtx = () => { setCtxMenu(null); setCtxMuteOpen(false); };

  const openCtxMenu = (e: React.MouseEvent, userId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const menuW = 224, menuH = 320;
    const x = Math.min(e.clientX, window.innerWidth - menuW - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuH - 8);
    setCtxMenu({ userId, x, y });
    setCtxMuteOpen(false);
  };

  const handleCtxArchive = () => {
    if (!ctxMenu) return;
    const uid = ctxMenu.userId;
    setArchivedIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      saveSet('msgs_archived', next);
      return next;
    });
    if (selectedUserId === uid) { setSelectedUserId(null); setPendingUser(null); }
    closeCtx();
  };

  const handleCtxMute = (option: '8h' | '1w' | 'always' | 'unmute') => {
    if (!ctxMenu) return;
    const uid = ctxMenu.userId;
    setMutedMap(prev => {
      const next = new Map(prev);
      if (option === 'unmute') { next.delete(uid); }
      else {
        const until = option === 'always' ? null
          : option === '8h' ? Date.now() + 8 * 3600_000
          : Date.now() + 7 * 86400_000;
        next.set(uid, until);
      }
      saveMuted(next);
      return next;
    });
    closeCtx();
  };

  const handleCtxPin = () => {
    if (!ctxMenu) return;
    const uid = ctxMenu.userId;
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      saveSet('msgs_pinned', next);
      return next;
    });
    closeCtx();
  };

  const handleCtxMarkUnread = () => {
    if (!ctxMenu) return;
    const uid = ctxMenu.userId;
    setManualUnreadIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
    closeCtx();
  };

  const handleCtxFavourite = () => {
    if (!ctxMenu) return;
    const uid = ctxMenu.userId;
    setFavouriteIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      saveSet('msgs_favourites', next);
      return next;
    });
    closeCtx();
  };

  const handleCtxBlock = async () => {
    if (!ctxMenu) return;
    const uid = ctxMenu.userId;
    closeCtx();
    await handleBlock(uid);
  };

  const handleCtxClear = async () => {
    if (!ctxMenu) return;
    const uid = ctxMenu.userId;
    if (!confirm('Clear all messages in this chat? This cannot be undone.')) return;
    closeCtx();
    await apiClient.initCsrf();
    await messagesApi.clearThread(uid);
    if (selectedUserId === uid) setMessages([]);
  };

  const handleCtxDelete = async () => {
    if (!ctxMenu) return;
    const uid = ctxMenu.userId;
    if (!confirm('Delete this entire chat? All messages will be removed.')) return;
    closeCtx();
    await apiClient.initCsrf();
    await messagesApi.clearThread(uid);
    setConversations(prev => prev.filter(c => c.user.id !== uid));
    if (selectedUserId === uid) { setSelectedUserId(null); setPendingUser(null); setMessages([]); }
  };

  // ── Derived list state ────────────────────────────────────────────────
  const mainConversations     = conversations.filter(c => !archivedIds.has(c.user.id));
  const archivedConversations = conversations.filter(c => archivedIds.has(c.user.id));

  const filteredConversations = useMemo(() => {
    let list = mainConversations;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => `${c.user.first_name ?? ''} ${c.user.last_name ?? ''} ${c.user.username}`.toLowerCase().includes(q));
    }
    if (tab === 'unread' || filterUnread) list = list.filter(c => c.unread > 0 || manualUnreadIds.has(c.user.id));
    if (tab === 'mentors') list = list.filter(c => c.user.role === 'mentor' || c.user.role === 'superadmin');
    if (tab === 'teams')   return [];
    return list;
  }, [mainConversations, search, tab, filterUnread, manualUnreadIds]);

  const unreadCount = mainConversations.filter(c => c.unread > 0 || manualUnreadIds.has(c.user.id)).length;

  const pinnedConvs = filteredConversations.filter(c =>
    c.user.role === 'mentor' || c.user.role === 'superadmin' || pinnedIds.has(c.user.id)
  );
  const recentConvs = filteredConversations.filter(c =>
    c.user.role !== 'mentor' && c.user.role !== 'superadmin' && !pinnedIds.has(c.user.id)
  );

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: 'all',     label: 'All',     count: mainConversations.length },
    { key: 'unread',  label: 'Unread',  count: unreadCount },
    { key: 'mentors', label: 'Mentors' },
    { key: 'teams',   label: 'Teams' },
  ];

  const inputDisabled  = isBlocked || blockedMe || (crError && outgoingCR?.status !== 'accepted');
  const ctxIsArchived  = ctxMenu ? archivedIds.has(ctxMenu.userId) : false;
  const ctxIsPinned    = ctxMenu ? pinnedIds.has(ctxMenu.userId) : false;
  const ctxIsMuted     = ctxMenu ? isMutedNow(mutedMap, ctxMenu.userId) : false;
  const ctxIsFav       = ctxMenu ? favouriteIds.has(ctxMenu.userId) : false;
  const ctxIsUnread    = ctxMenu ? manualUnreadIds.has(ctxMenu.userId) : false;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="-m-5 flex overflow-hidden rounded-xl border border-gray-200 select-none"
      style={{ height: 'calc(100vh - 40px)' }}
    >

      {ctxMenu && (
        <ConversationContextMenu
          ctxMenu={ctxMenu}
          ctxRef={ctxRef}
          ctxMuteOpen={ctxMuteOpen}
          setCtxMuteOpen={setCtxMuteOpen}
          ctxIsArchived={ctxIsArchived}
          ctxIsPinned={ctxIsPinned}
          ctxIsMuted={ctxIsMuted}
          ctxIsFav={ctxIsFav}
          ctxIsUnread={ctxIsUnread}
          ctxConvIsBlocked={ctxConvIsBlocked}
          onArchive={handleCtxArchive}
          onMute={handleCtxMute}
          onPin={handleCtxPin}
          onMarkUnread={handleCtxMarkUnread}
          onFavourite={handleCtxFavourite}
          onBlock={handleCtxBlock}
          onClear={handleCtxClear}
          onDelete={handleCtxDelete}
        />
      )}

      {showNewMsg && (
        <NewMessageModal
          query={newMsgQuery}
          onQueryChange={handleNewMsgQueryChange}
          results={newMsgResults}
          loading={newMsgLoading}
          onSelect={startConversation}
          onClose={() => { setShowNewMsg(false); setNewMsgQuery(''); setNewMsgResults([]); }}
        />
      )}

      {/* ── Left sidebar ───────────────────────────────────────────── */}
      <div className="shrink-0 flex flex-col bg-gray-50/60 border-r border-gray-100" style={{ width: leftW }}>

        {/* Header row */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h1 className="text-[18px] font-bold text-gray-900 tracking-tight">Messages</h1>
          <div className="flex items-center gap-1">
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setShowFilter(v => !v)}
                className={`p-1.5 rounded-lg transition-colors ${filterUnread ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                title="Filter"
              >
                <SlidersHorizontal size={15} />
              </button>
              {showFilter && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl z-20 py-1">
                  <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Filter by</p>
                  <button
                    onClick={() => { setFilterUnread(v => !v); setShowFilter(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] transition-colors ${filterUnread ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {filterUnread
                      ? <><Check size={13} className="text-primary-500" /> Unread only</>
                      : <><ChevronDown size={13} className="text-gray-400 -rotate-90" /> Unread only</>
                    }
                  </button>
                  <button
                    onClick={() => { setFilterUnread(false); setTab('all'); setSearch(''); setShowFilter(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <X size={13} className="text-gray-400" /> Clear filters
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowNewMsg(true)}
              className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-colors"
              title="New message"
            >
              <FilePen size={15} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pb-3">
          <div className="relative">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search in chats..."
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-gray-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 border-b border-gray-100 overflow-x-auto scrollbar-none">
          {TABS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                'flex items-center gap-1.5 pb-2 pt-1 text-[12.5px] font-medium border-b-2 -mb-px mr-3 transition-colors whitespace-nowrap shrink-0',
                tab === key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none ${tab === key ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Contact requests */}
        {contactReqs.length > 0 && (
          <div className="mx-3 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1.5">
              <UserPlus size={12} className="text-amber-600" />
              <p className="text-[11.5px] font-bold text-amber-700">Contact Requests ({contactReqs.length})</p>
            </div>
            {contactReqs.map(cr => {
              const name = `${cr.user.first_name ?? ''} ${cr.user.last_name ?? ''}`.trim() || cr.user.username;
              return (
                <div key={cr.id} className="flex items-center gap-2 py-1">
                  <Avatar name={name} src={cr.user.profile_picture ?? undefined} size="sm" />
                  <p className="flex-1 text-[12px] font-medium text-gray-800 truncate">{name}</p>
                  <button onClick={() => respondToRequest(cr.id, 'accept')} className="p-1 text-green-600 hover:bg-green-50 rounded-lg transition-colors"><Check size={13} /></button>
                  <button onClick={() => respondToRequest(cr.id, 'decline')} className="p-1 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"><X size={13} /></button>
                </div>
              );
            })}
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 py-2" onScroll={() => { setCtxMenu(null); setCtxMuteOpen(false); }}>
          {tab === 'teams' ? (
            <div className="text-center py-12">
              <Users size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-[12.5px] font-semibold text-gray-500">Team chats</p>
              <p className="text-[11.5px] text-gray-400 mt-0.5">Coming soon</p>
            </div>
          ) : filteredConversations.length === 0 && archivedConversations.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare size={28} className="mx-auto text-gray-200 mb-2" />
              <p className="text-[12px] text-gray-400">No conversations found</p>
            </div>
          ) : (
            <>
              {pinnedConvs.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 pt-1 pb-1.5">Pinned</p>
                  {pinnedConvs.map(c => (
                    <ConversationItem
                      key={c.user.id}
                      conv={c}
                      isSelected={c.user.id === selectedUserId}
                      onClick={() => selectConv(c.user.id)}
                      onMenu={e => openCtxMenu(e, c.user.id)}
                      isPinned={pinnedIds.has(c.user.id)}
                      isMuted={isMutedNow(mutedMap, c.user.id)}
                      isFavourite={favouriteIds.has(c.user.id)}
                      hasManualUnread={manualUnreadIds.has(c.user.id)}
                    />
                  ))}
                </div>
              )}
              {recentConvs.length > 0 && (
                <div className={pinnedConvs.length > 0 ? 'mt-2' : ''}>
                  {pinnedConvs.length > 0 && (
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 pt-2 pb-1.5">Recent</p>
                  )}
                  {recentConvs.map(c => (
                    <ConversationItem
                      key={c.user.id}
                      conv={c}
                      isSelected={c.user.id === selectedUserId}
                      onClick={() => selectConv(c.user.id)}
                      onMenu={e => openCtxMenu(e, c.user.id)}
                      isPinned={false}
                      isMuted={isMutedNow(mutedMap, c.user.id)}
                      isFavourite={favouriteIds.has(c.user.id)}
                      hasManualUnread={manualUnreadIds.has(c.user.id)}
                    />
                  ))}
                </div>
              )}
              {archivedConversations.length > 0 && (
                <div className="mt-3 px-1">
                  <button
                    onClick={() => setShowArchived(v => !v)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-[11.5px] font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Archive size={12} />
                    {showArchived ? 'Hide archived' : `Archived (${archivedConversations.length})`}
                  </button>
                  {showArchived && (
                    <div className="opacity-70">
                      {archivedConversations.map(c => (
                        <ConversationItem
                          key={c.user.id}
                          conv={c}
                          isSelected={c.user.id === selectedUserId}
                          onClick={() => selectConv(c.user.id)}
                          onMenu={e => openCtxMenu(e, c.user.id)}
                          isPinned={false}
                          isMuted={isMutedNow(mutedMap, c.user.id)}
                          isFavourite={favouriteIds.has(c.user.id)}
                          hasManualUnread={manualUnreadIds.has(c.user.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* View all */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={() => { setSearch(''); setTab('all'); setFilterUnread(false); }}
            className="w-full flex items-center justify-center gap-1 text-[12.5px] font-semibold text-primary-600 hover:underline transition-colors"
          >
            View all conversations <span className="text-[14px]">›</span>
          </button>
        </div>
      </div>

      {/* ── Middle: Chat panel ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {!chatTarget ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-[14px] font-semibold text-gray-500">Select a conversation</p>
              <p className="text-[12px] text-gray-400 mt-1">Choose from the list to start messaging</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between px-4 h-[48px] border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar name={selectedName} src={chatTarget.profile_picture ?? undefined} size="md" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-gray-900">{selectedName}</p>
                  <p className="text-[11.5px] text-gray-500 capitalize">
                    {chatTarget.role === 'superadmin' ? 'Admin' : chatTarget.role}
                    <span className="mx-1.5 text-gray-300">•</span>
                    <span className="text-green-500 font-medium">Online</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button className="p-2 text-gray-400 rounded-lg cursor-not-allowed" title="Call (coming soon)"><Phone size={15} /></button>
                <button className="p-2 text-gray-400 rounded-lg cursor-not-allowed" title="Video (coming soon)"><Video size={15} /></button>
                <button
                  onClick={() => setShowDetails(v => !v)}
                  className={`p-2 rounded-lg transition-colors ${showDetails ? 'bg-primary-50 text-primary-600' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <Info size={15} />
                </button>
                <div className="relative" ref={headerMoreRef}>
                  <button onClick={() => setShowHeaderMore(v => !v)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                    <MoreHorizontal size={15} />
                  </button>
                  {showHeaderMore && (
                    <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl z-20 py-1">
                      <button
                        onClick={() => { navigate(`/profiles/${selectedUserId}`); setShowHeaderMore(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <ExternalLink size={13} /> View profile
                      </button>
                      <div className="my-1 border-t border-gray-100" />
                      <button
                        onClick={() => handleBlock()}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] transition-colors ${isBlocked ? 'text-green-600 hover:bg-green-50' : 'text-red-500 hover:bg-red-50'}`}
                      >
                        {isBlocked ? <><UserCheck size={13} /> Unblock user</> : <><Ban size={13} /> Block user</>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Banners */}
            {(isBlocked || blockedMe) && (
              <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                <Ban size={13} className="text-amber-600 shrink-0" />
                <p className="text-[12px] text-amber-700 font-medium">
                  {isBlocked ? 'You have blocked this user. Unblock to send messages.' : 'This user has blocked you.'}
                </p>
                {isBlocked && (
                  <button onClick={() => handleBlock()} className="ml-auto text-[11.5px] font-semibold text-amber-700 hover:underline shrink-0">Unblock</button>
                )}
              </div>
            )}
            {crError && !isBlocked && !blockedMe && (
              <div className="px-5 py-3 bg-primary-50 border-b border-primary-200 flex items-center gap-3">
                <UserPlus size={14} className="text-primary-500 shrink-0" />
                {!outgoingCR ? (
                  <>
                    <p className="text-[12px] text-primary-700 flex-1">This user requires a contact request before you can message them.</p>
                    <button
                      onClick={handleSendContactRequest}
                      disabled={crSending}
                      className="shrink-0 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-[12px] font-semibold rounded-lg transition-colors"
                    >
                      {crSending ? 'Sending…' : 'Send Request'}
                    </button>
                  </>
                ) : outgoingCR.status === 'pending' ? (
                  <p className="text-[12px] text-primary-700 flex-1">Contact request sent. You'll be notified when they accept.</p>
                ) : outgoingCR.status === 'declined' ? (
                  <p className="text-[12px] text-red-600 flex-1">Your contact request was declined.</p>
                ) : null}
              </div>
            )}

            <MessageThread
              grouped={grouped}
              loading={loading}
              currentUser={user}
              selectedName={selectedName}
              scrollRef={messagesScrollRef}
            />

            {/* Emoji picker */}
            {showEmoji && (
              <div className="px-4 pt-2 pb-1 border-t border-gray-100 bg-white">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-2 flex flex-wrap gap-1">
                  {COMMON_EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => insertEmoji(emoji)} className="text-[18px] p-1.5 hover:bg-white rounded-lg transition-colors">{emoji}</button>
                  ))}
                </div>
              </div>
            )}
            <RichTextInput
              ref={richTextRef}
              onSend={handleSend}
              disabled={inputDisabled}
              placeholder={inputDisabled ? (isBlocked || blockedMe ? 'Messaging is unavailable.' : 'Send a contact request to start messaging.') : 'Type a message...'}
              attachment={attachment}
              setAttachment={setAttachment}
              sending={sending}
              showEmoji={showEmoji}
              setShowEmoji={setShowEmoji}
              fileInputRef={fileInputRef}
              imageInputRef={imageInputRef}
              docInputRef={docInputRef}
            />
          </>
        )}
      </div>

      {/* ── Right: Details panel ────────────────────────────────────── */}
      {showDetails && chatTarget && (
        <ConversationDetailsPanel
          chatTarget={chatTarget as Parameters<typeof ConversationDetailsPanel>[0]['chatTarget']}
          selectedUserId={selectedUserId!}
          selectedName={selectedName}
          selectedConv={selectedConv}
          isBlocked={isBlocked}
          detailsMoreRef={detailsMoreRef}
          showDetailsMore={showDetailsMore}
          setShowDetailsMore={setShowDetailsMore}
          sharedFiles={sharedFiles}
          visibleFiles={visibleFiles}
          showAllFiles={showAllFiles}
          setShowAllFiles={setShowAllFiles}
          onClose={() => setShowDetails(false)}
          onBlock={() => handleBlock()}
          onNavigate={navigate}
        />
      )}
    </div>
  );
}
