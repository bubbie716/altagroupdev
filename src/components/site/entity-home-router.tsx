import type { SiteKey } from "@/config/sites";
import { CorporateHomepage, type CorporateHomepageProps } from "@/components/site/homepages/corporate-homepage";
import { EMPTY_PLATFORM_METRICS } from "@/lib/metrics/platform-metrics.functions";

export function EntityHomeRouter({
  siteKey,
  corporateProps,
}: {
  siteKey: SiteKey;
  corporateProps?: CorporateHomepageProps;
}) {
  if (siteKey !== "corporate") {
    return null;
  }

  if (!corporateProps) {
    return <CorporateHomepage platformMetrics={EMPTY_PLATFORM_METRICS} />;
  }

  return <CorporateHomepage {...corporateProps} />;
}
