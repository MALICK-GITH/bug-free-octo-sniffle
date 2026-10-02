(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ExactScoreSignal = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this, function () {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function extractExactScore(input) {
    if (!input || typeof input !== "object") return null;
    if (input.available === true && input.value && typeof input.value === "object") return input.value;
    if (input.exactScore && typeof input.exactScore === "object") return input.exactScore;
    return input;
  }

  function resolveSource(exactScore, options = {}) {
    if (options.source) return String(options.source);
    const provenanceSource = exactScore?.provenance?.source;
    if (provenanceSource) return String(provenanceSource);
    if (exactScore?.method === "convergence-v2") return "convergence";
    if (exactScore?.method === "poisson-odds-market-v1") return "poisson";
    if (exactScore?.method) return String(exactScore.method);
    return "unknown";
  }

  function isAligned(exactScore, options = {}) {
    if (options.aligned != null) return Boolean(options.aligned);
    if (exactScore?.primary?.aligned != null) return Boolean(exactScore.primary.aligned);
    return String(exactScore?.coherence?.badgeTone || "neutral") === "good";
  }

  function normalizeExactScoreSignal(input, options = {}) {
    const exactScore = extractExactScore(input);
    if (!exactScore) {
      return {
        available: false,
        signal: 0,
        normalized: 0,
        quality: 0,
        reliability: 0,
        fitScore: 0,
        marketSupport: 0,
        aligned: false,
        hasBias: false,
        hasConvergence: false,
        source: "none",
        provenance: {
          source: "none",
          usedConvergence: false,
          hasBias: false,
          aligned: false,
          method: null,
        },
      };
    }

    const source = resolveSource(exactScore, options);
    const hasConvergence = Boolean(
      options.hasConvergence != null
        ? options.hasConvergence
        : exactScore?.provenance?.usedConvergence != null
          ? exactScore.provenance.usedConvergence
          : exactScore?.method && exactScore.method !== "poisson-odds-market-v1"
    );
    const hasBias = Boolean(
      options.hasBias != null
        ? options.hasBias
        : exactScore?.provenance?.hasBias != null
          ? exactScore.provenance.hasBias
          : exactScore?.coherence?.recommendation
    );
    const aligned = isAligned(exactScore, options);

    const reliability = clamp(toNumber(exactScore.reliability, 0), 0, 100);
    const fitScore = clamp(toNumber(exactScore.fitScore, reliability), 0, 100);
    const marketSupport = clamp(toNumber(exactScore.marketSupport, reliability), 0, 100);
    const primaryProbability = clamp(toNumber(exactScore?.primary?.probability, 0), 0, 1);

    const quality = clamp(
      reliability * 0.48 + fitScore * 0.28 + marketSupport * 0.16 + primaryProbability * 100 * 0.08,
      0,
      100
    );

    const centered = ((quality - 50) / 50) * 3.2;
    const convergenceBoost = hasConvergence ? 0.6 : 0.15;
    const biasBonus = hasBias ? (aligned ? 1.05 : -1.05) : 0;
    const sourceBonus = source === "convergence" ? 0.35 : source === "poisson" ? 0.1 : 0;
    const signal = clamp(Number((centered + convergenceBoost + biasBonus + sourceBonus).toFixed(3)), -5, 5);
    const normalized = Number(((signal + 5) / 10).toFixed(3));

    return {
      available: true,
      signal,
      normalized,
      quality: Number(quality.toFixed(1)),
      reliability,
      fitScore,
      marketSupport,
      aligned,
      hasBias,
      hasConvergence,
      source,
      provenance: {
        source,
        usedConvergence: hasConvergence,
        hasBias,
        aligned,
        method: exactScore.method || null,
      },
    };
  }

  function buildExactScoreAttachment(input, options = {}) {
    const exactScore = extractExactScore(input);
    if (!exactScore) return null;
    const signal = normalizeExactScoreSignal(exactScore, options);

    return {
      score: exactScore?.primary?.score || exactScore?.score || null,
      value: exactScore,
      primary: exactScore.primary || null,
      alternatives: Array.isArray(exactScore.alternatives) ? exactScore.alternatives : [],
      reliability: exactScore.reliability ?? null,
      fitScore: exactScore.fitScore ?? null,
      marketSupport: exactScore.marketSupport ?? null,
      totalGoals: exactScore.totalGoals ?? null,
      homeLambda: exactScore.homeLambda ?? null,
      awayLambda: exactScore.awayLambda ?? null,
      overLines: Array.isArray(exactScore.overLines) ? exactScore.overLines : [],
      bttsProb: exactScore.bttsProb ?? null,
      method: exactScore.method || null,
      coherence: exactScore.coherence || null,
      provenance: signal.provenance,
      signal: signal.signal,
      normalizedSignal: signal.normalized,
      available: true,
    };
  }

  return {
    clamp,
    normalizeExactScoreSignal,
    buildExactScoreAttachment,
  };
});
