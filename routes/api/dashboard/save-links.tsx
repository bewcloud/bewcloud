import { Handlers } from 'fresh/server.ts';

import { DashboardLink, FreshContextState } from '/lib/types.ts';
import { getDashboardByUserId, updateDashboard } from '/lib/data/dashboard.ts';

interface Data {}

export interface RequestBody {
  links: DashboardLink[];
}

export interface ResponseBody {
  success: boolean;
}

export const handler: Handlers<Data, FreshContextState> = {
  async POST(request, context) {
    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userDashboard = await getDashboardByUserId(context.state.user.id);

    if (!userDashboard) {
      return new Response('Not found', { status: 404 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (typeof requestBody.links !== 'undefined') {
      userDashboard.data.links = requestBody.links;

      await updateDashboard(userDashboard);
    }

    const responseBody: ResponseBody = { success: true };

    return new Response(JSON.stringify(responseBody));
  },
};
