import { PageProps, RouteHandler } from 'fresh';

import { FreshContextState, NewsFeed } from '/lib/types.ts';
import { FeedModel } from '/lib/models/news.ts';
import Feeds from '/islands/news/Feeds.tsx';

interface Data {
  userFeeds: NewsFeed[];
}

export const handler: RouteHandler<Data, FreshContextState> = {
  async GET(context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const userFeeds = await FeedModel.list(context.state.user.id);

    return { data: { userFeeds } };
  },
};

export default function FeedsPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <Feeds initialFeeds={data?.userFeeds || []} />
    </main>
  );
}
