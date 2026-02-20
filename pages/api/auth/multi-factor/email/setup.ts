import page, { RequestHandlerParams } from '/lib/page.ts';

import { UserModel } from '/lib/models/user.ts';
import { AppConfig } from '/lib/config.ts';
import { MultiFactorAuthModel } from '/lib/models/multi-factor-auth.ts';
import { EmailModel } from '/lib/models/multi-factor-auth/email.ts';

export interface ResponseBody {
  success: boolean;
  error?: string;
  data?: {
    methodId: string;
  };
}

async function post({ user }: RequestHandlerParams) {
  const isMultiFactorAuthEnabled = await AppConfig.isMultiFactorAuthEnabled();

  if (!isMultiFactorAuthEnabled) {
    const responseBody: ResponseBody = {
      success: false,
      error: 'Multi-factor authentication is not enabled on this server',
    };

    return new Response(JSON.stringify(responseBody), { status: 403 });
  }

  const methodId = MultiFactorAuthModel.generateMethodId();
  const setup = await EmailModel.createMethod(methodId, 'Email', user!);

  if (!user!.extra.multi_factor_auth_methods) {
    user!.extra.multi_factor_auth_methods = [];
  }

  user!.extra.multi_factor_auth_methods.push(setup.method);

  await UserModel.update(user!);

  const responseData: ResponseBody = {
    success: true,
    data: {
      methodId: setup.method.id,
    },
  };

  return new Response(JSON.stringify(responseData));
}

export default page({
  post,
  accessMode: 'user',
});
