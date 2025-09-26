import { RouteHandler } from 'fresh';

import { FreshContextState } from '/lib/types.ts';
import { DashboardModel } from '/lib/models/dashboard.ts';

interface Data {}

export interface RequestBody {
  notes: string;
}

export interface ResponseBody {
  success: boolean;
}

export const handler: RouteHandler<Data, FreshContextState> = {
  async POST(context) {
    const request = context.req;

    if (!context.state.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userDashboard = await DashboardModel.getByUserId(context.state.user.id);

    if (!userDashboard) {
      return new Response('Not found', { status: 404 });
    }

    const requestBody = await request.clone().json() as RequestBody;

    if (typeof requestBody.notes !== 'undefined' && userDashboard.data.notes !== requestBody.notes) {
      userDashboard.data.notes = requestBody.notes;

      await DashboardModel.update(userDashboard);
    }

    const responseBody: ResponseBody = { success: true };

    return new Response(JSON.stringify(responseBody));
  },
};
