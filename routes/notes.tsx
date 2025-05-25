import { Handlers, PageProps } from 'fresh/server.ts';

import { Directory, DirectoryFile, FreshContextState } from '/lib/types.ts';
import { AppConfig } from '/lib/config.ts';
import { DirectoryModel, FileModel } from '/lib/models/files.ts';
import NotesWrapper from '/islands/notes/NotesWrapper.tsx';

interface Data {
  userDirectories: Directory[];
  userNotes: DirectoryFile[];
  currentPath: string;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    if (!(await AppConfig.isAppEnabled('notes'))) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/files` } });
    }

    const searchParams = new URL(request.url).searchParams;

    let currentPath = searchParams.get('path') || '/Notes/';

    // Send invalid paths back to Notes root
    if (!currentPath.startsWith('/Notes/') || currentPath.includes('../')) {
      currentPath = '/Notes/';
    }

    // Always append a trailing slash
    if (!currentPath.endsWith('/')) {
      currentPath = `${currentPath}/`;
    }

    const userDirectories = await DirectoryModel.list(context.state.user.id, currentPath);

    const userFiles = await FileModel.list(context.state.user.id, currentPath);

    const userNotes = userFiles.filter((file) => file.file_name.endsWith('.md'));

    return await context.render({ userDirectories, userNotes, currentPath });
  },
};

export default function NotesPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <NotesWrapper
        initialDirectories={data.userDirectories}
        initialFiles={data.userNotes}
        initialPath={data.currentPath}
      />
    </main>
  );
}
