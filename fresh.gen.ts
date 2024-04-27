// DO NOT EDIT. This file is generated by Fresh.
// This file SHOULD be checked into source version control.
// This file is automatically updated during development when running `dev.ts`.

import * as $_404 from './routes/_404.tsx';
import * as $_app from './routes/_app.tsx';
import * as $_middleware from './routes/_middleware.tsx';
import * as $api_dashboard_save_links from './routes/api/dashboard/save-links.tsx';
import * as $api_dashboard_save_notes from './routes/api/dashboard/save-notes.tsx';
import * as $api_files_create_directory from './routes/api/files/create-directory.tsx';
import * as $api_files_delete_directory from './routes/api/files/delete-directory.tsx';
import * as $api_files_delete from './routes/api/files/delete.tsx';
import * as $api_files_get_directories from './routes/api/files/get-directories.tsx';
import * as $api_files_get from './routes/api/files/get.tsx';
import * as $api_files_move_directory from './routes/api/files/move-directory.tsx';
import * as $api_files_move from './routes/api/files/move.tsx';
import * as $api_files_rename_directory from './routes/api/files/rename-directory.tsx';
import * as $api_files_rename from './routes/api/files/rename.tsx';
import * as $api_files_search from './routes/api/files/search.tsx';
import * as $api_files_upload from './routes/api/files/upload.tsx';
import * as $api_news_add_feed from './routes/api/news/add-feed.tsx';
import * as $api_news_delete_feed from './routes/api/news/delete-feed.tsx';
import * as $api_news_import_feeds from './routes/api/news/import-feeds.tsx';
import * as $api_news_mark_read from './routes/api/news/mark-read.tsx';
import * as $api_news_refresh_articles from './routes/api/news/refresh-articles.tsx';
import * as $api_notes_save from './routes/api/notes/save.tsx';
import * as $dashboard from './routes/dashboard.tsx';
import * as $dav from './routes/dav.tsx';
import * as $files from './routes/files.tsx';
import * as $files_open_fileName_ from './routes/files/open/[fileName].tsx';
import * as $index from './routes/index.tsx';
import * as $login from './routes/login.tsx';
import * as $logout from './routes/logout.tsx';
import * as $news from './routes/news.tsx';
import * as $news_feeds from './routes/news/feeds.tsx';
import * as $notes from './routes/notes.tsx';
import * as $notes_open_fileName_ from './routes/notes/open/[fileName].tsx';
import * as $photos from './routes/photos.tsx';
import * as $settings from './routes/settings.tsx';
import * as $signup from './routes/signup.tsx';
import * as $Settings from './islands/Settings.tsx';
import * as $dashboard_Links from './islands/dashboard/Links.tsx';
import * as $dashboard_Notes from './islands/dashboard/Notes.tsx';
import * as $files_FilesWrapper from './islands/files/FilesWrapper.tsx';
import * as $news_Articles from './islands/news/Articles.tsx';
import * as $news_Feeds from './islands/news/Feeds.tsx';
import * as $notes_Note from './islands/notes/Note.tsx';
import * as $notes_NotesWrapper from './islands/notes/NotesWrapper.tsx';
import * as $photos_PhotosWrapper from './islands/photos/PhotosWrapper.tsx';
import { type Manifest } from '$fresh/server.ts';

const manifest = {
  routes: {
    './routes/_404.tsx': $_404,
    './routes/_app.tsx': $_app,
    './routes/_middleware.tsx': $_middleware,
    './routes/api/dashboard/save-links.tsx': $api_dashboard_save_links,
    './routes/api/dashboard/save-notes.tsx': $api_dashboard_save_notes,
    './routes/api/files/create-directory.tsx': $api_files_create_directory,
    './routes/api/files/delete-directory.tsx': $api_files_delete_directory,
    './routes/api/files/delete.tsx': $api_files_delete,
    './routes/api/files/get-directories.tsx': $api_files_get_directories,
    './routes/api/files/get.tsx': $api_files_get,
    './routes/api/files/move-directory.tsx': $api_files_move_directory,
    './routes/api/files/move.tsx': $api_files_move,
    './routes/api/files/rename-directory.tsx': $api_files_rename_directory,
    './routes/api/files/rename.tsx': $api_files_rename,
    './routes/api/files/search.tsx': $api_files_search,
    './routes/api/files/upload.tsx': $api_files_upload,
    './routes/api/news/add-feed.tsx': $api_news_add_feed,
    './routes/api/news/delete-feed.tsx': $api_news_delete_feed,
    './routes/api/news/import-feeds.tsx': $api_news_import_feeds,
    './routes/api/news/mark-read.tsx': $api_news_mark_read,
    './routes/api/news/refresh-articles.tsx': $api_news_refresh_articles,
    './routes/api/notes/save.tsx': $api_notes_save,
    './routes/dashboard.tsx': $dashboard,
    './routes/dav.tsx': $dav,
    './routes/files.tsx': $files,
    './routes/files/open/[fileName].tsx': $files_open_fileName_,
    './routes/index.tsx': $index,
    './routes/login.tsx': $login,
    './routes/logout.tsx': $logout,
    './routes/news.tsx': $news,
    './routes/news/feeds.tsx': $news_feeds,
    './routes/notes.tsx': $notes,
    './routes/notes/open/[fileName].tsx': $notes_open_fileName_,
    './routes/photos.tsx': $photos,
    './routes/settings.tsx': $settings,
    './routes/signup.tsx': $signup,
  },
  islands: {
    './islands/Settings.tsx': $Settings,
    './islands/dashboard/Links.tsx': $dashboard_Links,
    './islands/dashboard/Notes.tsx': $dashboard_Notes,
    './islands/files/FilesWrapper.tsx': $files_FilesWrapper,
    './islands/news/Articles.tsx': $news_Articles,
    './islands/news/Feeds.tsx': $news_Feeds,
    './islands/notes/Note.tsx': $notes_Note,
    './islands/notes/NotesWrapper.tsx': $notes_NotesWrapper,
    './islands/photos/PhotosWrapper.tsx': $photos_PhotosWrapper,
  },
  baseUrl: import.meta.url,
} satisfies Manifest;

export default manifest;
