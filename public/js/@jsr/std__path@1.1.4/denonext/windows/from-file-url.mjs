/* esm.sh - @jsr/std__path@1.1.4/windows/from-file-url */
import{assertArg as t}from"../_common/from_file_url.mjs";function n(e){e=t(e);let a=decodeURIComponent(e.pathname.replace(/\//g,"\\").replace(/%(?![0-9A-Fa-f]{2})/g,"%25")).replace(/^\\*([A-Za-z]:)(\\|$)/,"$1\\");return e.hostname!==""&&(a=`\\\\${e.hostname}${a}`),a}export{n as fromFileUrl};
//from-file-url.mjs.map