interface FilesBreadcrumbProps {
  path: string;
}

export default function FilesBreadcrumb({ path }: FilesBreadcrumbProps) {
  if (path === '/') {
    return (
      <h3 class='text-base font-semibold text-white whitespace-nowrap mr-2'>
        All files
      </h3>
    );
  }

  const pathParts = path.slice(1, -1).split('/');

  return (
    <h3 class='text-base font-semibold text-white whitespace-nowrap mr-2'>
      <a href={`/files?path=/`}>All files</a>
      {pathParts.map((part, index) => {
        if (index === pathParts.length - 1) {
          return (
            <>
              <span class='ml-2 text-xs'>/</span>
              <span class='ml-2'>{part}</span>
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
            <a href={`/files?path=/${fullPathForPart.join('/')}/`} class='ml-2'>{part}</a>
          </>
        );
      })}
    </h3>
  );
}
