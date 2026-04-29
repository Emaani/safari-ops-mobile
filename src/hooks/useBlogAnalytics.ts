/**
 * useBlogAnalytics
 *
 * Merges GA4 page-level metrics with Supabase blog_posts data and
 * UTM-attributed marketing_leads / bookings for a given blog post slug.
 *
 * Data Sources:
 *   GA4        → views, users, engagement (via ga4-analytics edge function)
 *   Supabase   → blog_posts row, marketing_leads, safari_bookings (UTM attributed)
 *
 * Attribution Logic:
 *   Match blog post using: slug ↔ utm_content OR referrer_url contains slug
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
  ga4AvgEngagementSec: number;
  // Supabase
  dbViews: number;
  leads: number;
  bookings: number;
  // Combined
  totalViews: number;
  conversionRate: number; // leads / ga4Views
}

export interface BlogAnalyticsSummary {
  posts: BlogPostAnalytics[];
  totalViews: number;
  totalLeads: number;
  totalBookings: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
}

export function useBlogAnalytics(): BlogAnalyticsSummary {
  const [posts,      setPosts]      = useState<BlogPostAnalytics[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      // 1. Fetch all blog posts from Supabase
      const { data: blogRows, error: blogErr } = await supabase
        .from('blog_posts')
        .select('id, title, slug, status, views, published_at, created_at')
        .order('published_at', { ascending: false });
      if (blogErr) throw blogErr;
      const blogs = (blogRows ?? []) as Record<string, any>[];

      if (blogs.length === 0) {
        setPosts([]);
        return;
      }

      // 2. Fetch GA4 top pages (last 90 days)
      let ga4PageMap: Record<string, { views: number; users: number; engaged: number; duration: number }> = {};
      try {
        const { data: ga4Data, error: fnErr } = await supabase.functions.invoke('ga4-analytics', {
          body: { startDate: '90daysAgo', endDate: 'today', limit: 200 },
        });
        if (!fnErr && ga4Data?.ok && ga4Data.topPages) {
          for (const page of ga4Data.topPages) {
            // Normalize path: /blog/my-slug → my-slug
            const parts = (page.path as string).split('/').filter(Boolean);
            const slug = parts[parts.length - 1] ?? page.path;
            ga4PageMap[slug] = {
              views:    page.views ?? 0,
              users:    page.sessions ?? 0,
              engaged:  page.engagedSessions ?? 0,
              duration: 0,
            };
          }
        }
      } catch {
        // GA4 unavailable — continue with DB-only data
      }

      // 3. Fetch UTM-attributed leads for each slug
      let leadsMap: Record<string, number> = {};
      let bookingsMap: Record<string, number> = {};
      try {
        const { data: leads } = await supabase
          .from('marketing_leads')
          .select('utm_content, referrer_url, safari_booking_id')
          .not('utm_content', 'is', null);

        for (const lead of (leads ?? []) as Record<string, any>[]) {
          const content = lead.utm_content ?? '';
          const ref     = lead.referrer_url ?? '';
          for (const blog of blogs) {
            const slug = blog.slug ?? '';
            if (content === slug || ref.includes(slug)) {
              if (lead.safari_booking_id) {
                bookingsMap[slug] = (bookingsMap[slug] ?? 0) + 1;
              } else {
                leadsMap[slug] = (leadsMap[slug] ?? 0) + 1;
              }
            }
          }
        }
      } catch {
        // marketing_leads table may not exist yet
      }

      // 4. Merge all three sources
      const merged: BlogPostAnalytics[] = blogs.map(b => {
        const slug         = b.slug ?? b.id;
        const ga4          = ga4PageMap[slug] ?? { views: 0, users: 0, engaged: 0, duration: 0 };
        const dbViews      = b.views ?? 0;
        const leads        = leadsMap[slug] ?? 0;
        const bookings     = bookingsMap[slug] ?? 0;
        const totalViews   = Math.max(ga4.views, dbViews);
        const convRate     = totalViews > 0 ? Math.round((leads / totalViews) * 10000) / 100 : 0;
        return {
          slug,
          title:                b.title ?? 'Untitled',
          status:               b.status ?? 'draft',
          published_at:         b.published_at ?? null,
          ga4Views:             ga4.views,
          ga4Users:             ga4.users,
          ga4EngagedSessions:   ga4.engaged,
          ga4AvgEngagementSec:  ga4.duration,
          dbViews,
          leads,
          bookings,
          totalViews,
          conversionRate: convRate,
        };
      });

      // Sort by totalViews desc
      merged.sort((a, b) => b.totalViews - a.totalViews);
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

  return { posts, totalViews, totalLeads, totalBookings, loading, refreshing, error, refresh };
}
