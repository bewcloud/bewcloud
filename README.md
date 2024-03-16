# bewCloud

[![](https://github.com/bewcloud/bewcloud/workflows/Run%20Tests/badge.svg)](https://github.com/bewcloud/bewcloud/actions?workflow=Run+Tests)

This is the [bewCloud app](https://bewcloud.com) built using [Fresh](https://fresh.deno.dev) and deployed using [docker compose](https://docs.docker.com/compose/).

## Self-host it!

Check the [Development section below](#development).

> **NOTE:** You don't need to have emails (Brevo) setup to have the app work. Those are only setup and used for email verification and future needs. You can simply make any `user.status = 'active'` and `user.subscription.expires_at = new Date('2100-01-01')` to "never" expire, in the database, directly.

> **NOTE 2:** Even with signups disabled (`CONFIG_ALLOW_SIGNUPS="false"`), the first signup will work and become an admin.

## Requirements

This was tested with [`Deno`](https://deno.land)'s version stated in the `.dvmrc` file, though other versions may work.

For the postgres dependency (used when running locally or in CI), you should have `Docker` and `docker compose` installed.

Don't forget to set up your `.env` file based on `.env.sample`.

## Development

```sh
$ docker compose up # (optional) runs docker with postgres, locally
$ make migrate-db # runs any missing database migrations
$ make start # runs the app
$ make format # formats the code
$ make test # runs tests
```

## Other less-used commands

```sh
$ make exec-db # runs psql inside the postgres container, useful for running direct development queries like `DROP DATABASE "bewcloud"; CREATE DATABASE "bewcloud";`
$ make build # generates all static files for production deploy
```

## Structure

- Routes defined at `routes/`.
- Static files are defined at `static/`.
- Static frontent components are defined at `components/`.
- Interactive frontend components are defined at `islands/`.
- Cron jobs are defined at `crons/`.
- Reusable bits of code are defined at `lib/`.
- Database migrations are defined at `db-migrations/`.

## Deployment

Just push to the `main` branch.

## Tentative Roadmap:

- [x] Dashboard with URLs and Notes
- [x] News
- [x] Contacts / CardDav
- [ ] Calendar / CalDav
- [ ] Tasks / CalDav
- [ ] Files / WebDav
- [ ] Notes / WebDav
- [ ] Photos / WebDav
- [ ] Desktop app for selective file sync (or potentially just `rclone`)
- [ ] Mobile app for offline file sync
- [ ] Add notes support for mobile app
- [ ] Add photos/sync support for mobile client
- [ ] Address `TODO:`s in code
