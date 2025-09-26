import page, { RequestHandlerParams } from '/lib/page.ts';
import { DashboardLink } from '/lib/types.ts';
import { DashboardModel } from '/lib/models/dashboard.ts';

export interface RequestBody {
  links: DashboardLink[];
}

export interface ResponseBody {
  success: boolean;
}

async function post({ request, user }: RequestHandlerParams) {
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const userDashboard = await DashboardModel.getByUserId(user.id);

  if (!userDashboard) {
    return new Response('Not found', { status: 404 });
  }

  const requestBody = await request.clone().json() as RequestBody;

  if (typeof requestBody.links !== 'undefined') {
    userDashboard.data.links = requestBody.links;

    await DashboardModel.update(userDashboard);
  }

  const responseBody: ResponseBody = { success: true };

  return new Response(JSON.stringify(responseBody));
}

const saveLinksPage = page({
  post,
  accessMode: 'user',
});

export default saveLinksPage;
