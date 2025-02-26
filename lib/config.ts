import 'std/dotenv/load.ts';

import { isThereAnAdmin } from './data/user.ts';

export async function isSignupAllowed() {
  const areSignupsAllowed = Deno.env.get('CONFIG_ALLOW_SIGNUPS') === 'true';

  const areThereAdmins = await isThereAnAdmin();

  if (areSignupsAllowed || !areThereAdmins) {
    return true;
  }

  return false;
}

export function isAppEnabled(app: 'news' | 'notes' | 'photos' | 'expenses') {
  const enabledApps = (Deno.env.get('CONFIG_ENABLED_APPS') || '').split(',') as typeof app[];

  return enabledApps.includes(app);
}

export function isCookieDomainAllowed(domain: string) {
  const allowedDomains = (Deno.env.get('CONFIG_ALLOWED_COOKIE_DOMAINS') || '').split(',') as typeof domain[];

  if (allowedDomains.length === 0) {
    return true;
  }

  return allowedDomains.includes(domain);
}

export function isEmailEnabled() {
  const areEmailsAllowed = Deno.env.get('CONFIG_ENABLE_EMAILS') === 'true';

  return areEmailsAllowed;
}

export function isForeverSignupEnabled() {
  const areForeverAccountsEnabled = Deno.env.get('CONFIG_ENABLE_FOREVER_SIGNUP') === 'true';

  return areForeverAccountsEnabled;
}

export function getFilesRootPath() {
  const configRootPath = Deno.env.get('CONFIG_FILES_ROOT_PATH') || '';

  const filesRootPath = `${Deno.cwd()}/${configRootPath}`;

  return filesRootPath;
}
