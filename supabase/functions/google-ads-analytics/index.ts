import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADS_API_VERSION = 'v17';
const ADS_BASE = `https://googleads.googleapis.com/${ADS_API_VERSION}`;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// ── env ───────────────────────────────────────────────────────────────────────
const DEV_TOKEN     = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN') ?? '';
const CUSTOMER_ID   = (Deno.env.get('GOOGLE_ADS_CUSTOMER_ID') ?? '').replace(/-/g, '');
const CLIENT_ID     = Deno.env.get('GOOGLE_ADS_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET') ?? '';
const REFRESH_TOKEN = Deno.env.get('GOOGLE_ADS_REFRESH_TOKEN') ?? '';
const LOGIN_CID     = (Deno.env.get('GOOGLE_ADS_LOGIN_CUSTOMER_ID') ?? '').replace(/-/g, '');

// ── helpers ───────────────────────────────────────────────────────────────────

function checkEnv() {
  const missing = [
    !DEV_TOKEN     && 'GOOGLE_ADS_DEVELOPER_TOKEN',
    !CUSTOMER_ID   && 'GOOGLE_ADS_CUSTOMER_ID',
    !CLIENT_ID     && 'GOOGLE_ADS_CLIENT_ID',
    !CLIENT_SECRET && 'GOOGLE_ADS_CLIENT_SECRET',
    !REFRESH_TOKEN && 'GOOGLE_ADS_REFRESH_TOKEN',
  ].filter(Boolean);
  return missing as string[];
}

async function getAccessToken(): Promise<string> {
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const json = await resp.json();
  if (!resp.ok || !json.access_token) {
    throw new Error(`OAuth2 token exchange failed: ${json.error_description ?? json.error ?? resp.statusText}`);
  }
  return json.access_token as string;
}

