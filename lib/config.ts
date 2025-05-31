import { UserModel } from './models/user.ts';
import { Config, OptionalApp, S3Config } from './types.ts';

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
    };
  }

  /** This allows for backwards-compatibility with the old config format, which was in the .env file. */
  private static async getLegacyConfigFromEnv(): Promise<Config> {
    const defaultConfig = this.getDefaultConfig();

    if (typeof Deno === 'undefined') {
      return defaultConfig;
    }

    await import('std/dotenv/load.ts');

    const baseUrl = Deno.env.get('BASE_URL') ?? defaultConfig.auth.baseUrl;
    const allowSignups = Deno.env.get('CONFIG_ALLOW_SIGNUPS') === 'true';
    const enabledApps = (Deno.env.get('CONFIG_ENABLED_APPS') ?? '').split(',') as OptionalApp[];
    const filesRootPath = Deno.env.get('CONFIG_FILES_ROOT_PATH') ?? defaultConfig.files.rootPath;
    const enableEmailVerification = (Deno.env.get('CONFIG_ENABLE_EMAILS') ?? 'false') === 'true';
    const enableForeverSignup = (Deno.env.get('CONFIG_ENABLE_FOREVER_SIGNUP') ?? 'true') === 'true';
    const allowedCookieDomains = (Deno.env.get('CONFIG_ALLOWED_COOKIE_DOMAINS') || '').split(',').filter(
      Boolean,
    ) as string[];
    const skipCookieDomainSecurity = Deno.env.get('CONFIG_SKIP_COOKIE_DOMAIN_SECURITY') === 'true';
    const title = Deno.env.get('CUSTOM_TITLE') ?? defaultConfig.visuals.title;
    const description = Deno.env.get('CUSTOM_DESCRIPTION') ?? defaultConfig.visuals.description;
    const helpEmail = Deno.env.get('HELP_EMAIL') ?? defaultConfig.visuals.helpEmail;

    return {
      ...defaultConfig,
      auth: {
        ...defaultConfig.auth,
        baseUrl,
        allowSignups,
        enableEmailVerification,
        enableForeverSignup,
        allowedCookieDomains,
        skipCookieDomainSecurity,
      },
      files: {
        ...defaultConfig.files,
        rootPath: filesRootPath,
      },
      core: {
        ...defaultConfig.core,
        enabledApps,
      },
      visuals: {
        ...defaultConfig.visuals,
        title,
        description,
        helpEmail,
      },
    };
  }

  private static async loadConfig(): Promise<void> {
    if (this.config) {
      return;
    }

    let initialConfig = this.getDefaultConfig();

    if (
      typeof Deno.env.get('BASE_URL') === 'string' || typeof Deno.env.get('CONFIG_ALLOW_SIGNUPS') === 'string' ||
      typeof Deno.env.get('CONFIG_ENABLED_APPS') === 'string'
    ) {
      console.warn(
        '\nDEPRECATION WARNING: .env file has config variables. This will be used but is deprecated. Please use the bewcloud.config.ts file instead.',
      );

      initialConfig = await this.getLegacyConfigFromEnv();
    }

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
      };

      console.info('\nConfig loaded from bewcloud.config.ts', JSON.stringify(this.config, null, 2), '\n');

      return;
    } catch (error) {
      console.error('Error loading config from bewcloud.config.ts. Using default and legacy config instead.', error);
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

  static async getFilesRootPath(): Promise<string> {
    await this.loadConfig();

    const filesRootPath = `${Deno.cwd()}/${this.config.files.rootPath}`;

    return filesRootPath;
  }

  static async getS3Config(): Promise<S3Config | undefined> {
    await this.loadConfig();
    // Ensure Deno namespace is available
    if (typeof Deno === 'undefined' || typeof Deno.env === 'undefined') {
      console.error('Deno environment is not available. S3 config cannot be loaded.');
      return undefined;
    }

    const bucket = Deno.env.get('S3_BUCKET');
    const region = Deno.env.get('S3_REGION');
    const accessKeyID = Deno.env.get('S3_ACCESS_KEY_ID');
    const secretAccessKey = Deno.env.get('S3_SECRET_ACCESS_KEY');
    const endpoint = Deno.env.get('S3_ENDPOINT'); // Optional

    if (!bucket || !region || !accessKeyID || !secretAccessKey) {
      console.warn(
        'S3 environment variables (S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY) are not fully set. S3 functionality may be disabled or limited.',
      );
      return undefined;
    }

    return {
      bucket,
      region,
      accessKeyID,
      secretAccessKey,
      endpoint,
    };
  }
}
