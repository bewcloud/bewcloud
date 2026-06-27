/* esm.sh - @jsr/std__internal@1.0.14/os */
function n(){let o=globalThis,t=o.process?.platform;if(typeof t=="string")return t.startsWith("win");let s=o.Deno?.build?.os;return typeof s=="string"?s==="windows":o.navigator?.platform?.startsWith("Win")??!1}var e=n();export{e as isWindows};
//os.mjs.map