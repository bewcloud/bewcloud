import page, { RequestHandlerParams } from '/lib/page.ts';

import { DashboardModel } from '/lib/models/dashboard.ts';
import { AppConfig } from '/lib/config.ts';

export interface RequestBody {
  notes: string;
}

export interface ResponseBody {
  success: boolean;
}

async function post({ request, user }: RequestHandlerParams) {
  if (!(await AppConfig.isAppEnabled('dashboard'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const userDashboard = await DashboardModel.getByUserId(user!.id);

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
}

export default page({
  post,
  accessMode: 'user',
});
