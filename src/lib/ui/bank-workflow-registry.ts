/**
 * Registry of open Bank workflows (action sheets + Alta Card dialogs).
 * Enforces a single active Bank dialog/backdrop at a time.
 */

type WorkflowCloser = () => void;

const workflows = new Set<WorkflowCloser>();

export function registerBankWorkflow(close: WorkflowCloser): () => void {
  workflows.add(close);
  return () => {
    workflows.delete(close);
  };
}

/** Force-close every registered Bank workflow (no dirty confirm). */
export function closeAllBankWorkflows(): void {
  const snapshot = [...workflows];
  workflows.clear();
  for (const close of snapshot) {
    try {
      close();
    } catch {
      // Ignore individual closer failures so one bad workflow cannot block others.
    }
  }
}

export function countOpenBankWorkflows(): number {
  return workflows.size;
}
