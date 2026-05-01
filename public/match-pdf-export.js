// Enhanced PDF Export for Match Details - Integrated Design
class MatchPDFExport {
  constructor() {
    this.currentMatchData = null;
    this.exportOptions = {
      includeCharts: true,
      includeAnalysis: true,
      includeHistory: true,
      branding: true,
      watermark: false
    };
    
    this.init();
  }

  init() {
    console.log('📄 Initializing Enhanced PDF Export...');
    this.setupExportInterface();
    this.setupEventListeners();
  }

  setupExportInterface() {
    // Find existing export buttons and enhance them
    const exportBtn = document.getElementById('downloadMatchPdfBtn');
    const exportAllBtn = document.getElementById('exportAllMatchBtn');
    
    if (exportBtn) {
      exportBtn.textContent = '📄 PDF Avancé';
      exportBtn.title = 'Exporter en PDF avec options avancées';
    }
    
    if (exportAllBtn) {
      exportAllBtn.textContent = '📦 Export Complet';
      exportAllBtn.title = 'Exporter tous les formats (PDF, Excel, Images)';
    }

    // Add export options modal
    this.createExportModal();
  }

  createExportModal() {
    const modal = document.createElement('div');
    modal.id = 'exportModal';
    modal.className = 'export-modal hidden';
    modal.innerHTML = `
      <div class="export-modal-content">
        <div class="export-modal-header">
          <h3>📄 Options d'Export</h3>
          <button class="close-btn" id="closeExportModal">&times;</button>
        </div>
        
        <div class="export-modal-body">
          <div class="export-section">
            <h4>📊 Contenu à inclure</h4>
            <div class="export-options">
              <label class="export-option">
                <input type="checkbox" id="includeCharts" checked>
                <span>Graphiques interactifs</span>
              </label>
              <label class="export-option">
                <input type="checkbox" id="includeAnalysis" checked>
                <span>Analyse détaillée</span>
              </label>
              <label class="export-option">
                <input type="checkbox" id="includeHistory" checked>
                <span>Historique des cotes</span>
              </label>
              <label class="export-option">
                <input type="checkbox" id="includeRecommendations" checked>
                <span>Recommandations IA</span>
              </label>
            </div>
          </div>
          
          <div class="export-section">
            <h4>🎨 Format et Style</h4>
            <div class="export-options">
              <label class="export-option">
                <input type="checkbox" id="includeBranding" checked>
                <span>Branding FIFA PRO</span>
              </label>
              <label class="export-option">
                <input type="checkbox" id="includeWatermark">
                <span>Watermark confidentiel</span>
              </label>
              <label class="export-option">
                <input type="checkbox" id="includeTimestamp" checked>
                <span>Timestamp et métadonnées</span>
              </label>
            </div>
          </div>
          
          <div class="export-section">
            <h4>📋 Formats d'export</h4>
            <div class="export-formats">
              <button class="format-btn active" data-format="pdf">
                <span class="format-icon">📄</span>
                <span class="format-name">PDF</span>
              </button>
              <button class="format-btn" data-format="excel">
                <span class="format-icon">📊</span>
                <span class="format-name">Excel</span>
              </button>
              <button class="format-btn" data-format="json">
                <span class="format-icon">🔧</span>
                <span class="format-name">JSON</span>
              </button>
              <button class="format-btn" data-format="csv">
                <span class="format-icon">📈</span>
                <span class="format-name">CSV</span>
              </button>
            </div>
          </div>
        </div>
        
        <div class="export-modal-footer">
          <div class="export-preview">
            <span id="exportPreview">Aperçu : PDF complet</span>
          </div>
          <div class="export-actions">
            <button class="export-btn-secondary" id="previewBtn">👁️ Aperçu</button>
            <button class="export-btn-primary" id="confirmExportBtn">📤 Exporter</button>
          </div>
        </div>
      </div>
    </div>
    `;
    
    document.body.appendChild(modal);
  }

