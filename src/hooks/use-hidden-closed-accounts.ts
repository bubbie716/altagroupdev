import { useCallback, useEffect, useState } from "react";
import {
  hideClosedAccount,
  readHiddenClosedAccountIds,
} from "@/lib/bank/hidden-closed-accounts";
import { useRequireCurrentUser } from "@/hooks/use-current-user";

export function useHiddenClosedAccounts() {
  const user = useRequireCurrentUser();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() =>
    readHiddenClosedAccountIds(user.id),
  );

  useEffect(() => {
    setHiddenIds(readHiddenClosedAccountIds(user.id));
  }, [user.id]);

  const hideAccount = useCallback(
    (accountId: string) => {
      const next = hideClosedAccount(user.id, accountId);
      setHiddenIds(new Set(next));
    },
    [user.id],
  );

  const isHidden = useCallback(
    (accountId: string) => hiddenIds.has(accountId),
    [hiddenIds],
  );

  return { hiddenIds, hideAccount, isHidden };
}
