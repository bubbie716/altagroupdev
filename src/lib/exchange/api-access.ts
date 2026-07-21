export type ApiApplication = {
  organization: string;
  contactName: string;
  useCase: string;
  description: string;
};

export type ApiSession = {
  key: string;
  organization: string;
};

/** Browser storage cannot issue or validate Exchange API credentials. */
export function readApiSession(): ApiSession | null {
  return null;
}

export function validateApiKey(_key: string): ApiSession | null {
  return null;
}

export function saveApiSession(_session: ApiSession): void {
  // Intentionally no-op — credentials are never issued via browser storage.
}

export function clearApiSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("alta-exchange-api-session");
    localStorage.removeItem("alta-exchange-api-keys");
  } catch {
    // ignore
  }
}

export type ApiApplicationResult = {
  submitted: false;
  unavailable: true;
  message: string;
};

/** Exchange Institution API credential issuance is not available yet. */
export function submitApiApplication(_application: ApiApplication): ApiApplicationResult {
  return {
    submitted: false,
    unavailable: true,
    message: "Exchange API credential issuance is not available yet.",
  };
}

export function maskApiKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 12)}${"•".repeat(8)}${key.slice(-4)}`;
}
