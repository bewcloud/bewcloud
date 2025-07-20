# bewCloud

[![](https://github.com/bewcloud/bewcloud/workflows/Run%20Tests/badge.svg)](https://github.com/bewcloud/bewcloud/actions?workflow=Run+Tests)

This is the [bewCloud app](https://bewcloud.com) built using [Fresh](https://fresh.deno.dev) and deployed using [docker compose](https://docs.docker.com/compose/).

If you're looking for the desktop sync app, it's at [`bewcloud-desktop`](https://github.com/bewcloud/bewcloud-desktop).

If you're looking for the mobile app, it's at [`bewcloud-mobile`](https://github.com/bewcloud/bewcloud-mobile).

## Self-host it!

[![Deploy to DigitalOcean](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/bewcloud/bewcloud)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/bewcloud/bewcloud)

[![Buy managed cloud (1 year)](https://img.shields.io/badge/Buy%20managed%20cloud%20(1%20year)-51a4fb?style=for-the-badge)](https://buy.stripe.com/eVa01HgQk0Ap0eseVz)

[![Buy managed cloud (1 month)](https://img.shields.io/badge/Buy%20managed%20cloud%20(1%20month)-51a4fb?style=for-the-badge)](https://buy.stripe.com/fZu8wOb5RfIydj56FA1gs0J)

Or on your own machine:

Download/copy [`docker-compose.yml`](/docker-compose.yml), [`.env.sample`](/.env.sample) as `.env`, and [`bewcloud.config.sample.ts`](/bewcloud.config.sample.ts) as `bewcloud.config.ts`.

> [!NOTE]
> `1993:1993` below comes from deno's [docker image](https://github.com/denoland/deno_docker/blob/2abfe921484bdc79d11c7187a9d7b59537457c31/ubuntu.dockerfile#L20-L22) where `1993` is the default user id in it. It might change in the future since I don't control it.

```sh
$ mkdir data-files data-radicale # local directories for storing user-uploaded files and radicale data
$ sudo chown -R 1993:1993 data-files # solves permission-related issues in the container with uploading files
$ docker compose up -d # makes the app available at http://localhost:8000
$ docker compose run --rm website bash -c "cd /app && make migrate-db" # initializes/updates the database (only needs to be executed the first time and on any data updates)
```

Alternatively, check the [Development section below](#development).

> [!IMPORTANT]
> Even with signups disabled (`config.auth.allowSignups=false`), the first signup will work and become an admin.

## Sponsors

These are the amazing entities or individuals who are sponsoring this project for this current month. If you'd like to show up here, [check the GitHub Sponsors page](https://github.com/sponsors/bewcloud) or [make a donation](https://donate.stripe.com/bIYeWBbw00Ape5iaFi) above $50 ($100 to show up on the website)!

<p align="center" width="100%">
  <a href="https://nlnet.nl/project/bewCloud/" title="NLnet Foundation">
    <img src="https://nlnet.nl/logo/banner.svg" alt="NLnet Foundation" width="256" />
  </a>
</p>

## Development

### Requirements

> [!IMPORTANT]
> Don't forget to set up your `.env` file based on `.env.sample`.
> Don't forget to set up your `bewcloud.config.ts` file based on `bewcloud.config.sample.ts`.

- This was tested with [`Deno`](https://deno.land)'s version stated in the `.dvmrc` file, though other versions may work.
- For the postgres dependency (used when running locally or in CI), you should have `Docker` and `docker compose` installed.

### Commands

```sh
$ docker compose -f docker-compose.dev.yml up # (optional) runs docker with postgres, locally
$ make migrate-db # runs any missing database migrations
$ make start # runs the app
$ make format # formats the code
$ make test # runs tests
```

### Other less-used commands

```sh
$ make exec-db # runs psql inside the postgres container, useful for running direct development queries like `DROP DATABASE "bewcloud"; CREATE DATABASE "bewcloud";`
$ make build # generates all static files for production deploy
```

## Structure

- Routes defined at `routes/`.
- Static files are defined at `static/`.
- Frontend-only components are defined at `components/`.
- Isomorphic components are defined at `islands/`.
- Cron jobs are defined at `crons/`.
- Reusable bits of code are defined at `lib/`.
- Database migrations are defined at `db-migrations/`.

## Deployment

Just push to the `main` branch.

## How does Contacts/CardDav and Calendar/CalDav work?

CalDav/CardDav is now available since [v2.3.0](https://github.com/bewcloud/bewcloud/releases/tag/v2.3.0), using [Radicale](https://radicale.org/v3.html) via Docker, which is already _very_ efficient (and battle-tested). The clients are not yet implemented. [Check this tag/release for custom-made server and clients where it was all mostly working, except for many edge cases](https://github.com/bewcloud/bewcloud/releases/tag/v0.0.1-self-made-carddav-caldav).

In order to share a calendar, you can either have a shared user, or you can symlink the calendar to the user's own calendar (simply `ln -s /<absolute-path-to-data-radicale>/collections/collection-root/<owner-user-id>/<calendar-to-share> /<absolute-path-to-data-radicale>/collections/collection-root/<user-id-to-share-with>/`).

> [!NOTE]
> If you're running radicale with docker, the symlink needs to point to the container's directory, usually starting with `/data` if you didn't change the `radicale-config/config`, otherwise the container will fail to load the linked directory.

## How does private file sharing work?

Public file sharing is now possible since [v2.2.0](https://github.com/bewcloud/bewcloud/releases/tag/v2.2.0). [Check this PR for advanced sharing with internal and external users, with read and write access that was being done and almost working](https://github.com/bewcloud/bewcloud/pull/4). I ditched all that complexity for simply using [symlinks](https://en.wikipedia.org/wiki/Symbolic_link) for internal sharing, as it served my use case (I have multiple data backups and trust the people I provide accounts to, with the symlinks).

You can simply `ln -s /<absolute-path-to-data-files>/<owner-user-id>/<directory-to-share> /<absolute-path-to-data-files>/<user-id-to-share-with>/` to create a shared directory between two users, and the same directory can have different names, now.

> [!NOTE]
> If you're running the app with docker, the symlink needs to point to the container's directory, usually starting with `/app` if you didn't change the `Dockerfile`, otherwise the container will fail to load the linked directory.

## How does it look?

[Check the website](https://bewcloud.com) for screenshots or [the YouTube channel](https://www.youtube.com/@bewCloud) for 1-minute demos.
