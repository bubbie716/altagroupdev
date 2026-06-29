import type { AltaPrivateBankerProfile } from "@/lib/bank/alta-private-client.types";

/**
 * Default private banker shown to Alta Private members until per-client assignment is stored in the database.
 * Replace this module or extend lookup in `getAltaPrivateClientContext` when assignment is modeled.
 */
export const DEFAULT_ALTA_PRIVATE_BANKER: AltaPrivateBankerProfile = {
  name: "FTLCEO",
  title: "Managing Director",
};
