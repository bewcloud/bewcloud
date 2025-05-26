import { Secret, TOTP } from 'otpauth';
import QRCode from 'qrcode';
import { crypto } from 'std/crypto/mod.ts';
import { encodeBase32 } from 'std/encoding/base32.ts';

export interface TOTPSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
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
