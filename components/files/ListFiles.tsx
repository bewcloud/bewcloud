import { join } from 'std/path/join.ts';

import { Directory, DirectoryFile } from '/lib/types.ts';
import { humanFileSize, TRASH_PATH } from '/lib/utils/files.ts';

interface ListFilesProps {
  directories: Directory[];
  files: DirectoryFile[];
  chosenDirectories?: Pick<Directory, 'parent_path' | 'directory_name'>[];
  chosenFiles?: Pick<DirectoryFile, 'parent_path' | 'file_name'>[];
  onClickChooseFile?: (parentPath: string, name: string) => void;
  onClickChooseDirectory?: (parentPath: string, name: string) => void;
  onClickOpenRenameDirectory?: (parentPath: string, name: string) => void;
  onClickOpenRenameFile?: (parentPath: string, name: string) => void;
  onClickOpenMoveDirectory?: (parentPath: string, name: string) => void;
  onClickOpenMoveFile?: (parentPath: string, name: string) => void;
  onClickDeleteDirectory?: (parentPath: string, name: string) => Promise<void>;
  onClickDeleteFile?: (parentPath: string, name: string) => Promise<void>;
  onClickCreateShare?: (filePath: string) => void;
  onClickOpenManageShare?: (fileShareId: string) => void;
  isShowingNotes?: boolean;
  isShowingPhotos?: boolean;
  fileShareId?: string;
}

