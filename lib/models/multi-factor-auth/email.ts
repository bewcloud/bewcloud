import { MultiFactorAuthMethod, User } from '/lib/types.ts';
import { MultiFactorAuthSetup } from '/lib/models/multi-factor-auth.ts';
import { VerificationCodeModel } from '/lib/models/user.ts';
import { EmailModel as EmailTransportModel } from '/lib/models/email.ts';

export class EmailModel {
  static async createMethod(
    id: string,
    name: string,
    user: User,
  ): Promise<MultiFactorAuthSetup> {
    const method: MultiFactorAuthMethod = {
      type: 'email',
      id,
      name,
      enabled: false,
      created_at: new Date(),
      metadata: {},
    };

    await this.createAndSendCode(id, user);

    return {
      method,
    };
  }

  static async createAndSendCode(
    id: string,
    user: User,
  ): Promise<void> {
    const code = await VerificationCodeModel.create(user, `${user.email}-${id}`, 'email');

    await EmailTransportModel.sendLoginVerificationEmail(user.email, code);
  }

  static async verifyCode(
    methodId: string,
    code: string,
    user: User,
  ): Promise<boolean> {
    try {
      await VerificationCodeModel.validate(user, `${user.email}-${methodId}`, code, 'email');

      return true;
    } catch {
      return false;
    }
  }
}
