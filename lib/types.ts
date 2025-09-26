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
    expenses_currency?: SupportedCurrencySymbol;
    multi_factor_auth_methods?: MultiFactorAuthMethod[];
    hidden_calendar_ids?: string[];
    timezone?: {
      id: string;
      utcOffset: number;
    };
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
  extra: Record<never, never>; // NOTE: Here for potential future fields
  created_at: Date;
}

export interface Directory {
  user_id: string;
  parent_path: string;
  directory_name: string;
  has_write_access: boolean;
  size_in_bytes: number;
  file_share_id: string | null;
  updated_at: Date;
  created_at: Date;
}

export interface DirectoryFile {
  user_id: string;
  parent_path: string;
  file_name: string;
  has_write_access: boolean;
  size_in_bytes: number;
  file_share_id: string | null;
  updated_at: Date;
  created_at: Date;
}

export interface Budget {
  id: string;
  user_id: string;
  name: string;
  month: string;
  value: number;
  extra: {
    usedValue: number;
    availableValue: number;
  };
  created_at: Date;
}

export interface Expense {
  id: string;
  user_id: string;
  cost: number;
  description: string;
  budget: string;
  date: string;
  is_recurring: boolean;
  extra: Record<never, never>; // NOTE: Here for potential future fields
  created_at: Date;
}

export type SupportedCurrencySymbol = '$' | '€' | '£' | '¥' | '₹';
type SupportedCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'INR';

export const currencyMap = new Map<SupportedCurrencySymbol, SupportedCurrency>([
  ['$', 'USD'],
  ['€', 'EUR'],
  ['£', 'GBP'],
  ['¥', 'JPY'],
  ['₹', 'INR'],
]);

export type PartialDeep<T> = (T extends (infer U)[] ? PartialDeep<U>[] : { [P in keyof T]?: PartialDeep<T[P]> }) | T;

export type OptionalApp = 'news' | 'notes' | 'photos' | 'expenses' | 'contacts' | 'calendar';

export interface Config {
  auth: {
    /** The base URL of the application you use to access the app, i.e. "http://localhost:8000" or "https://cloud.example.com" (note authentication won't work without https:// except for localhost; SSO redirect, if enabled, will be this + /oidc/callback, so "https://cloud.example.com/oidc/callback") */
    baseUrl: string;
    /** If true, anyone can sign up for an account. Note that it's always possible to sign up for the first user, and they will be an admin */
    allowSignups: boolean;
    /** If true, email verification will be required for signups (using SMTP settings below) */
    enableEmailVerification: boolean;
    /** If true, all signups become active for 100 years */
    enableForeverSignup: boolean;
    /** If true, users can enable multi-factor authentication (TOTP, Passkeys, or Email if the SMTP settings below are set) */
    enableMultiFactor: boolean;
    /** Can be set to allow more than the baseUrl's domain for session cookies */
    allowedCookieDomains: string[];
    /** If true, the cookie domain will not be strictly set and checked against. This skipping slightly reduces security, but is usually necessary for reverse proxies like Cloudflare Tunnel. */
    skipCookieDomainSecurity: boolean;
    /** If true, single sign-on will be enabled */
    enableSingleSignOn: boolean;
    /** The Discovery URL (AKA Issuer) of the identity/single sign-on provider */
    singleSignOnUrl: string;
    /** The attribute to prefer as email of the identity/single sign-on provider */
    singleSignOnEmailAttribute: string;
    /** The scopes to request from the identity/single sign-on provider */
    singleSignOnScopes: string[];
  };
  files: {
    /** The root-relative root path for files, i.e. "data-files" */
    rootPath: string;
    /** If true, public file sharing will be allowed (still requires a user to enable sharing for a given file or directory) */
    allowPublicSharing: boolean;
  };
  core: {
    /** dashboard and files cannot be disabled */
    enabledApps: OptionalApp[];
  };
  visuals: {
    /** An override title of the application. Empty shows the default title. */
    title: string;
    /** An override description of the application. Empty shows the default description. */
    description: string;
    /** The email address to contact for help. Empty will disable/hide the "need help" sections. */
    helpEmail: string;
  };
  email: {
    /** The email address to send emails from */
    from: string;
    /** The SMTP host to send emails from */
    host: string;
    /** The SMTP port to send emails from */
    port: number;
  };
  contacts: {
    /** If true, the CardDAV server will be enabled (proxied) */
    enableCardDavServer: boolean;
    /** The CardDAV server URL to proxy to */
    cardDavUrl: string;
  };
  calendar: {
    /** If true, the CalDAV server will be enabled (proxied) */
    enableCalDavServer: boolean;
    /** The CalDAV server URL to proxy to */
    calDavUrl: string;
  };
}

export type MultiFactorAuthMethodType = 'totp' | 'passkey' | 'email';

export interface MultiFactorAuthMethod {
  type: MultiFactorAuthMethodType;
  id: string;
  name: string;
  enabled: boolean;
  created_at: Date;
  metadata: {
    totp?: {
      hashed_secret: string;
      hashed_backup_codes: string[];
    };
    passkey?: {
      credential_id: string;
      public_key: string;
      counter?: number;
      device_type?: string;
      backed_up?: boolean;
      // @ts-ignore this fails in vite/tests
      transports?: AuthenticatorTransport[];
    };
  };
}

export interface FileShare {
  id: string;
  user_id: string;
  file_path: string;
  extra: {
    hashed_password?: string;
  };
  created_at: Date;
}
