import { Cron } from 'https://deno.land/x/croner@8.1.2/dist/croner.js';

import { isAppEnabled } from '/lib/config.ts';
import { cleanupSessions } from './sessions.ts';
import { cleanupOldArticles, fetchNewArticles } from './news.ts';

export function startCrons() {
  new Cron(
    // At 03:06 every day.
    '6 3 * * *',
    {
      name: 'cleanup',
      protect: true,
    },
    async () => {
      await cleanupSessions();

      if (isAppEnabled('news')) {
        await cleanupOldArticles();
      }
    },
  );

  if (isAppEnabled('news')) {
    new Cron(
      // Every 30 minutes.
      '*/30 * * * *',
      {
        name: 'news',
        protect: true,
      },
      async () => {
        await fetchNewArticles();
      },
    );
  }

  console.log('Crons starting...');
}
