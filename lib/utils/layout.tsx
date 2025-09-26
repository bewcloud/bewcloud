import { renderToString } from 'preact-render-to-string';
import { VNode } from 'preact';

import { RequestHandlerParams } from '/lib/page.ts';
import { AppConfig } from '/lib/config.ts';
import { escapeHtml, html, validateUrl } from '/lib/utils/misc.ts';

import Header from '/components/Header.tsx';

interface BasicLayoutOptions
  extends Pick<RequestHandlerParams, 'user' | 'session' | 'request' | 'match' | 'isRunningLocally'> {
  currentPath: string;
  titlePrefix: string;
  description?: string;
}

async function basicLayout(
  htmlContent: string,
  { currentPath, titlePrefix, description, user }: BasicLayoutOptions,
) {
  const config = await AppConfig.getConfig();

  const defaultTitle = config.visuals.title || 'bewCloud is a modern and simpler alternative to Nextcloud and ownCloud';
  const defaultDescription = config.visuals.description || `Have your files under your own control.`;
  const enabledApps = config.core.enabledApps;

  let title = defaultTitle;

  if (titlePrefix) {
    title = `${titlePrefix} - bewCloud`;
  }

  const headerReactNode = <Header route={currentPath} user={user} enabledApps={enabledApps} />;

  const headerHtml = renderToString(headerReactNode);

  return html`
    <!DOCTYPE html>
    <html lang="pt" dir="ltr" class="h-full bg-slate-800">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(title)}</title>
        <meta name="description" content="${escapeHtml(description || defaultDescription)}">
        <meta name="author" content="Bruno Bernardino">
        <meta property="og:title" content="{defaultTitle}" />
        <link rel="icon" href="/public/images/favicon-dark.png" type="image/png" />
        <link rel="apple-touch-icon" href="/public/images/favicon-dark.png" />
        <link rel="manifest" href="/public/manifest.json">
        <link rel="stylesheet" href="/public/scss/style.scss">
        <link rel="stylesheet" href="/public/css/tailwind.css">
      </head>

      <script type="importmap">
      {
        "imports": {
          "preact": "https://esm.sh/preact@10.27.0",
          "preact/": "https://esm.sh/preact@10.27.0/",
          "@preact/signals": "https://esm.sh/*@preact/signals@2.3.1?deps=preact@10.27.0",
          "@preact/signals-core": "https://esm.sh/*@preact/signals-core@1.12.1?deps=preact@10.27.0"
        }
      }
      </script>

      <body class="h-full">
        ${headerHtml} ${htmlContent}
      </body>
    </html>
  `;
}

export async function basicLayoutResponse(htmlContent: string, options: BasicLayoutOptions) {
  const headers: HeadersInit = {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy':
      `default-src 'self'; child-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://esm.sh/preact@10.27.0 https://esm.sh/preact@10.27.0/ https://esm.sh/*@preact/signals@2.3.1 https://esm.sh/*@preact/signals@2.3.1/ https://esm.sh/*@preact/signals-core@1.12.1 https://esm.sh/*@preact/signals-core@1.12.1/`,
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
  };

  return new Response(await basicLayout(htmlContent, options), {
    headers,
  });
}

export function renderHydratableComponent(
  Component: (...args: any[]) => VNode<any>,
  props: Record<string, any> = {},
): VNode {
  const componentHtml = renderToString(<Component {...props} />);

  const componentId = crypto.randomUUID();

  const htmlContent = html`
    <div id="${componentId}">${componentHtml}</div>

    <script type="module">
    // These imports are necessary to hydrate any component
    import { createElement, hydrate } from 'preact';
    import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'preact/jsx-runtime';

    // These imports are necessary by some components which are hydrated
    import { useSignal, useSignalEffect } from '@preact/signals';
    import { useEffect } from 'preact/hooks';

    // These functions are necessary by some components which are hydrated
    ${validateUrl.toString()}

    // This hydrates the component
    const Component = ${Component.toString()};

    hydrate(createElement(Component, ${JSON.stringify(props)}), document.getElementById('${componentId}'));
    </script>
  `;

  return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
}
