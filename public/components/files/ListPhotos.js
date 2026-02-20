import { humanFileSize, TRASH_PATH } from '/public/ts/utils/files.ts';
export default function ListPhotos({
  directories,
  files,
  onClickOpenRenameDirectory,
  onClickOpenRenameFile,
  onClickOpenMoveDirectory,
  onClickOpenMoveFile,
  onClickDeleteDirectory,
  onClickDeleteFile,
  isShowingNotes
}) {
  const dateFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  };
  const dateFormat = new Intl.DateTimeFormat('en-GB', dateFormatOptions);
  const routePath = isShowingNotes ? 'notes' : 'files';
  const itemSingleLabel = isShowingNotes ? 'note' : 'file';
  const itemPluralLabel = routePath;
  return h("section", {
    class: "mx-auto max-w-7xl my-8"
  }, h("table", {
    class: "w-full border-collapse bg-gray-900 text-left text-sm text-slate-500 shadow-sm rounded-md"
  }, h("thead", null, h("tr", {
    class: "border-b border-slate-600"
  }, h("th", {
    scope: "col",
    class: "px-6 py-4 font-medium text-white"
  }, "Name"), h("th", {
    scope: "col",
    class: "px-6 py-4 font-medium text-white w-56"
  }, "Last update"), isShowingNotes ? null : h("th", {
    scope: "col",
    class: "px-6 py-4 font-medium text-white w-32"
  }, "Size"), h("th", {
    scope: "col",
    class: "px-6 py-4 font-medium text-white w-20"
  }))), h("tbody", {
    class: "divide-y divide-slate-600 border-t border-slate-600"
  }, directories.map(directory => {
    const fullPath = `${directory.parent_path}${directory.directory_name}/`;
    return h("tr", {
      class: "bg-slate-700 hover:bg-slate-600 group"
    }, h("td", {
      class: "flex gap-3 px-6 py-4"
    }, h("a", {
      href: `/${routePath}?path=${encodeURIComponent(fullPath)}`,
      class: "flex items-center font-normal text-white"
    }, h("img", {
      src: `/public/images/${fullPath === TRASH_PATH ? 'trash.svg' : 'directory.svg'}`,
      class: "white drop-shadow-md mr-2",
      width: 18,
      height: 18,
      alt: "Directory",
      title: "Directory"
    }), directory.directory_name)), h("td", {
      class: "px-6 py-4 text-slate-200"
    }, dateFormat.format(new Date(directory.updated_at))), isShowingNotes ? null : h("td", {
      class: "px-6 py-4 text-slate-200"
    }, humanFileSize(directory.size_in_bytes)), h("td", {
      class: "px-6 py-4"
    }, fullPath === TRASH_PATH || typeof onClickOpenRenameDirectory === 'undefined' || typeof onClickOpenMoveDirectory === 'undefined' ? null : h("section", {
      class: "flex items-center justify-end w-20"
    }, h("span", {
      class: "invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2",
      onClick: () => onClickOpenRenameDirectory(directory.parent_path, directory.directory_name)
    }, h("img", {
      src: "/public/images/rename.svg",
      class: "white drop-shadow-md",
      width: 18,
      height: 18,
      alt: "Rename directory",
      title: "Rename directory"
    })), h("span", {
      class: "invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2",
      onClick: () => onClickOpenMoveDirectory(directory.parent_path, directory.directory_name)
    }, h("img", {
      src: "/public/images/move.svg",
      class: "white drop-shadow-md",
      width: 18,
      height: 18,
      alt: "Move directory",
      title: "Move directory"
    })), h("span", {
      class: "invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100",
      onClick: () => onClickDeleteDirectory(directory.parent_path, directory.directory_name)
    }, h("img", {
      src: "/public/images/delete.svg",
      class: "red drop-shadow-md",
      width: 20,
      height: 20,
      alt: "Delete directory",
      title: "Delete directory"
    })))));
  }), files.map(file => h("tr", {
    class: "bg-slate-700 hover:bg-slate-600 group"
  }, h("td", {
    class: "flex gap-3 px-6 py-4"
  }, h("a", {
    href: `/${routePath}/open/${encodeURIComponent(file.file_name)}?path=${encodeURIComponent(file.parent_path)}`,
    class: "flex items-center font-normal text-white",
    target: "_blank",
    rel: "noopener noreferrer"
  }, h("img", {
    src: "/public/images/file.svg",
    class: "white drop-shadow-md mr-2",
    width: 18,
    height: 18,
    alt: "File",
    title: "File"
  }), file.file_name)), h("td", {
    class: "px-6 py-4 text-slate-200"
  }, dateFormat.format(new Date(file.updated_at))), isShowingNotes ? null : h("td", {
    class: "px-6 py-4 text-slate-200"
  }, humanFileSize(file.size_in_bytes)), h("td", {
    class: "px-6 py-4"
  }, h("section", {
    class: "flex items-center justify-end w-20"
  }, typeof onClickOpenRenameFile === 'undefined' ? null : h("span", {
    class: "invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2",
    onClick: () => onClickOpenRenameFile(file.parent_path, file.file_name)
  }, h("img", {
    src: "/public/images/rename.svg",
    class: "white drop-shadow-md",
    width: 18,
    height: 18,
    alt: `Rename ${itemSingleLabel}`,
    title: `Rename ${itemSingleLabel}`
  })), typeof onClickOpenMoveFile === 'undefined' ? null : h("span", {
    class: "invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2",
    onClick: () => onClickOpenMoveFile(file.parent_path, file.file_name)
  }, h("img", {
    src: "/public/images/move.svg",
    class: "white drop-shadow-md",
    width: 18,
    height: 18,
    alt: `Move ${itemSingleLabel}`,
    title: `Move ${itemSingleLabel}`
  })), h("span", {
    class: "invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100",
    onClick: () => onClickDeleteFile(file.parent_path, file.file_name)
  }, h("img", {
    src: "/public/images/delete.svg",
    class: "red drop-shadow-md",
    width: 20,
    height: 20,
    alt: `Delete ${itemSingleLabel}`,
    title: `Delete ${itemSingleLabel}`
  })))))), directories.length === 0 && files.length === 0 ? h("tr", null, h("td", {
    class: "flex gap-3 px-6 py-4 font-normal",
    colspan: 4
  }, h("div", {
    class: "text-md"
  }, h("div", {
    class: "font-medium text-slate-400"
  }, "No ", itemPluralLabel, " to show")))) : null)));
}