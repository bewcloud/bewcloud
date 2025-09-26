import { Cron } from '@hexagon/croner';

import { AppConfig } from '/lib/config.ts';
import { cleanupSessions } from './sessions.ts';
import { cleanupOldArticles, fetchNewArticles } from './news.ts';

export async function startCrons() {
  new Cron(
    // At 03:06 every day.
    '6 3 * * *',
    {
      name: 'cleanup',
      protect: true,
    },
    async () => {
      await cleanupSessions();

      if (await AppConfig.isAppEnabled('news')) {
        await cleanupOldArticles();
      }
    },
  );

  if (await AppConfig.isAppEnabled('news')) {
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
