# bewCloud - FAQ (Frequently Asked Questions)

## How does Contacts/CardDav and Calendar/CalDav work?

CalDav/CardDav is now available since [v2.3.0](https://github.com/bewcloud/bewcloud/releases/tag/v2.3.0), using [Radicale](https://radicale.org/v3.html) via Docker, which is already _very_ efficient (and battle-tested). The "Contacts" client for CardDav is available since [v2.4.0](https://github.com/bewcloud/bewcloud/releases/tag/v2.3.0) and the "Calendar" client for CalDav is available since [v2.5.0](https://github.com/bewcloud/bewcloud/releases/tag/v2.5.0). [Check this tag/release for custom-made server code where it was all mostly working, except for many edge cases, if you're interested](https://github.com/bewcloud/bewcloud/releases/tag/v0.0.1-self-made-carddav-caldav).

In order to share a calendar, you can either have a shared user, or you can symlink the calendar to the user's own calendar (simply `ln -s /<absolute-path-to-data-radicale>/collections/collection-root/<owner-user-id>/<calendar-to-share> /<absolute-path-to-data-radicale>/collections/collection-root/<user-id-to-share-with>/`).

> [!NOTE]
> If you're running radicale with docker, the symlink needs to point to the container's directory, usually starting with `/data` if you didn't change the `radicale-config/config`, otherwise the container will fail to load the linked directory.

## How does private file sharing work?

Public file sharing is now possible since [v2.2.0](https://github.com/bewcloud/bewcloud/releases/tag/v2.2.0). [Check this PR for advanced sharing with internal and external users, with read and write access that was being done and almost working, if you're interested](https://github.com/bewcloud/bewcloud/pull/4). I ditched all that complexity for simply using [symlinks](https://en.wikipedia.org/wiki/Symbolic_link) for internal sharing, as it served my use case (I have multiple data backups and trust the people I provide accounts to, with the symlinks).

You can simply `ln -s /<absolute-path-to-data-files>/<owner-user-id>/<directory-to-share> /<absolute-path-to-data-files>/<user-id-to-share-with>/` to create a shared directory between two users, and the same directory can have different names, now.

> [!NOTE]
> If you're running the app with docker, the symlink needs to point to the container's directory, usually starting with `/app` if you didn't change the `Dockerfile`, otherwise the container will fail to load the linked directory.

## How can I use .env for configuration?

During [v1](https://github.com/bewcloud/bewcloud/releases/tag/v1.0.0), bewCloud was entirely configured with a `.env` file, but since [v2](https://github.com/bewcloud/bewcloud/releases/tag/v2.0.0) it was swapped to being used exclusively for "secrets", and having a more robust `bewcloud.config.ts` file for configuration. While it's unlikely `.env`-only configuration will be supported again in the future, the advantage of a `bewcloud.config.ts` file is that it's more dynamic and powerful, which means you can "hack" your way into using a `.env` file for configuration, like how it was suggested [in this comment](https://github.com/bewcloud/bewcloud/issues/90#issuecomment-3450344972). It's copied below for reference, and it's a bit outdated, but should serve as a good starting point, and you can make a PR to update it:

> [!NOTE]
> This is not recommended and should only be done if you know what you're doing.

<details>
<summary>
bewcloud.config.ts
</summary>

```ts
import { Config, OptionalApp, PartialDeep } from './lib/types.ts';

// Check the Config type for all the possible options and instructions.
function requireValue<T>(value: T | undefined, key: string): T {
  if (value === undefined || value === '') {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

function getEnvString(key: string, defaultValue: string): string {
  return Deno.env.get(key) ?? defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = Deno.env.get(key);
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = Deno.env.get(key);
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvStringArray(key: string, defaultValue: string[]): string[] {
  const value = Deno.env.get(key);
  if (value === undefined) {
    return defaultValue;
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
const config: PartialDeep<Config> = {
  auth: {
    baseUrl: getEnvString('BEWCLOUD_AUTH_BASE_URL', 'http://localhost:8000'),
    allowSignups: getEnvBoolean('BEWCLOUD_AUTH_ALLOW_SIGNUPS', false),
    enableEmailVerification: getEnvBoolean(
      'BEWCLOUD_AUTH_ENABLE_EMAIL_VERIFICATION',
      false,
    ),
    enableForeverSignup: getEnvBoolean(
      'BEWCLOUD_AUTH_ENABLE_FOREVER_SIGNUP',
      true,
    ),
    enableMultiFactor: getEnvBoolean(
      'BEWCLOUD_AUTH_ENABLE_MULTI_FACTOR',
      false,
    ),
    allowedCookieDomains: getEnvStringArray(
      'BEWCLOUD_AUTH_ALLOWED_COOKIE_DOMAINS',
      [],
    ),
    skipCookieDomainSecurity: getEnvBoolean(
      'BEWCLOUD_AUTH_SKIP_COOKIE_DOMAIN_SECURITY',
      false,
    ),
    enableSingleSignOn: getEnvBoolean(
      'BEWCLOUD_AUTH_ENABLE_SINGLE_SIGN_ON',
      false,
    ),
    singleSignOnUrl: getEnvString('BEWCLOUD_AUTH_SINGLE_SIGN_ON_URL', ''),
    singleSignOnEmailAttribute: getEnvString(
      'BEWCLOUD_AUTH_SINGLE_SIGN_ON_EMAIL_ATTRIBUTE',
      'email',
    ),
    singleSignOnScopes: getEnvStringArray(
      'BEWCLOUD_AUTH_SINGLE_SIGN_ON_SCOPES',
      ['openid', 'email'],
    ),
  },
  files: {
    rootPath: getEnvString('BEWCLOUD_FILES_ROOT_PATH', 'data-files'),
    allowPublicSharing: getEnvBoolean(
      'BEWCLOUD_FILES_ALLOW_PUBLIC_SHARING',
      false,
    ),
  },
  core: {
    enabledApps: getEnvStringArray('BEWCLOUD_CORE_ENABLED_APPS', [
      'dashboard',
      'files',
      'news',
      'notes',
      'photos',
      'expenses',
    ]) as OptionalApp[],
  },
  visuals: {
    title: getEnvString('BEWCLOUD_VISUALS_TITLE', ''),
    description: getEnvString('BEWCLOUD_VISUALS_DESCRIPTION', ''),
    helpEmail: getEnvString('BEWCLOUD_VISUALS_HELP_EMAIL', 'help@bewcloud.com'),
  },
  email: {
    from: getEnvString('BEWCLOUD_EMAIL_FROM', 'help@bewcloud.com'),
    host: getEnvString('BEWCLOUD_EMAIL_HOST', 'localhost'),
    port: getEnvNumber('BEWCLOUD_EMAIL_PORT', 465),
  },
  contacts: {
    enableCardDavServer: getEnvBoolean(
      'BEWCLOUD_CONTACTS_ENABLE_CARDDAV_SERVER',
      true,
    ),
    cardDavUrl: getEnvString(
      'BEWCLOUD_CONTACTS_CARDDAV_URL',
      'http://127.0.0.1:5232',
    ),
  },
  calendar: {
    enableCalDavServer: getEnvBoolean(
      'BEWCLOUD_CALENDAR_ENABLE_CALDAV_SERVER',
      true,
    ),
    calDavUrl: getEnvString(
      'BEWCLOUD_CALENDAR_CALDAV_URL',
      'http://127.0.0.1:5232',
    ),
  },
};

export default config;
```

</details>

Append the following to your `.env` file

<details>
<summary> .env </summary>

```env
# Auth Configuration
BEWCLOUD_AUTH_BASE_URL=http://localhost:8000
BEWCLOUD_AUTH_ALLOW_SIGNUPS=false
BEWCLOUD_AUTH_ENABLE_EMAIL_VERIFICATION=false
BEWCLOUD_AUTH_ENABLE_FOREVER_SIGNUP=true
BEWCLOUD_AUTH_ENABLE_MULTI_FACTOR=false
# Comma-separated list of allowed cookie domains
BEWCLOUD_AUTH_ALLOWED_COOKIE_DOMAINS=
BEWCLOUD_AUTH_SKIP_COOKIE_DOMAIN_SECURITY=false

# Single Sign-On Configuration
BEWCLOUD_AUTH_ENABLE_SINGLE_SIGN_ON=false
BEWCLOUD_AUTH_SINGLE_SIGN_ON_URL=
BEWCLOUD_AUTH_SINGLE_SIGN_ON_EMAIL_ATTRIBUTE=email
# Comma-separated list of scopes
BEWCLOUD_AUTH_SINGLE_SIGN_ON_SCOPES=openid,email

# Files Configuration
BEWCLOUD_FILES_ROOT_PATH=data-files
BEWCLOUD_FILES_ALLOW_PUBLIC_SHARING=false

# Core Configuration
# Comma-separated list of enabled apps (dashboard and files cannot be disabled)
BEWCLOUD_CORE_ENABLED_APPS=news,notes,photos,expenses,contacts,calendar

# Visuals Configuration
BEWCLOUD_VISUALS_TITLE=
BEWCLOUD_VISUALS_DESCRIPTION=
BEWCLOUD_VISUALS_HELP_EMAIL=help@bewcloud.com

# Email/SMTP Configuration
BEWCLOUD_EMAIL_FROM=help@bewcloud.com
BEWCLOUD_EMAIL_HOST=localhost
BEWCLOUD_EMAIL_PORT=465

# Contacts Configuration
BEWCLOUD_CONTACTS_ENABLE_CARDDAV_SERVER=true
BEWCLOUD_CONTACTS_CARDDAV_URL=http://127.0.0.1:5232

# Calendar Configuration
BEWCLOUD_CALENDAR_ENABLE_CALDAV_SERVER=true
BEWCLOUD_CALENDAR_CALDAV_URL=http://127.0.0.1:5232
```

</details>

## Wasn't this made with Fresh?

Up until [v4.0.0](https://github.com/bewcloud/bewcloud/releases/tag/v4.0.0), bewCloud was made with [Fresh](https://fresh.deno.dev/), but as per [#141](https://github.com/bewcloud/bewcloud/issues/141) it has since been rewritten in standard Deno to use a more web-standards-based backend, easier to maintain and extend, without requiring breaking updates.
