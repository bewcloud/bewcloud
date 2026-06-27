import page, { RequestHandlerParams } from '/lib/page.ts';
import { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';

import { AppConfig } from '/lib/config.ts';
import { PasskeyModel } from '/lib/models/multi-factor-auth/passkey.ts';
import { MultiFactorAuthModel } from '/lib/models/multi-factor-auth.ts';

export interface ResponseBody {
  success: boolean;
  error?: string;
  options?: PublicKeyCredentialCreationOptionsJSON;
  sessionData?: {
    challenge: string;
    methodId: string;
    userId: string;
  };
}

async function post({ user }: RequestHandlerParams) {
  const isMultiFactorAuthEnabled = await AppConfig.isMultiFactorAuthEnabled();

  if (!isMultiFactorAuthEnabled) {
    const responseBody: ResponseBody = {
      success: false,
      error: 'Passwordless passkey login requires multi-factor authentication to be enabled.',
    };

    return new Response(JSON.stringify(responseBody), { status: 403 });
  }

  const methodId = MultiFactorAuthModel.generateMethodId();

  const config = await AppConfig.getConfig();
  const existingCredentials = PasskeyModel.getCredentialsFromUser(user!);

  const options = await PasskeyModel.generateRegistrationOptions(
    user!.id,
    user!.email,
    config.auth.baseUrl,
    existingCredentials,
  );

  const sessionData: ResponseBody['sessionData'] = {
    challenge: options.challenge,
    methodId,
    userId: user!.id,
  };

  const responseBody: ResponseBody = {
    success: true,
    options,
    sessionData,
  };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
