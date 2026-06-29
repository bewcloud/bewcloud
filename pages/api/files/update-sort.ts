import page, { RequestHandlerParams } from '/lib/page.ts';

import { UserModel } from '/lib/models/user.ts';
import { SortColumn, SortOrder } from '/public/ts/utils/files.ts';

export interface RequestBody {
  sortBy: SortColumn;
  sortOrder: SortOrder;
}

export interface ResponseBody {
  success: boolean;
}

const VALID_SORT_COLUMNS: SortColumn[] = ['name', 'updated_at', 'size_in_bytes'];
const VALID_SORT_ORDERS: SortOrder[] = ['asc', 'desc'];

async function post({ request, user }: RequestHandlerParams) {
  const requestBody = await request.clone().json() as RequestBody;

  if (!VALID_SORT_COLUMNS.includes(requestBody.sortBy) || !VALID_SORT_ORDERS.includes(requestBody.sortOrder)) {
    return new Response('Bad Request', { status: 400 });
  }

  user!.extra.file_sorting = { sort_by: requestBody.sortBy, sort_order: requestBody.sortOrder };

  await UserModel.update(user!);

  const responseBody: ResponseBody = { success: true };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
