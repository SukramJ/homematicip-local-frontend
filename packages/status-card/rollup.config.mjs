import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import replace from "@rollup/plugin-replace";
import terser from "@rollup/plugin-terser";

export default {
  input: "src/all-cards.ts",
  output: {
    file: "dist/homematicip-local-all-cards.js",
    format: "es",
    sourcemap: false,
  },
  treeshake: {
    // Keep all side effects — card/editor modules register custom elements
    moduleSideEffects: (id) => {
      if (id.includes("schedule-ui")) return true;
      if (id.includes("editor")) return true;
      if (id.includes("card")) return true;
      return false;
    },
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
      // Allow compilation of source files from sibling packages
      rootDir: "../..",
    }),
    terser({
      compress: { drop_console: false, passes: 2 },
      mangle: true,
    }),
  ],
};
