# bewCloud

[![](https://github.com/bewcloud/bewcloud/workflows/Run%20Tests/badge.svg)](https://github.com/bewcloud/bewcloud/actions?workflow=Run+Tests)

This is the [bewCloud app](https://bewcloud.com) built using [Fresh](https://fresh.deno.dev) and deployed using [docker compose](https://docs.docker.com/compose/).

> [!CAUTION]
> This is actively being built and should be considered pre-alpha. Bugs will exist. Code and models _can_ change without a good upgrade path (though I'll try to avoid that). **Don't use it as your only source of data!**

## Self-host it!

Check the [Development section below](#development).

> [!NOTE]
> You don't need to have emails (Brevo) setup to have the app work. Those are only setup and used for email verification and future needs. You can simply make any `user.status = 'active'` and `user.subscription.expires_at = new Date('2100-01-01')` to "never" expire, in the database, directly.

> [!IMPORTANT]
> Even with signups disabled (`CONFIG_ALLOW_SIGNUPS="false"`), the first signup will work and become an admin.

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
- Static frontend components are defined at `components/`.
- Interactive frontend components are defined at `islands/`.
- Cron jobs are defined at `crons/`.
- Reusable bits of code are defined at `lib/`.
- Database migrations are defined at `db-migrations/`.

## Deployment

Just push to the `main` branch.

## Tentative Roadmap:

- [x] Dashboard with URLs and Notes
- [x] News
- [ ] Files UI
- [ ] Notes UI
- [ ] Photos UI
- [ ] Desktop app for selective file sync (WebDav or potentially just `rclone` or `rsync`)
- [ ] Mobile app for offline file sync
- [ ] Add notes support for mobile app
- [ ] Add photos/sync support for mobile client
- [ ] Address `TODO:`s in code
- [ ] Basic Contacts UI via CardDav?
- [ ] Basic Calendar UI via CalDav?
- [ ] Basic Tasks UI via CalDav?

## Where's Contacts/Calendar (CardDav/CalDav)?! Wasn't this supposed to be a core Nextcloud replacement?

[Check this tag/release for more info and the code where/when that was being done](https://github.com/bewcloud/bewcloud/releases/tag/v0.0.1-self-made-carddav-caldav). Contacts/CardDav worked and Calendar/CalDav mostly worked as well at that point.

My focus is still to get me to replace Nextcloud for me and my family ASAP, but turns out it's not easy to do it all in a single, installable _thing_, so I'm focusing on the Files UI, sync, and sharing, since [Radicale](https://radicale.org/v3.html) solved my other issues better than my own solution (and it's already _very_ efficient).
