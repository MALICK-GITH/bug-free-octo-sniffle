/**
 * Gestionnaire de prédiction IA via API pour la page de match
 * Intégration des prédictions foudroyantes par l'intelligence artificielle
 */

document.addEventListener('DOMContentLoaded', () => {
  const generateAIPredictionBtn = document.getElementById('generateAIPredictionBtn');
  const generateIntegratedPredictionBtn = document.getElementById('generateIntegratedPredictionBtn');
  const aiStatus = document.getElementById('aiStatus');
  const aiPredictionContent = document.getElementById('aiPredictionContent');

  // Données du match (seront extraites de la page)
  let matchData = {
    team1: '',
    team2: '',
    league: '',
    score1: 0,
    score2: 0,
    minute: 0,
    markets: []
  };

  // Extraire les données du match depuis la page
  function extractMatchData() {
    const titleElement = document.getElementById('title');
    const subElement = document.getElementById('sub');
    
    if (titleElement) {
      const titleText = titleElement.textContent;
      const teams = titleText.split(' vs ');
      if (teams.length === 2) {
        matchData.team1 = teams[0].trim();
        matchData.team2 = teams[1].trim();
      }
    }

    // Extraire les marchés disponibles
    const marketsPanel = document.getElementById('markets');
    if (marketsPanel) {
      const marketElements = marketsPanel.querySelectorAll('.market-item, .bet-option');
      matchData.markets = Array.from(marketElements).map(el => ({
        nom: el.textContent.trim(),
        cote: parseFloat(el.dataset.odds) || 2.0
      }));
    }

    return matchData;
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
    const data = extractMatchData();
    
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
    const data = extractMatchData();
    
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

  // Extraire les données au chargement
  extractMatchData();
});
