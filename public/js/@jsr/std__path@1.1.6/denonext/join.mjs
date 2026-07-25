/* esm.sh - @jsr/std__path@1.1.6/join */
import{isWindows as n}from"/public/js/@jsr/std__internal@^1.0.14/os?target=denonext";import{join as r}from"./posix/join.mjs";import{join as m}from"./windows/join.mjs";function j(o,...i){return n?m(o,...i):r(o,...i)}export{j as join};
//join.mjs.map