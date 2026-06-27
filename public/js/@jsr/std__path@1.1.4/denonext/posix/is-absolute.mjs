/* esm.sh - @jsr/std__path@1.1.4/posix/is-absolute */
import{assertPath as o}from"../_common/assert_path.mjs";import{isPosixPathSeparator as t}from"./_util.mjs";function s(r){return o(r),r.length>0&&t(r.charCodeAt(0))}export{s as isAbsolute};
//is-absolute.mjs.map