async function gaqlSearch(accessToken: string, query: string): Promise<any[]> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': DEV_TOKEN,
    'Content-Type': 'application/json',
  };
  if (LOGIN_CID) headers['login-customer-id'] = LOGIN_CID;

  const resp = await fetch(`${ADS_BASE}/customers/${CUSTOMER_ID}/googleAds:search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, pageSize: 200 }),
  });
  const json = await resp.json();
  if (!resp.ok) {
    const msg = json?.error?.message ?? JSON.stringify(json);
    throw new Error(`Google Ads API error: ${msg}`);
  }
  return json.results ?? [];
}

// ── GAQL period map ───────────────────────────────────────────────────────────
function periodClause(period: string): string {
  if (period === '7d')  return 'DURING LAST_7_DAYS';
  if (period === '90d') return 'DURING LAST_90_DAYS';
  return 'DURING LAST_30_DAYS';
}

// micro-currency → display unit
const mc = (v: any) => (Number(v ?? 0) / 1_000_000);
const n  = (v: any) => Number(v ?? 0);
const pct = (v: any) => Number((Number(v ?? 0) * 100).toFixed(2));

// ── main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const missing = checkEnv();
    if (missing.length > 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'MISSING_ENV',
        missingVars: missing,
        message: `Google Ads not configured. Set these Supabase secrets: ${missing.join(', ')}`,
      }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const period: string = body?.period ?? '30d';
    const clause = periodClause(period);

    const accessToken = await getAccessToken();

    // ── Run 4 queries in parallel ──────────────────────────────────────────
    const [accountRows, campaignRows, trendRows, adGroupRows] = await Promise.all([

      // 0. True account-wide totals — NOT derived from the campaign list below,
      // which is capped at the top 25 by spend. An account with more than 25
      // active campaigns would otherwise silently under-report totalSpend/
      // impressions/clicks, disagreeing with the real Google Ads numbers the
      // web dashboard shows.
      gaqlSearch(accessToken, `
        SELECT
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM customer
        WHERE segments.date ${clause}
      `),

      // 1. Campaign performance
      gaqlSearch(accessToken, `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type,
          campaign.bidding_strategy_type,
          campaign.budget_amount_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.all_conversions,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversion_rate,
          metrics.cost_per_conversion,
          metrics.value_per_all_conversions
        FROM campaign
        WHERE segments.date ${clause}
          AND campaign.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 25
      `),

      // 2. Daily spend / click / impression trend
      gaqlSearch(accessToken, `
        SELECT
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions
        FROM customer
        WHERE segments.date ${clause}
        ORDER BY segments.date ASC
        LIMIT 90
      `),

      // 3. Top ad groups
      gaqlSearch(accessToken, `
        SELECT
          ad_group.name,
          campaign.name,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc
        FROM ad_group
        WHERE segments.date ${clause}
          AND ad_group.status = 'ENABLED'
          AND campaign.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 10
      `),
    ]);

    // ── Build account summary from the dedicated account-wide query ────────
    // (NOT summed from the capped campaign list — see comment above).
    const acctMetrics = accountRows[0]?.metrics ?? {};
    const totalSpend       = mc(acctMetrics.costMicros);
    const totalImpressions = n(acctMetrics.impressions);
    const totalClicks      = n(acctMetrics.clicks);
    const totalConversions = n(acctMetrics.conversions);
    const totalCTR      = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgCPC        = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const convRate      = totalClicks > 0 ? totalConversions / totalClicks : 0;
    const costPerConv   = totalConversions > 0 ? totalSpend / totalConversions : 0;

    // ── Shape campaigns ────────────────────────────────────────────────────
    const campaigns = campaignRows.map(r => {
      const c = r.campaign ?? {};
      const m = r.metrics ?? {};
      const spend = mc(m.costMicros);
      const impr  = n(m.impressions);
      const clk   = n(m.clicks);
      const conv  = n(m.conversions);
      return {
        id:             String(c.id ?? ''),
        name:           c.name ?? 'Unknown',
        status:         c.status ?? 'UNKNOWN',
        channelType:    c.advertisingChannelType ?? '',
        biddingStrategy:c.biddingStrategyType ?? '',
        dailyBudget:    mc(c.budgetAmountMicros),
        spend,
        impressions:    impr,
        clicks:         clk,
        conversions:    conv,
        ctr:            pct(m.ctr),
        avgCpc:         mc(m.averageCpc),
        convRate:       pct(m.conversionRate),
        costPerConv:    mc(m.costPerConversion),
        pctOfSpend:     totalSpend > 0 ? Math.round((spend / totalSpend) * 100) : 0,
      };
    });

    // ── Shape daily trend ─────────────────────────────────────────────────
    const trend = trendRows.map(r => {
      const m = r.metrics ?? {};
      const s = r.segments ?? {};
      return {
        date:        s.date ?? '',
        spend:       mc(m.costMicros),
        impressions: n(m.impressions),
        clicks:      n(m.clicks),
        conversions: n(m.conversions),
      };
    });

    // ── Shape ad groups ───────────────────────────────────────────────────
    const adGroups = adGroupRows.map(r => {
      const ag = r.adGroup ?? {};
      const c  = r.campaign ?? {};
      const m  = r.metrics ?? {};
      return {
        name:        ag.name ?? 'Unknown',
        campaign:    c.name ?? '',
        spend:       mc(m.costMicros),
        impressions: n(m.impressions),
        clicks:      n(m.clicks),
        conversions: n(m.conversions),
        ctr:         pct(m.ctr),
        avgCpc:      mc(m.averageCpc),
      };
    });

    return new Response(JSON.stringify({
      ok: true,
      period,
      fetchedAt: new Date().toISOString(),
      summary: {
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        ctr:          pct(totalCTR),
        avgCpc,
        convRate:     pct(convRate),
        costPerConv,
        activeCampaigns: campaigns.filter(c => c.status === 'ENABLED').length,
        totalCampaigns:  campaigns.length,
      },
      campaigns,
      trend,
      adGroups,
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: err?.message ?? 'Unknown error',
    }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
