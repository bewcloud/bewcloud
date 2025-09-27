#!/usr/bin/env -S deno run -A --watch=static/,routes/,lib/,components/,islands/

import dev from 'fresh/dev.ts';
import config from './fresh.config.ts';

import '@std/dotenv/load';

await dev(import.meta.url, './main.ts', config);
