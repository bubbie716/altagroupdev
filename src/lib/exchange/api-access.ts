export type ApiApplication = {
  organization: string;
  contactName: string;
  useCase: string;
  description: string;
};

export type StoredApiKey = {
  key: string;
  organization: string;
  useCase: string;
  issuedAt: string;
};

export type ApiSession = {
  key: string;
  organization: string;
};

const KEYS_STORAGE = "alta-exchange-api-keys";
const SESSION_STORAGE = "alta-exchange-api-session";

function readKeys(): StoredApiKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS_STORAGE);
    return raw ? (JSON.parse(raw) as StoredApiKey[]) : [];
  } catch {
    return [];
  }
}

function writeKeys(keys: StoredApiKey[]) {
  localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
}

export function readApiSession(): ApiSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE);
    if (!raw) return null;
    const session = JSON.parse(raw) as ApiSession;
    return findKeyRecord(session.key) ? session : null;
  } catch {
    return null;
  }
}

function findKeyRecord(key: string): StoredApiKey | undefined {
  const trimmed = key.trim();
  return readKeys().find((k) => k.key === trimmed);
}

export function validateApiKey(key: string): ApiSession | null {
  const record = findKeyRecord(key.trim());
  if (!record) return null;
  return { key: record.key, organization: record.organization };
}

export function saveApiSession(session: ApiSession) {
  localStorage.setItem(SESSION_STORAGE, JSON.stringify(session));
}

export function clearApiSession() {
  localStorage.removeItem(SESSION_STORAGE);
}

export function generateApiKey(): string {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  return `ax_live_${suffix}`;
}

export function submitApiApplication(application: ApiApplication): StoredApiKey {
  const record: StoredApiKey = {
    key: generateApiKey(),
    organization: application.organization.trim(),
    useCase: application.useCase,
    issuedAt: new Date().toISOString().slice(0, 10),
  };
  writeKeys([...readKeys(), record]);
  return record;
}

export function maskApiKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 12)}${"•".repeat(8)}${key.slice(-4)}`;
}
