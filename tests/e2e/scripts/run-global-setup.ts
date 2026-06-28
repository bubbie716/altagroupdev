import type { FullConfig } from "@playwright/test";
import globalSetup from "../global-setup.js";

await globalSetup({} as FullConfig);
