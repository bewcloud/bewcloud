import '@std/dotenv/load';

import Database, { sql } from '/lib/interfaces/database.ts';

const migrationsDirectoryPath = `${Deno.cwd()}/db-migrations`;

const migrationsDirectory = Deno.readDir(migrationsDirectoryPath);

const db = new Database({ throwOnConnectionError: true });

interface Migration {
  id: string;
  name: string;
  executed_at: Date;
}

async function getExecutedMigrations(): Promise<Set<string>> {
  const executedMigrations = new Set(
    Array.from(
      (await db.query<Migration>(sql`SELECT * FROM "bewcloud_migrations" ORDER BY "name" ASC`)).map((migration) =>
        migration.name
      ),
    ),
  );

  return executedMigrations;
}

async function getMissingMigrations(): Promise<string[]> {
  const existingMigrations: Set<string> = new Set();

  for await (const migrationFile of migrationsDirectory) {
    // Skip non-files
    if (!migrationFile.isFile) {
      continue;
    }

    // Skip files not in the "001-blah.pgsql" format
    if (!migrationFile.name.match(/^\d+-.*(\.pgsql)$/)) {
      continue;
    }

    existingMigrations.add(migrationFile.name);
  }

  // Sort migrations
  const sortedExistingMigrations = [...existingMigrations].sort();

  // Add everything to run, by default
  const migrationsToExecute = new Set([...sortedExistingMigrations]);

  try {
    const executedMigrations = await getExecutedMigrations();

    // Remove any existing migrations that were executed, from the list of migrations to execute
    for (const executedMigration of executedMigrations) {
      migrationsToExecute.delete(executedMigration);
    }
  } catch (_error) {
    // The table likely doesn't exist, so run everything.
  }

  return Array.from(migrationsToExecute).sort();
}

async function runMigrations(missingMigrations: string[]): Promise<void> {
  for (const missingMigration of missingMigrations) {
    console.log(`Running "${missingMigration}"...`);

    try {
      const migrationSql = await Deno.readTextFile(`${migrationsDirectoryPath}/${missingMigration}`);

      await db.query(migrationSql);

      await db.query(sql`INSERT INTO "public"."bewcloud_migrations" ("name", "executed_at") VALUES ($1, NOW())`, [
        missingMigration,
      ]);

      console.log('Success!');
    } catch (error) {
      console.log('Failed!');
      console.error(error);
      throw error;
    }
  }
}

try {
  const missingMigrations = await getMissingMigrations();

  await runMigrations(missingMigrations);

  if (missingMigrations.length === 0) {
    console.log('No migrations to run!');
  }

  Deno.exit(0);
} catch (error) {
  console.error(error);
  Deno.exit(1);
}
