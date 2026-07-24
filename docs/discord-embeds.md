# Discord Embeds — Internal Operations Tool

Alta staff with **admin** or **operator** access can compose Discord embeds at `/internal/embeds`. This tool validates embed content against Discord limits, renders a live preview, and sends messages when bot credentials are configured.

## Access control

- Route: `/internal/embeds`
- Guard: parent `/internal` layout (`internalBeforeLoad`) requires admin or operator tag
- Server actions: `requireOperator()` on all embed send/config endpoints
- API route: `POST /api/internal/discord/embed` validates session cookie server-side

Never expose `DISCORD_BOT_TOKEN` to the browser. The token is read only in server code (`src/server/discord-embed.service.ts`).

## Environment variables

Add to `.env` (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `DISCORD_BOT_TOKEN` | Bot token for Discord REST API |
| `DISCORD_GUILD_ID` | Target guild (required to confirm sending is configured) |
| `DISCORD_CHANNEL_INFORMATION` | Override channel ID for `#information` |
| `DISCORD_CHANNEL_ANNOUNCEMENTS` | Override for `#announcements` |
| `DISCORD_CHANNEL_BANK_NOTICES` | Override for `#bank-notices` |
| `DISCORD_CHANNEL_EXCHANGE_NOTICES` | Override for `#exchange-notices` |
| `DISCORD_CHANNEL_TERMINAL_UPDATES` | Override for `#terminal-updates` |
| `DISCORD_CHANNEL_DEVELOPER_UPDATES` | Override for `#developer-updates` |
| `DISCORD_CHANNEL_INTERNAL_LOG` | Override for `#internal-log` |

If a channel env var is unset, quick-fill presets use mock IDs. You can also paste **any** Discord channel snowflake directly into the Channel ID field.

### Bot setup

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications).
2. Add a **Bot** user and copy the token into `DISCORD_BOT_TOKEN`.
3. Enable **Message Content Intent** if you plan to read messages later (not required for sending embeds).
4. Invite the bot to your Alta guild with `Send Messages` and `Embed Links` permissions.
5. Copy the guild ID into `DISCORD_GUILD_ID`.
6. Enable Developer Mode in Discord, right-click each target channel, copy ID, and set the `DISCORD_CHANNEL_*` variables.

## Embed limits

Enforced client-side (preview) and server-side (send):

| Field | Max |
|-------|-----|
| Title | 256 |
| Description | 4096 |
| Field name | 256 |
| Field value | 1024 |
| Fields count | 25 |
| Footer | 2048 |
| Total embed content | 6000 |

## Templates

Built-in presets populate the editor:

- **Bank Notice** — Alta Bank operational notice
- **Exchange Notice** — market participant notice
- **IPO Announcement** — company, ticker, price, status fields
- **Developer API Update** — API changelog notice
- **Maintenance Notice** — affected services, start time, duration

Templates are starting points; staff can edit all fields before sending.

## Sending behavior

### Configured (`DISCORD_BOT_TOKEN` + `DISCORD_GUILD_ID`)

- `sendDiscordEmbedRecord` server function posts to Discord REST API:
  `POST https://discord.com/api/v10/channels/{channelId}/messages`
- Optional link buttons are sent as message components (style 5 link buttons) when present.

### Not configured

- Validation still runs
- Response: **"Embed validated. Discord sending is not configured."**
- No error thrown — safe for staging/preview environments

## API placeholder

`POST /api/internal/discord/embed`

Request body:

```json
{
  "draft": { "...DiscordEmbedDraft fields..." }
}
```

Also accepts legacy-shaped fields (`channelId`, `embed`, `components`) in the type definition for future webhook integrations; the handler currently requires `draft`.

Requires authenticated internal session (admin/operator).

## Security notes

- Bot token and guild ID are server-only environment variables
- All sends re-validate embed limits on the server
- URLs must be `http:` or `https:`
- String fields are trimmed and length-capped before Discord API calls
- **TODO:** Add per-operator rate limiting before enabling production sends at scale

## Future integration

- Dedicated Alta Discord bot service with audit log entries in `#internal-log`
- Webhook fallback per channel for simpler deployments
- Scheduled sends and draft library
- Auto-post from bank/exchange ops events (maintenance, IPO approval, etc.)

## Related code

| Path | Role |
|------|------|
| `src/routes/internal/embeds.tsx` | Internal page |
| `src/components/internal/discord-embed-builder.tsx` | Editor + validation UI |
| `src/components/internal/discord-embed-preview.tsx` | Discord-style preview |
| `src/lib/discord/embed-*.ts` | Types, templates, validation |
| `src/lib/discord/discord-embed.functions.ts` | Server functions |
| `src/server/discord-embed.service.ts` | Discord REST send logic |
| `src/routes/api/internal/discord/embed.ts` | HTTP API endpoint |
