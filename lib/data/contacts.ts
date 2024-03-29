import Database, { sql } from '/lib/interfaces/database.ts';
import { Contact } from '/lib/types.ts';
import { CONTACTS_PER_PAGE_COUNT } from '/lib/utils/contacts.ts';
import { updateUserContactRevision } from './user.ts';

const db = new Database();

export async function getContacts(userId: string, pageIndex: number) {
  const contacts = await db.query<Pick<Contact, 'id' | 'first_name' | 'last_name'>>(
    sql`SELECT "id", "first_name", "last_name" FROM "bewcloud_contacts" WHERE "user_id" = $1 ORDER BY "first_name" ASC, "last_name" ASC LIMIT ${CONTACTS_PER_PAGE_COUNT} OFFSET $2`,
    [
      userId,
      pageIndex * CONTACTS_PER_PAGE_COUNT,
    ],
  );

  return contacts;
}

export async function getContactsCount(userId: string) {
  const results = await db.query<{ count: number }>(
    sql`SELECT COUNT("id") AS "count" FROM "bewcloud_contacts" WHERE "user_id" = $1`,
    [
      userId,
    ],
  );

  return Number(results[0]?.count || 0);
}

export async function searchContacts(searchTerm: string, userId: string, pageIndex: number) {
  const contacts = await db.query<Pick<Contact, 'id' | 'first_name' | 'last_name'>>(
    sql`SELECT "id", "first_name", "last_name" FROM "bewcloud_contacts" WHERE "user_id" = $1 AND ("first_name" ILIKE $3 OR "last_name" ILIKE $3 OR "extra"::text ILIKE $3) ORDER BY "first_name" ASC, "last_name" ASC LIMIT ${CONTACTS_PER_PAGE_COUNT} OFFSET $2`,
    [
      userId,
      pageIndex * CONTACTS_PER_PAGE_COUNT,
      `%${searchTerm.split(' ').join('%')}%`,
    ],
  );

  return contacts;
}

export async function searchContactsCount(search: string, userId: string) {
  const results = await db.query<{ count: number }>(
    sql`SELECT COUNT("id") AS "count" FROM "bewcloud_contacts" WHERE "user_id" = $1 AND ("first_name" ILIKE $2 OR "last_name" ILIKE $2 OR "extra"::text ILIKE $2)`,
    [
      userId,
      `%${search}%`,
    ],
  );

  return Number(results[0]?.count || 0);
}

export async function getAllContacts(userId: string) {
  const contacts = await db.query<Contact>(sql`SELECT * FROM "bewcloud_contacts" WHERE "user_id" = $1`, [
    userId,
  ]);

  return contacts;
}

export async function getContact(id: string, userId: string) {
  const contacts = await db.query<Contact>(
    sql`SELECT * FROM "bewcloud_contacts" WHERE "id" = $1 AND "user_id" = $2 LIMIT 1`,
    [
      id,
      userId,
    ],
  );

  return contacts[0];
}

export async function createContact(userId: string, firstName: string, lastName: string) {
  const extra: Contact['extra'] = {};

  const revision = crypto.randomUUID();

  const newContact = (await db.query<Contact>(
    sql`INSERT INTO "bewcloud_contacts" (
      "user_id",
      "revision",
      "first_name",
      "last_name",
      "extra"
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [
      userId,
      revision,
      firstName,
      lastName,
      JSON.stringify(extra),
    ],
  ))[0];

  await updateUserContactRevision(userId);

  return newContact;
}

export async function updateContact(contact: Contact) {
  const revision = crypto.randomUUID();

  await db.query(
    sql`UPDATE "bewcloud_contacts" SET
        "revision" = $3,
        "first_name" = $4,
        "last_name" = $5,
        "extra" = $6,
        "updated_at" = now()
      WHERE "id" = $1 AND "revision" = $2`,
    [
      contact.id,
      contact.revision,
      revision,
      contact.first_name,
      contact.last_name,
      JSON.stringify(contact.extra),
    ],
  );

  await updateUserContactRevision(contact.user_id);
}

export async function deleteContact(id: string, userId: string) {
  await db.query(
    sql`DELETE FROM "bewcloud_contacts" WHERE "id" = $1 AND "user_id" = $2`,
    [
      id,
      userId,
    ],
  );

  await updateUserContactRevision(userId);
}
