/** App version (package.json, injected at build time by Vite's `define`). */
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
