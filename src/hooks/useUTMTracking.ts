/**
 * useUTMTracking
 *
 * Captures UTM parameters and referrer from deep-link URLs and persists them
 * to the marketing_leads table when a user submits a booking or enquiry form.
 *
 * Usage:
 *   const { captureFromUrl, persistLead } = useUTMTracking();
 *
 *   // On app open with deep link:
 *   captureFromUrl(url);
 *
 *   // On form submission:
 *   await persistLead({ email, name, phone, source: 'booking_form' });
 */

import { useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer_url?: string;
}

export interface LeadPayload extends UTMParams {
  email?: string;
  name?: string;
  phone?: string;
  source?: string;        // e.g. 'booking_form', 'contact_form', 'safari_enquiry'
  booking_id?: string;
  safari_booking_id?: string;
  notes?: string;
}

// Module-level session store (persists for app session)
let sessionUTM: UTMParams = {};

export function useUTMTracking() {
  const captured = useRef<UTMParams>(sessionUTM);

  /**
   * Parse UTM params from a URL string (deep link or web URL).
   * Stores them in module-level session so they persist across navigation.
   */
  const captureFromUrl = useCallback((url: string) => {
    try {
      const parsed = new URL(url);
      const p = parsed.searchParams;
      const utm: UTMParams = {};
      if (p.get('utm_source'))   utm.utm_source   = p.get('utm_source')!;
      if (p.get('utm_medium'))   utm.utm_medium   = p.get('utm_medium')!;
      if (p.get('utm_campaign')) utm.utm_campaign = p.get('utm_campaign')!;
      if (p.get('utm_content'))  utm.utm_content  = p.get('utm_content')!;
      if (p.get('utm_term'))     utm.utm_term     = p.get('utm_term')!;
      if (p.get('ref'))          utm.referrer_url = p.get('ref')!;
      sessionUTM = { ...sessionUTM, ...utm };
      captured.current = sessionUTM;
    } catch {
      // invalid URL — ignore
    }
  }, []);

  /** Manually set UTM params (e.g. from notification payload) */
  const setUTM = useCallback((utm: UTMParams) => {
    sessionUTM = { ...sessionUTM, ...utm };
    captured.current = sessionUTM;
  }, []);

  /** Get current captured UTM session */
  const getUTM = useCallback((): UTMParams => captured.current, []);

  /**
   * Persist a marketing lead with current UTM params to Supabase.
   * Fails silently — never blocks the booking/form flow.
   */
  const persistLead = useCallback(async (payload: LeadPayload): Promise<void> => {
    try {
      const { error } = await supabase.from('marketing_leads').insert({
        ...payload,
        ...captured.current,
        created_at: new Date().toISOString(),
      });
      if (error) console.warn('[UTMTracking] persistLead error:', error.message);
    } catch (e) {
      console.warn('[UTMTracking] persistLead exception:', e);
    }
  }, []);

  /**
   * Attach UTM params to an existing booking record.
   * Call after a safari_booking is created to link attribution.
   */
  const attachToBooking = useCallback(async (bookingId: string): Promise<void> => {
    const utm = captured.current;
    if (!Object.keys(utm).length) return;
    try {
      await supabase.from('marketing_leads').insert({
        safari_booking_id: bookingId,
        source: 'safari_booking',
        ...utm,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[UTMTracking] attachToBooking exception:', e);
    }
  }, []);

  return { captureFromUrl, setUTM, getUTM, persistLead, attachToBooking };
}
