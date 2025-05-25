import { Directory, DirectoryFile } from '/lib/types.ts';
import MainFiles from '/components/files/MainFiles.tsx';

interface FilesWrapperProps {
  initialDirectories: Directory[];
  initialFiles: DirectoryFile[];
  initialPath: string;
  baseUrl: string;
}

// This wrapper is necessary because islands need to be the first frontend component, but they don't support functions as props, so the more complex logic needs to live in the component itself
export default function FilesWrapper(
  { initialDirectories, initialFiles, initialPath, baseUrl }: FilesWrapperProps,
) {
  return (
    <MainFiles
      initialDirectories={initialDirectories}
      initialFiles={initialFiles}
      initialPath={initialPath}
      baseUrl={baseUrl}
    />
  );
}
