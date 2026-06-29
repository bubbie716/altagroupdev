import { createContext, createElement, useContext } from "react";
import {
  EMPTY_ALTA_PRIVATE_CLIENT_CONTEXT,
  type AltaPrivateClientContext,
} from "@/lib/bank/alta-private-client.types";

const AltaPrivateClientContextReact = createContext<AltaPrivateClientContext>(
  EMPTY_ALTA_PRIVATE_CLIENT_CONTEXT,
);

export function AltaPrivateClientProvider({
  value,
  children,
}: {
  value: AltaPrivateClientContext;
  children: React.ReactNode;
}) {
  return createElement(AltaPrivateClientContextReact.Provider, { value }, children);
}

export function useAltaPrivateClientContext(): AltaPrivateClientContext {
  return useContext(AltaPrivateClientContextReact);
}
