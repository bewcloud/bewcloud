# bewCloud

[![](https://github.com/bewcloud/bewcloud/workflows/Run%20Tests/badge.svg)](https://github.com/bewcloud/bewcloud/actions?workflow=Run+Tests)

This is the [bewCloud app](https://bewcloud.com) built using [Fresh](https://fresh.deno.dev) and deployed using [docker compose](https://docs.docker.com/compose/).

If you're looking for the desktop sync app, it's at [`bewcloud-desktop`](https://github.com/bewcloud/bewcloud-desktop).

If you're looking for the mobile app, it's at [`bewcloud-mobile`](https://github.com/bewcloud/bewcloud-mobile).

## Self-host it!

[![Buy managed cloud (1 year)](https://img.shields.io/badge/Buy%20managed%20cloud%20(1%20year)-51a4fb?style=for-the-badge)](https://buy.stripe.com/eVa01HgQk0Ap0eseVz)

[![Buy managed cloud (1 month)](https://img.shields.io/badge/Buy%20managed%20cloud%20(1%20month)-51a4fb?style=for-the-badge)](https://buy.stripe.com/fZu8wOb5RfIydj56FA1gs0J)

Or, to run on your own machine, start with these commands:

```sh
mkdir data-files data-radicale radicale-config # local directories for storing user-uploaded files, radicale data, and radicale config (these last two are necessary only if you're using CalDav/CardDav/Contacts)
```

Now, download/copy the following configuration files (and tweak their contents as necessary, though no changes should yield a working — but very unsafe — setup):

- [`docker-compose.yml`](/docker-compose.yml)
- [`.env.sample`](/.env.sample) and save it as `.env`
- [`bewcloud.config.sample.ts`](/bewcloud.config.sample.ts) and save it as `bewcloud.config.ts`
- [`radicale-config/config`](/radicale-config/config) and save it as `radicale-config/config` (necessary only if you're using CalDav/CardDav/Contacts)

Finally, run these commands:

```sh
docker compose up -d # makes the app available at http://localhost:8000
docker compose run --rm website bash -c "cd /app && make migrate-db" # initializes/updates the database (only needs to be executed the first time and on any data updates)
```

> [!NOTE]
> If you run into permission issues, you can try running `sudo chown -R 1993:1993 data-files` to fix them.
>
> `1993:1993` above comes from deno's [docker image](https://github.com/denoland/deno_docker/blob/2abfe921484bdc79d11c7187a9d7b59537457c31/ubuntu.dockerfile#L20-L22) where `1993` is the default user id in it. It might change in the future since I don't control it.

If you're interested in building/contributing (or just running the app locally), check the [Development section below](#development).

See the [Community Links](#community-links) section for alternative ways of running bewCloud yourself.

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
docker compose -f docker-compose.dev.yml up # (optional) runs docker with postgres, locally
make migrate-db # runs any missing database migrations
make start # runs the app
make format # (optional) formats the code (if you're interested in contributing)
make test # (optional) runs tests (if you're interested in contributing)
```

### Other less-used commands (mostly for development)

```sh
make exec-db # runs psql inside the postgres container, useful for running direct development queries like `DROP DATABASE "bewcloud"; CREATE DATABASE "bewcloud";`
make build # generates all static files for production deploy
```

## File/Directory Structure

- Routes are defined at `routes/`.
- Static files are defined at `static/`.
- Frontend-only components are defined at `components/`.
- Isomorphic components are defined at `islands/`.
- Cron jobs are defined at `crons/`.
- Reusable bits of code are defined at `lib/`.
- Database migrations are defined at `db-migrations/`.

## Deployment

Just push to the `main` branch.

## FAQ (Frequently Asked Questions)

[Check the FAQ](/FAQ.md) for answers to common questions, like private calendar and file sharing, or `.env`-based configuration.

## How does it look?

[Check the website](https://bewcloud.com) for screenshots or [the YouTube channel](https://www.youtube.com/@bewCloud) for 1-minute demos.

## Community Links

These are not officially endorsed, but are alternative ways of running bewCloud.

- [`bewcloud-nixos`](https://gitlab.com/ntninja/bewcloud-nixos/) by [@ntninja](https://github.com/ntninja) exposes bewCloud as a NixOS integration as an alternative to using Docker or running the app locally.
  - For installation and known limitations, please see its [README](https://gitlab.com/ntninja/bewcloud-nixos/-/blob/main/README.md).
