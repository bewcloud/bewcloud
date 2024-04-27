interface FilesBreadcrumbProps {
  path: string;
  isShowingNotes?: boolean;
  isShowingPhotos?: boolean;
}

export default function FilesBreadcrumb({ path, isShowingNotes, isShowingPhotos }: FilesBreadcrumbProps) {
  let routePath = 'files';
  let rootPath = '/';

  if (isShowingNotes) {
    routePath = 'notes';
    rootPath = '/Notes/';
  } else if (isShowingPhotos) {
    routePath = 'photos';
    rootPath = '/Photos/';
  }

  const itemPluralLabel = routePath;

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
      {!isShowingNotes && !isShowingPhotos ? <a href={`/files?path=/`}>All files</a> : null}
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
            <a href={`/${routePath}?path=/${fullPathForPart.join('/')}/`} class='ml-2'>{decodeURIComponent(part)}</a>
          </>
        );
      })}
    </h3>
  );
}
