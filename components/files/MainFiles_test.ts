import { assertEquals } from '@std/assert';
import { h, options, VNode } from 'preact';
import { renderToString } from 'preact-render-to-string';

import MainFiles from './MainFiles.tsx';

// Server-rendering drops event handlers from the output, so look at the props of every element as it's created instead.
function renderAndCollectDropHandlers(fileShareId?: string) {
  const elementsWithDropHandlers: string[] = [];
  const originalVnodeHook = options.vnode;

  options.vnode = (vnode: VNode) => {
    if (typeof vnode.type === 'string' && (vnode.props as Record<string, unknown>).onDrop) {
      elementsWithDropHandlers.push(vnode.type);
    }

    originalVnodeHook?.(vnode);
  };

  try {
    renderToString(h(MainFiles, {
      initialDirectories: [],
      initialFiles: [],
      initialPath: '/',
      baseUrl: 'http://localhost:8000',
      isFileSharingAllowed: true,
      areDirectoryDownloadsAllowed: true,
      fileShareId,
    }));
  } finally {
    options.vnode = originalVnodeHook;
  }

  return elementsWithDropHandlers;
}

Deno.test('that the files view accepts drops', () => {
  assertEquals(renderAndCollectDropHandlers().length, 1);
});

Deno.test('that a public file share does not accept drops', () => {
  assertEquals(renderAndCollectDropHandlers('share-id'), []);
});
