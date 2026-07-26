const HtmlWebpackPlugin = require("html-webpack-plugin")
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

// esbuild-loader transpiles each file in isolation (no type checking); run
// `npm run check` (tsc --noEmit) for types. Electron 39 ships modern V8/Chromium,
// so es2022 output is safe for all three targets.
const esbuildRule = test => ({
    test: test,
    include: /src/,
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
    },
    use: [
        {
            loader: "esbuild-loader",
            options: {
                target: "es2022",
            },
        },
    ],
})

module.exports = env => {
    const dev = Boolean(env && env.dev)
    const base = {
        mode: dev ? "development" : "production",
        watch: dev,
        devtool: dev ? "eval-cheap-module-source-map" : false,
    }
    return [
        {
            ...base,
            entry: "./src/electron.ts",
            target: "electron-main",
            module: {
                rules: [esbuildRule(/\.ts$/)],
            },
            output: {
                devtoolModuleFilenameTemplate: "[absolute-resource-path]",
                path: __dirname + "/dist",
                filename: "electron.js",
            },
            node: {
                __dirname: false,
            },
        },
        {
            ...base,
            entry: "./src/preload.ts",
            target: "electron-preload",
            module: {
                rules: [esbuildRule(/\.ts$/)],
            },
            output: {
                path: __dirname + "/dist",
                filename: "preload.js",
            },
        },
        {
            ...base,
            entry: "./src/index.tsx",
            target: "web",
            // Source maps are excluded from packaged builds (electron-builder
            // drops *.js.map) and would ship the full @fluentui/react source to
            // users, so don't emit them in production. Re-enable locally if you
            // need to debug the renderer.
            performance: {
                hints: false,
            },
            module: {
                rules: [esbuildRule(/\.ts(x?)$/)],
            },
            output: {
                path: __dirname + "/dist",
                filename: "index.js",
            },
            plugins: [
                new NodePolyfillPlugin(),
                new HtmlWebpackPlugin({
                    template: "./src/index.html",
                }),
            ],
        },
    ]
}
