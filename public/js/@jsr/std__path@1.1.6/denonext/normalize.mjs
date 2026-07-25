/* esm.sh - @jsr/std__path@1.1.6/normalize */
import{isWindows as r}from"/public/js/@jsr/std__internal@^1.0.14/os?target=denonext";import{normalize as i}from"./posix/normalize.mjs";import{normalize as m}from"./windows/normalize.mjs";function s(o){return r?m(o):i(o)}export{s as normalize};
//normalize.mjs.map