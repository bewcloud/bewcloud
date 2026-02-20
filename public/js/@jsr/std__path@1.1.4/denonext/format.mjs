/* esm.sh - @jsr/std__path@1.1.4/format */
import{isWindows as r}from"/public/js/@jsr/std__internal@^1.0.12/os?target=denonext";import{format as m}from"./posix/format.mjs";import{format as t}from"./windows/format.mjs";function s(o){return r?t(o):m(o)}export{s as format};
//format.mjs.map