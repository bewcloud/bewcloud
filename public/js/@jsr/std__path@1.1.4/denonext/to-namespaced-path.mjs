/* esm.sh - @jsr/std__path@1.1.4/to-namespaced-path */
import{isWindows as o}from"/public/js/@jsr/std__internal@^1.0.12/os?target=denonext";import{toNamespacedPath as t}from"./posix/to-namespaced-path.mjs";import{toNamespacedPath as e}from"./windows/to-namespaced-path.mjs";function r(a){return o?e(a):t(a)}export{r as toNamespacedPath};
//to-namespaced-path.mjs.map