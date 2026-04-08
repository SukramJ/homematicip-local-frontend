import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";

export default {
  input: "src/index.ts",
  output: {
    file: "dist/homematicip-local-status-card.js",
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
