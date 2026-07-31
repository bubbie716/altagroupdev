import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  OnboardingCheckbox,
  OnboardingLegalLink,
  OnboardingPrimaryButton,
  OnboardingShell,
} from "@/components/onboarding/onboarding-shell";
import { OnboardingMinecraftStep } from "@/components/onboarding/onboarding-minecraft-step";
import { submitCoreOnboardingFn } from "@/lib/onboarding/onboarding.functions";
import {
  continueButtonLabel,
  resolveOnboardingProgress,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps";
import type { OnboardingLoaderState } from "@/lib/onboarding/onboarding-types";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { getUiLabOnboardingScenario } from "@/lib/onboarding/ui-lab-onboarding";
import { invalidateRootSessionCache } from "@/lib/auth/root-session-cache";
import type { SiteKey } from "@/config/sites";

type Props = {
  initial: OnboardingLoaderState;
  sourceSite: SiteKey;
  returnPath?: string | null;
  returnOrigin?: string | null;
};

function docById(docs: OnboardingLoaderState["coreDocuments"], id: string) {
  return docs.find((d) => d.documentId === id);
}

function humanizeSubmitError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("ONBOARDING_ELIGIBILITY_REQUIRED")) {
    return "Confirm that you meet the eligibility requirements to continue.";
  }
  if (message.includes("ONBOARDING_TERMS_REQUIRED")) {
    return "Agree to the Terms of Service and Acceptable Use Policy to continue.";
  }
  if (message.includes("ONBOARDING_PRIVACY_REQUIRED")) {
    return "Acknowledge the Privacy Policy and electronic communications consent to continue.";
  }
  if (message.includes("ONBOARDING_SERVER_ERROR") || message.includes("UI Lab")) {
    return "We couldn't record your agreements. Your selections are preserved — please try again.";
  }
  return "Something went wrong while saving your agreements. Your selections are preserved — please try again.";
}

