/* esm.sh - @jsr/std__internal@1.0.12/os */
function t(){let o=globalThis,s=o.Deno?.build?.os;return typeof s=="string"?s==="windows":o.navigator?.platform?.startsWith("Win")??o.process?.platform?.startsWith("win")??!1}var r=t();export{r as isWindows};
//os.mjs.map