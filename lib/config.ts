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
      },
      core: {
        enabledApps: ['news', 'notes', 'photos', 'expenses'],
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
      const configFromFile: Config = (await import(`${Deno.cwd()}/bewcloud.config.ts`)).default;

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

      console.info('\nConfig loaded from bewcloud.config.ts', JSON.stringify(this.config, null, 2), '\n');

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

  static async getFilesRootPath(): Promise<string> {
    await this.loadConfig();

    const filesRootPath = `${Deno.cwd()}/${this.config.files.rootPath}`;

    return filesRootPath;
  }

  static async getEmailConfig(): Promise<Config['email']> {
    await this.loadConfig();

    return this.config.email;
  }
}
