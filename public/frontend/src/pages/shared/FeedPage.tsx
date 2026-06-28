import { useState, useMemo } from 'react';
import {
  Newspaper, Plus, Bookmark, Calendar, Activity,
  TrendingUp, Award, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { feedApi } from '../../api/feed';
import apiClient from '../../api/apiClient';
import { relativeTime } from '../../utils/time';
import type { FeedPost } from '../../types';
import PostCard from '../../components/feed/PostCard';
import CreatePostModal from '../../components/feed/CreatePostModal';
import Avatar from '../../components/ui/Avatar';

type FeedTab  = 'all' | 'saved' | 'mentor' | 'following';
type SortKey  = 'latest' | 'popular';

const PAGE_SIZE = 5;

interface FeedActivityItem {
  type: 'post' | 'comment';
  actor: string;
  action: string;
  target: string;
  link: string;
  created_at: string;
}

export default function FeedPage() {
  const { user } = useAuth();
  const [tab,          setTab]          = useState<FeedTab>('all');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [tagFilter,    setTagFilter]    = useState('');
  const [sort,         setSort]         = useState<SortKey>('latest');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [modalState,   setModalState]   = useState<null | 'create' | FeedPost>(null);

  const { data,      refetch }       = useApi(() => feedApi.list());
  const { data: savedData, refetch: refetchSaved } = useApi(feedApi.bookmarked);
  const { data: activityData } = useApi<FeedActivityItem[]>(
    () => apiClient.get('/api/feed/activity/')
  );

  const posts: FeedPost[]            = data         ?? [];
  const savedPosts: FeedPost[]       = savedData    ?? [];
  const feedActivity: FeedActivityItem[] = activityData ?? [];

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const p of posts) for (const t of p.tags_list) s.add(t);
    return [...s].sort();
  }, [posts]);

  const trendingTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      for (const t of p.tags_list) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [posts]);

  const topContributors = useMemo(() => {
    const map = new Map<string, { name: string; count: number; role: string }>();
    for (const p of posts) {
      const name = `${p.author.first_name ?? ''} ${p.author.last_name ?? ''}`.trim() || p.author.username;
      const key  = String(p.author.id);
      const cur  = map.get(key);
      if (cur) cur.count++;
      else map.set(key, { name, count: 1, role: p.author.role });
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  }, [posts]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return posts
      .filter(p => p.post_type === 'event' && p.event_date && new Date(p.event_date) >= now)
      .sort((a, b) => new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime())
      .slice(0, 3);
  }, [posts]);

  const handleUpdate = (_updated: FeedPost) => { refetch(); refetchSaved(); };
  const handleDelete = (_id: number)         => { refetch(); refetchSaved(); };
  const handleSaved  = ()                    => { setModalState(null); refetch(); };

  const canPost = user?.role === 'mentor' || user?.role === 'superadmin';

  const basePosts = tab === 'saved' ? savedPosts : posts;

  const filteredPosts = useMemo(() => {
    let list = basePosts.filter(p => {
      if (tab === 'mentor' || tab === 'following')
        return p.author.role === 'mentor' || p.author.role === 'superadmin';
      return true;
    });
    if (typeFilter) list = list.filter(p => p.post_type === typeFilter);
    if (tagFilter)  list = list.filter(p => p.tags_list.includes(tagFilter));
    if (sort === 'popular') {
      list = [...list].sort((a, b) => {
        const ra = Object.values(a.reaction_counts).reduce((x, y) => x + y, 0);
        const rb = Object.values(b.reaction_counts).reduce((x, y) => x + y, 0);
        return rb - ra;
      });
    }
    return list;
  }, [basePosts, tab, typeFilter, tagFilter, sort]);

  const visiblePosts = filteredPosts.slice(0, visibleCount);
  const hasMore      = visibleCount < filteredPosts.length;

  const TABS: { key: FeedTab; label: string }[] = [
    { key: 'all',       label: 'All Posts'      },
    { key: 'saved',     label: 'Saved'          },
    { key: 'mentor',    label: 'Mentor Updates' },
    { key: 'following', label: 'Following'      },
  ];

  const switchTab = (key: FeedTab) => { setTab(key); setVisibleCount(PAGE_SIZE); };

  return (
    <div className="flex gap-6 items-start">

      {/* ── Main feed column ─────────────────────────────────── */}
      <div className="flex-1 min-w-0">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Feed</h1>
          </div>
          {canPost && (
            <button
              onClick={() => setModalState('create')}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-semibold rounded-lg transition-colors"
            >
              <Plus size={14} /> New Post
            </button>
          )}
        </div>

        {/* Tabs + filter bar combined */}
        <div className="bg-white border border-[#e0e0e0] rounded-xl mb-4 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-2 pt-1">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => switchTab(key)}
                className={[
                  'px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                  tab === key
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2 px-4 py-2.5">
            {/* Type */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
                className="appearance-none pl-3 pr-7 py-1.5 text-[12px] border border-gray-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-600 cursor-pointer font-medium"
              >
                <option value="">All types</option>
                <option value="general">Post</option>
                <option value="event">Event</option>
              </select>
              <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Tag */}
            <div className="relative">
              <select
                value={tagFilter}
                onChange={e => { setTagFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}
                className="appearance-none pl-3 pr-7 py-1.5 text-[12px] border border-gray-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-600 cursor-pointer font-medium"
              >
                <option value="">All tags</option>
                {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Active filter chips */}
            {(typeFilter || tagFilter) && (
              <button
                onClick={() => { setTypeFilter(''); setTagFilter(''); setVisibleCount(PAGE_SIZE); }}
                className="text-[11.5px] font-medium text-gray-400 hover:text-red-500 transition-colors"
              >
                Clear filters
              </button>
            )}

            {/* Sort */}
            <div className="relative ml-auto">
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortKey)}
                className="appearance-none pl-3 pr-7 py-1.5 text-[12px] border border-gray-200 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-600 cursor-pointer font-medium"
              >
                <option value="latest">Latest</option>
                <option value="popular">Popular</option>
              </select>
              <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Post list */}
        {visiblePosts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            {tab === 'saved'
              ? <Bookmark size={36} className="mx-auto mb-3 opacity-30" />
              : <Newspaper size={36} className="mx-auto mb-3 opacity-30" />
            }
            <p className="text-[14px]">
              {tab === 'saved'
                ? 'No saved posts yet.'
                : typeFilter || tagFilter ? 'No posts match these filters.' : 'No posts yet.'
              }
            </p>
            {canPost && tab === 'all' && !typeFilter && !tagFilter && (
              <p className="text-[12px] mt-1">Be the first to post something!</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {visiblePosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onEdit={p => setModalState(p)}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="mt-5 text-center">
            <button
              onClick={() => setVisibleCount(n => n + PAGE_SIZE)}
              className="px-5 py-2 text-[13px] font-semibold text-gray-600 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              Load more posts
            </button>
          </div>
        )}
      </div>

      {/* ── Right sidebar ─────────────────────────────────────── */}
      <div className="w-72 shrink-0 sticky top-6 space-y-4">

        {/* Upcoming events */}
        <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-primary-500" />
              <p className="text-[13px] font-bold text-gray-900">Upcoming Events</p>
            </div>
            <button
              onClick={() => { setTypeFilter('event'); setTab('all'); setVisibleCount(PAGE_SIZE); }}
              className="text-[11.5px] font-medium text-primary-600 hover:underline"
            >
              View all
            </button>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Calendar size={22} className="mx-auto mb-2 text-gray-200" />
              <p className="text-[12.5px] font-semibold text-gray-500">No upcoming events</p>
              <p className="text-[11.5px] text-gray-400 mt-1 leading-snug">
                Check back soon — mentors will post events here when something's coming up.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {upcomingEvents.map(ev => {
                const d   = new Date(ev.event_date.includes('T') ? ev.event_date : ev.event_date + 'T00:00:00');
                const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
                const day = d.getDate();
                return (
                  <div key={ev.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="shrink-0 w-10 text-center">
                      <p className="text-[10px] font-bold text-primary-500 leading-none tracking-widest">{mon}</p>
                      <p className="text-[22px] font-bold text-gray-900 leading-tight">{day}</p>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-[12.5px] font-semibold text-gray-900 line-clamp-1 leading-snug">{ev.title}</p>
                      <p className="text-[11.5px] text-gray-500 mt-0.5 truncate">
                        {d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {ev.event_location && <> · {ev.event_location}</>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Activity size={13} className="text-primary-500" />
            <p className="text-[13px] font-bold text-gray-900">Recent Activity</p>
          </div>
          <div className="divide-y divide-gray-50">
            {feedActivity.length === 0 ? (
              <p className="px-4 py-5 text-[12px] text-gray-400">No recent activity.</p>
            ) : feedActivity.map((item, i) => (
              <div key={i} className="px-4 py-2.5">
                <p className="text-[12px] text-gray-700 leading-snug">
                  <span className="font-semibold text-gray-900">{item.actor}</span>
                  {' '}{item.action}{' '}
                  <span className="font-medium text-gray-700 italic line-clamp-1">"{item.target}"</span>
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">{relativeTime(item.created_at)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trending topics */}
        {trendingTags.length > 0 && (
          <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <TrendingUp size={13} className="text-violet-500" />
              <p className="text-[13px] font-bold text-gray-900">Trending Topics</p>
            </div>
            <div className="px-4 py-3 flex flex-wrap gap-2">
              {trendingTags.map(([tag, count]) => (
                <button
                  key={tag}
                  onClick={() => {
                    setTagFilter(tag === tagFilter ? '' : tag);
                    setTab('all');
                    setVisibleCount(PAGE_SIZE);
                  }}
                  className={[
                    'flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium rounded-lg transition-colors',
                    tagFilter === tag
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  ].join(' ')}
                >
                  #{tag}
                  <span className="text-[10px] text-gray-400 ml-0.5">{count}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Top contributors */}
        {topContributors.length > 0 && (
          <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Award size={13} className="text-amber-500" />
              <p className="text-[13px] font-bold text-gray-900">Top Contributors</p>
            </div>
            <div className="divide-y divide-gray-50">
              {topContributors.map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar name={c.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-gray-800 truncate">{c.name}</p>
                    <p className="text-[11px] text-gray-400 capitalize">
                      {c.role === 'superadmin' ? 'Admin' : c.role}
                    </p>
                  </div>
                  <span className="text-[11.5px] font-semibold text-gray-500 shrink-0">
                    {c.count} post{c.count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {modalState !== null && (
        <CreatePostModal
          mode={typeof modalState === 'string' ? 'create' : 'edit'}
          initial={typeof modalState === 'object' ? modalState : undefined}
          onClose={() => setModalState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
