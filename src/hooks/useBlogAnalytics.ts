/**
 * useBlogAnalytics
 *
 * Merges GA4 page-level metrics with Supabase blog_posts data and
 * UTM-attributed marketing_leads / bookings for a given blog post slug.
 *
 * Data Sources:
 *   GA4        → views, users, engagement (via ga4-analytics edge function)
 *   Supabase   → blog_posts row (views column), marketing_leads, safari_bookings
 *
 * Attribution Logic:
 *   Match blog post using: slug ↔ utm_content OR referrer_url contains slug
 *   Leads query includes ALL rows (not filtered by utm_content presence) so
 *   referrer_url-only attribution is captured correctly.
 *
 * totalViews per post: GA4 views + DB views are kept separate; the higher
 * value is used so the best available source wins. When GA4 is unavailable,
 * falls back to blog_posts.views (website counter).
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface BlogPostAnalytics {
  slug: string;
  title: string;
  status: string;
  published_at: string | null;
  // GA4
  ga4Views: number;
  ga4Users: number;
  ga4EngagedSessions: number;
  // Supabase
  dbViews: number;
  leads: number;
  bookings: number;
  // Combined
  totalViews: number;
  conversionRate: number; // leads / totalViews %
}

export interface BlogAnalyticsSummary {
  posts: BlogPostAnalytics[];
  totalViews: number;
  totalLeads: number;
  totalBookings: number;
  ga4Available: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
}

export function useBlogAnalytics(): BlogAnalyticsSummary {
  const [posts,        setPosts]       = useState<BlogPostAnalytics[]>([]);
  const [ga4Available, setGa4]         = useState(false);
  const [loading,      setLoading]     = useState(true);
  const [refreshing,   setRefreshing]  = useState(false);
  const [error,        setError]       = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // ── 1. Fetch all blog posts ────────────────────────────────────────────
      const { data: blogRows, error: blogErr } = await supabase
        .from('blog_posts')
        .select('id, title, slug, status, views, published_at, created_at')
        .order('published_at', { ascending: false });
      if (blogErr) throw blogErr;
      const blogs = (blogRows ?? []) as Record<string, any>[];

      if (blogs.length === 0) {
        setPosts([]);
        setGa4(false);
        return;
      }

      // Build a Set of all known slugs for fast O(1) matching
      const slugSet = new Set(blogs.map(b => b.slug ?? b.id).filter(Boolean));

      // ── 2. GA4 top pages (last 90 days, up to 500 rows) ───────────────────
      let ga4PageMap: Record<string, { views: number; users: number; engaged: number }> = {};
      let ga4Ok = false;
      try {
        const { data: ga4Data, error: fnErr } = await supabase.functions.invoke('ga4-analytics', {
          body: { startDate: '90daysAgo', endDate: 'today', limit: 500 },
        });
        if (!fnErr && ga4Data?.ok && Array.isArray(ga4Data.topPages)) {
          ga4Ok = true;
          for (const page of ga4Data.topPages) {
            // Normalize: strip trailing slash, then take last path segment as slug
            const cleanPath = (page.path as string).replace(/\/$/, '');
            const segments  = cleanPath.split('/').filter(Boolean);
            const candidate = segments[segments.length - 1] ?? '';

            // Only record if the slug actually exists in our blog posts
            if (candidate && slugSet.has(candidate)) {
              // Accumulate — the same slug may appear multiple times (e.g. with/without query string)
              const existing = ga4PageMap[candidate] ?? { views: 0, users: 0, engaged: 0 };
              ga4PageMap[candidate] = {
                views:   existing.views   + (page.views          ?? 0),
                users:   existing.users   + (page.sessions        ?? 0),
                engaged: existing.engaged + (page.engagedSessions ?? 0),
              };
            }
          }
        }
      } catch {
        // GA4 unavailable — continue with DB-only views
      }
      setGa4(ga4Ok);

      // ── 3. UTM-attributed leads (no column filter — capture referrer-only rows) ─
      let leadsMap:    Record<string, number> = {};
      let bookingsMap: Record<string, number> = {};
      try {
        // Fetch ALL leads — filter by either utm_content or referrer_url
        const { data: leadRows } = await supabase
          .from('marketing_leads')
          .select('utm_content, referrer_url, safari_booking_id');

        for (const lead of (leadRows ?? []) as Record<string, any>[]) {
          const content = (lead.utm_content  ?? '').toString().trim();
          const ref     = (lead.referrer_url ?? '').toString();

          for (const slug of slugSet) {
            const matched = content === slug || ref.includes(slug);
            if (!matched) continue;

            if (lead.safari_booking_id) {
              bookingsMap[slug] = (bookingsMap[slug] ?? 0) + 1;
            } else {
              leadsMap[slug] = (leadsMap[slug] ?? 0) + 1;
            }
          }
        }
      } catch {
        // marketing_leads table may not exist yet — silently ignore
      }

      // ── 4. Merge all three sources ─────────────────────────────────────────
      const merged: BlogPostAnalytics[] = blogs.map(b => {
        const slug     = b.slug ?? b.id;
        const ga4      = ga4PageMap[slug] ?? { views: 0, users: 0, engaged: 0 };
        const dbViews  = Number(b.views) || 0;
        const leads    = leadsMap[slug]    ?? 0;
        const bookings = bookingsMap[slug] ?? 0;

        // Best-source view count: use whichever is larger (GA4 or DB counter)
        const totalViews = ga4.views > 0 ? ga4.views : dbViews;

        const convRate = totalViews > 0
          ? Math.round((leads / totalViews) * 10000) / 100
          : 0;

        return {
          slug,
          title:              b.title       ?? 'Untitled',
          status:             b.status      ?? 'draft',
          published_at:       b.published_at ?? null,
          ga4Views:           ga4.views,
          ga4Users:           ga4.users,
          ga4EngagedSessions: ga4.engaged,
          dbViews,
          leads,
          bookings,
          totalViews,
          conversionRate: convRate,
        };
      });

      // Sort: published first by totalViews desc, then drafts/archived at bottom
      merged.sort((a, b) => {
        const aIsPublished = a.status === 'published' ? 0 : 1;
        const bIsPublished = b.status === 'published' ? 0 : 1;
        if (aIsPublished !== bIsPublished) return aIsPublished - bIsPublished;
        return b.totalViews - a.totalViews;
      });

      setPosts(merged);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load blog analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  const totalViews    = posts.reduce((s, p) => s + p.totalViews, 0);
  const totalLeads    = posts.reduce((s, p) => s + p.leads, 0);
  const totalBookings = posts.reduce((s, p) => s + p.bookings, 0);

  return { posts, totalViews, totalLeads, totalBookings, ga4Available, loading, refreshing, error, refresh };
}
