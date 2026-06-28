import { test } from "@playwright/test";
import { canRunMutations, mutationSkipReason } from "./env.js";

export function describeMutations(title: string, fn: () => void): void {
  test.describe(title, () => {
    test.describe.configure({ mode: "serial" });
    test.beforeEach(({ }, testInfo) => {
      if (!canRunMutations()) {
        testInfo.skip(true, mutationSkipReason());
      }
    });
    fn();
  });
}

export function skipUnlessMutations(testInfo: { skip: (condition: boolean, reason: string) => void }): void {
  if (!canRunMutations()) {
    testInfo.skip(true, mutationSkipReason());
  }
}
