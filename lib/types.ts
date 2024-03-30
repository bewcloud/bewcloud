export interface User {
  id: string;
  email: string;
  hashed_password: string;
  subscription: {
    external: Record<never, never>;
    expires_at: string;
    updated_at: string;
  };
  status: 'trial' | 'active' | 'inactive';
  extra: {
    is_email_verified: boolean;
    is_admin?: boolean;
    dav_hashed_password?: string;
    contacts_revision?: string;
    contacts_updated_at?: string;
  };
  created_at: Date;
}

export interface UserSession {
  id: string;
  user_id: string;
  expires_at: Date;
  last_seen_at: Date;
  created_at: Date;
}

export interface FreshContextState {
  user?: User;
  session?: UserSession;
}

export interface VerificationCode {
  id: string;
  user_id: string;
  code: string;
  verification: {
    type: 'email';
    id: string;
  };
  expires_at: Date;
  created_at: Date;
}

export interface DashboardLink {
  url: string;
  name: string;
}

export interface Dashboard {
  id: string;
  user_id: string;
  data: {
    links: DashboardLink[];
    notes: string;
  };
  created_at: Date;
}

export type NewsFeedType = 'rss' | 'atom' | 'json';
export type NewsFeedCrawlType = 'direct' | 'googlebot' | 'proxy';

export interface NewsFeed {
  id: string;
  user_id: string;
  feed_url: string;
  last_crawled_at: Date | null;
  extra: {
    title?: string;
    feed_type?: NewsFeedType;
    crawl_type?: NewsFeedCrawlType;
  };
  created_at: Date;
}

export interface NewsFeedArticle {
  id: string;
  user_id: string;
  feed_id: string;
  article_url: string;
  article_title: string;
  article_summary: string;
  article_date: Date;
  is_read: boolean;
  extra: Record<never, never>;
  created_at: Date;
}

// NOTE: I don't really organize contacts by groups or address books, so I don't think I'll need that complexity
export interface Contact {
  id: string;
  user_id: string;
  revision: string;
  first_name: string;
  last_name: string;
  extra: {
    name_title?: string;
    middle_names?: string[];
    organization?: string;
    role?: string;
    photo_url?: string;
    photo_mediatype?: string;
    addresses?: ContactAddress[];
    fields?: ContactField[];
    notes?: string;
    uid?: string;
    nickname?: string;
    birthday?: string;
  };
  updated_at: Date;
  created_at: Date;
}

export interface ContactAddress {
  label?: string;
  line_1?: string;
  line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export type ContactFieldType = 'email' | 'phone' | 'url' | 'other';

export interface ContactField {
  name: string;
  value: string;
  type: ContactFieldType;
}

export interface Calendar {
  id: string;
  user_id: string;
  revision: string;
  name: string;
  color: string;
  is_visible: boolean;
  extra: {
    shared_read_user_ids?: string[];
    shared_write_user_ids?: string[];
    default_transparency: 'opaque' | 'transparent';
    calendar_timezone?: string;
  };
  updated_at: Date;
  created_at: Date;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  calendar_id: string;
  revision: string;
  title: string;
  start_date: Date;
  end_date: Date;
  is_all_day: boolean;
  status: 'scheduled' | 'pending' | 'canceled';
  extra: {
    organizer_email: string;
    description?: string;
    location?: string;
    url?: string;
    attendees?: CalendarEventAttendee[];
    transparency: 'default' | Calendar['extra']['default_transparency'];
    is_recurring?: boolean;
    recurring_id?: string;
    recurring_sequence?: number;
    recurring_rrule?: string;
    recurring_rdate?: string;
    recurring_exdate?: string;
    is_task?: boolean;
    task_due_date?: string;
    task_completed_at?: string;
    uid?: string;
    reminders?: CalendarEventReminder[];
  };
  updated_at: Date;
  created_at: Date;
}

export interface CalendarEventAttendee {
  email: string;
  status: 'accepted' | 'rejected' | 'invited';
  name?: string;
}

export interface CalendarEventReminder {
  uid?: string;
  start_date: string;
  type: 'email' | 'sound' | 'display';
  acknowledged_at?: string;
  description?: string;
}
