import { PageProps } from 'fresh/server.ts';

import { FreshContextState } from '/lib/types.ts';
import { defaultDescription, defaultTitle } from '/lib/utils/misc.ts';
import Header from '/components/Header.tsx';

interface Data {}

export default function App({ route, Component, state }: PageProps<Data, FreshContextState>) {
  return (
    <html class='h-full bg-slate-800'>
      <head>
        <meta charset='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
        <title>{defaultTitle}</title>
        <meta name='description' content={defaultDescription} />
        <meta name='author' content='Bruno Bernardino' />
        <meta property='og:title' content={defaultTitle} />
        <link rel='icon' href='/images/favicon-dark.png' type='image/png' />
        <link rel='apple-touch-icon' href='/images/favicon-dark.png' />
        <link rel='stylesheet' href='/styles.css' />
        <link rel='manifest' href='/manifest.json' />
      </head>
      <body class='h-full'>
        <Header route={route} user={state.user} />
        <Component />
      </body>
    </html>
  );
}
