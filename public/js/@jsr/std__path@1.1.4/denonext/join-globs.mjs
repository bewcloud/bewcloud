/* esm.sh - @jsr/std__path@1.1.4/join-globs */
import{isWindows as n}from"/public/js/@jsr/std__internal@^1.0.12/os?target=denonext";import{joinGlobs as r}from"./posix/join-globs.mjs";import{joinGlobs as s}from"./windows/join-globs.mjs";function b(o,i={}){return n?s(o,i):r(o,i)}export{b as joinGlobs};
//join-globs.mjs.map