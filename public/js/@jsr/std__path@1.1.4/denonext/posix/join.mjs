/* esm.sh - @jsr/std__path@1.1.4/posix/join */
import{assertPath as e}from"../_common/assert_path.mjs";import{fromFileUrl as f}from"./from-file-url.mjs";import{normalize as m}from"./normalize.mjs";function u(r,...o){if(r===void 0)return".";r instanceof URL&&(r=f(r)),o=r?[r,...o]:o,o.forEach(i=>e(i));let n=o.filter(i=>i.length>0).join("/");return n===""?".":m(n)}export{u as join};
//join.mjs.map