# bewCloud

[![](https://github.com/bewcloud/bewcloud/workflows/Run%20Tests/badge.svg)](https://github.com/bewcloud/bewcloud/actions?workflow=Run+Tests)

This is the [bewCloud app](https://bewcloud.com) built with [Deno](https://deno.land/) and deployed using [docker compose](https://docs.docker.com/compose/).

If you're looking for the desktop sync app, it's at [`bewcloud-desktop`](https://github.com/bewcloud/bewcloud-desktop).

If you're looking for the mobile app, it's at [`bewcloud-mobile`](https://github.com/bewcloud/bewcloud-mobile).

## Self-host it!

[![Buy managed cloud (1 year)](https://img.shields.io/badge/Buy%20managed%20cloud%20(1%20year)-51a4fb?style=for-the-badge)](https://payment-links.mollie.com/payment/AiEHa5EpD6wkZN5r6Vs3c)

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

These are the amazing entities or individuals who are sponsoring this project for this current month. If you'd like to show up here, [check the GitHub Sponsors page](https://github.com/sponsors/bewcloud) or [make a donation](https://payment-links.mollie.com/payment/wUS9dvewvjEPvseZVHEi5) above $50 ($100 to show up on the website)!

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
make start # runs the app in development mode (watches for CSS file changes and recompiles the CSS)
make format # (optional) formats the code (if you're interested in contributing)
make test # (optional) runs tests (if you're interested in contributing)
make build # (optional) generates CSS for production, if you've made changes
```

### Other less-used commands (mostly for development)

```sh
make preview # runs the app in production mode (serves the app from the built files)
make exec-db # runs psql inside the postgres container, useful for running direct development queries like `DROP DATABASE "bewcloud"; CREATE DATABASE "bewcloud";`
```

## File/Directory Structure

- Backend routes are defined at `routes.ts`
- Publicly-available files are defined at `public/`
- Pages are defined at `pages/`.
- JSX/TSX components are defined at `components/`.
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

- [`bewcloud-nixos`](https://codeberg.org/ntninja/bewcloud-nixos/) by [@ntninja](https://codeberg.org/ntninja/) exposes bewCloud as an easy-to-use NixOS integration as an alternative to using Docker or running the app locally.
  - For installation, please see the [README](https://codeberg.org/ntninja/bewcloud-nixos/src/branch/main/README.md).
- [`bewcloud-helm`](https://github.com/loboda4450/charts/tree/main/charts/bewcloud) by [@loboda4450](https://github.com/loboda4450/) exposes bewCloud as a Helm chart.
  - For installation, please see the [README](https://github.com/loboda4450/charts/blob/main/charts/bewcloud/README.md)
  - Supports automatic migrations, Radicale installation (as a dependency chart) and streamlined, fully yaml-based configuration.
