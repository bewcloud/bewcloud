/* esm.sh - @jsr/std__path@1.1.4/_common/common */
function s(f,o){let[l="",...c]=f,e=l.split(o),n=e.length,i="";for(let a of c){let r=a.split(o);r.length<=n&&(n=r.length,i="");for(let t=0;t<n;t++)if(r[t]!==e[t]){n=t,i=t===0?"":o;break}}return e.slice(0,n).join(o)+i}export{s as common};
//common.mjs.map