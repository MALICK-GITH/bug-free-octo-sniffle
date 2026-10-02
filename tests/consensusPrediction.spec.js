const { test, expect } = require("@playwright/test");

const { buildConsensusPrediction, toMasterDecision } = require("../services/consensusPrediction");

test.describe("Consensus prediction engine", () => {
  test("builds a primary decision with safer alternatives", () => {
    const bets = [
      { nom: "Score exact 2-1", cote: 7.5 },
      { nom: "Total Plus de 1.5", cote: 1.62 },
      { nom: "Double chance 1X", cote: 1.42 },
      { nom: "Victoire 1", cote: 1.95 },
    ];

    const bots = {
      systeme_unifie: {
        paris_recommandes: [
          { nom: "Total Plus de 1.5", cote: 1.62, confiance: 78 },
          { nom: "Victoire 1", cote: 1.95, confiance: 69 },
        ],
      },
      systeme_ia: {
        paris_recommandes: [{ nom: "Total Plus de 1.5", cote: 1.62, confiance: 74 }],
      },
      systeme_probabilites: {
        paris_recommandes: [{ nom: "Double chance 1X", cote: 1.42, confiance: 76 }],
      },
      systeme_value: {
        paris_recommandes: [{ nom: "Victoire 1", cote: 1.95, confiance: 64 }],
      },
      systeme_statistique: {
        paris_recommandes: [{ nom: "Total Plus de 1.5", cote: 1.62, confiance: 72 }],
      },
    };

    const analyseAvancee = {
      analyses_detaillees: [
        { pari: "Score exact 2-1", cote: 7.5, score_composite: 68, probabilite_estimee: 18, value: -5, risque: "ELEVE" },
        { pari: "Total Plus de 1.5", cote: 1.62, score_composite: 77, probabilite_estimee: 66, value: 6.9, risque: "FAIBLE" },
        { pari: "Double chance 1X", cote: 1.42, score_composite: 72, probabilite_estimee: 74, value: 5.1, risque: "FAIBLE" },
        { pari: "Victoire 1", cote: 1.95, score_composite: 69, probabilite_estimee: 55, value: 7.2, risque: "MODERE" },
      ],
    };

    const result = buildConsensusPrediction({
      team1: "Arsenal",
      team2: "Chelsea",
      league: "FIFA Virtual",
      context: { score1: 0, score2: 0, minute: 12 },
      bets,
      bots,
      analyseAvancee,
    });

    expect(result.version).toBe("CONSENSUS-PREDICTOR-1.0");
    expect(result.primary).toBeTruthy();
    expect(result.primary.family).not.toBe("EXACT_SCORE");
    expect(result.primary.confidence).toBeGreaterThanOrEqual(58);
    expect(result.alternatives.prudent).toBeTruthy();
    expect(result.topMarkets.length).toBeGreaterThan(1);

    const masterDecision = toMasterDecision(result, {});
    expect(masterDecision.pari_choisi).toBe(result.primary.pari);
    expect(masterDecision.moteur).toBe("CONSENSUS-PREDICTOR-1.0");
  });
});
