/* esm.sh - @jsr/std__path@1.1.6/dirname */
import{isWindows as i}from"/public/js/@jsr/std__internal@^1.0.14/os?target=denonext";import{dirname as m}from"./posix/dirname.mjs";import{dirname as o}from"./windows/dirname.mjs";function s(r){return i?o(r):m(r)}export{s as dirname};
//dirname.mjs.map