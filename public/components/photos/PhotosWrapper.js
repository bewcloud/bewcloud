import MainPhotos from "/public/components/photos/MainPhotos.js";
export default function PhotosWrapper({
  initialDirectories,
  initialFiles,
  initialPath
}) {
  return h(MainPhotos, {
    initialDirectories: initialDirectories,
    initialFiles: initialFiles,
    initialPath: initialPath
  });
}