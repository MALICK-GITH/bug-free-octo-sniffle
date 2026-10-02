/**
 * Gestionnaire de prédiction IA via API pour la page de match
 * Intégration des prédictions foudroyantes par l'intelligence artificielle
 */

document.addEventListener('DOMContentLoaded', () => {
  const generateAIPredictionBtn = document.getElementById('generateAIPredictionBtn');
  const generateIntegratedPredictionBtn = document.getElementById('generateIntegratedPredictionBtn');
  const aiStatus = document.getElementById('aiStatus');
  const aiPredictionContent = document.getElementById('aiPredictionContent');

  // Données du match (seront extraites de la même API que le système existant)
  let matchData = {
    team1: '',
    team2: '',
    league: '',
    score1: 0,
    score2: 0,
    minute: 0,
    markets: []
  };

  // Extraire les données du match depuis la même API que le système existant
  async function extractMatchDataFromAPI() {
    const urlParams = new URLSearchParams(window.location.search);
    const matchId = urlParams.get('id');
    
    if (!matchId) {
      console.error('ID du match non trouvé dans l\'URL');
      return matchData;
    }

    try {
      const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}/details`, { cache: "no-store" });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        console.error('Erreur lors de la récupération des données du match:', data);
        return matchData;
      }

      const match = data.match || {};
      const prediction = data.prediction || {};
      
      matchData = {
        id: matchId,
        team1: match.teamHome || '',
        team2: match.teamAway || '',
        league: match.league || '',
        score1: match.score1 || 0,
        score2: match.score2 || 0,
        minute: match.minute || 0,
        markets: data.bettingMarkets || [],
        prediction: prediction
      };

      console.log('[AI Prediction] Données du match extraites depuis l\'API:', matchData);
      return matchData;
    } catch (error) {
      console.error('Erreur lors de l\'extraction des données du match:', error);
      return matchData;
    }
  }

  // Mettre à jour le statut IA
  function updateAIStatus(status, isLoading = false) {
    if (aiStatus) {
      aiStatus.textContent = status;
      aiStatus.classList.toggle('loading', isLoading);
    }
  }

  // Afficher le résultat de la prédiction IA
  function displayAIPrediction(result) {
    if (!aiPredictionContent) return;

    const confidence = result.confidence || 0;
    const exactScore = result.exactScore || { score: 'N/A', probability: 0 };
    const marketRec = result.marketRecommendation || { type: 'N/A', odds: '-' };
    const reasoning = result.reasoning || [];

    let html = `
      <div class="ai-prediction-result">
        <div class="ai-prediction-score">
          ${exactScore.score}
        </div>
        <div class="ai-prediction-confidence">
          <span>Confiance IA:</span>
          <div class="ai-confidence-bar">
            <div class="ai-confidence-fill" style="width: ${confidence}%"></div>
          </div>
          <span>${confidence.toFixed(1)}%</span>
        </div>
        <div class="ai-prediction-details">
          <p><strong>Probabilité score exact:</strong> ${(exactScore.probability * 100).toFixed(1)}%</p>
          <p><strong>Recommandation marché:</strong> ${marketRec.type} @ ${marketRec.odds}</p>
          <p><strong>Prédiction IA:</strong> ${result.prediction || 'N/A'}</p>
        </div>
        ${reasoning.length > 0 ? `
          <div class="ai-reasoning">
            <strong>Reasoning IA:</strong>
            <ul>
              ${reasoning.map(r => `<li>${r}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;

    aiPredictionContent.innerHTML = html;
  }

  // Afficher le résultat de l'intégration complète
  function displayIntegratedPrediction(result) {
    if (!aiPredictionContent) return;

    const consensus = result.consensus || {};
    const ai = result.ai || {};
    const exactScore = result.exactScore || {};
    const unified = result.unified || {};

    let html = `
      <div class="ai-prediction-result">
        <h3>🤖 Intégration Complète - Consensus IA</h3>
        <div class="ai-prediction-score">
          ${consensus.action || 'ANALYSE'}
        </div>
        <div class="ai-prediction-confidence">
          <span>Confiance Consensus:</span>
          <div class="ai-confidence-bar">
            <div class="ai-confidence-fill" style="width: ${consensus.confidence || 0}%"></div>
          </div>
          <span>${(consensus.confidence || 0).toFixed(1)}%</span>
        </div>
        <div class="ai-prediction-details">
          <p><strong>Recommandation:</strong> ${consensus.recommendation || 'N/A'}</p>
          <p><strong>Score exact primaire:</strong> ${exactScore.primary?.score || 'N/A'} (${(exactScore.primary?.probability || 0 * 100).toFixed(1)}%)</p>
          <p><strong>Prédiction IA:</strong> ${ai.prediction || 'N/A'} (${ai.confidence || 0}%)</p>
          <p><strong>Système unifié:</strong> ${unified.maitre?.decision_finale?.recommandation || 'N/A'}</p>
        </div>
        ${consensus.sources && consensus.sources.length > 0 ? `
          <div class="ai-reasoning">
            <strong>Sources du consensus:</strong>
            <ul>
              ${consensus.sources.map(s => `
                <li>
                  <strong>${s.name}:</strong> ${s.recommendation} (confiance: ${s.confidence?.toFixed(1) || 0}%)
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;

    aiPredictionContent.innerHTML = html;
  }

  // Gérer l'erreur
  function displayError(message) {
    if (!aiPredictionContent) return;
    aiPredictionContent.innerHTML = `
      <div class="ai-prediction-result" style="border-color: var(--error);">
        <p style="color: var(--error);">❌ Erreur: ${message}</p>
      </div>
    `;
  }

  // Générer la prédiction IA
  async function generateAIPrediction() {
    const data = await extractMatchDataFromAPI();
    
    if (!data.team1 || !data.team2) {
      displayError('Données du match non disponibles');
      return;
    }

    updateAIStatus('Génération en cours...', true);
    generateAIPredictionBtn.disabled = true;

    try {
      const response = await fetch('/api/prediction/ai/only', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        displayAIPrediction(result.data);
        updateAIStatus('Prédiction générée avec succès');
      } else {
        displayError(result.error || 'Erreur lors de la génération');
        updateAIStatus('Erreur');
      }
    } catch (error) {
      console.error('Erreur lors de la génération IA:', error);
      displayError(error.message || 'Erreur de connexion');
      updateAIStatus('Erreur');
    } finally {
      generateAIPredictionBtn.disabled = false;
    }
  }

  // Générer l'intégration complète
  async function generateIntegratedPrediction() {
    const data = await extractMatchDataFromAPI();
    
    if (!data.team1 || !data.team2) {
      displayError('Données du match non disponibles');
      return;
    }

    updateAIStatus('Intégration en cours...', true);
    generateIntegratedPredictionBtn.disabled = true;

    try {
      const response = await fetch('/api/prediction/ai/integrated', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        displayIntegratedPrediction(result.data);
        updateAIStatus('Intégration générée avec succès');
      } else {
        displayError(result.error || 'Erreur lors de l\'intégration');
        updateAIStatus('Erreur');
      }
    } catch (error) {
      console.error('Erreur lors de l\'intégration IA:', error);
      displayError(error.message || 'Erreur de connexion');
      updateAIStatus('Erreur');
    } finally {
      generateIntegratedPredictionBtn.disabled = false;
    }
  }

  // Attacher les événements
  if (generateAIPredictionBtn) {
    generateAIPredictionBtn.addEventListener('click', generateAIPrediction);
  }

  if (generateIntegratedPredictionBtn) {
    generateIntegratedPredictionBtn.addEventListener('click', generateIntegratedPrediction);
  }

  // Extraire les données au chargement (async)
  extractMatchDataFromAPI();
});
