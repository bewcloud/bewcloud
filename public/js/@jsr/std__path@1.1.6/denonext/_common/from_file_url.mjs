/* esm.sh - @jsr/std__path@1.1.6/_common/from_file_url */
function o(e){if(e=e instanceof URL?e:new URL(e),e.protocol!=="file:")throw new TypeError(`URL must be a file URL: received "${e.protocol}"`);return e}export{o as assertArg};
//from_file_url.mjs.map