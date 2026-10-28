/** WhatsApp announcements sent from SignManager (admin API /broadcast). */

export type BroadcastAudience = 'all' | 'filiere' | 'members';

export interface BroadcastPayload {
  title: string;
  message: string;
  link?: string;
  audience: BroadcastAudience;
  filiere?: string;
  user_x_ids?: string[];
}

export interface BroadcastPreview {
  recipients: number;
  consenting: number;
  excluded: number;
  max_recipients: number;
  text: string;
  estimated_seconds: number;
  gowa_ready: boolean;
}

export interface BroadcastItem {
  x_id: string;
  message: string;
  audience: BroadcastAudience;
  filiere: string | null;
  recipients: number;
  sent: number;
  failed: number;
  status: 'queued' | 'sending' | 'done' | 'failed';
  error: string | null;
  author: string | null;
  created_time: string;
  finished_time: string | null;
}
