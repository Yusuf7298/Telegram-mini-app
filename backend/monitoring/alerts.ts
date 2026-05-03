// Alert rules for production anomaly detection
export const alertRules = [
  {
    name: 'duplicate_referral_blocked_spike',
    metric: 'duplicate_referral_attempts',
    condition: 'rate > threshold',
    threshold: 10, // e.g., 10 per minute
    window: '1m',
    action: 'alert',
    description: 'Spike in duplicate referral attempts blocked',
  },
  {
    name: 'reward_grant_failure_rate',
    metric: 'reward_grant_failures',
    condition: 'rate > 0.01',
    threshold: 0.01, // 1%
    window: '5m',
    action: 'alert',
    description: 'Reward grant failures exceed 1% in 5 minutes',
  },
  {
    name: 'db_health_endpoint_failures',
    metric: 'db_health_failures',
    condition: 'count >= 3',
    threshold: 3,
    window: '10m',
    action: 'alert',
    description: 'DB health endpoint failed 3 times in 10 minutes',
  },
];
