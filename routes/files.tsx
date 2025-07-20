import { Handlers, PageProps } from 'fresh/server.ts';

import { Directory, DirectoryFile, FreshContextState } from '/lib/types.ts';
import { DirectoryModel, FileModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';
import FilesWrapper from '/islands/files/FilesWrapper.tsx';

interface Data {
  userDirectories: Directory[];
  userFiles: DirectoryFile[];
  currentPath: string;
  baseUrl: string;
  isFileSharingAllowed: boolean;
  isCardDavEnabled: boolean;
  isCalDavEnabled: boolean;
}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const baseUrl = (await AppConfig.getConfig()).auth.baseUrl;

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

    const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();
    const contactsConfig = await AppConfig.getContactsConfig();
    const calendarConfig = await AppConfig.getCalendarConfig();

    const isCardDavEnabled = contactsConfig.enableCardDavServer;
    const isCalDavEnabled = calendarConfig.enableCalDavServer;

    return await context.render({
      userDirectories,
      userFiles,
      currentPath,
      baseUrl,
      isFileSharingAllowed: isPublicFileSharingAllowed,
      isCardDavEnabled,
      isCalDavEnabled,
    });
  },
};

export default function FilesPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <FilesWrapper
        initialDirectories={data.userDirectories}
        initialFiles={data.userFiles}
        initialPath={data.currentPath}
        baseUrl={data.baseUrl}
        isFileSharingAllowed={data.isFileSharingAllowed}
        isCardDavEnabled={data.isCardDavEnabled}
        isCalDavEnabled={data.isCalDavEnabled}
      />
    </main>
  );
}
