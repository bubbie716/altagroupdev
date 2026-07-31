import { useMemo, useRef, useState } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { Card } from "@/components/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BankActionProgressView,
  BankProcessError,
  BankProcessResult,
} from "@/components/bank/actions/bank-process-ui";
import { EmbedFieldLabel } from "@/components/internal/discord-embed-char-counter";
import { sendDiscordEmbedRecord } from "@/lib/discord/discord-embed.functions";
import {
  DISCORD_MESSAGE_LIMITS,
  type DiscordMessageDraft,
  type DiscordServerKey,
} from "@/lib/discord/embed-types";
import { validateMessageDraft } from "@/lib/discord/embed-validation";
import { useUiLabMutationGate } from "@/lib/internal/ui-lab-mutation-gate";
import { cn } from "@/lib/utils";

const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-0 focus-visible:shadow-none";

type FlowState = "compose" | "processing" | "success" | "error";

type ServerOption = {
  key: DiscordServerKey;
  label: string;
  configured: boolean;
};

function createEmptyMessageDraft(): DiscordMessageDraft {
  return { serverKey: "", channelId: "", content: "" };
}

export function DiscordEmbedBuilder({
  sendingConfigured,
  servers,
}: {
  sendingConfigured: boolean;
  servers: ServerOption[];
}) {
  const emptyBaseline = useMemo(() => createEmptyMessageDraft(), []);
  const { uiLab, unavailableLabel, bannerCopy } = useUiLabMutationGate();

  const [draft, setDraft] = useState<DiscordMessageDraft>(() => createEmptyMessageDraft());
  const [flow, setFlow] = useState<FlowState>("compose");
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const submitLockRef = useRef(false);

  const validation = useMemo(() => validateMessageDraft(draft), [draft]);
  const dirty =
    draft.serverKey !== emptyBaseline.serverKey ||
    draft.channelId !== emptyBaseline.channelId ||
    draft.content !== emptyBaseline.content;

  const selectedServer = servers.find((server) => server.key === draft.serverKey);
  const selectedServerConfigured = selectedServer?.configured ?? false;

  const serverErrors = validation.errors.filter((error) => error.startsWith("Select a Discord"));
  const channelErrors = validation.errors.filter((error) => error.startsWith("Channel ID"));
  const textErrors = validation.errors.filter(
    (error) => error.startsWith("Text") || error.startsWith("Message text"),
  );

  function updateDraft(patch: Partial<DiscordMessageDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    if (flow === "success" || flow === "error") {
      setFlow("compose");
      setResultMessage(null);
    }
  }

  function handleReset() {
    if (dirty && !window.confirm("Discard this draft and reset the message?")) {
      return;
    }
    setDraft(createEmptyMessageDraft());
    setFlow("compose");
    setResultMessage(null);
    setSubmitting(false);
    submitLockRef.current = false;
  }

  async function handleSend() {
    if (submitLockRef.current || submitting || uiLab || !validation.valid) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setFlow("processing");
    setResultMessage(null);
    try {
      const response = await sendDiscordEmbedRecord({ data: draft });
      setResultMessage(response.message);
      setFlow(response.ok ? "success" : "error");
    } catch (error) {
      setResultMessage(
        error instanceof Error
          ? error.message.replace(/^BAD_REQUEST:/, "")
          : "Unable to send message.",
      );
      setFlow("error");
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  }

  function handleComposeAnother() {
    setDraft(createEmptyMessageDraft());
    setFlow("compose");
    setResultMessage(null);
  }

  return (
    <Card className="!p-5 max-w-2xl">
      {uiLab && (
        <div className="mb-5 rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-[13px] text-muted-foreground">
          {bannerCopy}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h2 className="type-section-title">Send message</h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Post plain text through the Corporate, Terminal, or Bank Discord bot.
          </p>
        </div>
        <CredentialStatus configured={sendingConfigured} />
      </div>

      {flow === "processing" && (
        <BankActionProgressView label={SUBMITTING_COPY.sending} />
      )}

      {flow === "success" && (
        <BankProcessResult
          kind="success"
          title="Message sent"
          liveMessage={resultMessage ?? "Discord message sent."}
          summary={[
            { label: "Server", value: selectedServer?.label ?? "—" },
            { label: "Channel", value: draft.channelId || "—" },
            {
              label: "Text",
              value:
                draft.content.trim().length > 80
                  ? `${draft.content.trim().slice(0, 80)}…`
                  : draft.content.trim() || "(empty)",
            },
          ]}
          onDone={handleComposeAnother}
        >
          {resultMessage ? <p>{resultMessage}</p> : null}
        </BankProcessResult>
      )}

      {flow === "error" && (
        <BankProcessError
          title="Send failed"
          message={resultMessage ?? "Unable to send message."}
          onEdit={() => setFlow("compose")}
          onRetry={() => void handleSend()}
          editLabel="Edit message"
          retryLabel="Try again"
        />
      )}

      {flow === "compose" && (
        <div className="space-y-5">
          <label className="block">
            <EmbedFieldLabel label="Server" />
            <Select
              value={draft.serverKey || undefined}
              onValueChange={(value) =>
                updateDraft({ serverKey: value as DiscordServerKey })
              }
            >
              <SelectTrigger className={inputClass}>
                <SelectValue placeholder="Select a server" />
              </SelectTrigger>
              <SelectContent>
                {servers.map((server) => (
                  <SelectItem key={server.key} value={server.key}>
                    {server.label}
                    {!server.configured ? " (not configured)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldErrors errors={serverErrors} />
          </label>

          <label className="block">
            <EmbedFieldLabel label="Channel ID" />
            <input
              value={draft.channelId}
              onChange={(e) =>
                updateDraft({ channelId: e.target.value.replace(/\D/g, "") })
              }
              placeholder="1234567890123456789"
              className={`${inputClass} font-mono`}
            />
            <p className="mt-2 text-[12px] text-muted-foreground">
              Paste the Discord channel snowflake. Enable Developer Mode, right-click a
              channel, and copy ID. The selected bot must be in that server.
            </p>
            <FieldErrors errors={channelErrors} />
          </label>

          <label className="block">
            <EmbedFieldLabel
              label="Text"
              counter={{
                current: draft.content.length,
                max: DISCORD_MESSAGE_LIMITS.content,
              }}
            />
            <Textarea
              value={draft.content}
              onChange={(e) => updateDraft({ content: e.target.value })}
              className={`${inputClass} min-h-[160px]`}
              placeholder="Message content…"
            />
            <FieldErrors errors={textErrors} />
          </label>

          {draft.serverKey && !selectedServerConfigured && (
            <p className="rounded-lg border border-border/70 bg-surface-2/30 px-3 py-2 text-[12px] text-muted-foreground">
              {selectedServer?.label ?? "This"} bot token is not configured — preview only.
              Sending will validate but not post to Discord.
            </p>
          )}

          {!sendingConfigured && !draft.serverKey && (
            <p className="rounded-lg border border-border/70 bg-surface-2/30 px-3 py-2 text-[12px] text-muted-foreground">
              No communications bot tokens configured — preview only.
            </p>
          )}

          {uiLab && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[12px] text-muted-foreground">
              {unavailableLabel("Send to Discord")}. You can still compose the message in UI Lab.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
            <span className="text-[12px] text-muted-foreground">
              {validation.valid ? (
                <span className="text-[var(--success)]">Ready to send</span>
              ) : (
                <span className="text-destructive">Needs information</span>
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!dirty}
                onClick={handleReset}
                className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                Reset
              </button>
              <button
                type="button"
                disabled={!validation.valid || submitting || uiLab}
                onClick={() => void handleSend()}
                className="rounded-md bg-foreground px-4 py-2.5 text-[13px] font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uiLab
                  ? unavailableLabel("Send to Discord")
                  : selectedServerConfigured
                    ? "Send to Discord"
                    : "Validate & preview send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function CredentialStatus({ configured }: { configured: boolean }) {
  return (
    <span
      className={cn(
        "rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]",
        configured
          ? "border-[var(--success)]/30 bg-[var(--success)]/5 text-[var(--success)]"
          : "border-border bg-surface-2/40 text-muted-foreground",
      )}
    >
      {configured ? "Discord connected" : "Preview only"}
    </span>
  );
}

function FieldErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-[12px] text-destructive">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}
