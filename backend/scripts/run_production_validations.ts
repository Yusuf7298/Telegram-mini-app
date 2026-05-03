import { runReferralCheck } from './production_validations/referral_check';
import { runWalletCheck } from './production_validations/wallet_check';
import { runDuplicateRewardsCheck } from './production_validations/duplicate_rewards_check';

type ModuleResult = { name: string; ok: boolean; details: any };

async function main() {
  const results: ModuleResult[] = [];

  try {
    const r1 = await runReferralCheck();
    results.push({ name: 'referral_check', ok: r1.ok, details: r1.details });
  } catch (err) {
    results.push({ name: 'referral_check', ok: false, details: { error: String(err) } });
  }

  try {
    const r2 = await runWalletCheck();
    results.push({ name: 'wallet_check', ok: r2.ok, details: r2.details });
  } catch (err) {
    results.push({ name: 'wallet_check', ok: false, details: { error: String(err) } });
  }

  try {
    const r3 = await runDuplicateRewardsCheck();
    results.push({ name: 'duplicate_rewards_check', ok: r3.ok, details: r3.details });
  } catch (err) {
    results.push({ name: 'duplicate_rewards_check', ok: false, details: { error: String(err) } });
  }

  const finalOk = results.every((r) => r.ok);
  const report = { runAt: new Date().toISOString(), finalOk, results };
  console.log(JSON.stringify(report, null, 2));
  process.exit(finalOk ? 0 : 2);
}

main().catch((err) => {
  console.error('run_production_validations error', err);
  process.exit(3);
});
