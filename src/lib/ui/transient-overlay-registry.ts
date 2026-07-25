/**
 * Registry of open transient overlays (dropdowns, selects, popovers) that must
 * close when the route changes. Safety net — components still own their open state.
 */

type OverlayCloser = () => void;

const closers = new Set<OverlayCloser>();

export function registerTransientOverlay(close: OverlayCloser): () => void {
  closers.add(close);
  return () => {
    closers.delete(close);
  };
}

export function closeAllTransientOverlays(): void {
  for (const close of [...closers]) {
    try {
      close();
    } catch {
      // Ignore individual closer failures so one bad overlay cannot block others.
    }
  }
}
