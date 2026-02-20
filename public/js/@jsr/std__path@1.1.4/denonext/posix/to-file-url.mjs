/* esm.sh - @jsr/std__path@1.1.4/posix/to-file-url */
import{encodeWhitespace as o}from"../_common/to_file_url.mjs";import{isAbsolute as t}from"./is-absolute.mjs";function n(e){if(!t(e))throw new TypeError(`Path must be absolute: received "${e}"`);let r=new URL("file:///");return r.pathname=o(e.replace(/%/g,"%25").replace(/\\/g,"%5C")),r}export{n as toFileUrl};
//to-file-url.mjs.map