import { PageProps, RouteHandler } from 'fresh';

import { FreshContextState } from '/lib/types.ts';
import { FileModel } from '/lib/models/files.ts';
import Note from '/islands/notes/Note.tsx';

interface Data {
  fileName: string;
  currentPath: string;
  contents: string;
}

export const handler: RouteHandler<Data, FreshContextState> = {
  async GET(context) {
    const request = context.req;

    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const { fileName } = context.params;

    if (!fileName) {
      return new Response('Not Found', { status: 404 });
    }

    const searchParams = new URL(request.url).searchParams;

    let currentPath = searchParams.get('path') || '/';

    // Send invalid paths back to notes root
    if (!currentPath.startsWith('/Notes/') || currentPath.includes('../')) {
      currentPath = '/Notes/';
    }

    // Always append a trailing slash
    if (!currentPath.endsWith('/')) {
      currentPath = `${currentPath}/`;
    }

    // Don't allow non-markdown files here
    if (!fileName.endsWith('.md')) {
      return new Response('Not Found', { status: 404 });
    }

    const fileResult = await FileModel.get(context.state.user.id, currentPath, decodeURIComponent(fileName));

    if (!fileResult.success) {
      return new Response('Not Found', { status: 404 });
    }

    return { data: { fileName, currentPath, contents: new TextDecoder().decode(fileResult.contents!) } };
  },
};

export default function OpenNotePage({ data }: PageProps<Data, FreshContextState>) {
  return <Note fileName={data.fileName} currentPath={data.currentPath} contents={data.contents} />;
}
