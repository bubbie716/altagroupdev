import type { DiscordEmbedDraft } from "@/lib/discord/embed-types";
import { resolveEmbedColorHex } from "@/lib/discord/embed-utils";

function PreviewImage({ url, alt }: { url: string; alt: string }) {
  if (!url.trim()) return null;
  return (
    <img
      src={url}
      alt={alt}
      className="max-h-48 rounded object-contain"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

export function DiscordEmbedPreview({ draft }: { draft: DiscordEmbedDraft }) {
  const color = resolveEmbedColorHex(draft);
  const timestamp = draft.includeTimestamp
    ? new Date().toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="rounded-xl border border-[#1E1F22] bg-[#313338] p-4 shadow-lg">
      <div className="mb-3 flex items-center gap-2">
        <div className="size-8 rounded-full bg-[#5865F2]/30" />
        <div>
          <div className="text-[13px] font-medium text-[#F2F3F5]">Alta Bot</div>
          <div className="text-[10px] text-[#949BA4]">
            Today at {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </div>
        </div>
      </div>

      <div className="flex max-w-[520px] gap-0">
        <div className="w-1 shrink-0 rounded-l" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1 rounded-r bg-[#2B2D31] px-3 py-2.5">
          {(draft.authorName || draft.authorIconUrl) && (
            <div className="mb-1.5 flex items-center gap-2">
              {draft.authorIconUrl && (
                <img src={draft.authorIconUrl} alt="" className="size-5 rounded-full object-cover" />
              )}
              {draft.authorName && (
                <span className="text-[12px] font-medium text-[#DBDEE1]">{draft.authorName}</span>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              {draft.title && (
                <div className="text-[15px] font-semibold text-[#00A8FC]">
                  {draft.url ? (
                    <a href={draft.url} className="hover:underline">
                      {draft.title}
                    </a>
                  ) : (
                    draft.title
                  )}
                </div>
              )}

              {draft.description && (
                <div className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-[#DBDEE1]">
                  {draft.description}
                </div>
              )}

              {draft.fields.length > 0 && (
                <div className="mt-3 grid gap-2">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {draft.fields.map((field) => (
                      <div
                        key={field.id}
                        className={field.inline ? "sm:col-span-1" : "sm:col-span-3"}
                      >
                        <div className="text-[12px] font-semibold text-[#DBDEE1]">
                          {field.name || "Field"}
                        </div>
                        <div className="mt-0.5 whitespace-pre-wrap text-[13px] text-[#B5BAC1]">
                          {field.value || "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {draft.imageUrl && (
                <div className="mt-3">
                  <PreviewImage url={draft.imageUrl} alt="Embed image" />
                </div>
              )}

              {(draft.footerText || timestamp) && (
                <div className="mt-3 flex items-center gap-2 border-t border-[#3F4147]/80 pt-2">
                  {draft.footerIconUrl && (
                    <img src={draft.footerIconUrl} alt="" className="size-4 rounded-full object-cover" />
                  )}
                  <span className="text-[11px] text-[#949BA4]">
                    {draft.footerText}
                    {draft.footerText && timestamp ? " · " : ""}
                    {timestamp}
                  </span>
                </div>
              )}
            </div>

            {draft.thumbnailUrl && (
              <div className="shrink-0">
                <PreviewImage url={draft.thumbnailUrl} alt="Thumbnail" />
              </div>
            )}
          </div>
        </div>
      </div>

      {draft.buttons.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#949BA4]">
            Button preview — requires bot message components
          </p>
          <div className="flex flex-wrap gap-2">
            {draft.buttons.map((button) => (
              <span
                key={button.id}
                className="inline-flex items-center rounded bg-[#5865F2] px-3 py-1.5 text-[12px] font-medium text-white"
              >
                {button.label || "Button"}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
