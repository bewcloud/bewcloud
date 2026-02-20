import { renderToString } from 'preact-render-to-string';

import denoConfig from '/deno.json' with { type: 'json' };
import { RequestHandlerParams } from '/lib/page.ts';
import { AppConfig } from '/lib/config.ts';
import { escapeHtml, html } from '/public/ts/utils/misc.ts';

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
    <html lang="en" dir="ltr" class="h-full bg-slate-800">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(title)}</title>
        <meta name="description" content="${escapeHtml(description || defaultDescription)}">
        <meta name="author" content="Bruno Bernardino">
        <meta property="og:title" content="${escapeHtml(defaultTitle)}" />
        <link rel="icon" href="/public/images/favicon-dark.png" type="image/png" />
        <link rel="apple-touch-icon" href="/public/images/favicon-dark.png" />
        <link rel="manifest" href="/public/manifest.json" />
        <link rel="stylesheet" href="/public/scss/style.scss" />
        <link rel="stylesheet" href="/public/css/tailwind.css" />
      </head>

      <script type="importmap">
      ${JSON.stringify(importMap)}
      </script>

      <body class="h-full">
        ${headerHtml} ${htmlContent}
      </body>
    </html>
  `;
}

const importMap = denoConfig.frontendImports.reduce(
  (importsObject: { imports: Record<string, string> }, importName: string) => {
    const url = new URL(denoConfig.imports[importName as keyof typeof denoConfig.imports]).toString();
    let fileName = url.replace('https://esm.sh/', '').split('?')[0].trim();
    if (!fileName.endsWith('.mjs')) {
      fileName = `${fileName}.mjs`;
    }
    importsObject.imports[importName] = `/public/js/${fileName}`;
    return importsObject;
  },
  { imports: {} },
);

export async function basicLayoutResponse(htmlContent: string, options: BasicLayoutOptions) {
  const headers: HeadersInit = {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy':
      `default-src 'self'; child-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'`,
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
  };

  return new Response(await basicLayout(htmlContent, options), {
    headers,
  });
}
