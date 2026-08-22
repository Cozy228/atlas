module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      startServerCommand:
        "node -e \"process.env.PORT='4173'; import('./.output/server/index.mjs')\"",
      startServerReadyPattern: "ready",
      startServerReadyTimeout: 30_000,
      url: ["http://127.0.0.1:4173/"],
      settings: {
        onlyCategories: ["performance"],
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { aggregationMethod: "median-run", minScore: 0.9 }],
        "largest-contentful-paint": [
          "error",
          { aggregationMethod: "median", maxNumericValue: 2_500 },
        ],
        "cumulative-layout-shift": ["error", { aggregationMethod: "median", maxNumericValue: 0.1 }],
        "total-blocking-time": ["error", { aggregationMethod: "median", maxNumericValue: 200 }],
      },
    },
  },
};
