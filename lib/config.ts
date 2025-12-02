import { toFileUrl } from '@std/path';
import { UserModel } from './models/user.ts';
import { Config, OptionalApp } from './types.ts';

export class AppConfig {
  private static config: Config;

  private static getDefaultConfig(): Config {
    return {
      auth: {
        baseUrl: 'http://localhost:8000',
        allowSignups: false,
        enableEmailVerification: false,
        enableForeverSignup: true,
        enableMultiFactor: false,
        allowedCookieDomains: [],
        skipCookieDomainSecurity: false,
        enableSingleSignOn: false,
        singleSignOnUrl: '',
        singleSignOnEmailAttribute: 'email',
        singleSignOnScopes: ['openid', 'email'],
      },
      files: {
        rootPath: 'data-files',
        allowPublicSharing: false,
        allowDirectoryDownloads: false,
      },
      core: {
        enabledApps: ['dashboard', 'files', 'news', 'notes', 'photos', 'expenses', 'contacts', 'calendar'],
      },
      visuals: {
        title: '',
        description: '',
        helpEmail: 'help@bewcloud.com',
      },
      email: {
        from: 'help@bewcloud.com',
        host: 'localhost',
        port: 465,
      },
      contacts: {
        enableCardDavServer: true,
        cardDavUrl: 'http://radicale:5232',
      },
      calendar: {
        enableCalDavServer: true,
        calDavUrl: 'http://radicale:5232',
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
      const configPath = toFileUrl(`${Deno.cwd()}/bewcloud.config.ts`).href;
      const configFromFile: Config = (await import(configPath)).default;

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
        contacts: {
          ...config.contacts,
          ...configFromFile.contacts,
        },
        calendar: {
          ...config.calendar,
          ...configFromFile.calendar,
        },
      };

      console.info('\nConfig loaded from bewcloud.config.ts', JSON.stringify(this.config, null, 2), '\n');

      if (this.config.core.enabledApps.length === 0) {
        throw new Error('At least one app must be enabled. Please check the config.core.enabledApps array.');
      }

      return;
    } catch (error) {
      console.error('Error loading config from bewcloud.config.ts. Using default config instead.', error);
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

  static async areDirectoryDownloadsAllowed(): Promise<boolean> {
    await this.loadConfig();

    return this.config.files.allowDirectoryDownloads;
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
