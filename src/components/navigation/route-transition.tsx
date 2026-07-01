import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";

type RouteTransitionContextValue = {
  /** Skip hero entrance animations after the first in-app navigation. */
  suppressEntranceAnimations: boolean;
};

const RouteTransitionContext = createContext<RouteTransitionContextValue>({
  suppressEntranceAnimations: false,
});

export function useRouteTransition() {
  return useContext(RouteTransitionContext);
}

/** Suppresses hero entrance animations on client-side navigations. */
export function RouteTransitionProvider({ children }: { children: ReactNode }) {
  const [suppressEntranceAnimations, setSuppressEntranceAnimations] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const isFirstNavigation = useRef(true);
  const lastLocationKey = useRef<string | null>(null);

  useLayoutEffect(() => {
    const locationKey = `${pathname}${searchStr}`;
    if (lastLocationKey.current === locationKey) return;

    if (isFirstNavigation.current) {
      isFirstNavigation.current = false;
      lastLocationKey.current = locationKey;
      return;
    }

    lastLocationKey.current = locationKey;
    setSuppressEntranceAnimations(true);
  }, [pathname, searchStr]);

  return (
    <RouteTransitionContext.Provider value={{ suppressEntranceAnimations }}>
      {children}
    </RouteTransitionContext.Provider>
  );
}
