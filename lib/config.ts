import { UserModel } from './models/user.ts';
import { Config, OptionalApp } from './types.ts';

// Helper functions for environment variable parsing
function getEnvString(key: string, defaultValue: string): string {
  return Deno.env.get(key) ?? defaultValue;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = Deno.env.get(key);
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = Deno.env.get(key);
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvStringArray(key: string, defaultValue: string[]): string[] {
  const value = Deno.env.get(key);
  if (value === undefined) return defaultValue;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export class AppConfig {
  private static config: Config;

  private static getDefaultConfig(): Config {
    return {
      auth: {
        baseUrl: getEnvString(
          'BEWCLOUD_AUTH_BASE_URL',
          'http://localhost:8000',
        ),
        allowSignups: getEnvBoolean('BEWCLOUD_AUTH_ALLOW_SIGNUPS', false),
        enableEmailVerification: getEnvBoolean(
          'BEWCLOUD_AUTH_ENABLE_EMAIL_VERIFICATION',
          false,
        ),
        enableForeverSignup: getEnvBoolean(
          'BEWCLOUD_AUTH_ENABLE_FOREVER_SIGNUP',
          true,
        ),
        enableMultiFactor: getEnvBoolean(
          'BEWCLOUD_AUTH_ENABLE_MULTI_FACTOR',
          false,
        ),
        allowedCookieDomains: getEnvStringArray(
          'BEWCLOUD_AUTH_ALLOWED_COOKIE_DOMAINS',
          [],
        ),
        skipCookieDomainSecurity: getEnvBoolean(
          'BEWCLOUD_AUTH_SKIP_COOKIE_DOMAIN_SECURITY',
          false,
        ),
        enableSingleSignOn: getEnvBoolean(
          'BEWCLOUD_AUTH_ENABLE_SINGLE_SIGN_ON',
          false,
        ),
        singleSignOnUrl: getEnvString('BEWCLOUD_AUTH_SINGLE_SIGN_ON_URL', ''),
        singleSignOnEmailAttribute: getEnvString(
          'BEWCLOUD_AUTH_SINGLE_SIGN_ON_EMAIL_ATTRIBUTE',
          'email',
        ),
        singleSignOnScopes: getEnvStringArray(
          'BEWCLOUD_AUTH_SINGLE_SIGN_ON_SCOPES',
          ['openid', 'email'],
        ),
      },
      files: {
        rootPath: getEnvString('BEWCLOUD_FILES_ROOT_PATH', 'data-files'),
        allowPublicSharing: getEnvBoolean(
          'BEWCLOUD_FILES_ALLOW_PUBLIC_SHARING',
          false,
        ),
      },
      core: {
        enabledApps: getEnvStringArray('BEWCLOUD_CORE_ENABLED_APPS', [
          'news',
          'notes',
          'photos',
          'expenses',
        ]) as OptionalApp[],
      },
      visuals: {
        title: getEnvString('BEWCLOUD_VISUALS_TITLE', ''),
        description: getEnvString('BEWCLOUD_VISUALS_DESCRIPTION', ''),
        helpEmail: getEnvString(
          'BEWCLOUD_VISUALS_HELP_EMAIL',
          'help@bewcloud.com',
        ),
      },
      email: {
        from: getEnvString('BEWCLOUD_EMAIL_FROM', 'help@bewcloud.com'),
        host: getEnvString('BEWCLOUD_EMAIL_HOST', 'localhost'),
        port: getEnvNumber('BEWCLOUD_EMAIL_PORT', 465),
      },
      contacts: {
        enableCardDavServer: getEnvBoolean(
          'BEWCLOUD_CONTACTS_ENABLE_CARDDAV_SERVER',
          true,
        ),
        cardDavUrl: getEnvString(
          'BEWCLOUD_CONTACTS_CARDDAV_URL',
          'http://127.0.0.1:5232',
        ),
      },
      calendar: {
        enableCalDavServer: getEnvBoolean(
          'BEWCLOUD_CALENDAR_ENABLE_CALDAV_SERVER',
          true,
        ),
        calDavUrl: getEnvString(
          'BEWCLOUD_CALENDAR_CALDAV_URL',
          'http://127.0.0.1:5232',
        ),
      },
    };
  }

  private static async loadConfig(): Promise<void> {
    if (this.config) {
      return;
    }

    const initialConfig = this.getDefaultConfig();

    const config: Config = {
      ...initialConfig,
    };

    try {
      const configFromFile: Config = (
        await import(`${Deno.cwd()}/bewcloud.config.ts`)
      ).default;

      this.config = {
        ...config,
        auth: {
          ...config.auth,
          ...configFromFile.auth,
        },
        files: {
          ...config.files,
          ...configFromFile.files,
        },
        core: {
          ...config.core,
          ...configFromFile.core,
        },
        visuals: {
          ...config.visuals,
          ...configFromFile.visuals,
        },
        email: {
          ...config.email,
          ...configFromFile.email,
        },
      };

      console.info(
        '\nConfig loaded from bewcloud.config.ts',
        JSON.stringify(this.config, null, 2),
        '\n',
      );

      return;
    } catch (error) {
      console.error(
        'Error loading config from bewcloud.config.ts. Using default config instead.',
        error,
      );
    }

    this.config = config;
  }

  static async getConfig(): Promise<Config> {
    await this.loadConfig();

    return this.config;
  }

  static async isSignupAllowed(): Promise<boolean> {
    await this.loadConfig();

    const areSignupsAllowed = this.config.auth.allowSignups;

    const areThereAdmins = await UserModel.isThereAnAdmin();

    if (areSignupsAllowed || !areThereAdmins) {
      return true;
    }

    return false;
  }

  static async isAppEnabled(app: OptionalApp): Promise<boolean> {
    await this.loadConfig();

    const enabledApps = this.config.core.enabledApps;

    return enabledApps.includes(app);
  }

  static async isCookieDomainAllowed(domain: string): Promise<boolean> {
    await this.loadConfig();

    const allowedDomains = this.config.auth.allowedCookieDomains;

    if (allowedDomains.length === 0) {
      return true;
    }

    return allowedDomains.includes(domain);
  }

  static async isCookieDomainSecurityDisabled(): Promise<boolean> {
    await this.loadConfig();

    return this.config.auth.skipCookieDomainSecurity;
  }

  static async isEmailVerificationEnabled(): Promise<boolean> {
    await this.loadConfig();

    return this.config.auth.enableEmailVerification;
  }

  static async isForeverSignupEnabled(): Promise<boolean> {
    await this.loadConfig();

    return this.config.auth.enableForeverSignup;
  }

  static async isMultiFactorAuthEnabled(): Promise<boolean> {
    await this.loadConfig();

    return this.config.auth.enableMultiFactor;
  }

  static async isSingleSignOnEnabled(): Promise<boolean> {
    await this.loadConfig();

    return this.config.auth.enableSingleSignOn;
  }

  static async isPublicFileSharingAllowed(): Promise<boolean> {
    await this.loadConfig();

    return this.config.files.allowPublicSharing;
  }

  static async getFilesRootPath(): Promise<string> {
    await this.loadConfig();

    const filesRootPath = `${Deno.cwd()}/${this.config.files.rootPath}`;

    return filesRootPath;
  }

  static async getEmailConfig(): Promise<Config['email']> {
    await this.loadConfig();

    return this.config.email;
  }

  static async getContactsConfig(): Promise<Config['contacts']> {
    await this.loadConfig();

    return this.config.contacts;
  }

  static async getCalendarConfig(): Promise<Config['calendar']> {
    await this.loadConfig();

    return this.config.calendar;
  }
}
