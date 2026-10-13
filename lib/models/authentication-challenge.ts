import Database, { sql } from '/lib/interfaces/database.ts';

import { AuthenticationChallenge } from '/lib/types.ts';

const db = new Database();

// Challenges only need to survive the short WebAuthn ceremony between "begin" and "verify"
const CHALLENGE_EXPIRATION_MINUTES = 5;

export class AuthenticationChallengeModel {
  /**
   * Stores an authentication challenge issued by the server, purging stale ones first so the table stays small.
   */
  static async create(challenge: string) {
    await db.query(sql`DELETE FROM "bewcloud_authentication_challenges" WHERE "expires_at" <= now()`);

    const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRATION_MINUTES * 60 * 1000);

    await db.query(
      sql`INSERT INTO "bewcloud_authentication_challenges" (
        "challenge",
        "expires_at"
      ) VALUES ($1, $2)`,
      [
        challenge,
        expiresAt,
      ],
    );

    return expiresAt;
  }

  /**
   * Atomically consumes a challenge, so it can never be verified against twice (replay protection).
   */
  static async consume(challenge: string) {
    const consumedChallenges = await db.query<AuthenticationChallenge>(
      sql`DELETE FROM "bewcloud_authentication_challenges" WHERE "challenge" = $1 AND "expires_at" > now() RETURNING "id"`,
      [challenge],
    );

    return consumedChallenges.length > 0;
  }
}
