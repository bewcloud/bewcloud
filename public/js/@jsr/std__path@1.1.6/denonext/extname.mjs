/* esm.sh - @jsr/std__path@1.1.6/extname */
import{isWindows as o}from"/public/js/@jsr/std__internal@^1.0.14/os?target=denonext";import{extname as e}from"./posix/extname.mjs";import{extname as n}from"./windows/extname.mjs";function x(m){return o?n(m):e(m)}export{x as extname};
//extname.mjs.map