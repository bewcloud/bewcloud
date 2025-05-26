import { TwoFactorMethod } from '../types.ts';

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
