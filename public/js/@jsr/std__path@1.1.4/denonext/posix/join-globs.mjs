/* esm.sh - @jsr/std__path@1.1.4/posix/join-globs */
import{join as f}from"./join.mjs";import{SEPARATOR as l}from"./constants.mjs";import{normalizeGlob as m}from"./normalize-glob.mjs";function c(r,e={}){let{globstar:n=!1}=e;if(!n||r.length===0)return f(...r);let o;for(let i of r){let t=i;t.length>0&&(o?o+=`${l}${t}`:o=t)}return o?m(o,{globstar:n}):"."}export{c as joinGlobs};
//join-globs.mjs.map