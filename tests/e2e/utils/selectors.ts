/** Shared Playwright selectors for Alta Bank E2E tests. */

export const bankSubNav = "nav";
export const pageShellTitle = "h1";
export const primaryButton = (name: RegExp | string) => ({ role: "button" as const, name });
export const depositAmount = () => ({ label: /amount/i });
export const depositProof = () => 'input[type="file"]';
