"use client";

import { Close, Share } from "@/components/icons";
import { useInstallBannerDismissed } from "@/hooks/useInstallBannerDismissed";
import { useInstallEligibility } from "@/hooks/useInstallEligibility";

// No beforeinstallprompt integration by design: it's inconsistent across
// Chrome versions and absent entirely on iOS Safari, so this is static
// instructional copy rather than a native install trigger.
export function InstallBanner() {
  const { dismissed, dismiss } = useInstallBannerDismissed();
  const { standalone, platform } = useInstallEligibility();

  if (standalone || dismissed) return null;

  return (
    <div className="flex items-start gap-2 border-b border-zinc-800 bg-zinc-900/60 px-3 py-2 text-[11px] leading-snug text-zinc-300">
      <div className="flex-1 space-y-1">
        {(platform === "ios" || platform === "unknown") && (
          <p className="flex items-center gap-1">
            <Share className="h-3 w-3 shrink-0 text-accent" />
            Add to your Home Screen: tap Share, then &ldquo;Add to Home Screen&rdquo;.
          </p>
        )}
        {(platform === "android" || platform === "unknown") && (
          <p className="flex items-center gap-1">
            Add to your Home Screen: open the browser menu, then &ldquo;Install app&rdquo; (or &ldquo;Add to Home screen&rdquo;).
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install instructions"
        className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <Close className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
