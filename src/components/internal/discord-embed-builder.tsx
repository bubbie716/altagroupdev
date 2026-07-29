import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  BankActionProgressView,
  BankProcessError,
  BankProcessResult,
  BankProcessSummary,
} from "@/components/bank/actions/bank-process-ui";
import { EmbedFieldLabel } from "@/components/internal/discord-embed-char-counter";
import { DiscordEmbedPreview } from "@/components/internal/discord-embed-preview";
import { sendDiscordEmbedRecord } from "@/lib/discord/discord-embed.functions";
import {
  DISCORD_EMBED_LIMITS,
  EMBED_COLOR_PRESETS,
  EMBED_TEMPLATES,
  type DiscordEmbedDraft,
  type EmbedColorPreset,
} from "@/lib/discord/embed-types";
import { applyEmbedTemplate, createEmptyEmbedDraft } from "@/lib/discord/embed-templates";
import { countEmbedCharacters, resolveEmbedColorHex } from "@/lib/discord/embed-utils";
import { validateEmbedDraft } from "@/lib/discord/embed-validation";
import { useUiLabMutationGate } from "@/lib/internal/ui-lab-mutation-gate";
import { cn } from "@/lib/utils";

const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-0 focus-visible:shadow-none";

const CHANNEL_CUSTOM = "__custom__";

type FlowState = "compose" | "review" | "processing" | "success" | "error";

