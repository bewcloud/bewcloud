import { Handlers, PageProps } from 'fresh/server.ts';

import { FreshContextState, NewsFeed } from '/lib/types.ts';
import { FeedModel } from '/lib/models/news.ts';
import Feeds from '/islands/news/Feeds.tsx';

interface Data {
  userFeeds: NewsFeed[];
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const userFeeds = await FeedModel.list(context.state.user.id);

    return await context.render({ userFeeds });
  },
};

export default function FeedsPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <Feeds initialFeeds={data?.userFeeds || []} />
    </main>
  );
}
