import { Secret, TOTP } from 'otpauth';
import QRCode from 'qrcode';
import { encodeBase32 } from 'std/encoding/base32';
import { decodeBase64, encodeBase64 } from 'std/encoding/base64';

import { MultiFactorAuthMethod } from '/lib/types.ts';
import { MFA_KEY, MFA_SALT } from '/lib/auth.ts';
import { generateHash } from '/lib/utils/misc.ts';
import { MultiFactorAuthSetup } from '/lib/models/multi-factor-auth.ts';

export class TOTPModel {
  private static async getEncryptionKey(): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(MFA_KEY),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode(MFA_SALT),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  private static generateBackupCodes(count = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const bytes = new Uint8Array(4);
      crypto.getRandomValues(bytes);
      const code = Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
        .substring(0, 8);
      codes.push(code);
    }
    return codes;
  }

  private static async hashBackupCodes(codes: string[]): Promise<string[]> {
    const hashedCodes: string[] = [];
    for (const code of codes) {
      const hashedCode = await generateHash(`${code}:${MFA_SALT}`, 'SHA-256');
      hashedCodes.push(hashedCode);
    }
    return hashedCodes;
  }

  private static async verifyBackupCodeHash(
    code: string,
    hashedCodes: string[],
  ): Promise<{ isValid: boolean; codeIndex: number }> {
    const hashedInput = await generateHash(`${code}:${MFA_SALT}`, 'SHA-256');
    const codeIndex = hashedCodes.indexOf(hashedInput);
    return { isValid: codeIndex !== -1, codeIndex };
  }

  private static async verifyBackupCodeHashed(
    hashedBackupCodes: string[],
    providedCode: string,
  ): Promise<{ isValid: boolean; remainingCodes: string[] }> {
    const { isValid, codeIndex } = await this.verifyBackupCodeHash(providedCode, hashedBackupCodes);

    if (!isValid) {
      return { isValid: false, remainingCodes: hashedBackupCodes };
    }

    const remainingCodes = [...hashedBackupCodes];
    remainingCodes.splice(codeIndex, 1);

    return { isValid: true, remainingCodes };
  }

  private static async encryptTOTPSecret(secret: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedSecret = new TextEncoder().encode(secret);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedSecret,
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return encodeBase64(combined);
  }

  static async decryptTOTPSecret(encryptedSecret: string): Promise<string> {
    const key = await this.getEncryptionKey();
    const combined = decodeBase64(encryptedSecret);
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted,
    );

    return new TextDecoder().decode(decrypted);
  }

  private static generateTOTPSecret(): string {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    return encodeBase32(bytes);
  }

  private static createTOTP(secret: string, issuer: string, accountName: string): TOTP {
    return new TOTP({
      issuer,
      label: accountName,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });
  }

  private static async generateQRCodeDataURL(secret: string, issuer: string, accountName: string): Promise<string> {
    const totp = this.createTOTP(secret, issuer, accountName);
    const uri = totp.toString();
    return await QRCode.toDataURL(uri);
  }

  private static verifyTOTPToken(secret: string, token: string, window = 1): boolean {
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

  static async createMethod(
    id: string,
    name: string,
    issuer: string,
    accountName: string,
  ): Promise<MultiFactorAuthSetup> {
    const secret = this.generateTOTPSecret();
    const backupCodes = this.generateBackupCodes();
    const qrCodeUrl = await this.generateQRCodeDataURL(secret, issuer, accountName);

    const encryptedSecret = await this.encryptTOTPSecret(secret);
    const hashedBackupCodes = await this.hashBackupCodes(backupCodes);

    const method: MultiFactorAuthMethod = {
      type: 'totp',
      id,
      name,
      enabled: false,
      created_at: new Date(),
      metadata: {
        totp: {
          hashed_secret: encryptedSecret,
          hashed_backup_codes: hashedBackupCodes,
        },
      },
    };

    return {
      method,
      qrCodeUrl,
      plainTextSecret: secret,
      plainTextBackupCodes: backupCodes,
    };
  }

  static async verifyMethodToken(
    metadata: MultiFactorAuthMethod['metadata'],
    token: string,
  ): Promise<{ isValid: boolean; remainingCodes?: string[] }> {
    if (!metadata.totp) {
      return { isValid: false };
    }

    const { totp } = metadata;

    if (token.length === 6 && /^\d+$/.test(token)) { // Try the TOTP first
      try {
        const decryptedSecret = await this.decryptTOTPSecret(totp.hashed_secret);
        const isValid = this.verifyTOTPToken(decryptedSecret, token);
        return { isValid };
      } catch {
        return { isValid: false };
      }
    } else if (token.length === 8 && /^[a-fA-F0-9]+$/.test(token)) { // Otherwise, try the backup codes
      const { isValid, remainingCodes } = await this.verifyBackupCodeHashed(
        totp.hashed_backup_codes,
        token.toLowerCase(),
      );
      return { isValid, remainingCodes };
    }

    return { isValid: false };
  }

  static verifyTOTP(secret: string, token: string): boolean {
    return this.verifyTOTPToken(secret, token);
  }
}
