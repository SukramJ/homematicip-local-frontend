import typescript from "@rollup/plugin-typescript";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";

export default {
  input: "src/card.ts",
  output: {
    file: "dist/homematicip-local-climate-schedule-card.js",
    format: "es",
    sourcemap: false,
  },
  treeshake: {
    moduleSideEffects: (id) => {
      if (id.includes("editor")) return true;
      return false;
    },
  },
  plugins: [
    replace({
      preventAssignment: true,
      "process.env.NODE_ENV": JSON.stringify("production"),
    }),
    resolve({
      browser: true,
    }),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
      sourceMap: false,
      inlineSources: false,
    }),
    json(),
    terser({
      compress: {
        drop_console: true,
        passes: 2,
        pure_getters: true,
      },
      mangle: true,
      format: {
        comments: false,
      },
    }),
  ],
  external: [],
};
