/* esm.sh - @jsr/std__path@1.1.4/posix/glob-to-regexp */
import{_globToRegExp as s}from"../_common/glob_to_reg_exp.mjs";var p={sep:"/+",sepMaybe:"/*",seps:["/"],globstar:"(?:[^/]*(?:/|$)+)*",wildcard:"[^/]*",escapePrefix:"\\"};function t(e,o={}){return s(p,e,o)}export{t as globToRegExp};
//glob-to-regexp.mjs.map