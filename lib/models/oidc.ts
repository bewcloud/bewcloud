import { decodeBase64Url } from '@std/encoding';
import * as openIdClient from 'openid-client';
import '@std/dotenv/load';

import { createSessionResponse, dataToText } from '/lib/auth.ts';
import { UserModel } from '/lib/models/user.ts';
import { generateRandomCode } from '/public/ts/utils/misc.ts';
import { AppConfig } from '/lib/config.ts';
import SimpleCache from '/lib/interfaces/simple-cache.ts';

const OIDC_CLIENT_ID = Deno.env.get('OIDC_CLIENT_ID') || '';
const OIDC_CLIENT_SECRET = Deno.env.get('OIDC_CLIENT_SECRET') || '';

interface OidcExtraState {
  redirectTo?: string;
}

interface OidcJwtIdToken extends Record<string, string | undefined> {
  email?: string;
  name?: string;
  sub?: string;
}

const redirectUrlPath = '/oidc/callback';

export class OidcModel {
  static async getSignInUrl(
    {
      requestPermissions,
      extraState = {},
    }: {
      requestPermissions: string[];
      extraState?: OidcExtraState;
    },
  ): Promise<string> {
    const state = {
      ...extraState,
      random: generateRandomCode(8),
    };

    const config = await AppConfig.getConfig();

    const baseUrl = config.auth.baseUrl;
    const oidcBaseUrl = config.auth.singleSignOnUrl;
    const oidcOptions = oidcBaseUrl.startsWith('http://')
      ? { execute: [openIdClient.allowInsecureRequests] }
      : undefined;

    try {
      const oidcConfig = await openIdClient.discovery(
        new URL(oidcBaseUrl),
        OIDC_CLIENT_ID,
        OIDC_CLIENT_SECRET,
        undefined,
        oidcOptions,
      );

      const redirectUrl = `${baseUrl}${redirectUrlPath}`;

      const codeVerifier = openIdClient.randomPKCECodeVerifier();

      const params = {
        client_id: OIDC_CLIENT_ID,
        redirect_uri: redirectUrl,
        state: btoa(JSON.stringify(state)),
        scope: requestPermissions.join(' '),
        code_challenge: await openIdClient.calculatePKCECodeChallenge(codeVerifier),
        code_challenge_method: 'S256',
      };

      const oidcStateCache = new SimpleCache(`oidc:state:${params.state}`);

      await oidcStateCache.set(JSON.stringify({ state, codeVerifier }));

      const oidcUrl = openIdClient.buildAuthorizationUrl(oidcConfig, params);

      return oidcUrl.href;
    } catch (error) {
      console.log(`Failed to get OIDC sign in URL: ${error}`);
      console.error(error);

      return '';
    }
  }

  private static decodeJwt(jwt: string): OidcJwtIdToken {
    const jwtParts = jwt.split('.');
    if (jwtParts.length !== 3) {
      throw new Error('Malformed JWT');
    }

    return JSON.parse(dataToText(decodeBase64Url(jwtParts[1]))) as OidcJwtIdToken;
  }

  private static parseState(state: string): OidcExtraState {
    let stateParams: OidcExtraState = {};

    try {
      stateParams = JSON.parse(atob(state));
    } catch (error) {
      console.log(`Failed to parse OIDC state: ${error}`);
      console.error(error);
    }

    return stateParams;
  }

  static async validateAndCreateSession(request: Request) {
    const urlSearchParams = new URL(request.url).searchParams;
    const state = urlSearchParams.get('state');

    if (!state) {
      throw new Error('Missing OIDC "state" parameter');
    }

    const oidcStateCache = new SimpleCache(`oidc:state:${state}`);

    let expectedState: string;
    let expectedCodeVerifier: string;

    try {
      const cacheValue = await oidcStateCache.get();

      const { state, codeVerifier } = JSON.parse(cacheValue) as {
        state: OidcExtraState;
        codeVerifier: string;
      };

      expectedState = btoa(JSON.stringify(state));
      expectedCodeVerifier = codeVerifier;
    } catch (error) {
      console.log(`Failed to verify/parse OIDC code: ${error}`);
      console.error(error);

      throw new Error('Invalid OIDC code');
    }

    const config = await AppConfig.getConfig();

    const baseUrl = config.auth.baseUrl;
    const oidcBaseUrl = config.auth.singleSignOnUrl;
    const emailAttribute = config.auth.singleSignOnEmailAttribute;
    const oidcOptions = oidcBaseUrl.startsWith('http://')
      ? { execute: [openIdClient.allowInsecureRequests] }
      : undefined;

    const oidcConfig = await openIdClient.discovery(
      new URL(oidcBaseUrl),
      OIDC_CLIENT_ID,
      OIDC_CLIENT_SECRET,
      undefined,
      oidcOptions,
    );

    const tokens = await openIdClient.authorizationCodeGrant(
      oidcConfig,
      new URL(`${baseUrl}${redirectUrlPath}?${urlSearchParams.toString()}`),
      {
        pkceCodeVerifier: expectedCodeVerifier,
        expectedState,
      },
    );

    const oidcParams = this.decodeJwt(tokens.id_token!);

    const email = oidcParams[emailAttribute];

    if (!email) {
      throw new Error(`Missing user/${emailAttribute}`);
    }

    const isSignupAllowed = await AppConfig.isSignupAllowed(true);
    const isThereAnAdmin = await UserModel.isThereAnAdmin();

    // Confirm the user exists (or signup if allowed)
    let user = await UserModel.getByEmail(email);

    if (!user && (isSignupAllowed || !isThereAnAdmin)) {
      // An empty password will always be impossible to login with
      user = await UserModel.create(email, '');
    }

    if (!user) {
      throw new Error('There was a problem signing up or logging in!');
    }

    const firstEnabledApp = config.core.enabledApps[0];

    let urlToRedirectTo = `/${firstEnabledApp}`;

    if (urlSearchParams.has('state')) {
      const state = this.parseState(urlSearchParams.get('state')!);

      if (state.redirectTo) {
        urlToRedirectTo = state.redirectTo;
      }
    }

    const response = await createSessionResponse(request, user, { urlToRedirectTo });

    return {
      response,
      user,
    };
  }
}
