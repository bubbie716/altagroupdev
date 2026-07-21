export type IssuerSession = {
  ticker: string;
  organization: string;
};

const SESSION_STORAGE = "alta-issuer-session";

export function readIssuerSession(ticker: string): IssuerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE);
    if (!raw) return null;
    const session = JSON.parse(raw) as IssuerSession;
    return session.ticker.toUpperCase() === ticker.toUpperCase() ? session : null;
  } catch {
    return null;
  }
}

export function saveIssuerSession(session: IssuerSession) {
  localStorage.setItem(SESSION_STORAGE, JSON.stringify(session));
}

export function clearIssuerSession() {
  localStorage.removeItem(SESSION_STORAGE);
}
