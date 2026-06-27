/* esm.sh - @jsr/std__path@1.1.4/_common/format */
function t(r,e){let o=e.dir||e.root,n=e.base||(e.name??"")+(e.ext??"");return o?n===r?o:o===e.root?o+n:o+r+n:n}function f(r){if(r===null||typeof r!="object")throw new TypeError(`The "pathObject" argument must be of type Object, received type "${typeof r}"`)}export{t as _format,f as assertArg};
//format.mjs.map