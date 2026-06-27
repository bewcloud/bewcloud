/* esm.sh - @jsr/std__path@1.1.4/relative */
import{isWindows as r}from"/public/js/@jsr/std__internal@^1.0.12/os?target=denonext";import{relative as t}from"./posix/relative.mjs";import{relative as o}from"./windows/relative.mjs";function m(i,e){return r?o(i,e):t(i,e)}export{m as relative};
//relative.mjs.map