export default function ListFiles(
  {
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
    isShowingNotes,
    isShowingPhotos,
    fileShareId,
  }: ListFilesProps,
) {
  const dateFormat = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

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
      files.forEach((files) => onClickChooseFile(files.parent_path, files.file_name));
    }

    if (typeof onClickChooseDirectory !== 'undefined') {
      directories.forEach((directory) => onClickChooseDirectory(directory.parent_path, directory.directory_name));
    }
  }

  return (
    <section class='mx-auto max-w-7xl my-8'>
      <table class='w-full border-collapse bg-gray-900 text-left text-sm text-slate-500 shadow-sm rounded-md'>
        <thead>
          <tr class='border-b border-slate-600'>
            {(directories.length === 0 && files.length === 0) ||
                (typeof onClickChooseFile === 'undefined' && typeof onClickChooseDirectory === 'undefined') ||
                fileShareId
              ? null
              : (
                <th scope='col' class='pl-6 pr-2 font-medium text-white w-3'>
                  <input
                    class='w-3 h-3 cursor-pointer text-[#51A4FB] bg-slate-100 border-slate-300 rounded dark:bg-slate-700 dark:border-slate-600'
                    type='checkbox'
                    onClick={() => chooseAllItems()}
                    checked={isAnyItemChosen}
                  />
                </th>
              )}
            <th scope='col' class='px-6 py-4 font-medium text-white'>Name</th>
            <th scope='col' class='px-6 py-4 font-medium text-white w-64'>Last update</th>
            {isShowingNotes || isShowingPhotos
              ? null
              : <th scope='col' class='px-6 py-4 font-medium text-white w-32'>Size</th>}
            {isShowingPhotos || fileShareId
              ? null
              : <th scope='col' class='px-6 py-4 font-medium text-white w-24'></th>}
          </tr>
        </thead>
        <tbody class='divide-y divide-slate-600 border-t border-slate-600'>
          {directories.map((directory) => {
            const fullPath = `${directory.parent_path}${directory.directory_name}/`;

            return (
              <tr class='bg-slate-700 hover:bg-slate-600 group'>
                {typeof onClickChooseDirectory === 'undefined' || fileShareId ? null : (
                  <td class='gap-3 pl-6 pr-2 py-4'>
                    {fullPath === TRASH_PATH ? null : (
                      <input
                        class='w-3 h-3 cursor-pointer text-[#51A4FB] bg-slate-100 border-slate-300 rounded dark:bg-slate-700 dark:border-slate-600'
                        type='checkbox'
                        onClick={() => onClickChooseDirectory(directory.parent_path, directory.directory_name)}
                        checked={Boolean(chosenDirectories.find((_directory) =>
                          _directory.parent_path === directory.parent_path &&
                          _directory.directory_name === directory.directory_name
                        ))}
                      />
                    )}
                  </td>
                )}
                <td class='flex gap-3 px-6 py-4'>
                  <a
                    href={`/${routePath}?path=${encodeURIComponent(fullPath)}`}
                    class='flex items-center font-normal text-white'
                  >
                    <img
                      src={`/images/${fullPath === TRASH_PATH ? 'trash.svg' : 'directory.svg'}`}
                      class='white drop-shadow-md mr-2'
                      width={18}
                      height={18}
                      alt='Directory'
                      title='Directory'
                    />
                    {directory.directory_name}
                  </a>
                </td>
                <td class='px-6 py-4 text-slate-200'>
                  {dateFormat.format(new Date(directory.updated_at))}
                </td>
                {isShowingNotes || isShowingPhotos ? null : (
                  <td class='px-6 py-4 text-slate-200'>
                    -
                  </td>
                )}
                {isShowingPhotos || fileShareId ? null : (
                  <td class='px-6 py-4'>
                    {(fullPath === TRASH_PATH || typeof onClickOpenRenameDirectory === 'undefined' ||
                        typeof onClickOpenMoveDirectory === 'undefined')
                      ? null
                      : (
                        <section class='flex items-center justify-end w-24'>
                          <span
                            class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2'
                            onClick={() => onClickOpenRenameDirectory(directory.parent_path, directory.directory_name)}
                          >
                            <img
                              src='/images/rename.svg'
                              class='white drop-shadow-md'
                              width={18}
                              height={18}
                              alt='Rename directory'
                              title='Rename directory'
                            />
                          </span>
                          <span
                            class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2'
                            onClick={() =>
                              onClickOpenMoveDirectory(directory.parent_path, directory.directory_name)}
                          >
                            <img
                              src='/images/move.svg'
                              class='white drop-shadow-md'
                              width={18}
                              height={18}
                              alt='Move directory'
                              title='Move directory'
                            />
                          </span>
                          {typeof onClickDeleteDirectory === 'undefined' ? null : (
                            <span
                              class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2'
                              onClick={() => onClickDeleteDirectory(directory.parent_path, directory.directory_name)}
                            >
                              <img
                                src='/images/delete.svg'
                                class='red drop-shadow-md'
                                width={20}
                                height={20}
                                alt='Delete directory'
                                title='Delete directory'
                              />
                            </span>
                          )}
                          {typeof onClickCreateShare === 'undefined' || directory.file_share_id ? null : (
                            <span
                              class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2'
                              onClick={() => onClickCreateShare(join(directory.parent_path, directory.directory_name))}
                            >
                              <img
                                src='/images/share.svg'
                                class='white drop-shadow-md'
                                width={18}
                                height={18}
                                alt='Create public share link'
                                title='Create public share link'
                              />
                            </span>
                          )}
                          {typeof onClickOpenManageShare === 'undefined' || !directory.file_share_id ? null : (
                            <span
                              class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2'
                              onClick={() => onClickOpenManageShare(directory.file_share_id!)}
                            >
                              <img
                                src='/images/share.svg'
                                class='white drop-shadow-md'
                                width={18}
                                height={18}
                                alt='Manage public share link'
                                title='Manage public share link'
                              />
                            </span>
                          )}
                        </section>
                      )}
                  </td>
                )}
              </tr>
            );
          })}
          {files.map((file) => (
            <tr class='bg-slate-700 hover:bg-slate-600 group'>
              {typeof onClickChooseFile === 'undefined' || fileShareId ? null : (
                <td class='gap-3 pl-6 pr-2 py-4'>
                  <input
                    class='w-3 h-3 cursor-pointer text-[#51A4FB] bg-slate-100 border-slate-300 rounded dark:bg-slate-700 dark:border-slate-600'
                    type='checkbox'
                    onClick={() => onClickChooseFile(file.parent_path, file.file_name)}
                    checked={Boolean(
                      chosenFiles.find((_file) =>
                        _file.parent_path === file.parent_path && _file.file_name === file.file_name
                      ),
                    )}
                  />
                </td>
              )}
              <td class='flex gap-3 px-6 py-4'>
                <a
                  href={`/${routePath}/open/${encodeURIComponent(file.file_name)}?path=${
                    encodeURIComponent(file.parent_path)
                  }`}
                  class='flex items-center font-normal text-white'
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  <img
                    src='/images/file.svg'
                    class='white drop-shadow-md mr-2'
                    width={18}
                    height={18}
                    alt='File'
                    title='File'
                  />
                  {file.file_name}
                </a>
              </td>
              <td class='px-6 py-4 text-slate-200'>
                {dateFormat.format(new Date(file.updated_at))}
              </td>
              {isShowingNotes ? null : (
                <td class='px-6 py-4 text-slate-200'>
                  {humanFileSize(file.size_in_bytes)}
                </td>
              )}
              {isShowingPhotos || fileShareId ? null : (
                <td class='px-6 py-4'>
                  <section class='flex items-center justify-end w-24'>
                    {typeof onClickOpenRenameFile === 'undefined' ? null : (
                      <span
                        class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2'
                        onClick={() => onClickOpenRenameFile(file.parent_path, file.file_name)}
                      >
                        <img
                          src='/images/rename.svg'
                          class='white drop-shadow-md'
                          width={18}
                          height={18}
                          alt={`Rename ${itemSingleLabel}`}
                          title={`Rename ${itemSingleLabel}`}
                        />
                      </span>
                    )}
                    {typeof onClickOpenMoveFile === 'undefined' ? null : (
                      <span
                        class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2'
                        onClick={() => onClickOpenMoveFile(file.parent_path, file.file_name)}
                      >
                        <img
                          src='/images/move.svg'
                          class='white drop-shadow-md'
                          width={18}
                          height={18}
                          alt={`Move ${itemSingleLabel}`}
                          title={`Move ${itemSingleLabel}`}
                        />
                      </span>
                    )}
                    {typeof onClickDeleteFile === 'undefined' ? null : (
                      <span
                        class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2'
                        onClick={() => onClickDeleteFile(file.parent_path, file.file_name)}
                      >
                        <img
                          src='/images/delete.svg'
                          class='red drop-shadow-md'
                          width={20}
                          height={20}
                          alt={`Delete ${itemSingleLabel}`}
                          title={`Delete ${itemSingleLabel}`}
                        />
                      </span>
                    )}
                    {typeof onClickCreateShare === 'undefined' || file.file_share_id ? null : (
                      <span
                        class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2'
                        onClick={() => onClickCreateShare(join(file.parent_path, file.file_name))}
                      >
                        <img
                          src='/images/share.svg'
                          class='white drop-shadow-md'
                          width={18}
                          height={18}
                          alt='Create public share link'
                          title='Create public share link'
                        />
                      </span>
                    )}
                    {typeof onClickOpenManageShare === 'undefined' || !file.file_share_id ? null : (
                      <span
                        class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2'
                        onClick={() => onClickOpenManageShare(file.file_share_id!)}
                      >
                        <img
                          src='/images/share.svg'
                          class='white drop-shadow-md'
                          width={18}
                          height={18}
                          alt='Manage public share link'
                          title='Manage public share link'
                        />
                      </span>
                    )}
                  </section>
                </td>
              )}
            </tr>
          ))}
          {directories.length === 0 && files.length === 0
            ? (
              <tr>
                <td class='flex gap-3 px-6 py-4 font-normal' colspan={5}>
                  <div class='text-md'>
                    <div class='font-medium text-slate-400'>No {itemPluralLabel} to show</div>
                  </div>
                </td>
              </tr>
            )
            : null}
        </tbody>
      </table>
    </section>
  );
}
