import { playwrightLauncher } from "@web/test-runner-playwright";

export default {
  files: "./tmp/test/**/*.spec.js",
  rootDir: "./",
  playwright: true,
  browsers: [playwrightLauncher({ product: "chromium", launchOptions: { headless: true } })],
  nodeResolve: true,
};
