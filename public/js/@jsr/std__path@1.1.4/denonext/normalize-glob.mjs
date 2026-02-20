/* esm.sh - @jsr/std__path@1.1.4/normalize-glob */
import{isWindows as i}from"/public/js/@jsr/std__internal@^1.0.12/os?target=denonext";import{normalizeGlob as m}from"./posix/normalize-glob.mjs";import{normalizeGlob as l}from"./windows/normalize-glob.mjs";function s(o,r={}){return i?l(o,r):m(o,r)}export{s as normalizeGlob};
//normalize-glob.mjs.map