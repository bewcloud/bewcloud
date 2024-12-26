import { Client } from 'https://deno.land/x/postgres@v0.19.2/mod.ts';
import 'std/dotenv/load.ts';

const POSTGRESQL_HOST = Deno.env.get('POSTGRESQL_HOST') || '';
const POSTGRESQL_USER = Deno.env.get('POSTGRESQL_USER') || '';
const POSTGRESQL_PASSWORD = Deno.env.get('POSTGRESQL_PASSWORD') || '';
const POSTGRESQL_DBNAME = Deno.env.get('POSTGRESQL_DBNAME') || '';
const POSTGRESQL_PORT = Deno.env.get('POSTGRESQL_PORT') || '';
const POSTGRESQL_CAFILE = Deno.env.get('POSTGRESQL_CAFILE') || '';

const tls = POSTGRESQL_CAFILE
  ? {
    enabled: true,
    enforce: false,
    caCertificates: [await Deno.readTextFile(POSTGRESQL_CAFILE)],
  }
  : {
    enabled: true,
    enforce: false,
  };

export default class Database {
  protected db?: Client;

  constructor(connectNow = false) {
    if (connectNow) {
      this.connectToPostgres();
    }
  }

  protected async connectToPostgres() {
    if (this.db) {
      return this.db;
    }

    try {
      const postgresClient = new Client({
        user: POSTGRESQL_USER,
        password: POSTGRESQL_PASSWORD,
        database: POSTGRESQL_DBNAME,
        hostname: POSTGRESQL_HOST,
        port: POSTGRESQL_PORT,
        tls,
      });

      await postgresClient.connect();

      this.db = postgresClient;
    } catch (error) {
      // Try to connect without TLS, if the connection type is socket
      if ((error as Error).toString().includes('No TLS options are allowed when host type is set to "socket"')) {
        const postgresClient = new Client({
          user: POSTGRESQL_USER,
          password: POSTGRESQL_PASSWORD,
          database: POSTGRESQL_DBNAME,
          hostname: POSTGRESQL_HOST,
          port: POSTGRESQL_PORT,
        });

        await postgresClient.connect();

        this.db = postgresClient;
      } else {
        throw error;
      }
    }
  }

  protected async disconnectFromPostgres() {
    if (!this.db) {
      return;
    }

    await this.db.end();

    this.db = undefined;
  }

  public close() {
    this.disconnectFromPostgres();
  }

  public async query<T>(sql: string, args?: any[]) {
    if (!this.db) {
      await this.connectToPostgres();
    }

    const result = await this.db!.queryObject<T>(sql, args);

    return result.rows;
  }
}

// This allows us to have nice SQL syntax highlighting in template literals
export const sql = String.raw;
