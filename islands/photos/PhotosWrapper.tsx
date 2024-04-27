import { Directory, DirectoryFile } from '/lib/types.ts';
import MainPhotos from '/components/photos/MainPhotos.tsx';

interface PhotosWrapperProps {
  initialDirectories: Directory[];
  initialFiles: DirectoryFile[];
  initialPath: string;
}

// This wrapper is necessary because islands need to be the first frontend component, but they don't support functions as props, so the more complex logic needs to live in the component itself
export default function PhotosWrapper(
  { initialDirectories, initialFiles, initialPath }: PhotosWrapperProps,
) {
  return (
    <MainPhotos
      initialDirectories={initialDirectories}
      initialFiles={initialFiles}
      initialPath={initialPath}
    />
  );
}
