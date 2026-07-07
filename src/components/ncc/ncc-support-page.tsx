import { NccLayout } from "@/components/ncc/ncc-layout";
import { NccCard, NccPageContainer, NccSectionHeader } from "@/components/ncc/ncc-ui";
import { ALTA_DISCORD_URLS } from "@/lib/site/discord-urls";
import { getDiscordCommunitiesForSite } from "@/lib/site/site-scoped-content";

export function NccSupportPage() {
  const communities = getDiscordCommunitiesForSite("ncc");

  return (
    <NccLayout>
      <NccPageContainer>
        <div className="border-b border-[#e5e7eb] pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Support</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#6b7280]">
            Operational support for participating institutions and authorized network representatives.
          </p>
        </div>

        <section className="mt-10">
          <NccSectionHeader title="Discord communities" />
          <div className="grid gap-4 sm:grid-cols-2">
            {communities.map((community) => {
              const inviteUrl = ALTA_DISCORD_URLS[community.entity];

              return (
                <NccCard key={community.entity}>
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#9ca3af]">
                    Discord
                  </div>
                  <h2 className="mt-2 text-[15px] font-semibold text-[#111827]">{community.label}</h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#6b7280]">
                    {community.description}
                  </p>
                  {inviteUrl ? (
                    <a
                      href={inviteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex text-[13px] font-medium text-[#0c4d32] hover:underline"
                    >
                      Join {community.label} Discord →
                    </a>
                  ) : (
                    <p className="mt-4 text-[13px] text-[#9ca3af]">Discord invite not configured.</p>
                  )}
                </NccCard>
              );
            })}
          </div>
        </section>
      </NccPageContainer>
    </NccLayout>
  );
}
