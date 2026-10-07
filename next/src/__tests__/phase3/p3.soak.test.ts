// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SoakRunner, DEFAULT_48H_CONFIG } from "../../../acceptance/soakRunner";
import { isBackendAvailable } from "../../../acceptance/productionClient";

describe("P3-SOAK: 48-Hour Production Rehearsal & Smoke Soak Matrix", () => {
  describe("Executable Soak Runner Specifications", () => {
    it("defines 48-hour rehearsal configuration", () => {
      expect(DEFAULT_48H_CONFIG.mode).toBe("rehearsal_48h");
      expect(DEFAULT_48H_CONFIG.durationMs).toBe(48 * 60 * 60 * 1000);
      expect(DEFAULT_48H_CONFIG.pollIntervalMs).toBe(2000);
      expect(DEFAULT_48H_CONFIG.commandIntervalMs).toBe(10000);
      expect(DEFAULT_48H_CONFIG.healthIntervalMs).toBe(30000);
      expect(DEFAULT_48H_CONFIG.numViewers).toBe(10);
    });

    it("executes short smoke mode and collects metrics without invariant violations", async () => {
      const runner = new SoakRunner({
        mode: "smoke",
        durationMs: isBackendAvailable() ? 3500 : 800, // Account for scrypt login time when live backend is active
        pollIntervalMs: 100,
        commandIntervalMs: 200,
        healthIntervalMs: 300,
        networkGlitchProbability: 0.2, // Exercise network drop & receipt reconciliation
        numViewers: 2,
      });

      const metrics = await runner.run();

      expect(metrics.durationMs).toBeGreaterThanOrEqual(700);
      expect(metrics.pollsTotal).toBeGreaterThan(0);
      expect(metrics.commandsSubmitted).toBeGreaterThan(0);
      expect(metrics.healthChecksTotal).toBeGreaterThan(0);
      expect(metrics.invariantViolations.length).toBe(0);

      const report = runner.generateReport();
      expect(report).toContain("LiveLift V3 Phase 3 Soak Rehearsal Report");
      expect(report).toContain("Result: PASS");
    }, 10000);
  });
});
