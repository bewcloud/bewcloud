/* esm.sh - @jsr/std__path@1.1.4/is-absolute */
import{isWindows as s}from"/public/js/@jsr/std__internal@^1.0.12/os?target=denonext";import{isAbsolute as i}from"./posix/is-absolute.mjs";import{isAbsolute as t}from"./windows/is-absolute.mjs";function m(o){return s?t(o):i(o)}export{m as isAbsolute};
//is-absolute.mjs.map