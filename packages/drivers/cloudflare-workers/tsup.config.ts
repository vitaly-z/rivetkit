import { defineConfig } from "tsup";

export default defineConfig({
	target: "es2020",
	format: ["cjs", "esm"],
	sourcemap: true,
	clean: true,
	dts: true,
	// Bundle only local dependencies
	noExternal: [/@rivet-gg\/.*?/],
	external: [/cloudflare:.*/],
	minify: true,
	platform: "neutral",
});
