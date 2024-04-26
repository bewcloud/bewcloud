import { Directory, DirectoryFile } from '/lib/types.ts';
import MainNotes from '/components/notes/MainNotes.tsx';

interface NotesWrapperProps {
  initialDirectories: Directory[];
  initialFiles: DirectoryFile[];
  initialPath: string;
}

// This wrapper is necessary because islands need to be the first frontend component, but they don't support functions as props, so the more complex logic needs to live in the component itself
export default function NotesWrapper(
  { initialDirectories, initialFiles, initialPath }: NotesWrapperProps,
) {
  return (
    <MainNotes
      initialDirectories={initialDirectories}
      initialFiles={initialFiles}
      initialPath={initialPath}
    />
  );
}
