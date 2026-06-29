# Alta Private — Invitation Workflow

Alta Private is an **invitation-only banking program**. It is **not** a relationship tier.

## Relationship tier vs Alta Private

| Concept | Values | Meaning |
|---------|--------|---------|
| **Relationship tier** | Standard, Preferred, Premier | Published tier from Relationship Intelligence scoring |
| **Alta Private** | Not eligible · Eligible · Invited · Active | Separate program; activated only after invitation acceptance |

## Data model

`AltaPrivateInvitation` stores the invitation lifecycle:

| Field | Purpose |
|-------|---------|
| `userId` | Invited customer |
| `status` | `PENDING`, `ACCEPTED`, `DECLINED`, `REVOKED`, `EXPIRED` |
| `invitedByUserId` | Admin who sent the invitation |
| `invitationMessage` | Required message shown to the customer |
| `acceptedAt` / `declinedAt` / `revokedAt` | Response timestamps |
| `expiresAt` | Optional expiry (default 30 days) |

Membership remains represented by the existing `private_client` tag (`UserTagAssignment`). The tag is granted **only when the customer accepts** an invitation (or via admin override in exceptional cases).

## Admin process

1. Relationship Intelligence flags eligibility (`privateBankingEligible`).
2. Admin reviews the customer workspace → **Relationship** tab.
3. Admin clicks **Send Alta Private Invitation**, enters a required message, and confirms.
4. Audit event: `ALTA_PRIVATE_INVITATION_SENT`.
5. Admin may **Revoke Invitation** while pending (requires reason). Audit: `ALTA_PRIVATE_INVITATION_REVOKED`.

Only **admins** may send or revoke invitations. Operators can review eligibility but not send invitations.

## Customer process

1. Pending invitation surfaces on `/bank/private`, `/bank/relationship`, and `/bank/private/invitation/:invitationId`.
2. Customer reviews benefits and the invitation message.
3. **Accept** → grants `private_client`, activates pending private accounts, writes timeline event **Alta Private Activated**, audit `ALTA_PRIVATE_INVITATION_ACCEPTED` + `ALTA_PRIVATE_ACTIVATED`.
4. **Decline** → status `DECLINED`, audit `ALTA_PRIVATE_INVITATION_DECLINED`. No membership activated.

Customers cannot self-activate Alta Private without a pending invitation.

## Alta Gold Card

- Gold is exclusive to Alta Private members.
- Alta Private activation does **not** auto-open Gold.
- Non-members see: *"Alta Gold is available exclusively through Alta Private."*
- Members request Gold through the existing Alta Card review flow.

## Discord integration (placeholder)

Environment variables (optional):

```env
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_PRIVATE_ROLE_ID=
DISCORD_PRIVATE_CHANNEL_ID=
```

Hooks in `src/server/alta-private-discord.service.ts`:

- `sendAltaPrivateInvitationDiscordNotification(userId, invitationId)`
- `sendAltaPrivateAcceptedDiscordNotification(userId)`
- `sendAltaPrivateDeclinedDiscordNotification(userId)`

If env vars are missing, notifications are skipped and the web flow continues normally.

## Security

- Only the invited `userId` may accept or decline.
- Only admins may send/revoke invitations.
- Expired/revoked/non-pending invitations cannot be accepted.
- Discord failures never change invitation status.
- All send/revoke/accept/decline/activate actions are audit-logged.

## Internal queue

`/internal/queues/private-banking` lists eligible customers, pending invitations, active members, and declined/revoked/expired invitations.

## Related docs

- [Private banking overview](./private-banking.md)
- [Relationship Intelligence terminology](../relationship-intelligence-terminology.md)

## Private client experience (bank-wide)

Active Alta Private members receive understated recognition across Alta Bank — not a separate site:

- **Hero subtitle** — “Alta Private Client” beneath page titles (except `/bank/private`, which has its own layout)
- **Dashboard** — “Welcome back, {name}.” greeting, relationship snapshot, member since, assigned banker, benefits hint
- **Navigation** — “Alta Private” nav item (members only)
- **Relationship page** — Alta Private · Active, member since, banker card, benefits
- **Lending** — subtle note on relationship pricing and priority review

Banker assignment defaults from `src/lib/bank/alta-private-banker.config.ts` until per-client assignment is stored in the database.
