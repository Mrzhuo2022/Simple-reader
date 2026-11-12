module.exports = {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    // The jsdom + ts-jest workers exceed their heap when too many run in
    // parallel (random "Jest worker ran out of memory" crashes with the
    // default worker count). Two workers run the whole suite in ~4s anyway.
    maxWorkers: 2,
    roots: ["<rootDir>/src"],
    setupFiles: ["<rootDir>/src/test-setup.ts"],
    testMatch: ["**/__tests__/**/*.+(ts|tsx|js)", "**/?(*.)+(spec|test).+(ts|tsx|js)"],
    transform: {
        "^.+\\.(ts|tsx)$": [
            "ts-jest",
            {
                // Transpile-only: per-file type checking is `pnpm run check`
                // (tsc --noEmit), which `pnpm run build` already gates on.
                isolatedModules: true,
            },
        ],
    },
}
