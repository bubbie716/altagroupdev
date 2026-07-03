/** Operator preference for whether the customer receives Discord / in-app notifications. */
export type OperatorNotificationOptions = {
  silentNotification?: boolean;
};

export type OpsConfirmOptions = OperatorNotificationOptions;

export function shouldNotifyCustomer(options?: OperatorNotificationOptions): boolean {
  return options?.silentNotification !== true;
}

export function buildOperatorNotificationAuditMetadata(
  actorUserId: string,
  options: OperatorNotificationOptions | undefined,
  customerNotificationSent: boolean,
): Record<string, boolean | string | null> {
  const silent = options?.silentNotification === true;
  return {
    silentNotification: silent,
    customerNotificationSent: silent ? false : customerNotificationSent,
    silentNotificationChosenByUserId: silent ? actorUserId : null,
  };
}
