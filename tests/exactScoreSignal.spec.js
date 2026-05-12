const { test, expect } = require("@playwright/test");
const path = require("path");

const { normalizeExactScoreSignal, buildExactScoreAttachment } = require("../public/exactScoreSignal.js");
const { buildExactScoreConvergence } = require("../services/exactScoreConvergence.js");

test.describe("Exact score signal", () => {
  test("shares the same normalized signal in node and browser", async ({ page }) => {
    const exactScore = {
      primary: { score: "1-0", aligned: true, probability: 0.38 },
      reliability: 78,
      fitScore: 72,
      marketSupport: 61,
      method: "convergence-v2",
      coherence: {
        badgeTone: "good",
      },
      provenance: {
        source: "convergence",
        usedConvergence: true,
        hasBias: true,
        aligned: true,
        method: "convergence-v2",
      },
    };

    const nodeSignal = normalizeExactScoreSignal(exactScore, {
      hasConvergence: true,
      hasBias: true,
      aligned: true,
    });

    await page.addScriptTag({ path: path.resolve("public/exactScoreSignal.js") });
    const browserSignal = await page.evaluate((value) => {
      return window.ExactScoreSignal.normalizeExactScoreSignal(value, {
        hasConvergence: true,
        hasBias: true,
        aligned: true,
      });
    }, exactScore);

    expect(browserSignal.signal).toBe(nodeSignal.signal);
    expect(browserSignal.normalized).toBe(nodeSignal.normalized);
    expect(browserSignal.signal).toBeGreaterThan(-5);
    expect(browserSignal.signal).toBeLessThanOrEqual(5);
  });

  test("uses a softmax distribution for convergence probabilities", () => {
    const convergence = buildExactScoreConvergence({
      bettingMarkets: [
        { nom: "1-0", cote: 5.5, code: { g: 0, t: 0, line: null } },
        { nom: "2-0", cote: 8.5, code: { g: 0, t: 0, line: null } },
        { nom: "0-0", cote: 9.5, code: { g: 0, t: 0, line: null } },
      ],
      league: "fifa virtual",
    });

    expect(convergence).toBeTruthy();
    const totalProbability = convergence.ranked.reduce((sum, item) => sum + Number(item.probability || 0), 0);
    expect(totalProbability).toBeGreaterThan(0.99);
    expect(totalProbability).toBeLessThan(1.01);
    expect(convergence.ranked.every((item) => Number(item.probability || 0) >= 0)).toBe(true);
  });

  test("builds a provenance-aware exact score attachment", () => {
    const attachment = buildExactScoreAttachment(
      {
        primary: { score: "1-0", aligned: true, probability: 0.4 },
        reliability: 82,
        fitScore: 76,
        marketSupport: 66,
        method: "convergence-v2",
        coherence: { badgeTone: "good", badgeLabel: "Aligne avec la reco" },
        provenance: { source: "convergence", usedConvergence: true, hasBias: true, aligned: true, method: "convergence-v2" },
      },
      {
        hasConvergence: true,
        hasBias: true,
        aligned: true,
      }
    );

    expect(attachment).toMatchObject({
      score: "1-0",
      method: "convergence-v2",
      provenance: {
        source: "convergence",
        usedConvergence: true,
        hasBias: true,
        aligned: true,
        method: "convergence-v2",
      },
    });
    expect(attachment.signal).toBeGreaterThan(0);
  });
});
