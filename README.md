# bewCloud

[![](https://github.com/bewcloud/bewcloud/workflows/Run%20Tests/badge.svg)](https://github.com/bewcloud/bewcloud/actions?workflow=Run+Tests)

This is the [bewCloud app](https://bewcloud.com) built using [Fresh](https://fresh.deno.dev) and deployed using [docker compose](https://docs.docker.com/compose/).

> [!CAUTION]
> This is actively being built and should be considered pre-alpha. Bugs will exist. Code and models _can_ change without a good upgrade path (though I'll try to avoid that). **Don't use it as your only source of data!**

## Self-host it!

Download/copy [`docker-compose.yml`](/docker-compose.yml) and [`.env.sample`](/.env.sample) as `.env`.

```sh
$ docker compose up # makes the app available at http://localhost:8000
$ docker compose run website bash -c "cd /app && make migrate-db" # initializes/updates the database (only needs to be executed the first time and on any updates)
```

Alternatively, check the [Development section below](#development).

> [!IMPORTANT]
> Even with signups disabled (`CONFIG_ALLOW_SIGNUPS="false"`), the first signup will work and become an admin.

## Requirements

This was tested with [`Deno`](https://deno.land)'s version stated in the `.dvmrc` file, though other versions may work.

For the postgres dependency (used when running locally or in CI), you should have `Docker` and `docker compose` installed.

Don't forget to set up your `.env` file based on `.env.sample`.

## Development

```sh
$ docker compose -f docker-compose.dev.yml up # (optional) runs docker with postgres, locally
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

## Tentative Roadmap for a v1 beta:

- [x] Dashboard with URLs and Notes
- [x] News
- [x] Files UI
- [x] WebDav Server
- [x] [Desktop app for selective file sync](https://github.com/bewcloud/bewcloud-desktop/releases) (`rclone` via WebDav)
- [ ] Mobile app for offline file view (WebDav client)
- [ ] Add photo auto-uplod support for mobile client
- [ ] Add notes view support for mobile app
- [ ] Add notes edit support for mobile app
- [ ] Notes UI
- [ ] Photos UI
- [ ] Address `TODO:`s in code

## Where's Contacts/Calendar (CardDav/CalDav)?! Wasn't this supposed to be a core Nextcloud replacement?

[Check this tag/release for more info and the code where/when that was being done](https://github.com/bewcloud/bewcloud/releases/tag/v0.0.1-self-made-carddav-caldav). Contacts/CardDav worked and Calendar/CalDav mostly worked as well at that point.

My focus is still to get me to replace Nextcloud for me and my family ASAP, but turns out it's not easy to do it all in a single, installable _thing_, so I'm focusing on the Files UI, sync, and sharing, since [Radicale](https://radicale.org/v3.html) solved my other issues better than my own solution (and it's already _very_ efficient).

## How does file sharing work?

[Check this PR for advanced sharing with internal and external users, with read and write access that was being done and almost working](https://github.com/bewcloud/bewcloud/pull/4). I ditched all that complexity for simply using [symlinks](https://en.wikipedia.org/wiki/Symbolic_link), as it served my use case (I have multiple data backups and trust the people I provide accounts to, with the symlinks).

You can simply `ln -s /<absolute-path-to-data-files>/<owner-user-id>/<directory-to-share> /<absolute-path-to-data-files>/<user-id-to-share-with>/` to create a shared directory between two users, and the same directory can have different names, now.