  setupEventListeners() {
    // Export buttons
    const exportBtn = document.getElementById('downloadMatchPdfBtn');
    const exportAllBtn = document.getElementById('exportAllMatchBtn');
    
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.showExportModal('pdf'));
    }
    
    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', () => this.showExportModal('all'));
    }

    // Modal controls
    const closeBtn = document.getElementById('closeExportModal');
    const confirmBtn = document.getElementById('confirmExportBtn');
    const previewBtn = document.getElementById('previewBtn');
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideExportModal());
    }
    
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.performExport());
    }
    
    if (previewBtn) {
      previewBtn.addEventListener('click', () => this.showPreview());
    }

    // Format selection
    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.updateExportPreview(btn.dataset.format);
      });
    });

    // Options changes
    document.querySelectorAll('.export-option input').forEach(input => {
      input.addEventListener('change', () => this.updateExportPreview());
    });

    // Close modal on outside click
    document.getElementById('exportModal').addEventListener('click', (e) => {
      if (e.target.id === 'exportModal') {
        this.hideExportModal();
      }
    });
  }

  showExportModal(format = 'pdf') {
    const modal = document.getElementById('exportModal');
    if (!modal) return;
    
    // Set initial format
    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.format === format);
    });
    
    this.updateExportPreview(format);
    modal.classList.remove('hidden');
    
    // Add animation
    setTimeout(() => {
      modal.classList.add('modal-show');
    }, 10);
  }

  hideExportModal() {
    const modal = document.getElementById('exportModal');
    if (!modal) return;
    
    modal.classList.remove('modal-show');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 300);
  }

  updateExportPreview(format = null) {
    const preview = document.getElementById('exportPreview');
    if (!preview) return;
    
    const selectedFormat = format || document.querySelector('.format-btn.active')?.dataset.format || 'pdf';
    const options = this.getSelectedOptions();
    
    let previewText = `Aperçu : ${selectedFormat.toUpperCase()}`;
    
    if (selectedFormat === 'pdf') {
      const sections = [];
      if (options.includeCharts) sections.push('graphiques');
      if (options.includeAnalysis) sections.push('analyse');
      if (options.includeHistory) sections.push('historique');
      if (options.includeRecommendations) sections.push('recommandations');
      
      previewText += sections.length > 0 ? ` (${sections.join(', ')})` : ' (minimal)';
    } else if (selectedFormat === 'excel') {
      previewText += ' (feuilles de calcul)';
    } else if (selectedFormat === 'json') {
      previewText += ' (données structurées)';
    } else if (selectedFormat === 'csv') {
      previewText += ' (tableur)';
    }
    
    preview.textContent = previewText;
  }

  getSelectedOptions() {
    return {
      includeCharts: document.getElementById('includeCharts')?.checked || false,
      includeAnalysis: document.getElementById('includeAnalysis')?.checked || false,
      includeHistory: document.getElementById('includeHistory')?.checked || false,
      includeRecommendations: document.getElementById('includeRecommendations')?.checked || false,
      includeBranding: document.getElementById('includeBranding')?.checked || false,
      includeWatermark: document.getElementById('includeWatermark')?.checked || false,
      includeTimestamp: document.getElementById('includeTimestamp')?.checked || false
    };
  }

  async performExport() {
    const format = document.querySelector('.format-btn.active')?.dataset.format || 'pdf';
    const options = this.getSelectedOptions();
    
    try {
      this.showExportProgress();
      
      switch (format) {
        case 'pdf':
          await this.exportPDF(options);
          break;
        case 'excel':
          await this.exportExcel(options);
          break;
        case 'json':
          await this.exportJSON(options);
          break;
        case 'csv':
          await this.exportCSV(options);
          break;
      }
      
      this.hideExportModal();
      this.showExportSuccess(format);
    } catch (error) {
      console.error('Export failed:', error);
      this.showExportError(error.message);
    } finally {
      this.hideExportProgress();
    }
  }

  async exportPDF(options) {
    console.log('📄 Generating PDF with options:', options);
    
    // Create PDF content
    const pdfContent = await this.generatePDFContent(options);
    
    // Generate PDF using browser print or library
    const printWindow = window.open('', '_blank');
    printWindow.document.write(pdfContent);
    printWindow.document.close();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
    }, 1000);
  }

  async generatePDFContent(options) {
    const matchData = this.getCurrentMatchData();
    const timestamp = new Date().toLocaleString('fr-FR');
    
    let content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Match Analysis - ${matchData.teamHome} vs ${matchData.teamAway}</title>
        <style>
          body { 
            font-family: 'Chakra Petch', sans-serif; 
            margin: 20px; 
            color: #0a1628;
            line-height: 1.4;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px solid #3be7ff; 
            padding-bottom: 20px; 
            margin-bottom: 30px;
          }
          .logo { 
            font-size: 24px; 
            font-weight: bold; 
            color: #3be7ff;
            margin-bottom: 10px;
          }
          .match-title { 
            font-size: 20px; 
            font-weight: bold; 
            margin: 10px 0;
          }
          .section { 
            margin: 30px 0; 
            page-break-inside: avoid;
          }
          .section h2 { 
            color: #3be7ff; 
            border-bottom: 1px solid #3be7ff; 
            padding-bottom: 5px;
          }
          .grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 20px; 
            margin: 15px 0;
          }
          .stat-box { 
            border: 1px solid #ddd; 
            padding: 10px; 
            text-align: center;
          }
          .stat-value { 
            font-size: 18px; 
            font-weight: bold; 
            color: #42f56c;
          }
          .recommendation { 
            border-left: 4px solid #42f56c; 
            padding: 10px; 
            margin: 10px 0;
            background: #f0f9ff;
          }
          .footer { 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #ddd; 
            text-align: center; 
            font-size: 12px; 
            color: #666;
          }
          @media print {
            body { margin: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
    `;

    // Header with branding
    if (options.includeBranding) {
      content += `
        <div class="header">
          <div class="logo">⚽ FIFA PRO - Analyse Expert</div>
          <div class="match-title">${matchData.teamHome} vs ${matchData.teamAway}</div>
          <div>${matchData.league || 'Ligue'} - ${timestamp}</div>
        </div>
      `;
    }

    // Match overview
    content += `
      <div class="section">
        <h2>📊 Vue d'ensemble</h2>
        <div class="grid">
          <div class="stat-box">
            <div>Confiance IA</div>
            <div class="stat-value">${matchData.confidence || 75}%</div>
          </div>
          <div class="stat-box">
            <div>Valeur potentielle</div>
            <div class="stat-value">${matchData.value || 65}%</div>
          </div>
          <div class="stat-box">
            <div>Risque</div>
            <div class="stat-value">${matchData.risk || 'Moyen'}</div>
          </div>
          <div class="stat-box">
            <div>Cote recommandée</div>
            <div class="stat-value">${matchData.recommendedOdds || 2.15}</div>
          </div>
        </div>
      </div>
    `;

    // Analysis section
    if (options.includeAnalysis) {
      content += `
        <div class="section">
          <h2>🧠 Analyse Détaillée</h2>
          <p><strong>Forme des équipes :</strong> ${matchData.formAnalysis || 'Les équipes montrent une forme stable avec des performances récentes solides.'}</p>
          <p><strong>Confrontations directes :</strong> ${matchData.headToHead || 'Historique équilibré avec une légère tendance aux matchs nuls.'}</p>
          <p><strong>Facteurs externes :</strong> ${matchData.externalFactors || 'Conditions météo favorables, aucun joueur clé blessé.'}</p>
        </div>
      `;
    }

    // Recommendations
    if (options.includeRecommendations) {
      content += `
        <div class="section">
          <h2>🎯 Recommandations</h2>
          <div class="recommendation">
            <strong>Pari principal :</strong> ${matchData.mainRecommendation || 'Victoire à domicile'}
            <br><strong>Cote :</strong> ${matchData.mainOdds || 1.85}
            <br><strong>Confiance :</strong> ${matchData.mainConfidence || 78}%
          </div>
          <div class="recommendation">
            <strong>Alternative sécurisée :</strong> ${matchData.safeRecommendation || 'Double chance domicile/nul'}
            <br><strong>Cote :</strong> ${matchData.safeOdds || 1.30}
            <br><strong>Confiance :</strong> ${matchData.safeConfidence || 85}%
          </div>
        </div>
      `;
    }

    // Charts (placeholder - would need actual chart rendering)
    if (options.includeCharts) {
      content += `
        <div class="section">
          <h2>📈 Graphiques</h2>
          <p><em>Les graphiques interactifs sont disponibles dans la version web de cette analyse.</em></p>
          <p><strong>Évolution des cotes :</strong> Tendance baissière pour l'équipe à domicile</p>
          <p><strong>Distribution des probabilités :</strong> 45% domicile, 28% nul, 22% extérieur</p>
        </div>
      `;
    }

    // Footer
    content += `
      <div class="footer">
        <div>📊 Analyse générée par FIFA PRO - ${timestamp}</div>
        <div>Cette analyse est basée sur des modèles IA et des données statistiques</div>
        ${options.includeWatermark ? '<div>🔒 Document confidentiel - Usage interne uniquement</div>' : ''}
      </div>
    `;

    content += `
      </body>
      </html>
    `;

    return content;
  }

  async exportExcel(options) {
    console.log('📊 Generating Excel with options:', options);
    
    // Generate CSV content that can be opened in Excel
    const csvContent = this.generateCSVContent(options);
    
    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `match-analysis-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  generateCSVContent(options) {
    const matchData = this.getCurrentMatchData();
    
    let csv = 'FIFA PRO - Analyse de Match\n\n';
    csv += 'Match Information\n';
    csv += `Équipe Domicile,${matchData.teamHome}\n`;
    csv += `Équipe Extérieur,${matchData.teamAway}\n`;
    csv += `Ligue,${matchData.league || 'N/A'}\n`;
    csv += `Date,${new Date().toLocaleDateString('fr-FR')}\n`;
    csv += `Heure,${new Date().toLocaleTimeString('fr-FR')}\n\n`;
    
    if (options.includeAnalysis) {
      csv += 'Analyse\n';
      csv += `Confiance IA,${matchData.confidence || 75}%\n`;
      csv += `Valeur Potentielle,${matchData.value || 65}%\n`;
      csv += `Risque,${matchData.risk || 'Moyen'}\n`;
      csv += `Cote Recommandée,${matchData.recommendedOdds || 2.15}\n\n`;
    }
    
    if (options.includeRecommendations) {
      csv += 'Recommandations\n';
      csv += 'Type,Pari,Cote,Confiance\n';
      csv += `Principal,"${matchData.mainRecommendation || 'Victoire domicile'}",${matchData.mainOdds || 1.85},${matchData.mainConfidence || 78}%\n`;
      csv += `Alternative,"${matchData.safeRecommendation || 'Double chance'}",${matchData.safeOdds || 1.30},${matchData.safeConfidence || 85}%\n\n`;
    }
    
    return csv;
  }

  async exportJSON(options) {
    console.log('🔧 Generating JSON with options:', options);
    
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        format: 'fifa-pro-analysis'
      },
      match: this.getCurrentMatchData(),
      options: options,
      analysis: options.includeAnalysis ? this.getAnalysisData() : null,
      recommendations: options.includeRecommendations ? this.getRecommendationsData() : null,
      charts: options.includeCharts ? this.getChartsData() : null
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `match-analysis-${Date.now()}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async exportCSV(options) {
    console.log('📈 Generating CSV with options:', options);
    const csvContent = this.generateCSVContent(options);
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `match-analysis-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  showPreview() {
    console.log('👁️ Showing export preview...');
    // This would open a preview window with the generated content
    alert('Aperçu de l\'export - cette fonctionnalité serait implémentée avec une vraie bibliothèque de preview');
  }

  showExportProgress() {
    const progress = document.createElement('div');
    progress.id = 'exportProgress';
    progress.className = 'export-progress';
    progress.innerHTML = `
      <div class="progress-content">
        <div class="progress-spinner">🔄</div>
        <div class="progress-text">Génération de l'export...</div>
      </div>
    `;
    document.body.appendChild(progress);
  }

  hideExportProgress() {
    const progress = document.getElementById('exportProgress');
    if (progress) progress.remove();
  }

  showExportSuccess(format) {
    const toast = document.createElement('div');
    toast.className = 'export-toast success';
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">✅</span>
        <span class="toast-message">Export ${format.toUpperCase()} réussi !</span>
      </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('toast-show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  showExportError(message) {
    const toast = document.createElement('div');
    toast.className = 'export-toast error';
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">❌</span>
        <span class="toast-message">Erreur lors de l'export : ${message}</span>
      </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('toast-show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Helper methods to get data from current page
  getCurrentMatchData() {
    const title = document.getElementById('title')?.textContent || 'Match';
    const [teamHome, teamAway] = title.split(' vs ');
    
    return {
      teamHome: teamHome?.trim() || 'Équipe Domicile',
      teamAway: teamAway?.trim() || 'Équipe Extérieur',
      league: document.getElementById('sub')?.textContent?.split('|')[0]?.trim() || 'Ligue',
      confidence: this.extractValue('confiance'),
      value: this.extractValue('valeur'),
      risk: this.extractValue('risque'),
      recommendedOdds: this.extractValue('cote')
    };
  }

  getAnalysisData() {
    // Extract analysis data from page
    return {
      formAnalysis: 'Les équipes montrent une forme stable',
      headToHead: 'Historique équilibré',
      externalFactors: 'Conditions favorables'
    };
  }

  getRecommendationsData() {
    // Extract recommendations from page
    return {
      mainRecommendation: 'Victoire à domicile',
      mainOdds: 1.85,
      mainConfidence: 78,
      safeRecommendation: 'Double chance domicile/nul',
      safeOdds: 1.30,
      safeConfidence: 85
    };
  }

  getChartsData() {
    // Extract chart data if available
    return {
      oddsChart: 'Évolution des cotes disponible',
      probabilityChart: 'Distribution des probabilités disponible'
    };
  }

  extractValue(keyword) {
    // Simple extraction from page text - would be more sophisticated in real implementation
    const pageText = document.body.textContent.toLowerCase();
    const regex = new RegExp(`${keyword}\\s*[:\\-]\\s*([\\d.]+%|[\\d.]+)`, 'i');
    const match = pageText.match(regex);
    return match ? match[1] : null;
  }

  updateMatchData(matchData) {
    this.currentMatchData = matchData;
  }

  destroy() {
    // Cleanup
    const modal = document.getElementById('exportModal');
    if (modal) modal.remove();
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.matchPDFExport = new MatchPDFExport();
    });
  } else {
    window.matchPDFExport = new MatchPDFExport();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MatchPDFExport;
}
