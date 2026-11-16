/**
 * Google Ads OAuth2 Refresh Token Generator
 * Run:  GOOGLE_ADS_CLIENT_SECRET=... node scripts/get-google-ads-token.mjs
 *
 * This opens your browser for the Google consent screen, captures the code
 * on a local callback server, exchanges it for a refresh token, and prints
 * the Supabase CLI commands to set all required secrets.
 */

import http from 'http';
import { exec } from 'child_process';
import { createInterface } from 'readline';

// ─── Credentials ──────────────────────────────────────────────────────────
const CLIENT_ID     = '102904395402-dvp25q3479b1shq1fmh5np58mc9e5s5r.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const CUSTOMER_ID   = '5662880666';  // dashes removed for API use
const REDIRECT_URI  = 'http://localhost:9876/callback';
const SCOPE         = 'https://www.googleapis.com/auth/adwords';
const TOKEN_URL     = 'https://oauth2.googleapis.com/token';

if (!CLIENT_SECRET) {
  console.error('Missing GOOGLE_ADS_CLIENT_SECRET. Run as:');
  console.error('  GOOGLE_ADS_CLIENT_SECRET=your-secret node scripts/get-google-ads-token.mjs');
  process.exit(1);
}

// ─── Build the authorization URL ─────────────────────────────────────────────
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id',     CLIENT_ID);
authUrl.searchParams.set('redirect_uri',  REDIRECT_URI);
authUrl.searchParams.set('scope',         SCOPE);
authUrl.searchParams.set('access_type',   'offline');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('prompt',        'consent');  // force refresh_token issuance

console.log('\n═══════════════════════════════════════════════════════');
console.log('  Google Ads OAuth2 — Refresh Token Generator');
console.log('═══════════════════════════════════════════════════════\n');
console.log('Opening your browser for Google login...\n');

// Open browser
const opener =
  process.platform === 'darwin' ? 'open' :
  process.platform === 'win32'  ? 'start' : 'xdg-open';
exec(`${opener} "${authUrl.toString()}"`);

// ─── Local callback server ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:9876`);
  if (url.pathname !== '/callback') { res.end(); return; }

  const code = url.searchParams.get('code');
  const err  = url.searchParams.get('error');

  if (err) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h2>❌ Authorization denied: ${err}</h2><p>Close this tab.</p>`);
    server.close();
    process.exit(1);
  }

  if (!code) { res.end('No code.'); return; }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html><body style="font-family:sans-serif;padding:32px;background:#f9f9f9">
    <h2 style="color:#2d7a3a">✅ Authorization successful!</h2>
    <p>Exchanging code for refresh token — check your terminal.</p>
    <p>You can close this tab.</p>
    </body></html>
  `);
  server.close();

  // Exchange code for tokens
  console.log('✔ Authorization code received. Exchanging for tokens...\n');
  try {
    const body = new URLSearchParams({
      code,
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      grant_type:    'authorization_code',
    });

    const resp = await fetch(TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });
    const json = await resp.json();

    if (!resp.ok || !json.refresh_token) {
      console.error('❌ Token exchange failed:', JSON.stringify(json, null, 2));
      process.exit(1);
    }

    const refreshToken = json.refresh_token;

    console.log('═══════════════════════════════════════════════════════');
    console.log('  ✅  REFRESH TOKEN OBTAINED');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`GOOGLE_ADS_REFRESH_TOKEN=${refreshToken}\n`);

    console.log('─── Ask your admin for the Developer Token ─────────────');
    console.log('  1. Sign in to Google Ads (ads.google.com)');
    console.log('  2. Tools & Settings → API Center');
    console.log('  3. Copy the Developer Token shown there\n');

    console.log('─── Then run these Supabase CLI commands ────────────────');
    console.log(`npx supabase secrets set GOOGLE_ADS_CUSTOMER_ID=${CUSTOMER_ID}`);
    console.log(`npx supabase secrets set GOOGLE_ADS_CLIENT_ID="${CLIENT_ID}"`);
    console.log(`npx supabase secrets set GOOGLE_ADS_CLIENT_SECRET="${CLIENT_SECRET}"`);
    console.log(`npx supabase secrets set GOOGLE_ADS_REFRESH_TOKEN="${refreshToken}"`);
    console.log(`npx supabase secrets set GOOGLE_ADS_DEVELOPER_TOKEN="YOUR_DEV_TOKEN_HERE"`);
    console.log('\n─── Then deploy the edge function ───────────────────────');
    console.log('npx supabase functions deploy google-ads-analytics --no-verify-jwt\n');
  } catch (e) {
    console.error('❌ Fetch failed:', e.message);
    process.exit(1);
  }
});

server.listen(9876, () => {
  console.log('Waiting for Google callback on http://localhost:9876/callback ...');
  console.log('(If the browser did not open, visit the URL below manually:)\n');
  console.log(authUrl.toString(), '\n');
});
