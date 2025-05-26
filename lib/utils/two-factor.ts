import { Secret, TOTP } from 'otpauth';
import QRCode from 'qrcode';
import { crypto } from 'std/crypto/mod.ts';
import { encodeBase32 } from 'std/encoding/base32.ts';
import { TwoFactorMethod, TwoFactorMethodType } from '/lib/types.ts';

export interface TwoFactorSetup {
  method: TwoFactorMethod;
  qrCodeUrl?: string;
}

export function generateTOTPSecret(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32(bytes);
}

export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const code = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 8);
    codes.push(code);
  }
  return codes;
}

export function generateMethodId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function createTOTP(secret: string, issuer: string, accountName: string): TOTP {
  return new TOTP({
    issuer,
    label: accountName,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });
}

export async function generateQRCodeDataURL(secret: string, issuer: string, accountName: string): Promise<string> {
  const totp = createTOTP(secret, issuer, accountName);
  const uri = totp.toString();
  return await QRCode.toDataURL(uri);
}

export function verifyTOTPToken(secret: string, token: string, window = 1): boolean {
  const totp = new TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });

  const currentTime = Math.floor(Date.now() / 1000);

  for (let i = -window; i <= window; i++) {
    const testTime = currentTime + (i * 30);
    const expectedToken = totp.generate({ timestamp: testTime * 1000 });
    if (expectedToken === token) {
      return true;
    }
  }

  return false;
}

export function verifyBackupCode(
  userBackupCodes: string[],
  providedCode: string,
): { isValid: boolean; remainingCodes: string[] } {
  const codeIndex = userBackupCodes.indexOf(providedCode);
  if (codeIndex === -1) {
    return { isValid: false, remainingCodes: userBackupCodes };
  }

  const remainingCodes = [...userBackupCodes];
  remainingCodes.splice(codeIndex, 1);

  return { isValid: true, remainingCodes };
}

export async function createTwoFactorMethod(
  type: TwoFactorMethodType,
  name: string,
  issuer: string,
  accountName: string,
): Promise<TwoFactorSetup> {
  const methodId = generateMethodId();

  switch (type) {
    case 'totp': {
      const secret = generateTOTPSecret();
      const backupCodes = generateBackupCodes();
      const qrCodeUrl = await generateQRCodeDataURL(secret, issuer, accountName);

      const method: TwoFactorMethod = {
        type: 'totp',
        id: methodId,
        name,
        enabled: false,
        created_at: new Date(),
        metadata: {
          totp: {
            secret,
            backup_codes: backupCodes,
          },
        },
      };

      return { method, qrCodeUrl };
    }

    case 'email': {
      const method: TwoFactorMethod = {
        type: 'email',
        id: methodId,
        name,
        enabled: false,
        created_at: new Date(),
        metadata: {
          email: {
            email: accountName,
          },
        },
      };

      return { method };
    }

    case 'passkey': {
      throw new Error('Passkey authentication is not yet implemented');
    }

    default:
      throw new Error(`Unsupported 2FA method: ${type}`);
  }
}

export function verifyTwoFactorToken(
  method: TwoFactorMethod,
  token: string,
): { isValid: boolean; remainingCodes?: string[] } {
  switch (method.type) {
    case 'totp': {
      if (!method.metadata.totp) {
        return { isValid: false };
      }

      if (token.length === 6 && /^\d+$/.test(token)) {
        const isValid = verifyTOTPToken(method.metadata.totp.secret, token);
        return { isValid };
      } else if (token.length === 8 && /^[a-fA-F0-9]+$/.test(token)) {
        const { isValid, remainingCodes } = verifyBackupCode(
          method.metadata.totp.backup_codes,
          token.toLowerCase(),
        );
        return { isValid, remainingCodes };
      }

      return { isValid: false };
    }

    case 'email': {
      throw new Error('Email 2FA verification is not yet implemented');
    }

    case 'passkey': {
      throw new Error('Passkey verification is not yet implemented');
    }

    default:
      return { isValid: false };
  }
}

export function getTwoFactorMethods(user: { extra: { two_factor_methods?: TwoFactorMethod[] } }): TwoFactorMethod[] {
  return user.extra.two_factor_methods || [];
}

export function getEnabledTwoFactorMethods(
  user: { extra: { two_factor_methods?: TwoFactorMethod[] } },
): TwoFactorMethod[] {
  return getTwoFactorMethods(user).filter((method) => method.enabled);
}

export function getTwoFactorMethodById(
  user: { extra: { two_factor_methods?: TwoFactorMethod[] } },
  id: string,
): TwoFactorMethod | undefined {
  return getTwoFactorMethods(user).find((method) => method.id === id);
}

export function hasTwoFactorEnabled(user: { extra: { two_factor_methods?: TwoFactorMethod[] } }): boolean {
  return getEnabledTwoFactorMethods(user).length > 0;
}

export function enableTwoFactorMethod(
  user: { extra: { two_factor_methods?: TwoFactorMethod[] } },
  methodId: string,
): void {
  const method = getTwoFactorMethodById(user, methodId);
  if (method) {
    method.enabled = true;
  }
}

export function disableTwoFactorMethod(
  user: { extra: { two_factor_methods?: TwoFactorMethod[] } },
  methodId: string,
): void {
  const method = getTwoFactorMethodById(user, methodId);
  if (method) {
    method.enabled = false;
  }
}

export function removeTwoFactorMethod(
  user: { extra: { two_factor_methods?: TwoFactorMethod[] } },
  methodId: string,
): void {
  if (!user.extra.two_factor_methods) {
    return;
  }

  const index = user.extra.two_factor_methods.findIndex((method) => method.id === methodId);
  if (index !== -1) {
    user.extra.two_factor_methods.splice(index, 1);
  }
}

export function verifyTOTP(secret: string, token: string): boolean {
  return verifyTOTPToken(secret, token);
}
