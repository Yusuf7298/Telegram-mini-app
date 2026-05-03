type ReferralLogEvent =
  | "referral_joined"
  | "referral_activation_attempt"
  | "referral_reward_granted"
  | "referral_duplicate_blocked";

type ReferralStructuredPayloadInput = {
  event: ReferralLogEvent;
  endpoint: string;
  inviterId: string;
  referredUserId: string;
  rewardAmount: string;
  status: string;
  correlationId: string;
  referralId?: string | null;
  transactionId?: string | null;
  reason?: string | null;
  detectionSource?: string | null;
  referralCode?: string | null;
  ip?: string | null;
  deviceId?: string | null;
};

export function createReferralStructuredLogPayload(payload: ReferralStructuredPayloadInput) {
  return {
    userId: payload.referredUserId,
    endpoint: payload.endpoint,
    action: payload.event,
    inviterId: payload.inviterId,
    referredUserId: payload.referredUserId,
    rewardAmount: payload.rewardAmount,
    status: payload.status,
    referralId: payload.referralId ?? null,
    transactionId: payload.transactionId ?? null,
    reason: payload.reason ?? null,
    detectionSource: payload.detectionSource ?? null,
    referralCode: payload.referralCode ?? null,
    ip: payload.ip ?? null,
    deviceId: payload.deviceId ?? null,
    correlationId: payload.correlationId,
    timestamp: new Date().toISOString(),
  };
}
