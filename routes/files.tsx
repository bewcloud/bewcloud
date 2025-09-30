import { Handlers, PageProps } from 'fresh/server.ts';

import { Directory, DirectoryFile, FreshContextState } from '/lib/types.ts';
import { DirectoryModel, FileModel } from '/lib/models/files.ts';
import { AppConfig } from '/lib/config.ts';
import { SortColumn, SortOrder } from '/lib/utils/files.ts';
import FilesWrapper from '/islands/files/FilesWrapper.tsx';

interface Data {
  userDirectories: Directory[];
  userFiles: DirectoryFile[];
  currentPath: string;
  baseUrl: string;
  isFileSharingAllowed: boolean;
  sortBy: SortColumn;
  sortOrder: SortOrder;
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

    // Get sort parameters
    const sortBy = (searchParams.get('sortBy') as SortColumn) || 'name';
    const sortOrder = (searchParams.get('sortOrder') as SortOrder) || 'asc';

    // Validate sort parameters
    const validSortColumns: SortColumn[] = ['name', 'updated_at', 'size_in_bytes'];
    const validSortOrders: SortOrder[] = ['asc', 'desc'];

    const finalSortBy = validSortColumns.includes(sortBy) ? sortBy : 'name';
    const finalSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : 'asc';

    const sortOptions = { sortBy: finalSortBy, sortOrder: finalSortOrder };

    const userDirectories = await DirectoryModel.list(context.state.user.id, currentPath, sortOptions);

    const userFiles = await FileModel.list(context.state.user.id, currentPath, sortOptions);

    const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();

    return await context.render({
      userDirectories,
      userFiles,
      currentPath,
      baseUrl,
      isFileSharingAllowed: isPublicFileSharingAllowed,
      sortBy: finalSortBy,
      sortOrder: finalSortOrder,
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
        initialSortBy={data.sortBy}
        initialSortOrder={data.sortOrder}
      />
    </main>
  );
}
