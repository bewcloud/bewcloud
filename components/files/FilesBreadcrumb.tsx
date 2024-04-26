interface FilesBreadcrumbProps {
  path: string;
  isShowingNotes?: boolean;
}

export default function FilesBreadcrumb({ path, isShowingNotes }: FilesBreadcrumbProps) {
  const routePath = isShowingNotes ? 'notes' : 'files';

  if (!isShowingNotes && path === '/') {
    return (
      <h3 class='text-base font-semibold text-white whitespace-nowrap mr-2'>
        All files
      </h3>
    );
  }

  if (isShowingNotes && path === '/Notes/') {
    return (
      <h3 class='text-base font-semibold text-white whitespace-nowrap mr-2'>
        All notes
      </h3>
    );
  }

  const pathParts = path.slice(1, -1).split('/');

  if (isShowingNotes) {
    pathParts.shift();
  }

  return (
    <h3 class='text-base font-semibold text-white whitespace-nowrap mr-2'>
      {isShowingNotes ? <a href={`/notes?path=/Notes/`}>All notes</a> : <a href={`/files?path=/`}>All files</a>}
      {pathParts.map((part, index) => {
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
