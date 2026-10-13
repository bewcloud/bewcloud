import { assertEquals } from '@std/assert';

import Database, { sql } from '/lib/interfaces/database.ts';

import { AuthenticationChallengeModel } from '/lib/models/authentication-challenge.ts';

// These tests need a reachable PostgreSQL instance (via the POSTGRESQL_* environment variables),
// so they are skipped when it isn't configured (like in CI)
const isPostgresConfigured = Boolean(Deno.env.get('POSTGRESQL_HOST'));

const db = new Database({ throwOnConnectionError: true });

async function insertChallenge(challenge: string, expiresAt: Date) {
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
}

async function isChallengeStored(challenge: string) {
  const storedChallenges = await db.query<{ challenge: string }>(
    sql`SELECT "challenge" FROM "bewcloud_authentication_challenges" WHERE "challenge" = $1`,
    [challenge],
  );

  return storedChallenges.length > 0;
}

Deno.test({
  name: 'that an authentication challenge can only be consumed once',
  ignore: !isPostgresConfigured,
  fn: async () => {
    const challenge = `test-consumed-once-${crypto.randomUUID()}`;

    await AuthenticationChallengeModel.create(challenge);

    assertEquals(await isChallengeStored(challenge), true);
    assertEquals(await AuthenticationChallengeModel.consume(challenge), true);
    assertEquals(await isChallengeStored(challenge), false);

    // A replayed verification with the same challenge must fail
    assertEquals(await AuthenticationChallengeModel.consume(challenge), false);
  },
});

Deno.test({
  name: 'that a challenge the server never issued is rejected',
  ignore: !isPostgresConfigured,
  fn: async () => {
    assertEquals(
      await AuthenticationChallengeModel.consume(`never-issued-${crypto.randomUUID()}`),
      false,
    );
  },
});

Deno.test({
  name: 'that an expired challenge is rejected',
  ignore: !isPostgresConfigured,
  fn: async () => {
    const challenge = `test-expired-${crypto.randomUUID()}`;
    const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    await insertChallenge(challenge, anHourAgo);

    assertEquals(await AuthenticationChallengeModel.consume(challenge), false);
  },
});

Deno.test({
  name: 'that stale challenges are purged when new ones are created',
  ignore: !isPostgresConfigured,
  fn: async () => {
    const staleChallenge = `test-stale-${crypto.randomUUID()}`;
    const freshChallenge = `test-fresh-${crypto.randomUUID()}`;
    const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    await insertChallenge(staleChallenge, anHourAgo);

    await AuthenticationChallengeModel.create(freshChallenge);

    assertEquals(await isChallengeStored(staleChallenge), false);
    assertEquals(await isChallengeStored(freshChallenge), true);
  },
});
