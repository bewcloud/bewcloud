/* esm.sh - @jsr/std__path@1.1.4/basename */
import{isWindows as m}from"/public/js/@jsr/std__internal@^1.0.12/os?target=denonext";import{basename as o}from"./posix/basename.mjs";import{basename as n}from"./windows/basename.mjs";function t(e,a=""){return m?n(e,a):o(e,a)}export{t as basename};
//basename.mjs.map