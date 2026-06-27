/* esm.sh - @jsr/std__path@1.1.4/from-file-url */
import{isWindows as o}from"/public/js/@jsr/std__internal@^1.0.12/os?target=denonext";import{fromFileUrl as i}from"./posix/from-file-url.mjs";import{fromFileUrl as m}from"./windows/from-file-url.mjs";function F(r){return o?m(r):i(r)}export{F as fromFileUrl};
//from-file-url.mjs.map