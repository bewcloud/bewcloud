import { Directory, DirectoryFile } from '/lib/types.ts';
import { humanFileSize, TRASH_PATH } from '/lib/utils/files.ts';

interface ListFilesProps {
  directories: Directory[];
  files: DirectoryFile[];
  onClickDeleteDirectory: (parentPath: string, name: string) => Promise<void>;
  onClickDeleteFile: (parentPath: string, name: string) => Promise<void>;
  onClickOpenRenameDirectory: (parentPath: string, name: string) => void;
  onClickOpenRenameFile: (parentPath: string, name: string) => void;
  onClickOpenMoveDirectory: (parentPath: string, name: string) => void;
  onClickOpenMoveFile: (parentPath: string, name: string) => void;
}

export default function ListFiles(
  {
    directories,
    files,
    onClickDeleteDirectory,
    onClickDeleteFile,
    onClickOpenRenameDirectory,
    onClickOpenRenameFile,
    onClickOpenMoveDirectory,
    onClickOpenMoveFile,
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

  return (
    <section class='mx-auto max-w-7xl my-8'>
      <table class='w-full border-collapse bg-gray-900 text-left text-sm text-slate-500 shadow-sm rounded-md'>
        <thead>
          <tr class='border-b border-slate-600'>
            <th scope='col' class='px-6 py-4 font-medium text-white'>Name</th>
            <th scope='col' class='px-6 py-4 font-medium text-white w-56'>Last update</th>
            <th scope='col' class='px-6 py-4 font-medium text-white w-32'>Size</th>
            <th scope='col' class='px-6 py-4 font-medium text-white w-20'></th>
          </tr>
        </thead>
        <tbody class='divide-y divide-slate-600 border-t border-slate-600'>
          {directories.map((directory) => {
            const fullPath = `${directory.parent_path}${directory.directory_name}/`;

            return (
              <tr class='bg-slate-700 hover:bg-slate-600 group'>
                <td class='flex gap-3 px-6 py-4'>
                  <a
                    href={`/files?path=${fullPath}`}
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
                <td class='px-6 py-4 text-slate-200'>
                  -
                </td>
                <td class='px-6 py-4'>
                  {fullPath === TRASH_PATH ? null : (
                    <section class='flex items-center justify-end w-20'>
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
                        onClick={() => onClickOpenMoveDirectory(directory.parent_path, directory.directory_name)}
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
                      <span
                        class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100'
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
                    </section>
                  )}
                </td>
              </tr>
            );
          })}
          {files.map((file) => (
            <tr class='bg-slate-700 hover:bg-slate-600 group'>
              <td class='flex gap-3 px-6 py-4'>
                <a
                  href={`/files/open/${file.file_name}?path=${file.parent_path}`}
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
              <td class='px-6 py-4 text-slate-200'>
                {humanFileSize(file.size_in_bytes)}
              </td>
              <td class='px-6 py-4'>
                <section class='flex items-center justify-end w-20'>
                  <span
                    class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2'
                    onClick={() => onClickOpenRenameFile(file.parent_path, file.file_name)}
                  >
                    <img
                      src='/images/rename.svg'
                      class='white drop-shadow-md'
                      width={18}
                      height={18}
                      alt='Rename file'
                      title='Rename file'
                    />
                  </span>
                  <span
                    class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100 mr-2'
                    onClick={() => onClickOpenMoveFile(file.parent_path, file.file_name)}
                  >
                    <img
                      src='/images/move.svg'
                      class='white drop-shadow-md'
                      width={18}
                      height={18}
                      alt='Move file'
                      title='Move file'
                    />
                  </span>
                  <span
                    class='invisible cursor-pointer group-hover:visible opacity-50 hover:opacity-100'
                    onClick={() => onClickDeleteFile(file.parent_path, file.file_name)}
                  >
                    <img
                      src='/images/delete.svg'
                      class='red drop-shadow-md'
                      width={20}
                      height={20}
                      alt='Delete file'
                      title='Delete file'
                    />
                  </span>
                </section>
              </td>
            </tr>
          ))}
          {directories.length === 0 && files.length === 0
            ? (
              <tr>
                <td class='flex gap-3 px-6 py-4 font-normal' colspan={4}>
                  <div class='text-md'>
                    <div class='font-medium text-slate-400'>No files to show</div>
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
