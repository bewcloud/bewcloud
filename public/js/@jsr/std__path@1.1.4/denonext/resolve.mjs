/* esm.sh - @jsr/std__path@1.1.4/resolve */
import{isWindows as r}from"/public/js/@jsr/std__internal@^1.0.12/os?target=denonext";import{resolve as e}from"./posix/resolve.mjs";import{resolve as s}from"./windows/resolve.mjs";function v(...o){return r?s(...o):e(...o)}export{v as resolve};
//resolve.mjs.map