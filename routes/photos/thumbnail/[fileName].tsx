import { Handlers } from 'fresh/server.ts';
import { resize } from 'https://deno.land/x/deno_image@0.0.4/mod.ts';

import { FreshContextState } from '/lib/types.ts';
import { FileModel } from '/lib/models/files.ts';

interface Data {}

const MIN_WIDTH = 25;
const MIN_HEIGHT = 25;
const MAX_WIDTH = 2048;
const MAX_HEIGHT = 2048;

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const { fileName } = context.params;

    if (!fileName) {
      return new Response('Not Found', { status: 404 });
    }

    const searchParams = new URL(request.url).searchParams;

    let currentPath = searchParams.get('path') || '/';

    // Send invalid paths back to root
    if (!currentPath.startsWith('/') || currentPath.includes('../')) {
      currentPath = '/';
    }

    // Always append a trailing slash
    if (!currentPath.endsWith('/')) {
      currentPath = `${currentPath}/`;
    }

    const fileResult = await FileModel.get(context.state.user.id, currentPath, decodeURIComponent(fileName));

    if (!fileResult.success) {
      return new Response('Not Found', { status: 404 });
    }

    const width = parseInt(searchParams.get('width') || '500', 10);
    const height = parseInt(searchParams.get('height') || '500', 10);

    if (
      fileResult.contentType?.split('/')[0] !== 'image' || isNaN(width) || isNaN(height) ||
      width > MAX_WIDTH || height > MAX_HEIGHT || width < MIN_WIDTH || height < MIN_HEIGHT
    ) {
      return new Response('Bad Request', { status: 400 });
    }

    const resizedImageContents = await resize(fileResult.contents!, { width, height, aspectRatio: true });

    return new Response(resizedImageContents, {
      status: 200,
      headers: {
        'cache-control': `max-age=${604_800}`, // Tell browsers to cache for 1 week (60 * 60 * 24 * 7 = 604_800)
        'content-type': fileResult.contentType!,
        'content-length': resizedImageContents.byteLength.toString(),
      },
    });
  },
};
