import { spawn } from "node:child_process";
import process from "node:process";


type ModuleStatus = "PASS" | "FAIL";

type ModuleResult = {
  moduleName: string;
  status: ModuleStatus;
  error: string | null;
  durationMs: number;
};


type OrchestratorReport = {
  modules: ModuleResult[];
  finalVerdict: "READY" | "BLOCKED";
};

function nowMs() {
  return Date.now();
}

function toMs(start: number) {
  return nowMs() - start;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RunCommandOptions = {
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
};

async function runCommand(command: string, options: RunCommandOptions = {}) {
  return new Promise<{ ok: boolean; exitCode: number; stdout: string; stderr: string; timedOut: boolean }>((resolve) => {
    const timeoutMs = options.timeoutMs ?? 15 * 60_000;
    const child = spawn(command, {
      cwd: process.cwd(),
      env: { ...process.env, ...options.env },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let killTimer: NodeJS.Timeout | null = null;

    const settle = (payload: { ok: boolean; exitCode: number; stdout: string; stderr: string; timedOut: boolean }) => {
      if (settled) {
        return;
      }
      settled = true;
      if (killTimer) {
        clearTimeout(killTimer);
      }
      resolve(payload);
    };

    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      // forward child stdout to parent for real-time visibility
      try {
        process.stdout.write(text);
      } catch (e) {
        // ignore
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      // forward child stderr to parent for real-time visibility
      try {
        process.stderr.write(text);
      } catch (e) {
        // ignore
      }
    });

    killTimer = setTimeout(() => {
      timedOut = true;
      stderr += `\n[production_check] command timed out after ${timeoutMs}ms`;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!settled) {
          child.kill("SIGKILL");
        }
      }, 5_000);
    }, timeoutMs);

    child.on("close", (code) => {
      const exitCode = typeof code === "number" ? code : 1;
      settle({
        ok: exitCode === 0,
        exitCode,
        stdout,
        stderr,
        timedOut,
      });
    });

    child.on("error", (error) => {
      stderr += error.message;
      settle({
        ok: false,
        exitCode: 1,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}

function trimForError(text: string, max = 800) {
  const clean = text.trim();
  if (!clean) {
    return null;
  }
  return clean.length <= max ? clean : `${clean.slice(0, max)}...`;
}

async function checkDbHealthUrlWithRetry(healthUrl: string): Promise<{ ok: boolean; error: string | null }> {
  const maxAttempts = 3;
  const delayMs = 500;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      const payload = (await response.json().catch(() => null)) as { status?: string; error?: string } | null;

      if (response.ok && payload?.status === "ok") {
        return { ok: true, error: null };
      }

      lastError = trimForError(JSON.stringify({ httpStatus: response.status, payload })) ?? "db_health_check_failed";
    } catch (error) {
      lastError = trimForError(error instanceof Error ? error.message : String(error)) ?? "db_health_check_failed";
    }

    if (attempt < maxAttempts) {
      await sleep(delayMs);
    }
  }

  return { ok: false, error: lastError ?? "db_health_check_failed" };
}

async function checkDbHealthWithRetry(): Promise<{ ok: boolean; error: string | null }> {
  const explicitHealthUrl = process.env.PRODUCTION_CHECK_HEALTH_URL?.trim();
  const healthUrl = explicitHealthUrl ?? "http://127.0.0.1:5000/health/db";
  const endpointResult = await checkDbHealthUrlWithRetry(healthUrl);
  if (endpointResult.ok) {
    return endpointResult;
  }

  try {
    const { prisma } = await import("../src/config/db");
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, error: null };
  } catch (fallbackError) {
    const fallbackMessage = trimForError(
      fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
    );
    return {
      ok: false,
      error: trimForError(`endpoint=${endpointResult.error ?? "unknown"}; fallback=${fallbackMessage ?? "unknown"}`),
    };
  }
}

// Deprecated: use appendModule for deterministic timing and error handling
async function runModule(
  moduleName: string,
  execute: () => Promise<{ ok: boolean; error: string | null }>
): Promise<ModuleResult> {
  // ...existing code...
  throw new Error("runModule is deprecated; use appendModule");
}

async function runModuleCommand(command: string, options: RunCommandOptions = {}) {
  const result = await runCommand(command, options);
  return {
    ok: result.ok,
    error: result.ok
      ? null
      : trimForError(
          result.stderr || result.stdout || `exit_code_${result.exitCode}${result.timedOut ? " (timeout)" : ""}`
        ),
  };
}


function buildReport(results: ModuleResult[]): OrchestratorReport {
  // Deterministic: always include all modules, never silent
  const requiredFailures = results.filter((result) => result.status === "FAIL");
  return {
    modules: results,
    finalVerdict: requiredFailures.length === 0 ? "READY" : "BLOCKED",
  };
}



function printHumanReport(report: OrchestratorReport) {
  console.log("=== PRODUCTION CHECK ===");
  for (const module of report.modules) {
    let label = module.moduleName;
    if (/db health/i.test(label)) label = "DB";
    if (/schema/i.test(label)) label = "Schema";
    if (/idempotency/i.test(label)) label = "Idempotency";
    if (/referral/i.test(label)) label = "Referral";
    if (/stress/i.test(label)) label = "Stress";
    if (/smoke/i.test(label)) label = "Smoke";
    const pad = (label + ":").padEnd(12, " ");
    const status = module.status;
    const emoji = status === "PASS" ? "✅" : "❌";
    console.log(`${pad}${status} ${emoji}`);
    if (module.status === "FAIL" && module.error) {
      console.log(`    error: ${module.error}`);
    }
    if (module.status === "PASS" && module.error) {
      // Should not happen, but log if present
      console.log(`    warning: ${module.error}`);
    }
  }
  console.log("\n=== SUMMARY ===");
  if (report.finalVerdict === "READY") {
    console.log("FINAL: READY 🚦");
  } else {
    console.log("FINAL: BLOCKED 🛑");
  }
}

function printJsonReport(report: OrchestratorReport) {
  console.log(JSON.stringify(report, null, 2));
}



async function main() {
  const results: ModuleResult[] = [];
  const runAt = nowMs();
  const useJson = process.argv.includes("--json");
  const TIMEOUTS = {
    db: 30_000,
    schema: 90_000,
    idempotency: 180_000,
    referral: 120_000,
    stress: 300_000,
    smoke: 300_000,
  };

  async function appendModule(moduleName: string, execute: () => Promise<{ ok: boolean; error: string | null }>, timeoutMs: number) {
    const startedAt = nowMs();
    let result: ModuleResult;
    let didOutput = false;
    try {
      const timeoutPromise = new Promise<ModuleResult>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs));
      const execPromise: Promise<ModuleResult> = (async () => {
        const r = await execute();
        didOutput = true;
        const status: ModuleStatus = r.ok ? "PASS" : "FAIL";
        return {
          moduleName,
          status,
          error: r.ok ? null : r.error,
          durationMs: toMs(startedAt),
        };
      })();
      result = await Promise.race([execPromise, timeoutPromise]);
    } catch (error) {
      result = {
        moduleName,
        status: "FAIL",
        error: error instanceof Error ? error.message : String(error),
        durationMs: toMs(startedAt),
      };
    }
    // Deterministic log per module
    const pad = (moduleName + ":").padEnd(12, " ");
    const emoji = result.status === "PASS" ? "✅" : "❌";
    console.log(`[${pad}${result.status} ${emoji}] (${result.durationMs}ms)`);
    if (result.status === "FAIL" && result.error) {
      console.log(`    error: ${result.error}`);
    }
    if (!didOutput && result.status === "PASS") {
      console.log(`    [WARN] Module '${moduleName}' produced no output but passed.`);
    }
    results.push(result);
  }

  // 1. DB health
  await appendModule("DB", async () => checkDbHealthWithRetry(), TIMEOUTS.db);

  // 2. Prisma schema drift
  await appendModule("Schema", async () => {
    const statusResult = await runModuleCommand("npx prisma migrate status", { timeoutMs: TIMEOUTS.schema });
    if (!statusResult.ok) return statusResult;
    return runModuleCommand("npx prisma migrate diff --from-schema prisma/schema.prisma --to-config-datasource --script", { timeoutMs: TIMEOUTS.schema });
  }, TIMEOUTS.schema);

  // 3. Idempotency tests
  await appendModule("Idempotency", async () =>
    runModuleCommand("npx ts-node scripts/production_validations/duplicate_rewards_check.ts", { timeoutMs: TIMEOUTS.idempotency })
  , TIMEOUTS.idempotency);

  // 4. Referral lifecycle
  await appendModule("Referral", async () =>
    runModuleCommand("npx ts-node scripts/validate_active_referral_rewards.ts", { timeoutMs: TIMEOUTS.referral })
  , TIMEOUTS.referral);

  // 5. Stress test
  await appendModule("Stress", async () =>
    runModuleCommand("npm run stress:test -- --mode=light", {
      env: { STRESS_MODE: "light", FF_REFERRAL_ENABLED: "true" },
      timeoutMs: TIMEOUTS.stress,
    })
  , TIMEOUTS.stress);

  // 6. Smoke E2E
  await appendModule("Smoke", async () =>
    runModuleCommand("npm run smoke:e2e", {
      env: { FF_REFERRAL_ENABLED: "true" },
      timeoutMs: TIMEOUTS.smoke,
    })
  , TIMEOUTS.smoke);

  const report = buildReport(results);
  if (useJson) {
    printJsonReport(report);
  } else {
    printHumanReport(report);
  }
  process.exitCode = report.finalVerdict === "READY" ? 0 : 1;
}


main().catch((error) => {
  const fallbackReport: OrchestratorReport = {
    modules: [
      {
        moduleName: "orchestrator",
        status: "FAIL",
        error: trimForError(error instanceof Error ? error.message : String(error)),
        durationMs: 0,
      },
    ],
    finalVerdict: "BLOCKED",
  };
  if (process.argv.includes("--json")) {
    printJsonReport(fallbackReport);
  } else {
    printHumanReport(fallbackReport);
  }
  process.exitCode = 1;
});
