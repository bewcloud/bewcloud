import { Directory, DirectoryFile } from '/lib/types.ts';
import { SortColumn, SortOrder } from '/lib/utils/files.ts';
import MainFiles from '/components/files/MainFiles.tsx';

interface FilesWrapperProps {
  initialDirectories: Directory[];
  initialFiles: DirectoryFile[];
  initialPath: string;
  baseUrl: string;
  isFileSharingAllowed: boolean;
  areDirectoryDownloadsAllowed: boolean;
  fileShareId?: string;
  initialSortBy?: SortColumn;
  initialSortOrder?: SortOrder;
}

// This wrapper is necessary because islands need to be the first frontend component, but they don't support functions as props, so the more complex logic needs to live in the component itself
export default function FilesWrapper(
  {
    initialDirectories,
    initialFiles,
    initialPath,
    baseUrl,
    isFileSharingAllowed,
    areDirectoryDownloadsAllowed,
    fileShareId,
    initialSortBy = 'name',
    initialSortOrder = 'asc',
  }: FilesWrapperProps,
) {
  return (
    <MainFiles
      initialDirectories={initialDirectories}
      initialFiles={initialFiles}
      initialPath={initialPath}
      baseUrl={baseUrl}
      isFileSharingAllowed={isFileSharingAllowed}
      areDirectoryDownloadsAllowed={areDirectoryDownloadsAllowed}
      fileShareId={fileShareId}
      initialSortBy={initialSortBy}
      initialSortOrder={initialSortOrder}
    />
  );
}
