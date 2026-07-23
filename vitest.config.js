import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    pool: "threads",
    maxWorkers: 4,
    setupFiles: ["./tests/setup-env.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "../coverage/server",
      include: [
        "src/services/statistics.service.js",
        "src/services/analytics-math.service.js",
        "src/services/rating-math.service.js",
        "src/services/ocr/ocr-result-parser.js",
        "src/services/ocr/player-matcher.service.js",
        "src/services/title-rule.service.js",
        "src/services/achievement-rule.service.js",
        "src/services/challenge-rule.service.js",
        "src/services/rivalry-math.service.js",
        "src/services/hall-of-fame-ranking.service.js",
        "src/services/ai/deterministic-insight.service.js",
        "src/services/ai/ai-output.schemas.js",
        "src/constants/rbac.constants.js",
      ],
      thresholds: {
        statements: 70,
        branches: 55,
        functions: 70,
        lines: 72,
      },
    },
  },
});
