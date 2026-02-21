import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";

export default {
  input: "src/homematic-config.ts",
  output: {
    file: "dist/homematic-config.js",
    format: "es",
    sourcemap: false,
  },
  plugins: [
    replace({
      preventAssignment: true,
      "process.env.NODE_ENV": JSON.stringify("production"),
    }),
    resolve({ browser: true }),
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
      format: { comments: false },
    }),
  ],
};
