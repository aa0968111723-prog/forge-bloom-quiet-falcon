import { build } from "vite";
await build({
  configFile: false,
  logLevel: "error",
  build: {
    outDir: "work/test-runtime",
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: "scripts/rpg-harness-entry.ts",
      formats: ["es"],
      fileName: () => "runtime.mjs",
    },
    rollupOptions: {
      external: [
        "three",
        "react",
        "zustand",
        "zustand/vanilla",
        "zustand/middleware",
        "@overworld-engine/inventory",
        "yuka",
      ],
    },
  },
});
