import { PageProps, RouteHandler } from 'fresh';

import { Directory, DirectoryFile, FreshContextState } from '/lib/types.ts';
import { AppConfig } from '/lib/config.ts';
import { DirectoryModel, FileModel } from '/lib/models/files.ts';
import { PHOTO_EXTENSIONS } from '/lib/utils/photos.ts';
import PhotosWrapper from '/islands/photos/PhotosWrapper.tsx';

interface Data {
  userDirectories: Directory[];
  userPhotos: DirectoryFile[];
  currentPath: string;
}

export const handler: RouteHandler<Data, FreshContextState> = {
  async GET(context) {
    const request = context.req;

    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    if (!(await AppConfig.isAppEnabled('photos'))) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/files` } });
    }

    const searchParams = new URL(request.url).searchParams;

    let currentPath = searchParams.get('path') || '/Photos/';

    // Send invalid paths back to Photos root
    if (!currentPath.startsWith('/Photos/') || currentPath.includes('../')) {
      currentPath = '/Photos/';
    }

    // Always append a trailing slash
    if (!currentPath.endsWith('/')) {
      currentPath = `${currentPath}/`;
    }

    const userDirectories = await DirectoryModel.list(context.state.user.id, currentPath);

    const userFiles = await FileModel.list(context.state.user.id, currentPath);

    const userPhotos = userFiles.filter((file) => {
      const lowercaseFileName = file.file_name.toLowerCase();

      return PHOTO_EXTENSIONS.some((extension) => lowercaseFileName.endsWith(extension));
    });

    return { data: { userDirectories, userPhotos, currentPath } };
  },
};

export default function PhotosPage({ data }: PageProps<Data, FreshContextState>) {
  return (
    <main>
      <PhotosWrapper
        initialDirectories={data.userDirectories}
        initialFiles={data.userPhotos}
        initialPath={data.currentPath}
      />
    </main>
  );
}
