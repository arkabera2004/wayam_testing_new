import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    host: true,
    port: 8080,
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    // Redirect TanStack Start's bundled server entry to src/server.ts
    // (our SSR error wrapper) — nitro/vite builds from this. This is
    // `server.entry` (the low-level HTTP fetch-handler entry), not
    // `start.entry` (a *different* option for a "start instance" /
    // createStart() config file we don't have — passing "server" there
    // by mistake breaks client hydration entirely, since the generated
    // route tree then expects src/server.ts to export `startInstance`).
    tanstackStart({ server: { entry: "server" } }),
    // Runs the actual Nitro build (presets, zero-config Vercel output,
    // `.output/server/index.mjs`) that consumes the entry above — without
    // this, `vite build` only emits a plain dist/client + dist/server SSR
    // bundle that Vercel's zero-config detection can't route to. MUST
    // come after tanstackStart().
    nitro(),
    viteReact(),
  ],
});
