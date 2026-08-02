/**
 * Preload for `tsx --test` / `node --test`.
 * Forces Discord live delivery off even when NODE_ENV is unset.
 */
import { forceDisableDiscordLiveDelivery } from "../src/lib/discord/discord-delivery-guard.ts";

forceDisableDiscordLiveDelivery();
