// Note: `npm test` sets NODE_OPTIONS=--no-experimental-webstorage. Node 26's
// own built-in `localStorage` global otherwise wins over jsdom's, leaving
// `window.localStorage` in a broken (non-functional) state for any test
// that touches it — see useStarred.test.ts.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
