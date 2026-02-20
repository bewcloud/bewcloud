/* esm.sh - @jsr/std__path@1.1.4/to-file-url */
import{isWindows as r}from"/public/js/@jsr/std__internal@^1.0.12/os?target=denonext";import{toFileUrl as i}from"./posix/to-file-url.mjs";import{toFileUrl as l}from"./windows/to-file-url.mjs";function s(o){return r?l(o):i(o)}export{s as toFileUrl};
//to-file-url.mjs.map