/* esm.sh - @jsr/std__path@1.1.6/_common/env */
function c(t){let o=globalThis,n=o.process?.cwd??o.Deno?.cwd;if(typeof n!="function")throw new TypeError(t);return n()}export{c as cwd};
//env.mjs.map