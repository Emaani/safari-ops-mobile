/**
 * GA4 Analytics Edge Function
 * Supabase Edge Function — Deno runtime
 *
 * Authenticates with Google Analytics Data API v1beta using a service account,
 * runs a report for the requested metrics/dimensions, and returns structured data.
 *
 * Environment secrets (set in Supabase Dashboard → Settings → Edge Functions):
 *   GA4_SERVICE_ACCOUNT_JSON  — full service account JSON string
 *   GA4_PROPERTY_ID           — GA4 property ID (numeric, e.g. "123456789")
 *
 * Deploy:
 *   npx supabase functions deploy ga4-analytics --project-ref ohlbioostgjxuwnaxjgk
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// ─── JWT helpers (service account → access token) ────────────────────────────

async function importRSAKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binary.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function b64url(data: Uint8Array | string): string {
  const str = typeof data === "string" ? data : String.fromCharCode(...data);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const signingInput = `${header}.${payload}`;
  const key = await importRSAKey(sa.private_key);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${b64url(new Uint8Array(sig))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  const { access_token } = await tokenRes.json();
  return access_token;
}

// ─── GA4 report runner ───────────────────────────────────────────────────────

interface ReportRequest {
  dateRanges: { startDate: string; endDate: string }[];
  metrics: { name: string }[];
  dimensions?: { name: string }[];
  limit?: number;
  orderBys?: unknown[];
}

async function runReport(
  propertyId: string,
  accessToken: string,
  body: ReportRequest,
): Promise<unknown> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GA4 API error ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Response builders ───────────────────────────────────────────────────────

function rowVal(row: any, headers: string[], name: string): string {
  const idx = headers.indexOf(name);
  return idx >= 0 ? (row.metricValues?.[idx]?.value ?? row.dimensionValues?.[idx]?.value ?? "0") : "0";
}

function buildSummary(report: any) {
  const mh = (report.metricHeaders ?? []).map((h: any) => h.name);
  const totals = report.totals?.[0] ?? {};

  const get = (name: string) => {
    const idx = mh.indexOf(name);
    return idx >= 0 ? Number(totals.metricValues?.[idx]?.value ?? 0) : 0;
  };
  return {
    sessions:              get("sessions"),
    activeUsers:           get("activeUsers"),
    newUsers:              get("newUsers"),
    screenPageViews:       get("screenPageViews"),
    userEngagementDuration: get("userEngagementDuration"),
    engagedSessions:       get("engagedSessions"),
    eventCount:            get("eventCount"),
    keyEvents:             get("keyEvents"),
  };
}

function buildTimeSeries(report: any) {
  const mh = (report.metricHeaders ?? []).map((h: any) => h.name);
  const dh = (report.dimensionHeaders ?? []).map((h: any) => h.name);
  return (report.rows ?? []).map((row: any) => {
    const dateIdx = dh.indexOf("date");
    const sessIdx = mh.indexOf("sessions");
    const usrIdx  = mh.indexOf("activeUsers");
    return {
      date:        row.dimensionValues?.[dateIdx]?.value ?? "",
      sessions:    Number(row.metricValues?.[sessIdx]?.value ?? 0),
      activeUsers: Number(row.metricValues?.[usrIdx]?.value ?? 0),
    };
  });
}

function buildTopPages(report: any) {
  const mh = (report.metricHeaders ?? []).map((h: any) => h.name);
  const dh = (report.dimensionHeaders ?? []).map((h: any) => h.name);
  const pathIdx  = dh.indexOf("pagePath");
  const viewIdx  = mh.indexOf("screenPageViews");
  const sessIdx  = mh.indexOf("sessions");
  const engIdx   = mh.indexOf("engagedSessions");
  const rows = (report.rows ?? []).map((row: any) => ({
    path:           row.dimensionValues?.[pathIdx]?.value ?? "",
    views:          Number(row.metricValues?.[viewIdx]?.value ?? 0),
    sessions:       Number(row.metricValues?.[sessIdx]?.value ?? 0),
    engagedSessions: Number(row.metricValues?.[engIdx]?.value ?? 0),
  }));
  const totalViews = rows.reduce((s: number, r: any) => s + r.views, 0) || 1;
  return rows.map((r: any) => ({ ...r, pct: Math.round((r.views / totalViews) * 100) }));
}

function buildSourceMedium(report: any) {
  const mh = (report.metricHeaders ?? []).map((h: any) => h.name);
  const dh = (report.dimensionHeaders ?? []).map((h: any) => h.name);
  const srcIdx  = dh.indexOf("sessionSource");
  const medIdx  = dh.indexOf("sessionMedium");
  const sessIdx = mh.indexOf("sessions");
  const usrIdx  = mh.indexOf("activeUsers");
  const rows = (report.rows ?? []).map((row: any) => ({
    source:      row.dimensionValues?.[srcIdx]?.value ?? "(direct)",
    medium:      row.dimensionValues?.[medIdx]?.value ?? "(none)",
    sessions:    Number(row.metricValues?.[sessIdx]?.value ?? 0),
    activeUsers: Number(row.metricValues?.[usrIdx]?.value ?? 0),
  }));
  const totalSessions = rows.reduce((s: number, r: any) => s + r.sessions, 0) || 1;
  return rows.map((r: any) => ({ ...r, pct: Math.round((r.sessions / totalSessions) * 100) }));
}

function buildAudience(countryReport: any, deviceReport: any) {
  const buildRows = (report: any, dimName: string) => {
    const mh = (report.metricHeaders ?? []).map((h: any) => h.name);
    const dh = (report.dimensionHeaders ?? []).map((h: any) => h.name);
    const dimIdx  = dh.indexOf(dimName);
    const usrIdx  = mh.indexOf("activeUsers");
    const sessIdx = mh.indexOf("sessions");
    const rows = (report.rows ?? []).map((row: any) => ({
      label:       row.dimensionValues?.[dimIdx]?.value ?? "Unknown",
      activeUsers: Number(row.metricValues?.[usrIdx]?.value ?? 0),
      sessions:    Number(row.metricValues?.[sessIdx]?.value ?? 0),
    }));
    const total = rows.reduce((s: number, r: any) => s + r.activeUsers, 0) || 1;
    return rows.map((r: any) => ({ ...r, pct: Math.round((r.activeUsers / total) * 100) }));
  };
  return {
    countries: buildRows(countryReport, "country"),
    devices:   buildRows(deviceReport, "deviceCategory"),
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const SA_JSON     = Deno.env.get("GA4_SERVICE_ACCOUNT_JSON");
    const PROPERTY_ID = Deno.env.get("GA4_PROPERTY_ID");

    if (!SA_JSON || !PROPERTY_ID) {
      return new Response(
        JSON.stringify({ error: "GA4 credentials not configured", code: "MISSING_ENV" }),
        { status: 503, headers: CORS },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { startDate = "30daysAgo", endDate = "today", limit = 20 } = body;
    const dateRanges = [{ startDate, endDate }];

    const token = await getAccessToken(SA_JSON);

    // Run all 5 reports in parallel
    const [summaryRaw, timeSeriesRaw, pagesRaw, sourceRaw, countryRaw, deviceRaw] =
      await Promise.all([
        // 1. Summary totals
        runReport(PROPERTY_ID, token, {
          dateRanges,
          metrics: [
            { name: "sessions" },
            { name: "activeUsers" },
            { name: "newUsers" },
            { name: "screenPageViews" },
            { name: "userEngagementDuration" },
            { name: "engagedSessions" },
            { name: "eventCount" },
            { name: "keyEvents" },
          ],
        }),
        // 2. Daily time series
        runReport(PROPERTY_ID, token, {
          dateRanges,
          metrics: [{ name: "sessions" }, { name: "activeUsers" }],
          dimensions: [{ name: "date" }],
          orderBys: [{ dimension: { dimensionName: "date" } }],
          limit: 90,
        }),
        // 3. Top pages
        runReport(PROPERTY_ID, token, {
          dateRanges,
          metrics: [
            { name: "screenPageViews" },
            { name: "sessions" },
            { name: "engagedSessions" },
          ],
          dimensions: [{ name: "pagePath" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit,
        }),
        // 4. Source / medium
        runReport(PROPERTY_ID, token, {
          dateRanges,
          metrics: [{ name: "sessions" }, { name: "activeUsers" }],
          dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 30,
        }),
        // 5. Country
        runReport(PROPERTY_ID, token, {
          dateRanges,
          metrics: [{ name: "activeUsers" }, { name: "sessions" }],
          dimensions: [{ name: "country" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
          limit: 10,
        }),
        // 6. Device category
        runReport(PROPERTY_ID, token, {
          dateRanges,
          metrics: [{ name: "activeUsers" }, { name: "sessions" }],
          dimensions: [{ name: "deviceCategory" }],
          orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
          limit: 5,
        }),
      ]);

    const summary    = buildSummary(summaryRaw);
    const timeSeries = buildTimeSeries(timeSeriesRaw);
    const topPages   = buildTopPages(pagesRaw);
    const sourceMedium = buildSourceMedium(sourceRaw);
    const audience   = buildAudience(countryRaw, deviceRaw);

    // Derive social traffic channels
    const SOCIAL = ["facebook", "instagram", "tiktok", "twitter", "x", "linkedin", "youtube", "pinterest"];
    const socialTraffic = sourceMedium
      .filter((r: any) => SOCIAL.some(s => r.source.toLowerCase().includes(s)))
      .reduce((acc: Record<string, number>, r: any) => {
        const key = SOCIAL.find(s => r.source.toLowerCase().includes(s)) ?? r.source;
        acc[key] = (acc[key] ?? 0) + r.sessions;
        return acc;
      }, {});

    // Channel grouping
    const channels: Record<string, number> = { Organic: 0, Direct: 0, Social: 0, Paid: 0, Referral: 0, Email: 0, Other: 0 };
    for (const r of sourceMedium as any[]) {
      const src = r.source.toLowerCase();
      const med = r.medium.toLowerCase();
      if (med === "(none)" && src === "(direct)") channels.Direct += r.sessions;
      else if (med === "organic")                  channels.Organic += r.sessions;
      else if (med === "cpc" || med === "paid")    channels.Paid += r.sessions;
      else if (SOCIAL.some(s => src.includes(s)))  channels.Social += r.sessions;
      else if (med === "email")                    channels.Email += r.sessions;
      else if (med === "referral")                 channels.Referral += r.sessions;
      else                                         channels.Other += r.sessions;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dateRange: { startDate, endDate },
        fetchedAt: new Date().toISOString(),
        summary,
        timeSeries,
        topPages,
        sourceMedium,
        channels,
        socialTraffic,
        audience,
      }),
      { headers: CORS },
    );
  } catch (err: any) {
    console.error("[ga4-analytics]", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal error", code: "GA4_ERROR" }),
      { status: 500, headers: CORS },
    );
  }
});
