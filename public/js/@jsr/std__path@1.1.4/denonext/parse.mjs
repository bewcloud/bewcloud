/* esm.sh - @jsr/std__path@1.1.4/parse */
import{isWindows as o}from"/public/js/@jsr/std__internal@^1.0.12/os?target=denonext";import{parse as s}from"./posix/parse.mjs";import{parse as i}from"./windows/parse.mjs";function m(r){return o?i(r):s(r)}export{m as parse};
//parse.mjs.map