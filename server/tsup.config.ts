import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  sourcemap: true,
  clean: true,
  // Bundle the workspace package (consumed as TS source) into the server build.
  noExternal: ["@nestama/shared"],
});
