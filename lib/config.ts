import { UserModel } from './models/user.ts';
import { Config, OptionalApp } from './types.ts';
import { Client } from 'postgres';

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
      contacts: {
        enableCardDavServer: true,
        cardDavUrl: 'http://127.0.0.1:5232',
      },
      calendar: {
        enableCalDavServer: true,
        calDavUrl: 'http://127.0.0.1:5232',
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
    } finally {
      try {
        const configFromJson = (await fetch('http://supervisor/addons/self/options/config', {
            headers: {
                Authorization: `Bearer ${Deno.env.get('SUPERVISOR_TOKEN')}`,
                'Content-Type': 'application/json'
            }
        }).then(res => {
            if (res.ok) {
                return res.json();
            } else {
                throw new Error(`Response status: ${res.status}`);
            }
        })).data;
        this.config = {
          auth: {
            baseUrl: configFromJson.baseUrl ?? config.auth.baseUrl,
            allowSignups: configFromJson.allowSignups ?? config.auth.allowSignups,
            enableEmailVerification: configFromJson.enableEmailVerification ?? config.auth.enableEmailVerification,
            enableForeverSignup: configFromJson.enableForeverSignup ?? config.auth.enableForeverSignup,
            enableMultiFactor: configFromJson.enableMultiFactor ?? config.auth.enableMultiFactor,
            allowedCookieDomains: configFromJson.allowedCookieDomains ?? config.auth.allowedCookieDomains,
            skipCookieDomainSecurity: configFromJson.skipCookieDomainSecurity ?? config.auth.skipCookieDomainSecurity,
            enableSingleSignOn: configFromJson.enableSingleSignOn ?? config.auth.enableSingleSignOn,
            singleSignOnUrl: configFromJson.singleSignOnUrl ?? config.auth.singleSignOnUrl,
            singleSignOnEmailAttribute: configFromJson.singleSignOnEmailAttribute ?? config.auth.singleSignOnEmailAttribute,
            singleSignOnScopes: configFromJson.singleSignOnScopes ?? config.auth.singleSignOnScopes,
          },
          files: {
            rootPath: configFromJson.rootPath ?? config.files.rootPath,
            allowPublicSharing: configFromJson.rootPath ?? config.files.rootPath,
          },
          core: {
            enabledApps: configFromJson.enabledApps ?? config.core.enabledApps,
          },
          visuals: {
            title: configFromJson.title ?? config.visuals.title,
            description: configFromJson.description ?? config.visuals.description,
            helpEmail: configFromJson.helpEmail ?? config.visuals.helpEmail,
          },
          email: {
            from: configFromJson.from ?? config.email.from,
            host: configFromJson.host ?? config.email.host,
            port: configFromJson.port ?? config.email.port,
          },
          contacts: {
            enableCardDavServer: configFromJson.enableCardDavServer ?? config.contacts.enableCardDavServer,
            cardDavUrl: configFromJson.cardDavUrl ?? config.contacts.cardDavUrl,
          },
          calendar: {
            enableCalDavServer: configFromJson.enableCalDavServer ?? config.calendar.enableCalDavServer,
            calDavUrl: configFromJson.calDavUrl ?? config.calendar.calDavUrl,
          },
        };
        console.info('\nConfig loaded from config.json', JSON.stringify(this.config, null, 2), '\n');

        const newOptions: Record<string, any> = {};
        if (configFromJson.runDropCreateDB === true) {
            let db: Client;
            const tls = configFromJson.POSTGRESQL_CAFILE
              ? {
                enabled: true,
                enforce: false,
                caCertificates: [await Deno.readTextFile(configFromJson.POSTGRESQL_CAFILE)],
              }
              : {
                enabled: true,
                enforce: false,
              };
            try {
              const postgresClient = new Client({
                user: configFromJson.POSTGRESQL_USER,
                password: configFromJson.POSTGRESQL_PASSWORD,
                database: 'postgres',
                hostname: configFromJson.POSTGRESQL_HOST,
                port: configFromJson.POSTGRESQL_PORT,
                tls,
              });
        
              await postgresClient.connect();
        
              db = postgresClient;
            } catch (error) {
              // Try to connect without TLS, if the connection type is socket
              if ((error as Error).toString().includes('No TLS options are allowed when host type is set to "socket"')) {
                const postgresClient = new Client({
                  user: configFromJson.POSTGRESQL_USER,
                  password: configFromJson.POSTGRESQL_PASSWORD,
                  database: 'postgres',
                  hostname: configFromJson.POSTGRESQL_HOST,
                  port: configFromJson.POSTGRESQL_PORT,
                });
        
                await postgresClient.connect();
        
                db = postgresClient;
              } else {
                console.log('Failed to connect to Postgres!');
                console.error(error);
        
                // This allows tests (and the app) to work even if Postgres is not available
                const mockPostgresClient = {
                  queryObject: () => {
                    return {
                      rows: [],
                    };
                  },
                } as unknown as Client;
        
                db = mockPostgresClient;
              }
            }
            await db!.queryArray`DROP DATABASE IF EXISTS "bewcloud"`
            await db!.queryArray`CREATE DATABASE "bewcloud"`;
            await db!.end();
            db = undefined;
            newOptions.runMigrateDB = false;
        }
        if (configFromJson.runMigrateDB === true) {
            const command = new Deno.Command("make", {
                args: [
                    "migrate-db",
                ],
            });
            const { code, stdout, stderr } = await command.output();
            console.log(new TextDecoder().decode(stdout));
            console.log(new TextDecoder().decode(stderr));
            if (code === 0) {
                newOptions.runMigrateDB = false;
            }
        }
        await fetch('http://supervisor/addons/self/options', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${Deno.env.get('SUPERVISOR_TOKEN')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                options: {
                    ...configFromJson,
                    ...newOptions
                }
            })
        });
      } catch (error) {
        console.error('Error loading config from config.json. Using default config instead unless bewcloud.config.ts loaded correctly.', error);
      }
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
