import Database, { sql } from '/lib/interfaces/database.ts';

const db = new Database();

export async function cleanupSessions() {
  const yesterday = new Date(new Date().setUTCDate(new Date().getUTCDate() - 1));

  try {
    const result = await db.query<{ count: number }>(
      sql`WITH "deleted" AS (
        DELETE FROM "bewcloud_user_sessions" WHERE "expires_at" <= $1 RETURNING *
      )
        SELECT COUNT(*) FROM "deleted"`,
      [
        yesterday.toISOString().substring(0, 10),
      ],
    );

    console.log('Deleted', result[0].count, 'user sessions');
  } catch (error) {
    console.log(error);
  }
}