export function OnboardingFlow({ initial, sourceSite, returnPath, returnOrigin }: Props) {
  const router = useRouter();
  const submit = useServerFn(submitCoreOnboardingFn);
  const [pending, startTransition] = useTransition();

  const serverStep = initial.step;
  const [clientStep, setClientStep] = useState<OnboardingStepId>(
    serverStep === "welcome" ? "welcome" : serverStep,
  );
  const [verifiedMinecraftName, setVerifiedMinecraftName] = useState<string | null>(
    initial.user.minecraftVerifiedAt ? initial.user.minecraftUsername : null,
  );
  const [minecraftJustVerified, setMinecraftJustVerified] = useState(false);

  useEffect(() => {
    if (
      serverStep === "confirmation" ||
      serverStep === "complete" ||
      serverStep === "legal" ||
      (serverStep === "minecraft" && !minecraftJustVerified)
    ) {
      setClientStep(serverStep === "complete" ? "confirmation" : serverStep);
    }
  }, [serverStep, minecraftJustVerified]);

  const step: OnboardingStepId =
    minecraftJustVerified || serverStep === "confirmation" || serverStep === "complete"
      ? "confirmation"
      : serverStep === "minecraft"
        ? "minecraft"
        : clientStep === "legal"
          ? "legal"
          : clientStep === "minecraft"
            ? "minecraft"
            : serverStep === "legal"
              ? "legal"
              : clientStep;

  const progress = resolveOnboardingProgress(step);

  const [eligibility, setEligibility] = useState(false);
  const [termsAndAup, setTermsAndAup] = useState(false);
  const [privacyElectronic, setPrivacyElectronic] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);

  const tos = docById(initial.coreDocuments, "AG-LEGAL-001");
  const aup = docById(initial.coreDocuments, "AG-LEGAL-004");
  const privacy = docById(initial.coreDocuments, "AG-LEGAL-002");
  const electronic = docById(initial.coreDocuments, "AG-LEGAL-005");

  const canSubmit = eligibility && termsAndAup && privacyElectronic;

  const destinationLabel = useMemo(
    () => continueButtonLabel(initial.destination.siteKey || sourceSite),
    [initial.destination.siteKey, sourceSite],
  );

  async function handleSubmit() {
    setErrorMessage(null);
    setStatusMessage("Recording your agreements…");
    startTransition(async () => {
      try {
        const result = await submit({
          data: {
            eligibilityConfirmed: eligibility,
            termsAndAupAgreed: termsAndAup,
            privacyAndElectronicConsented: privacyElectronic,
            sourceSite,
            returnPath: returnPath ?? initial.destination.path,
            returnOrigin: returnOrigin ?? initial.destination.origin,
            ...(isUiLabMode()
              ? { uiLabScenario: getUiLabOnboardingScenario() }
              : {}),
          },
        });
        invalidateRootSessionCache();
        setStatusMessage("Core account setup complete.");
        setClientStep(result.step === "minecraft" ? "minecraft" : "confirmation");
        await router.invalidate();
      } catch (error) {
        setStatusMessage(null);
        setErrorMessage(humanizeSubmitError(error));
        queueMicrotask(() => errorRef.current?.focus());
      }
    });
  }

  async function handleContinue() {
    const path = initial.destination.path || "/home";
    invalidateRootSessionCache();
    await router.invalidate();
    await router.navigate({ href: path });
  }

  if (step === "welcome") {
    return (
      <OnboardingShell
        title="Welcome to Alta"
        description="Alta is a Minecraft and Discord ecosystem for roleplay and virtual florin — not a real-world bank, brokerage, casino, or financial institution."
        progressLabel={progress.label}
        progressCurrent={progress.current}
        progressTotal={progress.total}
        footer={
          <OnboardingPrimaryButton onClick={() => setClientStep("legal")}>
            Get started
          </OnboardingPrimaryButton>
        }
      >
        <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          {initial.user.avatarUrl ? (
            <img
              src={initial.user.avatarUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-lg font-semibold"
              aria-hidden
            >
              {(initial.user.discordUsername?.[0] ?? "A").toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Signed in with Discord
            </p>
            <p className="mt-1 text-[17px] font-medium text-foreground">
              {initial.user.discordUsername}
            </p>
          </div>
        </div>
        <p className="mt-6 text-[14px] leading-relaxed text-muted-foreground">
          Next, confirm eligibility, review Alta Group’s core agreements, and verify your Minecraft
          account. Additional product terms may be required later.
        </p>
      </OnboardingShell>
    );
  }

  if (step === "minecraft") {
    return (
      <OnboardingMinecraftStep
        initial={initial}
        onVerified={(name) => {
          setVerifiedMinecraftName(name);
          setMinecraftJustVerified(true);
          setStatusMessage("Minecraft verified.");
          setClientStep("confirmation");
        }}
      />
    );
  }

  if (step === "confirmation") {
    const mcName =
      verifiedMinecraftName ??
      (initial.user.minecraftVerifiedAt ? initial.user.minecraftUsername : null);
    return (
      <OnboardingShell
        title="You’re set"
        description="Alta onboarding is complete. Additional product terms may be required before some services."
        progressLabel={progress.label}
        progressCurrent={progress.total}
        progressTotal={progress.total}
        statusMessage={statusMessage}
        footer={
          <OnboardingPrimaryButton onClick={() => void handleContinue()}>
            {destinationLabel}
          </OnboardingPrimaryButton>
        }
      >
        <ul className="space-y-3 text-[14px] text-foreground/90">
          <li className="flex justify-between gap-4 border-b border-white/10 py-3">
            <span className="text-muted-foreground">Discord</span>
            <span className="font-medium">{initial.user.discordUsername}</span>
          </li>
          <li className="flex justify-between gap-4 border-b border-white/10 py-3">
            <span className="text-muted-foreground">Minecraft</span>
            <span className="font-medium">{mcName ?? "Verified"}</span>
          </li>
          <li className="flex justify-between gap-4 border-b border-white/10 py-3">
            <span className="text-muted-foreground">Core legal documents</span>
            <span className="font-medium">Recorded</span>
          </li>
          <li className="flex justify-between gap-4 border-b border-white/10 py-3">
            <span className="text-muted-foreground">Alta onboarding</span>
            <span className="font-medium">Complete</span>
          </li>
        </ul>
      </OnboardingShell>
    );
  }

  // Legal step (default)
  return (
    <OnboardingShell
      title="Eligibility & agreements"
      description="Alta operates for Minecraft, Discord, roleplay, and virtual florin purposes. It is not a real-world bank, brokerage, casino, or financial institution."
      progressLabel={progress.label}
      progressCurrent={progress.current}
      progressTotal={progress.total}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      footer={
        <OnboardingPrimaryButton
          disabled={!canSubmit}
          loading={pending}
          onClick={() => void handleSubmit()}
        >
          Agree and continue
        </OnboardingPrimaryButton>
      }
    >
      <div ref={errorRef} tabIndex={-1} className="space-y-2.5 outline-none">
        <OnboardingCheckbox
          id="onboarding-eligibility"
          checked={eligibility}
          onChange={setEligibility}
          disabled={pending}
        >
          I confirm that I am at least 13 years old and meet the eligibility requirements of
          Discord and DistrictRP.
        </OnboardingCheckbox>

        <OnboardingCheckbox
          id="onboarding-terms-aup"
          checked={termsAndAup}
          onChange={setTermsAndAup}
          disabled={pending}
        >
          I have read and agree to the{" "}
          <OnboardingLegalLink href={tos?.publicPath ?? "/legal/terms"}>
            {tos?.title ?? "Alta Group Terms of Service"}
          </OnboardingLegalLink>{" "}
          and{" "}
          <OnboardingLegalLink href={aup?.publicPath ?? "/legal/acceptable-use"}>
            {aup?.title ?? "Alta Acceptable Use Policy"}
          </OnboardingLegalLink>
          .
        </OnboardingCheckbox>

        <OnboardingCheckbox
          id="onboarding-privacy-electronic"
          checked={privacyElectronic}
          onChange={setPrivacyElectronic}
          disabled={pending}
        >
          I acknowledge the{" "}
          <OnboardingLegalLink href={privacy?.publicPath ?? "/legal/privacy"}>
            {privacy?.title ?? "Privacy Policy"}
          </OnboardingLegalLink>{" "}
          and consent to receiving required records electronically under the{" "}
          <OnboardingLegalLink
            href={electronic?.publicPath ?? "/legal/electronic-communications"}
          >
            {electronic?.title ?? "Electronic Communications and Consent"}
          </OnboardingLegalLink>
          .
        </OnboardingCheckbox>
      </div>
    </OnboardingShell>
  );
}
