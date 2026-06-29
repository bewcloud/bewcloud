export default function FilesBreadcrumb({
  path,
  isShowingNotes,
  isShowingPhotos,
  fileShareId,
  sortBy = 'name',
  sortOrder = 'asc'
}) {
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
    return h("h3", {
      class: "text-base font-semibold text-white whitespace-nowrap mr-2"
    }, "All ", itemPluralLabel);
  }
  const pathParts = path.slice(1, -1).split('/');
  const commonSearchParams = new URLSearchParams();
  commonSearchParams.set('sortBy', sortBy);
  commonSearchParams.set('sortOrder', sortOrder);
  return h("h3", {
    class: "text-base font-semibold text-white whitespace-nowrap mr-2"
  }, !isShowingNotes && !isShowingPhotos ? h("a", {
    href: `/${routePath}?path=/&${commonSearchParams.toString()}`
  }, "All files") : null, isShowingNotes ? h("a", {
    href: `/notes?path=/Notes/&${commonSearchParams.toString()}`
  }, "All notes") : null, isShowingPhotos ? h("a", {
    href: `/photos?path=/Photos/&${commonSearchParams.toString()}`
  }, "All photos") : null, pathParts.map((part, index) => {
    if (index === 0 && (isShowingNotes || isShowingPhotos)) {
      return null;
    }
    if (index === pathParts.length - 1) {
      return h(Fragment, null, h("span", {
        class: "ml-2 text-xs"
      }, "/"), h("span", {
        class: "ml-2"
      }, decodeURIComponent(part)));
    }
    const fullPathForPart = [];
    for (let pathPartIndex = 0; pathPartIndex <= index; ++pathPartIndex) {
      fullPathForPart.push(pathParts[pathPartIndex]);
    }
    return h(Fragment, null, h("span", {
      class: "ml-2 text-xs"
    }, "/"), h("a", {
      href: `/${routePath}?path=/${encodeURIComponent(fullPathForPart.join('/'))}/&${commonSearchParams.toString()}`,
      class: "ml-2"
    }, decodeURIComponent(part)));
  }));
}