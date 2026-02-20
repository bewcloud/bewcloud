import { join } from '@std/path';
import { humanFileSize, TRASH_PATH } from '/public/ts/utils/files.ts';
export default function ListFiles({
  directories,
  files,
  chosenDirectories = [],
  chosenFiles = [],
  onClickChooseFile,
  onClickChooseDirectory,
  onClickOpenRenameDirectory,
  onClickOpenRenameFile,
  onClickOpenMoveDirectory,
  onClickOpenMoveFile,
  onClickDeleteDirectory,
  onClickDeleteFile,
  onClickCreateShare,
  onClickOpenManageShare,
  onClickDownloadDirectory,
  isShowingNotes,
  isShowingPhotos,
  fileShareId
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
  let routePath = fileShareId ? `file-share/${fileShareId}` : 'files';
  let itemSingleLabel = 'file';
  let itemPluralLabel = 'files';
  if (isShowingNotes) {
    routePath = 'notes';
    itemSingleLabel = 'note';
    itemPluralLabel = 'notes';
  } else if (isShowingPhotos) {
    routePath = 'photos';
    itemSingleLabel = 'photo';
    itemPluralLabel = 'photos';
  }
  if (isShowingPhotos && directories.length === 0) {
    return null;
  }
  const isAnyItemChosen = chosenDirectories.length > 0 || chosenFiles.length > 0;
  function chooseAllItems() {
    if (typeof onClickChooseFile !== 'undefined') {
      files.forEach(files => onClickChooseFile(files.parent_path, files.file_name));
    }
    if (typeof onClickChooseDirectory !== 'undefined') {
      directories.forEach(directory => onClickChooseDirectory(directory.parent_path, directory.directory_name));
    }
  }
  return h("section", {
    class: "mx-auto max-w-7xl my-8"
  }, h("table", {
    class: "w-full border-collapse bg-gray-900 text-left text-sm text-slate-500 shadow-sm rounded-md"
  }, h("thead", null, h("tr", {
    class: "border-b border-slate-600"
  }, directories.length === 0 && files.length === 0 || typeof onClickChooseFile === 'undefined' && typeof onClickChooseDirectory === 'undefined' || fileShareId ? null : h("th", {
    scope: "col",
    class: "pl-6 pr-2 font-medium text-white w-3"
  }, h("input", {
    class: "w-3 h-3 cursor-pointer text-[#51A4FB] bg-slate-100 border-slate-300 rounded dark:bg-slate-700 dark:border-slate-600",
    type: "checkbox",
    onClick: () => chooseAllItems(),
    checked: isAnyItemChosen
  })), h("th", {
    scope: "col",
    class: "px-6 py-4 font-medium text-white"
  }, "Name"), h("th", {
    scope: "col",
    class: "px-6 py-4 font-medium text-white w-64"
  }, "Last update"), isShowingNotes || isShowingPhotos ? null : h("th", {
    scope: "col",
    class: "px-6 py-4 font-medium text-white w-32"
  }, "Size"), isShowingPhotos || fileShareId ? null : h("th", {
    scope: "col",
    class: "px-6 py-4 font-medium text-white w-24"
  }))), h("tbody", {
    class: "divide-y divide-slate-600 border-t border-slate-600"
  }, directories.map(directory => {
    const fullPath = `${directory.parent_path}${directory.directory_name}/`;
    return h("tr", {
      class: "bg-slate-700 hover:bg-slate-600 group"
    }, typeof onClickChooseDirectory === 'undefined' || fileShareId ? null : h("td", {
      class: "gap-3 pl-6 pr-2 py-4"
    }, fullPath === TRASH_PATH ? null : h("input", {
      class: "w-3 h-3 cursor-pointer text-[#51A4FB] bg-slate-100 border-slate-300 rounded dark:bg-slate-700 dark:border-slate-600",
      type: "checkbox",
      onClick: () => onClickChooseDirectory(directory.parent_path, directory.directory_name),
      checked: Boolean(chosenDirectories.find(_directory => _directory.parent_path === directory.parent_path && _directory.directory_name === directory.directory_name))
    })), h("td", {
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
    }, dateFormat.format(new Date(directory.updated_at))), isShowingNotes || isShowingPhotos ? null : h("td", {
      class: "px-6 py-4 text-slate-200"
    }, humanFileSize(directory.size_in_bytes)), isShowingPhotos || fileShareId ? null : h("td", {
      class: "px-6 py-4"
    }, fullPath === TRASH_PATH || typeof onClickOpenRenameDirectory === 'undefined' || typeof onClickOpenMoveDirectory === 'undefined' ? null : h("section", {
      class: "flex items-center justify-end w-32"
    }, typeof onClickDownloadDirectory === 'undefined' ? null : h("span", {
      class: "invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2",
      onClick: () => onClickDownloadDirectory(directory.parent_path, directory.directory_name)
    }, h("img", {
      src: "/public/images/download.svg",
      class: "white drop-shadow-md",
      width: 18,
      height: 18,
      alt: "Download directory as zip",
      title: "Download directory as zip"
    })), h("span", {
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
    })), typeof onClickDeleteDirectory === 'undefined' ? null : h("span", {
      class: "invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2",
      onClick: () => onClickDeleteDirectory(directory.parent_path, directory.directory_name)
    }, h("img", {
      src: "/public/images/delete.svg",
      class: "red drop-shadow-md",
      width: 20,
      height: 20,
      alt: "Delete directory",
      title: "Delete directory"
    })), typeof onClickCreateShare === 'undefined' || directory.file_share_id ? null : h("span", {
      class: "invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2",
      onClick: () => onClickCreateShare(join(directory.parent_path, directory.directory_name))
    }, h("img", {
      src: "/public/images/share.svg",
      class: "white drop-shadow-md",
      width: 18,
      height: 18,
      alt: "Create public share link",
      title: "Create public share link"
    })), typeof onClickOpenManageShare === 'undefined' || !directory.file_share_id ? null : h("span", {
      class: "invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2",
      onClick: () => onClickOpenManageShare(directory.file_share_id)
    }, h("img", {
      src: "/public/images/share.svg",
      class: "white drop-shadow-md",
      width: 18,
      height: 18,
      alt: "Manage public share link",
      title: "Manage public share link"
    })))));
  }), files.map(file => h("tr", {
    class: "bg-slate-700 hover:bg-slate-600 group"
  }, typeof onClickChooseFile === 'undefined' || fileShareId ? null : h("td", {
    class: "gap-3 pl-6 pr-2 py-4"
  }, h("input", {
    class: "w-3 h-3 cursor-pointer text-[#51A4FB] bg-slate-100 border-slate-300 rounded dark:bg-slate-700 dark:border-slate-600",
    type: "checkbox",
    onClick: () => onClickChooseFile(file.parent_path, file.file_name),
    checked: Boolean(chosenFiles.find(_file => _file.parent_path === file.parent_path && _file.file_name === file.file_name))
  })), h("td", {
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
  }, humanFileSize(file.size_in_bytes)), isShowingPhotos || fileShareId ? null : h("td", {
    class: "px-6 py-4"
  }, h("section", {
    class: "flex items-center justify-end w-24"
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
  })), typeof onClickDeleteFile === 'undefined' ? null : h("span", {
    class: "invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2",
    onClick: () => onClickDeleteFile(file.parent_path, file.file_name)
  }, h("img", {
    src: "/public/images/delete.svg",
    class: "red drop-shadow-md",
    width: 20,
    height: 20,
    alt: `Delete ${itemSingleLabel}`,
    title: `Delete ${itemSingleLabel}`
  })), typeof onClickCreateShare === 'undefined' || file.file_share_id ? null : h("span", {
    class: "invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2",
    onClick: () => onClickCreateShare(join(file.parent_path, file.file_name))
  }, h("img", {
    src: "/public/images/share.svg",
    class: "white drop-shadow-md",
    width: 18,
    height: 18,
    alt: "Create public share link",
    title: "Create public share link"
  })), typeof onClickOpenManageShare === 'undefined' || !file.file_share_id ? null : h("span", {
    class: "invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2",
    onClick: () => onClickOpenManageShare(file.file_share_id)
  }, h("img", {
    src: "/public/images/share.svg",
    class: "white drop-shadow-md",
    width: 18,
    height: 18,
    alt: "Manage public share link",
    title: "Manage public share link"
  })))))), directories.length === 0 && files.length === 0 ? h("tr", null, h("td", {
    class: "flex gap-3 px-6 py-4 font-normal",
    colspan: 5
  }, h("div", {
    class: "text-md"
  }, h("div", {
    class: "font-medium text-slate-400"
  }, "No ", itemPluralLabel, " to show")))) : null)));
}