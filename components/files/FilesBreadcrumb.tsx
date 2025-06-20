interface FilesBreadcrumbProps {
  path: string;
  isShowingNotes?: boolean;
  isShowingPhotos?: boolean;
  fileShareId?: string;
}

export default function FilesBreadcrumb({ path, isShowingNotes, isShowingPhotos, fileShareId }: FilesBreadcrumbProps) {
  let routePath = fileShareId ? `file-share/${fileShareId}` : 'files';
  let rootPath = '/';
  let itemPluralLabel = 'files';

  if (isShowingNotes) {
    routePath = 'notes';
    itemPluralLabel = 'notes';
    rootPath = '/Notes/';
  } else if (isShowingPhotos) {
    routePath = 'photos';
    itemPluralLabel = 'photos';
    rootPath = '/Photos/';
  }

  if (path === rootPath) {
    return (
      <h3 class='text-base font-semibold text-white whitespace-nowrap mr-2'>
        All {itemPluralLabel}
      </h3>
    );
  }

  const pathParts = path.slice(1, -1).split('/');

  return (
    <h3 class='text-base font-semibold text-white whitespace-nowrap mr-2'>
      {!isShowingNotes && !isShowingPhotos ? <a href={`/${routePath}?path=/`}>All files</a> : null}
      {isShowingNotes ? <a href={`/notes?path=/Notes/`}>All notes</a> : null}
      {isShowingPhotos ? <a href={`/photos?path=/Photos/`}>All photos</a> : null}
      {pathParts.map((part, index) => {
        // Ignore the first directory in special ones
        if (index === 0 && (isShowingNotes || isShowingPhotos)) {
          return null;
        }

        if (index === pathParts.length - 1) {
          return (
            <>
              <span class='ml-2 text-xs'>/</span>
              <span class='ml-2'>{decodeURIComponent(part)}</span>
            </>
          );
        }

        const fullPathForPart: string[] = [];

        for (let pathPartIndex = 0; pathPartIndex <= index; ++pathPartIndex) {
          fullPathForPart.push(pathParts[pathPartIndex]);
        }

        return (
          <>
            <span class='ml-2 text-xs'>/</span>
            <a href={`/${routePath}?path=/${encodeURIComponent(fullPathForPart.join('/'))}/`} class='ml-2'>
              {decodeURIComponent(part)}
            </a>
          </>
        );
      })}
    </h3>
  );
}
