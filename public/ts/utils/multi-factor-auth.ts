// This file contains some multi-factor authentication utilities that are isomorphic.

import { MultiFactorAuthMethod, User } from '/lib/types.ts';

function getMultiFactorAuthMethodsFromUser(
  user: { extra: Pick<User['extra'], 'multi_factor_auth_methods'> },
): MultiFactorAuthMethod[] {
  return user.extra.multi_factor_auth_methods || [];
}

export function getEnabledMultiFactorAuthMethodsFromUser(
  user: { extra: Pick<User['extra'], 'multi_factor_auth_methods'> },
): MultiFactorAuthMethod[] {
  return getMultiFactorAuthMethodsFromUser(user).filter((method) => method.enabled);
}

export function getMultiFactorAuthMethodByIdFromUser(
  user: { extra: Pick<User['extra'], 'multi_factor_auth_methods'> },
  id: string,
): MultiFactorAuthMethod | undefined {
  return getMultiFactorAuthMethodsFromUser(user).find((method) => method.id === id);
}

export function isMultiFactorAuthEnabledForUser(
  user: { extra: Pick<User['extra'], 'multi_factor_auth_methods'> },
): boolean {
  return getEnabledMultiFactorAuthMethodsFromUser(user).length > 0;
}