export function DiscordEmbedBuilder({
  sendingConfigured,
  channelPresets,
}: {
  sendingConfigured: boolean;
  channelPresets: { label: string; channelId: string }[];
}) {
  const emptyBaseline = useMemo(() => createEmptyEmbedDraft(), []);
  const { uiLab, unavailableLabel, bannerCopy } = useUiLabMutationGate();

  const [draft, setDraft] = useState<DiscordEmbedDraft>(() => createEmptyEmbedDraft());
  const [flow, setFlow] = useState<FlowState>("compose");
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [customChannelSelected, setCustomChannelSelected] = useState(false);
  const submitLockRef = useRef(false);

  const validation = useMemo(() => validateEmbedDraft(draft), [draft]);
  const totalCharacters = useMemo(() => countEmbedCharacters(draft), [draft]);
  const resolvedColor = resolveEmbedColorHex(draft);
  const dirty = useMemo(() => isDraftDirty(draft, emptyBaseline), [draft, emptyBaseline]);

  const channelSelectValue = useMemo(() => {
    const match = channelPresets.find((preset) => preset.channelId === draft.channelId);
    if (match) return match.channelId;
    if (customChannelSelected || draft.channelId) return CHANNEL_CUSTOM;
    return "";
  }, [channelPresets, draft.channelId, customChannelSelected]);

  const channelLabel = useMemo(() => {
    const preset = channelPresets.find((item) => item.channelId === draft.channelId);
    if (preset) return preset.label;
    if (draft.channelId) return `Custom · ${draft.channelId}`;
    return "Not selected";
  }, [channelPresets, draft.channelId]);

  const templateLabel =
    EMBED_TEMPLATES.find((item) => item.key === draft.template)?.label ?? draft.template;

  function updateDraft(patch: Partial<DiscordEmbedDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    if (flow === "success" || flow === "error") {
      setFlow("compose");
      setResultMessage(null);
    }
  }

  function handleTemplateChange(template: DiscordEmbedDraft["template"]) {
    setDraft((current) => applyEmbedTemplate(current, template));
    setResultMessage(null);
    if (flow !== "compose" && flow !== "review") {
      setFlow("compose");
    }
  }

  function handleColorPresetChange(preset: EmbedColorPreset) {
    if (preset === "custom") {
      updateDraft({ colorPreset: "custom" });
      return;
    }
    updateDraft({
      colorPreset: preset,
      customColorHex: EMBED_COLOR_PRESETS[preset].hex,
    });
  }

  function handleReset() {
    if (dirty && !window.confirm("Discard this draft and reset the embed editor?")) {
      return;
    }
    setDraft(createEmptyEmbedDraft());
    setCustomChannelSelected(false);
    setFlow("compose");
    setResultMessage(null);
    setSubmitting(false);
    submitLockRef.current = false;
  }

  function handleReview() {
    if (!validation.valid) return;
    setFlow("review");
    setResultMessage(null);
  }

  async function handleSend() {
    if (submitLockRef.current || submitting || uiLab) return;
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
          : "Unable to send embed.",
      );
      setFlow("error");
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  }

  function handleComposeAnother() {
    setDraft(createEmptyEmbedDraft());
    setCustomChannelSelected(false);
    setFlow("compose");
    setResultMessage(null);
  }

  const titleErrors = filterFieldErrors(validation.errors, /^Title\b/);
  const descriptionErrors = [
    ...filterFieldErrors(validation.errors, /^Description\b/),
    ...filterFieldErrors(validation.errors, /^Embed must/),
  ];
  const channelErrors = filterFieldErrors(validation.errors, /^Channel ID\b/);
  const generalErrors = validation.errors.filter(
    (error) =>
      !titleErrors.includes(error) &&
      !descriptionErrors.includes(error) &&
      !channelErrors.includes(error) &&
      !/^Embed must/.test(error) &&
      !/^Field \d+/.test(error) &&
      !/^Button \d+/.test(error) &&
      !/^(Author name|Footer|Custom color|Total embed|Title URL|Author icon|Thumbnail|Image|Footer icon)/.test(
        error,
      ),
  );

  const hasMedia = Boolean(draft.url.trim() || draft.thumbnailUrl.trim() || draft.imageUrl.trim());
  const hasBranding = hasBrandingContent(draft, emptyBaseline);
  const usesCustomChannel =
    Boolean(draft.channelId) && !channelPresets.some((preset) => preset.channelId === draft.channelId);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <Card className="!p-5">
        {uiLab && (
          <div className="mb-5 rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-[13px] text-muted-foreground">
            {bannerCopy}
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <h2 className="type-section-title">Embed Editor</h2>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Compose Alta Discord embeds for operations announcements and status updates.
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
            liveMessage={resultMessage ?? "Discord embed sent."}
            summary={[
              { label: "Channel", value: channelLabel },
              { label: "Template", value: templateLabel },
              { label: "Title", value: draft.title.trim() || "(none)" },
            ]}
            onDone={handleComposeAnother}
          >
            {resultMessage ? <p>{resultMessage}</p> : null}
          </BankProcessResult>
        )}

        {flow === "error" && (
          <BankProcessError
            title="Send failed"
            message={resultMessage ?? "Unable to send embed."}
            onEdit={() => setFlow("compose")}
            onRetry={() => setFlow("review")}
            editLabel="Edit message"
            retryLabel="Back to review"
          />
        )}

        {flow === "review" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="type-section-title">Review message</h3>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Confirm channel, content, and attachments before sending to Discord.
                </p>
              </div>
              <span className="rounded-md border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {uiLab
                  ? unavailableLabel("Send")
                  : !sendingConfigured
                    ? "Preview only"
                    : validation.valid
                      ? "Ready to send"
                      : "Needs information"}
              </span>
            </div>

            <div className="rounded-xl border border-border/70 px-4 py-3">
              <BankProcessSummary
                rows={[
                  { label: "Channel", value: channelLabel, mono: usesCustomChannel },
                  { label: "Template", value: templateLabel },
                  { label: "Title", value: draft.title.trim() || "(none)" },
                  {
                    label: "Timestamp",
                    value: draft.includeTimestamp ? "Included" : "Not included",
                  },
                  {
                    label: "Buttons",
                    value:
                      draft.buttons.length > 0
                        ? `${draft.buttons.length} link button${draft.buttons.length === 1 ? "" : "s"}`
                        : "None",
                  },
                  {
                    label: "Media",
                    value: hasMedia
                      ? [
                          draft.url.trim() ? "Title URL" : null,
                          draft.thumbnailUrl.trim() ? "Thumbnail" : null,
                          draft.imageUrl.trim() ? "Image" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "None",
                  },
                  {
                    label: "Fields",
                    value:
                      draft.fields.length > 0
                        ? `${draft.fields.length} field${draft.fields.length === 1 ? "" : "s"}`
                        : "None",
                  },
                ]}
              />
            </div>

            {uiLab && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[12px] text-muted-foreground">
                {unavailableLabel("Send to Discord")}. You can still review the message in UI Lab.
              </p>
            )}

            {!sendingConfigured && (
              <p className="rounded-lg border border-border/70 bg-surface-2/30 px-3 py-2 text-[12px] text-muted-foreground">
                Credentials not configured — preview only. Sending will validate but not post to Discord.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFlow("compose")}
                className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-foreground"
              >
                Back to edit
              </button>
              <button
                type="button"
                disabled={submitting || uiLab}
                onClick={() => void handleSend()}
                className="rounded-md bg-foreground px-4 py-2.5 text-[13px] font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uiLab
                  ? unavailableLabel("Send to Discord")
                  : sendingConfigured
                    ? "Send to Discord"
                    : "Validate & preview send"}
              </button>
            </div>
          </div>
        )}

        {flow === "compose" && (
          <>
            <details className="mb-5 xl:hidden">
              <summary className="cursor-pointer list-none rounded-lg border border-border/70 bg-surface-2/20 px-4 py-3 text-[13px] font-medium text-foreground [&::-webkit-details-marker]:hidden">
                Preview
              </summary>
              <div className="mt-3 rounded-lg border border-border/70 p-4">
                <PreviewHeader
                  totalCharacters={totalCharacters}
                  channelId={draft.channelId}
                />
                <DiscordEmbedPreview draft={draft} />
              </div>
            </details>

            <div className="space-y-5">
              <label className="block">
                <EmbedFieldLabel label="Template" />
                <Select
                  value={draft.template}
                  onValueChange={(value) =>
                    handleTemplateChange(value as DiscordEmbedDraft["template"])
                  }
                >
                  <SelectTrigger className={inputClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMBED_TEMPLATES.map((template) => (
                      <SelectItem key={template.key} value={template.key}>
                        {template.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="block">
                <EmbedFieldLabel label="Target channel" />
                <Select
                  value={channelSelectValue}
                  onValueChange={(value) => {
                    if (value === CHANNEL_CUSTOM) {
                      setCustomChannelSelected(true);
                      return;
                    }
                    setCustomChannelSelected(false);
                    updateDraft({ channelId: value });
                  }}
                >
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Select a channel preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {channelPresets.map((channel) => (
                      <SelectItem key={channel.channelId} value={channel.channelId}>
                        {channel.label}
                      </SelectItem>
                    ))}
                    <SelectItem value={CHANNEL_CUSTOM}>Custom channel ID…</SelectItem>
                  </SelectContent>
                </Select>
                <FieldErrors errors={channelErrors} />
              </label>

              <label className="block">
                <EmbedFieldLabel
                  label="Title"
                  counter={{ current: draft.title.length, max: DISCORD_EMBED_LIMITS.title }}
                />
                <input
                  value={draft.title}
                  onChange={(e) => updateDraft({ title: e.target.value })}
                  className={inputClass}
                />
                <FieldErrors errors={titleErrors} />
              </label>

              <label className="block">
                <EmbedFieldLabel
                  label="Description"
                  counter={{
                    current: draft.description.length,
                    max: DISCORD_EMBED_LIMITS.description,
                  }}
                />
                <Textarea
                  value={draft.description}
                  onChange={(e) => updateDraft({ description: e.target.value })}
                  className={`${inputClass} min-h-[120px]`}
                />
                <FieldErrors errors={descriptionErrors} />
              </label>

              <ExpandableSection
                title="Advanced details"
                defaultOpen={usesCustomChannel || Boolean(draft.channelId && channelSelectValue === CHANNEL_CUSTOM)}
              >
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
                </label>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Paste any Discord channel snowflake ID. Enable Developer Mode in Discord,
                  right-click a channel, and copy ID.
                </p>
                <FieldErrors errors={channelErrors} />
              </ExpandableSection>

              <ExpandableSection title="Branding" defaultOpen={hasBranding}>
                <label className="block">
                  <EmbedFieldLabel label="Embed color" />
                  <Select
                    value={draft.colorPreset}
                    onValueChange={(value) => handleColorPresetChange(value as EmbedColorPreset)}
                  >
                    <SelectTrigger className={inputClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EMBED_COLOR_PRESETS).map(([key, preset]) => (
                        <SelectItem key={key} value={key}>
                          {preset.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom hex</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                {draft.colorPreset === "custom" && (
                  <label className="mt-3 block">
                    <EmbedFieldLabel label="Custom hex" />
                    <input
                      value={draft.customColorHex}
                      onChange={(e) => updateDraft({ customColorHex: e.target.value })}
                      placeholder="#06111F"
                      className={`${inputClass} font-mono uppercase`}
                    />
                  </label>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="size-4 rounded border border-border"
                    style={{ backgroundColor: resolvedColor }}
                  />
                  <span className="font-mono text-[11px] text-muted-foreground">{resolvedColor}</span>
                </div>
                <FieldErrors
                  errors={filterFieldErrors(validation.errors, /^Custom color\b|^Author name\b|^Footer\b/)}
                />

                <label className="mt-4 block">
                  <EmbedFieldLabel
                    label="Author name"
                    counter={{
                      current: draft.authorName.length,
                      max: DISCORD_EMBED_LIMITS.authorName,
                    }}
                  />
                  <input
                    value={draft.authorName}
                    onChange={(e) => updateDraft({ authorName: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="mt-3 block">
                  <EmbedFieldLabel label="Author icon URL" />
                  <input
                    value={draft.authorIconUrl}
                    onChange={(e) => updateDraft({ authorIconUrl: e.target.value })}
                    className={inputClass}
                    placeholder="https://..."
                  />
                </label>
                <FieldErrors errors={filterFieldErrors(validation.errors, /^Author icon\b/)} />

                <label className="mt-4 block">
                  <EmbedFieldLabel
                    label="Footer text"
                    counter={{
                      current: draft.footerText.length,
                      max: DISCORD_EMBED_LIMITS.footer,
                    }}
                  />
                  <input
                    value={draft.footerText}
                    onChange={(e) => updateDraft({ footerText: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="mt-3 block">
                  <EmbedFieldLabel label="Footer icon URL" />
                  <input
                    value={draft.footerIconUrl}
                    onChange={(e) => updateDraft({ footerIconUrl: e.target.value })}
                    className={inputClass}
                    placeholder="https://..."
                  />
                </label>
                <FieldErrors errors={filterFieldErrors(validation.errors, /^Footer icon\b/)} />

                <label className="mt-4 flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">Include timestamp</span>
                  <Switch
                    checked={draft.includeTimestamp}
                    onCheckedChange={(checked) => updateDraft({ includeTimestamp: checked })}
                  />
                </label>
              </ExpandableSection>

              <ExpandableSection title="Media" defaultOpen={hasMedia}>
                <label className="block">
                  <EmbedFieldLabel label="Title URL (optional)" />
                  <input
                    value={draft.url}
                    onChange={(e) => updateDraft({ url: e.target.value })}
                    className={inputClass}
                    placeholder="https://..."
                  />
                </label>
                <FieldErrors errors={filterFieldErrors(validation.errors, /^Title URL\b/)} />
                <label className="mt-3 block">
                  <EmbedFieldLabel label="Thumbnail URL" />
                  <input
                    value={draft.thumbnailUrl}
                    onChange={(e) => updateDraft({ thumbnailUrl: e.target.value })}
                    className={inputClass}
                    placeholder="https://..."
                  />
                </label>
                <FieldErrors errors={filterFieldErrors(validation.errors, /^Thumbnail\b/)} />
                <label className="mt-3 block">
                  <EmbedFieldLabel label="Image URL" />
                  <input
                    value={draft.imageUrl}
                    onChange={(e) => updateDraft({ imageUrl: e.target.value })}
                    className={inputClass}
                    placeholder="https://..."
                  />
                </label>
                <FieldErrors errors={filterFieldErrors(validation.errors, /^Image\b/)} />
              </ExpandableSection>

              <ExpandableSection title="Fields" defaultOpen={draft.fields.length > 0}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[13px] text-muted-foreground">
                    Add structured name/value rows to the embed body.
                  </p>
                  <button
                    type="button"
                    disabled={draft.fields.length >= DISCORD_EMBED_LIMITS.maxFields}
                    onClick={() =>
                      updateDraft({
                        fields: [
                          ...draft.fields,
                          { id: crypto.randomUUID(), name: "", value: "", inline: false },
                        ],
                      })
                    }
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] disabled:opacity-40"
                  >
                    <Plus className="size-3" />
                    Add field
                  </button>
                </div>
                {draft.fields.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No fields added.</p>
                ) : (
                  <div className="space-y-3">
                    {draft.fields.map((field, index) => (
                      <div key={field.id} className="rounded-lg border border-border/70 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="type-meta">Field {index + 1}</span>
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft({
                                fields: draft.fields.filter((item) => item.id !== field.id),
                              })
                            }
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <label className="block">
                          <EmbedFieldLabel
                            label="Name"
                            counter={{
                              current: field.name.length,
                              max: DISCORD_EMBED_LIMITS.fieldName,
                            }}
                          />
                          <input
                            value={field.name}
                            onChange={(e) =>
                              updateDraft({
                                fields: draft.fields.map((item) =>
                                  item.id === field.id ? { ...item, name: e.target.value } : item,
                                ),
                              })
                            }
                            className={inputClass}
                          />
                        </label>
                        <label className="mt-3 block">
                          <EmbedFieldLabel
                            label="Value"
                            counter={{
                              current: field.value.length,
                              max: DISCORD_EMBED_LIMITS.fieldValue,
                            }}
                          />
                          <Textarea
                            value={field.value}
                            onChange={(e) =>
                              updateDraft({
                                fields: draft.fields.map((item) =>
                                  item.id === field.id ? { ...item, value: e.target.value } : item,
                                ),
                              })
                            }
                            className={`${inputClass} min-h-[72px]`}
                          />
                        </label>
                        <label className="mt-3 flex items-center justify-between">
                          <span className="type-meta">Inline</span>
                          <Switch
                            checked={field.inline}
                            onCheckedChange={(checked) =>
                              updateDraft({
                                fields: draft.fields.map((item) =>
                                  item.id === field.id ? { ...item, inline: checked } : item,
                                ),
                              })
                            }
                          />
                        </label>
                        <FieldErrors
                          errors={filterFieldErrors(
                            validation.errors,
                            new RegExp(`^Field ${index + 1}\\b`),
                          )}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <FieldErrors
                  errors={filterFieldErrors(validation.errors, /^Embed exceeds \d+ fields\b/)}
                />
              </ExpandableSection>

              <ExpandableSection title="Buttons / links" defaultOpen={draft.buttons.length > 0}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[13px] text-muted-foreground">
                    Link buttons render beneath the embed when the bot sends message components.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft({
                        buttons: [...draft.buttons, { id: crypto.randomUUID(), label: "", url: "" }],
                      })
                    }
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em]"
                  >
                    <Plus className="size-3" />
                    Add button
                  </button>
                </div>
                {draft.buttons.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No buttons added.</p>
                ) : (
                  <div className="space-y-3">
                    {draft.buttons.map((button, index) => (
                      <div key={button.id} className="rounded-lg border border-border/70 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="type-meta">Button {index + 1}</span>
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft({
                                buttons: draft.buttons.filter((item) => item.id !== button.id),
                              })
                            }
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <label className="block">
                          <EmbedFieldLabel
                            label="Label"
                            counter={{
                              current: button.label.length,
                              max: DISCORD_EMBED_LIMITS.buttonLabel,
                            }}
                          />
                          <input
                            value={button.label}
                            onChange={(e) =>
                              updateDraft({
                                buttons: draft.buttons.map((item) =>
                                  item.id === button.id ? { ...item, label: e.target.value } : item,
                                ),
                              })
                            }
                            className={inputClass}
                          />
                        </label>
                        <label className="mt-3 block">
                          <EmbedFieldLabel label="URL" />
                          <input
                            value={button.url}
                            onChange={(e) =>
                              updateDraft({
                                buttons: draft.buttons.map((item) =>
                                  item.id === button.id ? { ...item, url: e.target.value } : item,
                                ),
                              })
                            }
                            className={inputClass}
                            placeholder="https://..."
                          />
                        </label>
                        <FieldErrors
                          errors={filterFieldErrors(
                            validation.errors,
                            new RegExp(`^Button ${index + 1}\\b`),
                          )}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {validation.warnings.length > 0 && (
                  <ul className="mt-3 space-y-1 text-[12px] text-muted-foreground">
                    {validation.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </ExpandableSection>

              <ValidationSummary
                totalCharacters={totalCharacters}
                valid={validation.valid}
                errors={[
                  ...generalErrors,
                  ...filterFieldErrors(validation.errors, /^Total embed/),
                ]}
                warnings={validation.warnings.filter(
                  (warning) => !warning.startsWith("Buttons require"),
                )}
              />

              <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                <button
                  type="button"
                  disabled={!validation.valid}
                  onClick={handleReview}
                  className="rounded-md bg-foreground px-4 py-2.5 text-[13px] font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Review message
                </button>
                <button
                  type="button"
                  disabled={!dirty}
                  onClick={handleReset}
                  className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reset
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      <div className="hidden xl:block xl:sticky xl:top-6 xl:self-start">
        <Card className="!p-5">
          <PreviewHeader totalCharacters={totalCharacters} channelId={draft.channelId} />
          <DiscordEmbedPreview draft={draft} />
        </Card>
      </div>
    </div>
  );
}

function PreviewHeader({
  totalCharacters,
  channelId,
}: {
  totalCharacters: number;
  channelId: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4 border-b border-border/60 pb-4">
      <div>
        <h2 className="type-section-title">Preview</h2>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Discord message rendering
          {channelId ? ` · channel ${channelId}` : ""}
        </p>
      </div>
      <EmbedFieldLabel
        label="Total"
        counter={{ current: totalCharacters, max: DISCORD_EMBED_LIMITS.totalEmbed }}
      />
    </div>
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

function ExpandableSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      className="rounded-lg border border-border/60 bg-surface-2/20"
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-medium text-foreground [&::-webkit-details-marker]:hidden">
        {title}
      </summary>
      <div className="space-y-3 border-t border-border/60 px-4 py-4">{children}</div>
    </details>
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

function ValidationSummary({
  totalCharacters,
  valid,
  errors,
  warnings,
}: {
  totalCharacters: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/20 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-muted-foreground">
          {totalCharacters.toLocaleString()} / {DISCORD_EMBED_LIMITS.totalEmbed.toLocaleString()}{" "}
          characters
        </span>
        {valid ? (
          <span className="text-[12px] text-[var(--success)]">Ready to review</span>
        ) : (
          <span className="text-[12px] text-destructive">Needs information</span>
        )}
      </div>

      {!valid && errors.length > 0 ? (
        <ul className="mt-2 space-y-1 text-[12px] text-destructive">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      {warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-[12px] text-muted-foreground">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-[12px] text-muted-foreground">
          Validation rules
        </summary>
        <ul className="mt-2 space-y-1 text-[12px] text-muted-foreground">
          <li>Title max {DISCORD_EMBED_LIMITS.title} characters</li>
          <li>Description max {DISCORD_EMBED_LIMITS.description} characters</li>
          <li>
            Field name max {DISCORD_EMBED_LIMITS.fieldName} · value max{" "}
            {DISCORD_EMBED_LIMITS.fieldValue}
          </li>
          <li>
            Max {DISCORD_EMBED_LIMITS.maxFields} fields · footer max {DISCORD_EMBED_LIMITS.footer}
          </li>
          <li>Total embed max {DISCORD_EMBED_LIMITS.totalEmbed} characters</li>
        </ul>
      </details>
    </div>
  );
}

function filterFieldErrors(errors: string[], pattern: RegExp): string[] {
  return errors.filter((error) => pattern.test(error));
}

function hasBrandingContent(draft: DiscordEmbedDraft, baseline: DiscordEmbedDraft): boolean {
  return (
    draft.colorPreset !== baseline.colorPreset ||
    draft.customColorHex !== baseline.customColorHex ||
    draft.authorName !== baseline.authorName ||
    Boolean(draft.authorIconUrl.trim()) ||
    draft.footerText !== baseline.footerText ||
    Boolean(draft.footerIconUrl.trim()) ||
    draft.includeTimestamp !== baseline.includeTimestamp
  );
}

function isDraftDirty(draft: DiscordEmbedDraft, baseline: DiscordEmbedDraft): boolean {
  if (draft.channelId !== baseline.channelId) return true;
  if (draft.template !== baseline.template) return true;
  if (draft.colorPreset !== baseline.colorPreset) return true;
  if (draft.customColorHex !== baseline.customColorHex) return true;
  if (draft.authorName !== baseline.authorName) return true;
  if (draft.authorIconUrl !== baseline.authorIconUrl) return true;
  if (draft.title !== baseline.title) return true;
  if (draft.description !== baseline.description) return true;
  if (draft.url !== baseline.url) return true;
  if (draft.thumbnailUrl !== baseline.thumbnailUrl) return true;
  if (draft.imageUrl !== baseline.imageUrl) return true;
  if (draft.footerText !== baseline.footerText) return true;
  if (draft.footerIconUrl !== baseline.footerIconUrl) return true;
  if (draft.includeTimestamp !== baseline.includeTimestamp) return true;
  if (draft.fields.length !== baseline.fields.length) return true;
  if (draft.buttons.length !== baseline.buttons.length) return true;

  for (let index = 0; index < draft.fields.length; index += 1) {
    const field = draft.fields[index]!;
    const baseField = baseline.fields[index];
    if (
      !baseField ||
      field.name !== baseField.name ||
      field.value !== baseField.value ||
      field.inline !== baseField.inline
    ) {
      return true;
    }
  }

  for (let index = 0; index < draft.buttons.length; index += 1) {
    const button = draft.buttons[index]!;
    const baseButton = baseline.buttons[index];
    if (!baseButton || button.label !== baseButton.label || button.url !== baseButton.url) {
      return true;
    }
  }

  return false;
}
