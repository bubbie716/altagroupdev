export type AltaPrivateBankerProfile = {
  name: string;
  title: string;
};

/** Customer-facing Alta Private membership context for bank chrome. */
export type AltaPrivateClientContext = {
  isMember: boolean;
  displayName: string;
  greeting: string;
  welcomeBackGreeting: string;
  memberSince: string | null;
  memberSinceLabel: string | null;
  banker: AltaPrivateBankerProfile | null;
  benefits: readonly string[];
};

export const EMPTY_ALTA_PRIVATE_CLIENT_CONTEXT: AltaPrivateClientContext = {
  isMember: false,
  displayName: "",
  greeting: "",
  welcomeBackGreeting: "",
  memberSince: null,
  memberSinceLabel: null,
  banker: null,
  benefits: [],
};
