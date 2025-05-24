import { Handlers, PageProps } from 'fresh/server.ts';

import { Directory, DirectoryFile, FreshContextState } from '/lib/types.ts';
import { DirectoryModel, FileModel } from '/lib/models/files.ts';
import FilesWrapper from '/islands/files/FilesWrapper.tsx';

interface Data {
  userDirectories: Directory[];
  userFiles: DirectoryFile[];
  currentPath: string;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
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

    const userDirectories = await DirectoryModel.list(context.state.user.id, currentPath);

    const userFiles = await FileModel.list(context.state.user.id, currentPath);

    return await context.render({ userDirectories, userFiles, currentPath });
  },
};

export default function FilesPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <FilesWrapper
        initialDirectories={data.userDirectories}
        initialFiles={data.userFiles}
        initialPath={data.currentPath}
      />
    </main>
  );
}
