// Metrics definitions for production monitoring
export const metrics = {
  referral_activation_success_rate: {
    type: 'rate',
    description: 'Rate of successful referral activations',
    labels: ['userId', 'referrerId'],
  },
  duplicate_referral_attempts: {
    type: 'counter',
    description: 'Number of duplicate referral attempts blocked',
    labels: ['userId', 'referrerId'],
  },
  reward_grant_failures: {
    type: 'counter',
    description: 'Number of failed reward grants',
    labels: ['userId', 'rewardType'],
  },
  wallet_balance_mismatch_count: {
    type: 'counter',
    description: 'Wallet balance mismatches detected',
    labels: ['userId'],
  },
  withdraw_failure_rate: {
    type: 'rate',
    description: 'Rate of failed withdrawal attempts',
    labels: ['userId'],
  },
};

export type MetricName = keyof typeof metrics;
