/**
 * In-App Messaging Types
 *
 * Staff messages are broadcast to all authenticated users
 * (shared channel) and synced in real-time with the web app.
 */

export interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  recipient_email?: string | null;
  /** null = broadcast to all staff; set = DM to that user */
  recipient_id: string | null;
  created_at: string;
  /** Array of user IDs that have marked this read */
  read_by: string[];
}

export interface SendMessagePayload {
  body: string;
  recipient_id?: string | null;
  recipient_email?: string | null;
}
