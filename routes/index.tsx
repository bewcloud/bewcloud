import { Handlers } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { AppConfig } from '/lib/config.ts';

interface Data {}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    const config = await AppConfig.getConfig();

    if (context.state.user) {
      const firstEnabledApp = config.core.enabledApps[0];

      return new Response('Redirect', { status: 303, headers: { 'Location': `/${firstEnabledApp}` } });
    }

    return new Response('Redirect', { status: 303, headers: { 'Location': '/login' } });
  },
};
