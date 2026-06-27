/* esm.sh - @jsr/std__path@1.1.4/posix/from-file-url */
import{assertArg as o}from"../_common/from_file_url.mjs";function t(e){return e=o(e),decodeURIComponent(e.pathname.replace(/%(?![0-9A-Fa-f]{2})/g,"%25"))}export{t as fromFileUrl};
//from-file-url.mjs.map