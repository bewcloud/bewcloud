import {
  AuthenticationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

import { MultiFactorAuthMethod, User } from '/lib/types.ts';

export interface PasskeyCredential {
  credentialID: string;
  credentialPublicKey: string;
  counter: number;
  credentialDeviceType: string;
  credentialBackedUp: boolean;
  transports?: AuthenticatorTransport[];
}

export interface PasskeySetupData {
  methodId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
}

export interface PasskeyAuthenticationData {
  options: PublicKeyCredentialCreationOptionsJSON;
}

const RP_NAME = 'bewCloud';
const RP_ID = (baseUrl: string) => {
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return 'localhost';
  }
};

const SUPPORTED_ALGORITHM_IDS = [-7, -257]; // TODO: Figure out what are these

export class PasskeyModel {
  static async generateRegistrationOptions(
    userId: string,
    email: string,
    baseUrl: string,
    existingCredentials: PasskeyCredential[] = [],
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID(baseUrl),
      userID: new TextEncoder().encode(userId),
      userName: email,
      userDisplayName: email,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map((credential) => ({
        id: credential.credentialID,
        type: 'public-key',
        transports: credential.transports || [],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
      supportedAlgorithmIDs: SUPPORTED_ALGORITHM_IDS,
    });

    return options;
  }

  static async verifyRegistration(
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
      supportedAlgorithmIDs: SUPPORTED_ALGORITHM_IDS,
    });

    return verification;
  }

  static async generateAuthenticationOptions(
    baseUrl: string,
    allowedCredentials?: PasskeyCredential[],
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    const options = await generateAuthenticationOptions({
      rpID: RP_ID(baseUrl),
      allowCredentials: allowedCredentials?.map((credential) => ({
        id: credential.credentialID,
        type: 'public-key',
        transports: credential.transports,
      })),
      userVerification: 'preferred',
    });

    return options as PublicKeyCredentialCreationOptionsJSON;
  }

  static async verifyAuthentication(
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
        transports: credential.transports,
      },
    });

    return verification;
  }

  static createMethod(
    id: string,
    name: string,
    credentialID: string,
    credentialPublicKey: string,
    counter: number,
    credentialDeviceType: string,
    credentialBackedUp: boolean,
    transports?: AuthenticatorTransport[],
  ): MultiFactorAuthMethod {
    return {
      type: 'passkey',
      id,
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

  static getCredentialsFromUser(
    user: { extra: Pick<User['extra'], 'multi_factor_auth_methods'> },
  ): PasskeyCredential[] {
    if (!user.extra.multi_factor_auth_methods) return [];

    return user.extra.multi_factor_auth_methods
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

  static updateCounterForUser(
    user: { extra: Pick<User['extra'], 'multi_factor_auth_methods'> },
    credentialID: string,
    newCounter: number,
  ): void {
    if (!user.extra.multi_factor_auth_methods) {
      return;
    }

    const method = user.extra.multi_factor_auth_methods.find(
      (method) => method.type === 'passkey' && method.metadata.passkey?.credential_id === credentialID,
    );

    if (method?.metadata.passkey) {
      method.metadata.passkey.counter = newCounter;
    }
  }
}
