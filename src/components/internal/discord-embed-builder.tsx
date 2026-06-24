import { useMemo, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";

const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function DiscordEmbedBuilder({
  sendingConfigured,
  channelPresets,
}: {
  sendingConfigured: boolean;
  channelPresets: { label: string; channelId: string }[];
}) {
  const [draft, setDraft] = useState<DiscordEmbedDraft>(() => createEmptyEmbedDraft());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const validation = useMemo(() => validateEmbedDraft(draft), [draft]);
  const totalCharacters = useMemo(() => countEmbedCharacters(draft), [draft]);
  const resolvedColor = resolveEmbedColorHex(draft);

  function updateDraft(patch: Partial<DiscordEmbedDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setResult(null);
  }

  function handleTemplateChange(template: DiscordEmbedDraft["template"]) {
    setDraft((current) => applyEmbedTemplate(current, template));
    setResult(null);
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

  async function handleSend() {
    setSubmitting(true);
    setResult(null);
    try {
      const response = await sendDiscordEmbedRecord({ data: draft });
      setResult({ ok: response.ok, message: response.message });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message.replace(/^BAD_REQUEST:/, "") : "Unable to send embed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="!p-5">
        <div className="mb-5 border-b border-border/60 pb-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Embed Editor
          </h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Compose Alta Discord embeds for operations announcements and status updates.
          </p>
        </div>

        <div className="space-y-6">
          <EditorSection title="Target Channel">
            <label className="block">
              <EmbedFieldLabel label="Channel ID" />
              <input
                value={draft.channelId}
                onChange={(e) => updateDraft({ channelId: e.target.value.replace(/\D/g, "") })}
                placeholder="1234567890123456789"
                className={`${inputClass} font-mono`}
              />
            </label>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Paste any Discord channel snowflake ID. Enable Developer Mode in Discord, right-click a
              channel, and copy ID.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {channelPresets.map((channel) => (
                <button
                  key={channel.label}
                  type="button"
                  onClick={() => updateDraft({ channelId: channel.channelId })}
                  className="rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                >
                  {channel.label}
                </button>
              ))}
            </div>
          </EditorSection>

          <EditorSection title="Embed Template">
            <Select value={draft.template} onValueChange={(value) => handleTemplateChange(value as DiscordEmbedDraft["template"])}>
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
          </EditorSection>

          <EditorSection title="Embed Color">
            <Select value={draft.colorPreset} onValueChange={(value) => handleColorPresetChange(value as EmbedColorPreset)}>
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
              <span className="size-4 rounded border border-border" style={{ backgroundColor: resolvedColor }} />
              <span className="font-mono text-[11px] text-muted-foreground">{resolvedColor}</span>
            </div>
          </EditorSection>

          <EditorSection title="Author">
            <label className="block">
              <EmbedFieldLabel label="Author name" counter={{ current: draft.authorName.length, max: DISCORD_EMBED_LIMITS.authorName }} />
              <input value={draft.authorName} onChange={(e) => updateDraft({ authorName: e.target.value })} className={inputClass} />
            </label>
            <label className="mt-3 block">
              <EmbedFieldLabel label="Author icon URL" />
              <input value={draft.authorIconUrl} onChange={(e) => updateDraft({ authorIconUrl: e.target.value })} className={inputClass} placeholder="https://..." />
            </label>
          </EditorSection>

          <EditorSection title="Main Content">
            <label className="block">
              <EmbedFieldLabel label="Title" counter={{ current: draft.title.length, max: DISCORD_EMBED_LIMITS.title }} />
              <input value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })} className={inputClass} />
            </label>
            <label className="mt-3 block">
              <EmbedFieldLabel label="Description" counter={{ current: draft.description.length, max: DISCORD_EMBED_LIMITS.description }} />
              <textarea
                value={draft.description}
                onChange={(e) => updateDraft({ description: e.target.value })}
                rows={5}
                className={`${inputClass} min-h-[120px] resize-y`}
              />
            </label>
            <label className="mt-3 block">
              <EmbedFieldLabel label="URL (optional)" />
              <input value={draft.url} onChange={(e) => updateDraft({ url: e.target.value })} className={inputClass} placeholder="https://..." />
            </label>
          </EditorSection>

          <EditorSection title="Thumbnail / Image">
            <label className="block">
              <EmbedFieldLabel label="Thumbnail URL" />
              <input value={draft.thumbnailUrl} onChange={(e) => updateDraft({ thumbnailUrl: e.target.value })} className={inputClass} placeholder="https://..." />
            </label>
            <label className="mt-3 block">
              <EmbedFieldLabel label="Image URL" />
              <input value={draft.imageUrl} onChange={(e) => updateDraft({ imageUrl: e.target.value })} className={inputClass} placeholder="https://..." />
            </label>
          </EditorSection>

          <EditorSection
            title="Fields"
            action={
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
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] disabled:opacity-40"
              >
                <Plus className="size-3" />
                Add field
              </button>
            }
          >
            {draft.fields.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No fields added.</p>
            ) : (
              <div className="space-y-3">
                {draft.fields.map((field, index) => (
                  <div key={field.id} className="rounded-lg border border-border/70 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Field {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateDraft({ fields: draft.fields.filter((item) => item.id !== field.id) })
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <label className="block">
                      <EmbedFieldLabel label="Name" counter={{ current: field.name.length, max: DISCORD_EMBED_LIMITS.fieldName }} />
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
                      <EmbedFieldLabel label="Value" counter={{ current: field.value.length, max: DISCORD_EMBED_LIMITS.fieldValue }} />
                      <textarea
                        value={field.value}
                        onChange={(e) =>
                          updateDraft({
                            fields: draft.fields.map((item) =>
                              item.id === field.id ? { ...item, value: e.target.value } : item,
                            ),
                          })
                        }
                        rows={2}
                        className={`${inputClass} min-h-[72px] resize-y`}
                      />
                    </label>
                    <label className="mt-3 flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Inline
                      </span>
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
                  </div>
                ))}
              </div>
            )}
          </EditorSection>

          <EditorSection title="Footer">
            <label className="block">
              <EmbedFieldLabel label="Footer text" counter={{ current: draft.footerText.length, max: DISCORD_EMBED_LIMITS.footer }} />
              <input value={draft.footerText} onChange={(e) => updateDraft({ footerText: e.target.value })} className={inputClass} />
            </label>
            <label className="mt-3 block">
              <EmbedFieldLabel label="Footer icon URL" />
              <input value={draft.footerIconUrl} onChange={(e) => updateDraft({ footerIconUrl: e.target.value })} className={inputClass} placeholder="https://..." />
            </label>
          </EditorSection>

          <EditorSection title="Timestamp">
            <label className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">Include timestamp</span>
              <Switch
                checked={draft.includeTimestamp}
                onCheckedChange={(checked) => updateDraft({ includeTimestamp: checked })}
              />
            </label>
          </EditorSection>

          <EditorSection
            title="Buttons / Links Preview"
            action={
              <button
                type="button"
                onClick={() =>
                  updateDraft({
                    buttons: [...draft.buttons, { id: crypto.randomUUID(), label: "", url: "" }],
                  })
                }
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em]"
              >
                <Plus className="size-3" />
                Add button
              </button>
            }
          >
            <p className="mb-3 text-[12px] text-muted-foreground">
              Button preview — requires bot message components.
            </p>
            {draft.buttons.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No buttons added.</p>
            ) : (
              <div className="space-y-3">
                {draft.buttons.map((button, index) => (
                  <div key={button.id} className="rounded-lg border border-border/70 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        Button {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateDraft({ buttons: draft.buttons.filter((item) => item.id !== button.id) })
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <label className="block">
                      <EmbedFieldLabel label="Label" counter={{ current: button.label.length, max: DISCORD_EMBED_LIMITS.buttonLabel }} />
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
                  </div>
                ))}
              </div>
            )}
          </EditorSection>
        </div>
      </Card>

      <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <Card className="!p-5">
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-border/60 pb-4">
            <div>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Live Preview
              </h2>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Discord message rendering
                {draft.channelId ? ` · channel ${draft.channelId}` : ""}
              </p>
            </div>
            <EmbedFieldLabel
              label="Total"
              counter={{ current: totalCharacters, max: DISCORD_EMBED_LIMITS.totalEmbed }}
            />
          </div>
          <DiscordEmbedPreview draft={draft} />
        </Card>

        <Card className="!p-5">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Validation
          </h3>
          <ul className="mt-3 space-y-1 text-[12px] text-muted-foreground">
            <li>Title max {DISCORD_EMBED_LIMITS.title} characters</li>
            <li>Description max {DISCORD_EMBED_LIMITS.description} characters</li>
            <li>Field name max {DISCORD_EMBED_LIMITS.fieldName} · value max {DISCORD_EMBED_LIMITS.fieldValue}</li>
            <li>Max {DISCORD_EMBED_LIMITS.maxFields} fields · footer max {DISCORD_EMBED_LIMITS.footer}</li>
            <li>Total embed max {DISCORD_EMBED_LIMITS.totalEmbed} characters</li>
          </ul>

          {validation.errors.length > 0 && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
              <ul className="space-y-1">
                {validation.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-[12px] text-muted-foreground">
              <ul className="space-y-1">
                {validation.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-border/70 bg-surface-2/30 px-3 py-2 text-[12px] text-muted-foreground">
            {sendingConfigured
              ? "Discord bot credentials detected — sends will post to the configured channel."
              : "Discord sending is preview-only until DISCORD_BOT_TOKEN and DISCORD_GUILD_ID are configured."}
          </div>

          {result && (
            <div
              className={cn(
                "mt-4 rounded-lg border px-3 py-2 text-[12px]",
                result.ok
                  ? "border-[var(--success)]/30 bg-[var(--success)]/5 text-[var(--success)]"
                  : "border-destructive/30 bg-destructive/5 text-destructive",
              )}
            >
              {result.message}
            </div>
          )}

          <button
            type="button"
            disabled={!validation.valid || submitting}
            onClick={() => void handleSend()}
            className="mt-4 w-full rounded-md bg-foreground px-4 py-2.5 text-[13px] font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Processing…"
              : sendingConfigured
                ? "Send to Discord"
                : "Validate & preview send"}
          </button>
        </Card>
      </div>
    </div>
  );
}

function EditorSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border/60 bg-surface-2/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
