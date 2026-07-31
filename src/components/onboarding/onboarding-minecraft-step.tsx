/**
 * Minecraft verification step — username claim → coordinates → location check.
 * Browser never fetches BlueMap; all checks go through authenticated server functions.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  OnboardingPrimaryButton,
  OnboardingShell,
} from "@/components/onboarding/onboarding-shell";
import {
  checkMinecraftLocationFn,
  createMinecraftChallengeFn,
} from "@/lib/onboarding/onboarding.functions";
import { resolveOnboardingProgress } from "@/lib/onboarding/onboarding-steps";
import type { OnboardingLoaderState } from "@/lib/onboarding/onboarding-types";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { getUiLabOnboardingScenario } from "@/lib/onboarding/ui-lab-onboarding";
import { invalidateRootSessionCache } from "@/lib/auth/root-session-cache";
import { cn } from "@/lib/utils";

type Challenge = NonNullable<OnboardingLoaderState["minecraftChallenge"]>;

type Props = {
  initial: OnboardingLoaderState;
  onVerified: (verifiedUsername: string) => void;
};

const POLL_ATTEMPTS = 5;
const POLL_GAP_MS = 2_000;

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function humanizeChallengeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("MINECRAFT_USERNAME_INVALID")) {
    return "Enter a valid Minecraft username.";
  }
  if (message.includes("MINECRAFT_REGEN_COOLDOWN")) {
    return "Please wait before requesting different coordinates.";
  }
  if (message.includes("MINECRAFT_REGEN_LIMIT")) {
    return "You’ve reached the coordinate regeneration limit for now. Try again later.";
  }
  if (message.includes("MINECRAFT_ALREADY_VERIFIED")) {
    return "Your Minecraft account is already verified.";
  }
  return "We couldn’t generate coordinates. Please try again.";
}

export function OnboardingMinecraftStep({ initial, onVerified }: Props) {
  const router = useRouter();
  const createChallenge = useServerFn(createMinecraftChallengeFn);
  const checkLocation = useServerFn(checkMinecraftLocationFn);
  const [pending, startTransition] = useTransition();

  const [username, setUsername] = useState(initial.user.minecraftUsername ?? "");
  const [challenge, setChallenge] = useState<Challenge | null>(
    initial.minecraftChallenge,
  );
  const [phase, setPhase] = useState<"claim" | "coords" | "checking" | "success">(
    initial.minecraftChallenge ? "coords" : "claim",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(
    initial.minecraftChallenge?.secondsRemaining ?? 0,
  );
  const abortRef = useRef(false);
  const errorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    abortRef.current = false;
    return () => {
      abortRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!challenge || phase === "success") return;
    setSecondsRemaining(challenge.secondsRemaining);
    const started = Date.now();
    const base = challenge.secondsRemaining;
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setSecondsRemaining(Math.max(0, base - elapsed));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [challenge, phase]);

  const progress = resolveOnboardingProgress("minecraft");

  function uiLabPayload() {
    return isUiLabMode() ? { uiLabScenario: getUiLabOnboardingScenario() } : {};
  }

  function handleGenerate() {
    setErrorMessage(null);
    setStatusMessage(null);
    startTransition(async () => {
      try {
        const next = await createChallenge({
          data: { claimedUsername: username, ...uiLabPayload() },
        });
        setChallenge(next);
        setSecondsRemaining(next.secondsRemaining);
        setPhase("coords");
        setStatusMessage(null);
        await router.invalidate();
      } catch (error) {
        setErrorMessage(humanizeChallengeError(error));
        queueMicrotask(() => errorRef.current?.focus());
      }
    });
  }

  async function copyCoordinates() {
    if (!challenge) return;
    const text = `X: ${challenge.targetX}, Z: ${challenge.targetZ}`;
    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage("Coordinates copied.");
    } catch {
      setStatusMessage(text);
    }
  }

  async function runLocationPoll() {
    setErrorMessage(null);
    setStatusMessage(null);
    setPhase("checking");
    abortRef.current = false;

    for (let i = 0; i < POLL_ATTEMPTS; i++) {
      if (abortRef.current) return;

      try {
        const result = await checkLocation({ data: { ...uiLabPayload() } });

        if (abortRef.current) return;

        if (result.challenge) {
          setChallenge(result.challenge);
          setSecondsRemaining(result.challenge.secondsRemaining);
        }

        if (result.outcome === "verified") {
          setVerifiedName(result.verifiedUsername);
          setPhase("success");
          invalidateRootSessionCache();
          // Advance locally first so UI Lab (and delayed session refresh) cannot
          // remount this step before confirmation is shown.
          window.setTimeout(() => {
            if (!abortRef.current) onVerified(result.verifiedUsername);
          }, 900);
          void router.invalidate();
          return;
        }

        if (
          result.outcome === "username_linked" ||
          result.outcome === "expired" ||
          result.outcome === "no_challenge"
        ) {
          setPhase(result.outcome === "no_challenge" || result.outcome === "expired" ? "claim" : "coords");
          if (result.outcome === "expired" || result.outcome === "no_challenge") {
            setChallenge(null);
          }
          setErrorMessage(result.message);
          queueMicrotask(() => errorRef.current?.focus());
          return;
        }

        // Transient: offline, wrong_block, foreign, feed_*, cooldown, rate_limited
        if (i === POLL_ATTEMPTS - 1) {
          setPhase("coords");
          setErrorMessage(result.message);
          if (result.retryAfterSeconds) {
            setStatusMessage(`Try again in ${result.retryAfterSeconds}s.`);
          }
          queueMicrotask(() => errorRef.current?.focus());
          return;
        }

        await new Promise((r) => setTimeout(r, POLL_GAP_MS));
      } catch {
        if (abortRef.current) return;
        setPhase("coords");
        setErrorMessage(
          "DistrictRP’s live map is temporarily unavailable. Your verification coordinates are saved.",
        );
        queueMicrotask(() => errorRef.current?.focus());
        return;
      }
    }
  }

  if (phase === "success") {
    return (
      <OnboardingShell
        title="Minecraft verified"
        description="Your Minecraft account is connected to Alta."
        progressLabel={progress.label}
        progressCurrent={progress.current}
        progressTotal={progress.total}
        statusMessage="Verification complete."
        footer={<OnboardingPrimaryButton disabled>Continuing…</OnboardingPrimaryButton>}
      >
        <div
          className={cn(
            "rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-5 py-6 text-center",
            "motion-safe:animate-[fadeIn_0.5s_ease-out]",
          )}
          role="status"
        >
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Verified username
          </p>
          <p className="mt-2 text-[22px] font-medium text-foreground">
            {verifiedName ?? challenge?.claimedUsername}
          </p>
        </div>
      </OnboardingShell>
    );
  }

  if (phase === "checking" && challenge) {
    return (
      <OnboardingShell
        title="Connect your Minecraft account"
        description="Alta is checking the public DistrictRP live map."
        progressLabel={progress.label}
        progressCurrent={progress.current}
        progressTotal={progress.total}
        footer={<OnboardingPrimaryButton disabled loading>Checking…</OnboardingPrimaryButton>}
      >
        <div className="flex flex-col items-center gap-4 py-8 text-center" role="status" aria-live="polite">
          <div
            className={cn(
              "h-10 w-10 rounded-full border-2 border-[var(--gold)]/30 border-t-[var(--gold)]",
              "motion-safe:animate-spin motion-reduce:animate-none",
            )}
            aria-hidden
          />
          <div>
            <p className="text-[16px] font-medium text-foreground">Checking DistrictRP…</p>
            <p className="mt-2 text-[14px] text-muted-foreground">
              Stay on the verification block.
            </p>
          </div>
        </div>
      </OnboardingShell>
    );
  }

  if (phase === "coords" && challenge) {
    return (
      <OnboardingShell
        title="Connect your Minecraft account"
        description="Join DistrictRP and stand on the exact verification block. Only X and Z matter — Y is not used."
        progressLabel={progress.label}
        progressCurrent={progress.current}
        progressTotal={progress.total}
        statusMessage={statusMessage}
        errorMessage={errorMessage}
        footer={
          <OnboardingPrimaryButton loading={pending} onClick={() => void runLocationPoll()}>
            I’m on the block
          </OnboardingPrimaryButton>
        }
      >
        <div ref={errorRef} tabIndex={-1} className="space-y-5 outline-none">
          <p className="text-[13px] text-muted-foreground">
            Claimed as <span className="font-medium text-foreground">{challenge.claimedUsername}</span>
            {" · "}
            {secondsRemaining > 0
              ? `${formatRemaining(secondsRemaining)} remaining`
              : "Expired"}
          </p>

          <dl className="grid grid-cols-3 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">World</dt>
              <dd className="mt-1 font-mono text-[18px] text-foreground">{challenge.targetWorld}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">X</dt>
              <dd className="mt-1 font-mono text-[18px] text-foreground">{challenge.targetX}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Z</dt>
              <dd className="mt-1 font-mono text-[18px] text-foreground">{challenge.targetZ}</dd>
            </div>
          </dl>

          <p className="text-[13px] leading-relaxed text-muted-foreground">
            You must stand on this exact block. Stay there while Alta checks the map — the live feed
            can take a few seconds to update. This is a one-time verification.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyCoordinates()}
              className="min-h-11 rounded-md border border-white/15 px-4 text-[13px] text-foreground transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/60"
            >
              Copy coordinates
            </button>
            <button
              type="button"
              disabled={pending || !challenge.canRegenerate}
              onClick={() => handleGenerate()}
              className="min-h-11 rounded-md border border-white/15 px-4 text-[13px] text-foreground transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/60 disabled:opacity-40"
            >
              {challenge.canRegenerate
                ? "Get different coordinates"
                : `Wait ${challenge.regenerateCooldownSeconds}s`}
            </button>
          </div>
        </div>
      </OnboardingShell>
    );
  }

  // Claim username
  return (
    <OnboardingShell
      title="Connect your Minecraft account"
      description="Enter the username you use on DistrictRP. Alta will generate a nearby verification block. Join the server, stand on that exact block, and Alta will confirm your identity using the public live map. Only X and Z are used. This is a one-time verification."
      progressLabel={progress.label}
      progressCurrent={progress.current}
      progressTotal={progress.total}
      statusMessage={statusMessage}
      errorMessage={errorMessage}
      footer={
        <OnboardingPrimaryButton
          disabled={!username.trim()}
          loading={pending}
          onClick={() => handleGenerate()}
        >
          Generate coordinates
        </OnboardingPrimaryButton>
      }
    >
      <div ref={errorRef} tabIndex={-1} className="space-y-3 outline-none">
        <label htmlFor="minecraft-username" className="block text-[13px] text-muted-foreground">
          Minecraft username
        </label>
        <input
          id="minecraft-username"
          name="minecraftUsername"
          autoComplete="off"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={pending}
          className="min-h-11 w-full rounded-lg border border-white/15 bg-white/[0.04] px-4 text-[15px] text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/60"
          placeholder="Your DistrictRP username"
        />
        {initial.user.minecraftUsername ? (
          <p className="text-[12px] text-muted-foreground">
            Prefilling your profile name does not mean it is verified — you still need to prove
            presence on the block.
          </p>
        ) : null}
      </div>
    </OnboardingShell>
  );
}
