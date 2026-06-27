/* esm.sh - @jsr/std__path@1.1.4/glob-to-regexp */
import{isWindows as r}from"/public/js/@jsr/std__internal@^1.0.12/os?target=denonext";import{globToRegExp as e}from"./posix/glob-to-regexp.mjs";import{globToRegExp as g}from"./windows/glob-to-regexp.mjs";function s(o,p={}){return r?g(o,p):e(o,p)}export{s as globToRegExp};
//glob-to-regexp.mjs.map