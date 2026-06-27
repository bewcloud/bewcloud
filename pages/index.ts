import page, { RequestHandlerParams } from '/lib/page.ts';

import { AppConfig } from '/lib/config.ts';

async function get({ user }: RequestHandlerParams) {
  const config = await AppConfig.getConfig();

  if (user) {
    const firstEnabledApp = config.core.enabledApps[0];

    return new Response('Redirect', { status: 303, headers: { 'Location': `/${firstEnabledApp}` } });
  }

  return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
}

export default page({
  get,
  accessMode: 'public',
});
