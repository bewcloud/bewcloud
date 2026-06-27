/* esm.sh - @jsr/std__path@1.1.4/_common/strip_trailing_separators */
function a(r,t){if(r.length<=1)return r;let l=r.length;for(let i=r.length-1;i>0&&t(r.charCodeAt(i));i--)l=i;return r.slice(0,l)}export{a as stripTrailingSeparators};
//strip_trailing_separators.mjs.map