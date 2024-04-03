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

export function getFilesRootPath() {
  const configRootPath = Deno.env.get('CONFIG_FILES_ROOT_PATH');

  const filesRootPath = `${Deno.cwd()}/${configRootPath}`;

  return filesRootPath;
}
