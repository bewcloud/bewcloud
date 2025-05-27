import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  type VerifiedAuthenticationResponse,
  type VerifiedRegistrationResponse,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { TwoFactorMethod } from '/lib/types.ts';
import { generateMethodId } from '/lib/utils/two-factor.ts';

export interface PasskeyCredential {
  credentialID: string;
  credentialPublicKey: string;
  counter: number;
  credentialDeviceType: string;
  credentialBackedUp: boolean;
  transports?: string[];
}

export interface PasskeySetupData {
  methodId: string;
  options: any;
}

export interface PasskeyAuthenticationData {
  options: any;
}

const RP_NAME = 'BewCloud';
const RP_ID = (baseUrl: string) => {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return 'localhost';
  }
};

export async function generatePasskeyRegistrationOptions(
  userID: string,
  email: string,
  baseUrl: string,
  existingCredentials: PasskeyCredential[] = [],
): Promise<any> {
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID(baseUrl),
    userID: new TextEncoder().encode(userID),
    userName: email,
    userDisplayName: email,
    attestationType: 'none',
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialID,
      type: 'public-key',
      transports: cred.transports as AuthenticatorTransport[] | undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
    supportedAlgorithmIDs: [-7, -257],
  });

  return options;
}

export async function verifyPasskeyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string,
  expectedOrigin: string,
  expectedRPID: string,
): Promise<VerifiedRegistrationResponse> {
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
    supportedAlgorithmIDs: [-7, -257],
  });

  return verification;
}

export async function generatePasskeyAuthenticationOptions(
  baseUrl: string,
  allowCredentials?: PasskeyCredential[],
): Promise<any> {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID(baseUrl),
    allowCredentials: allowCredentials?.map((cred) => ({
      id: cred.credentialID,
      type: 'public-key',
      transports: cred.transports as AuthenticatorTransport[] | undefined,
    })),
    userVerification: 'preferred',
  });

  return options;
}

export async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  expectedOrigin: string,
  expectedRPID: string,
  credential: PasskeyCredential,
): Promise<VerifiedAuthenticationResponse> {
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin,
    expectedRPID,
    credential: {
      id: credential.credentialID,
      publicKey: isoBase64URL.toBuffer(credential.credentialPublicKey),
      counter: credential.counter,
      transports: credential.transports as AuthenticatorTransport[] | undefined,
    },
  });

  return verification;
}

export function createPasskeyTwoFactorMethod(
  name: string,
  credentialID: string,
  credentialPublicKey: string,
  counter: number,
  credentialDeviceType: string,
  credentialBackedUp: boolean,
  transports?: string[],
): TwoFactorMethod {
  return {
    type: 'passkey',
    id: generateMethodId(),
    name,
    enabled: false,
    created_at: new Date(),
    metadata: {
      passkey: {
        credential_id: credentialID,
        public_key: credentialPublicKey,
        counter,
        device_type: credentialDeviceType,
        backed_up: credentialBackedUp,
        transports,
      },
    },
  };
}

export function getPasskeyCredentialsFromUser(
  user: { extra: { two_factor_methods?: TwoFactorMethod[] } },
): PasskeyCredential[] {
  if (!user.extra.two_factor_methods) return [];

  return user.extra.two_factor_methods
    .filter((method) => method.type === 'passkey' && method.enabled && method.metadata.passkey)
    .map((method) => ({
      credentialID: method.metadata.passkey!.credential_id,
      credentialPublicKey: method.metadata.passkey!.public_key,
      counter: method.metadata.passkey!.counter || 0,
      credentialDeviceType: method.metadata.passkey!.device_type || 'unknown',
      credentialBackedUp: method.metadata.passkey!.backed_up || false,
      transports: method.metadata.passkey!.transports,
    }));
}

export function updatePasskeyCounter(
  user: { extra: { two_factor_methods?: TwoFactorMethod[] } },
  credentialID: string,
  newCounter: number,
): void {
  if (!user.extra.two_factor_methods) return;

  const method = user.extra.two_factor_methods.find(
    (m) => m.type === 'passkey' && m.metadata.passkey?.credential_id === credentialID,
  );

  if (method?.metadata.passkey) {
    method.metadata.passkey.counter = newCounter;
  }
}
