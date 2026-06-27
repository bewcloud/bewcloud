import MainNotes from '/components/notes/MainNotes.tsx';
export default function NotesWrapper({
  initialDirectories,
  initialFiles,
  initialPath
}) {
  return h(MainNotes, {
    initialDirectories: initialDirectories,
    initialFiles: initialFiles,
    initialPath: initialPath
  });
}