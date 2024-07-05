import { DirectoryFile } from '/lib/types.ts';
import { PHOTO_IMAGE_EXTENSIONS, PHOTO_VIDEO_EXTENSIONS } from '/lib/utils/photos.ts';

interface ListPhotosProps {
  files: DirectoryFile[];
}

export default function ListPhotos(
  {
    files,
  }: ListPhotosProps,
) {
  return (
    <section class='mx-auto max-w-7xl my-8'>
      {files.length === 0
        ? (
          <article class='px-6 py-4 font-normal text-center w-full'>
            <div class='font-medium text-slate-400 text-md'>No photos to show</div>
          </article>
        )
        : (
          <section class='w-full grid grid-cols-2 md:grid-cols-3 gap-4'>
            {files.map((file) => {
              const lowercaseFileName = file.file_name.toLowerCase();
              const extensionName = lowercaseFileName.split('.').pop() || '';

              const isImage = PHOTO_IMAGE_EXTENSIONS.some((extension) => extension === extensionName);
              const isVideo = PHOTO_VIDEO_EXTENSIONS.some((extension) => extension === extensionName);

              return (
                <article class='hover:opacity-70'>
                  <a
                    href={`/files/open/${file.file_name}?path=${file.parent_path}`}
                    class='flex items-center'
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    {isVideo
                      ? (
                        <video class='h-auto max-w-full rounded-md' title={file.file_name}>
                          <source
                            src={`/files/open/${file.file_name}?path=${file.parent_path}`}
                            type={`video/${extensionName}`}
                          />
                        </video>
                      )
                      : null}
                    {isImage
                      ? (
                        <img
                          src={`/photos/thumbnail/${file.file_name}?path=${file.parent_path}`}
                          class='h-auto max-w-full rounded-md'
                          alt={file.file_name}
                          title={file.file_name}
                        />
                      )
                      : null}
                  </a>
                </article>
              );
            })}
          </section>
        )}
    </section>
  );
}
