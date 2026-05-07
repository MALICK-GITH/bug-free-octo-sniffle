/**
 * COUP SUBLIME - AR Scanner Module
 * Scan de tickets papier avec camera et OCR simplifie
 * SOLITAIRE HACK SIGNATURE
 */

class SublimeAR {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.stream = null;
    this.isScanning = false;
    this.scanInterval = null;
    
    this.init();
  }

  init() {
    this.setupElements();
    this.setupEventListeners();
  }

  setupElements() {
    this.video = document.getElementById('arVideo');
    this.canvas = document.getElementById('arCanvas');
  }

  setupEventListeners() {
    // Capture button
    document.getElementById('arCaptureBtn')?.addEventListener('click', () => {
      this.captureImage();
    });

    // Start camera when AR section is active
    const observer = new MutationObserver((mutations) => {
      const arSection = document.getElementById('arSection');
      if (arSection?.classList.contains('active')) {
        this.startCamera();
      } else {
        this.stopCamera();
      }
    });

    observer.observe(document.body, { 
      attributes: true, 
      subtree: true,
      attributeFilter: ['class']
    });
  }

  async startCamera() {
    if (!this.video || this.stream) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      this.video.srcObject = this.stream;
      this.isScanning = true;

      this.showToast('Camera activee - Placez le ticket dans le cadre', 'info');
    } catch (err) {
      console.error('Camera access error:', err);
      this.showToast('Acces camera refuse - Verifiez les permissions', 'error');
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.isScanning = false;
  }

  captureImage() {
    if (!this.video || !this.canvas || !this.isScanning) return;

    const ctx = this.canvas.getContext('2d');
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    
    ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    
    // Simulate OCR processing
    this.processScan();
  }

  processScan() {
    this.showToast('Analyse du ticket en cours...', 'info');

    // Simulate processing delay
    setTimeout(() => {
      const mockResult = this.generateMockScanResult();
      this.displayResult(mockResult);
      this.showToast('Ticket analyse avec succes!', 'success');
    }, 2000);
  }

  generateMockScanResult() {
    const teams = [
      { home: 'PSG', away: 'OM', odds: 1.85 },
      { home: 'Real Madrid', away: 'Barca', odds: 2.10 },
      { home: 'Chelsea', away: 'Arsenal', odds: 1.95 }
    ];

    const scannedMatches = teams.map(t => ({
      home: t.home,
      away: t.away,
      prediction: ['1', 'X', '2'][Math.floor(Math.random() * 3)],
      odds: t.odds,
      confidence: Math.floor(Math.random() * 30 + 60)
    }));

    return {
      date: new Date().toLocaleDateString('fr-FR'),
      matches: scannedMatches,
      totalOdds: scannedMatches.reduce((acc, m) => acc * m.odds, 1).toFixed(2),
      bookmaker: ['1xBet', 'Bet365', 'Winamax'][Math.floor(Math.random() * 3)]
    };
  }

  displayResult(result) {
    const container = document.getElementById('arResults');
    if (!container) return;

    container.innerHTML = `
      <h3>Resultat du Scan</h3>
      <div class="scan-result">
        <div class="result-header">
          <span class="result-date">${result.date}</span>
          <span class="result-bookmaker">${result.bookmaker}</span>
        </div>
        <div class="result-matches">
          ${result.matches.map((match, i) => `
            <div class="result-match">
              <span class="match-teams">${match.home} vs ${match.away}</span>
              <span class="match-prediction">${match.prediction} @${match.odds}</span>
              <span class="match-confidence">${match.confidence}%</span>
            </div>
          `).join('')}
        </div>
        <div class="result-footer">
          <span class="total-odds">Cote totale: ${result.totalOdds}</span>
          <button class="sublime-btn primary" id="importScannedBtn">
            Importer dans Coupon
          </button>
        </div>
      </div>
    `;

    // Add import button listener
    document.getElementById('importScannedBtn')?.addEventListener('click', () => {
      this.importToCoupon(result);
    });
  }

  importToCoupon(result) {
    // Switch to command section and populate
    if (window.sublimeApp) {
      window.sublimeApp.switchSection('command');
      document.querySelector('[data-section="command"]')?.classList.add('active');
      document.querySelectorAll('.orbital-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.section === 'command');
      });
      
      // Set match count
      const slider = document.getElementById('matchCountSlider');
      const value = document.getElementById('matchCountValue');
      if (slider && value) {
        slider.value = result.matches.length;
        value.textContent = result.matches.length;
        window.sublimeApp.matchCount = result.matches.length;
      }
      
      this.showToast('Ticket importe! Generez votre coupon sublime.', 'success');
    }
  }

  showToast(message, type = 'info') {
    if (window.sublimeApp) {
      window.sublimeApp.showToast(message, type);
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.sublimeAR = new SublimeAR();
});

window.SublimeAR = SublimeAR;
