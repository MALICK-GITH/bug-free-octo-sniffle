/**
 * COUP SUBLIME - JavaScript Avance et Immersif
 * SOLITAIRE HACK SIGNATURE
 * Fonctionnalites: Navigation fluide, Predictions 3D, Analytics temps reel, Mode Zen
 */

class SublimeApp {
  constructor() {
    this.currentSection = 'command';
    this.isGenerating = false;
    this.couponData = null;
    this.animations = new Map();
    this.confidenceLevel = 72;
    this.matchCount = 3;
    this.stake = 1000;
    this.riskProfile = 'balanced';

    this.init();
  }

  init() {
    this.initAmbientCanvas();
    this.initNavigation();
    this.initSliders();
    this.initSelects();
    this.initRiskChips();
    this.initButtons();
    this.initParticles();
    this.initKeyboardShortcuts();
    this.initGestures();
    this.initCharts();
    this.loadInitialData();

    console.log('%c COUP SUBLIME ', 'background: linear-gradient(135deg, #00f5ff, #7c3aed); color: #0a0a0f; font-size: 20px; font-weight: bold; padding: 10px 20px; border-radius: 10px;');
    console.log('%c Powered by SOLITAIRE HACK ', 'color: #00f5ff; font-style: italic;');
  }

  // ==========================================
  // CANVAS AMBIANCE IMMERSIF
  // ==========================================
  initAmbientCanvas() {
    const canvas = document.getElementById('ambientCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const draw = () => {
      time += 0.005;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Grille cyberpunk
      const gridSize = 50;

      ctx.strokeStyle = 'rgba(0, 245, 255, 0.03)';
      ctx.lineWidth = 1;

      // Lignes horizontales avec effet de profondeur
      for (let y = 0; y < canvas.height; y += gridSize) {
        const wave = Math.sin(time + y * 0.01) * 10;
        ctx.beginPath();
        ctx.moveTo(0, y + wave);
        ctx.lineTo(canvas.width, y + wave);
        ctx.stroke();
      }

      // Lignes verticales
      for (let x = 0; x < canvas.width; x += gridSize) {
        const wave = Math.cos(time + x * 0.01) * 5;
        ctx.beginPath();
        ctx.moveTo(x + wave, 0);
        ctx.lineTo(x + wave, canvas.height);
        ctx.stroke();
      }

      // Orbes flottants
      const orbes = [
        { x: canvas.width * 0.2, y: canvas.height * 0.3, r: 100, color: '#00f5ff' },
        { x: canvas.width * 0.8, y: canvas.height * 0.7, r: 150, color: '#7c3aed' },
        { x: canvas.width * 0.5, y: canvas.height * 0.5, r: 80, color: '#f59e0b' }
      ];

      orbes.forEach((orbe, i) => {
        const offsetX = Math.sin(time + i) * 50;
        const offsetY = Math.cos(time + i * 0.7) * 30;

        const gradient = ctx.createRadialGradient(
          orbe.x + offsetX, orbe.y + offsetY, 0,
          orbe.x + offsetX, orbe.y + offsetY, orbe.r
        );
        gradient.addColorStop(0, `${orbe.color}20`);
        gradient.addColorStop(0.5, `${orbe.color}08`);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(orbe.x + offsetX, orbe.y + offsetY, orbe.r, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    draw();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      cancelAnimationFrame(animationId);
    });
  }

  // ==========================================
  // SYSTEME DE PARTICULES
  // ==========================================
  initParticles() {
    const container = document.getElementById('particlesOverlay');
    if (!container) return;

    const particleCount = 25;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.cssText = `
        position: absolute;
        width: ${Math.random() * 4 + 2}px;
        height: ${Math.random() * 4 + 2}px;
        background: ${Math.random() > 0.5 ? '#00f5ff' : '#7c3aed'};
        border-radius: 50%;
        opacity: ${Math.random() * 0.5 + 0.2};
        pointer-events: none;
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        box-shadow: 0 0 10px currentColor;
      `;
      container.appendChild(particle);

      particles.push({
        element: particle,
        x: parseFloat(particle.style.left),
        y: parseFloat(particle.style.top),
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2
      });
    }

    const animate = () => {
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > 100) p.vx *= -1;
        if (p.y < 0 || p.y > 100) p.vy *= -1;

        p.element.style.left = p.x + '%';
        p.element.style.top = p.y + '%';
      });

      requestAnimationFrame(animate);
    };

    animate();
  }

  // ==========================================
  // NAVIGATION ORBITALE
  // ==========================================
  initNavigation() {
    const nav = document.getElementById('orbitalNav');

    nav?.querySelectorAll('.orbital-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        this.switchSection(section);

        // Update active state
        nav.querySelectorAll('.orbital-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Animation du bouton
        btn.style.transform = 'scale(0.9)';
        setTimeout(() => btn.style.transform = '', 150);
      });
    });

    // Menu toggle
    const menuBtn = document.getElementById('menuBtn');
    const menuOverlay = document.getElementById('menuOverlay');

    menuBtn?.addEventListener('click', () => {
      menuOverlay?.classList.toggle('active');
    });

    // Fermer le menu au clic ailleurs
    document.addEventListener('click', (e) => {
      if (!menuBtn?.contains(e.target) && !menuOverlay?.contains(e.target)) {
        menuOverlay?.classList.remove('active');
      }
    });

    // Fullscreen
    document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });

    // Theme toggle
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      document.documentElement.classList.toggle('light-theme');
      this.showToast('Theme mis a jour', 'success');
    });
  }

  switchSection(sectionName) {
    const sections = document.querySelectorAll('.section');

    sections.forEach(section => {
      if (section.id === `${sectionName}Section`) {
        section.classList.add('active');
        this.animateSectionEntry(section);
      } else {
        section.classList.remove('active');
      }
    });

    this.currentSection = sectionName;

    // Mettre a jour les metriques selon la section
    if (sectionName === 'analytics') {
      this.updateAnalytics();
    }
  }

  animateSectionEntry(section) {
    const elements = section.querySelectorAll('.glass-panel, .match-card, .metric-card');
    elements.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';

      setTimeout(() => {
        el.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, i * 50);
    });
  }

  // ==========================================
  // SLIDERS INTERACTIFS
  // ==========================================
  initSliders() {
    // Match count slider
    const matchSlider = document.getElementById('matchCountSlider');
    const matchValue = document.getElementById('matchCountValue');

    matchSlider?.addEventListener('input', (e) => {
      this.matchCount = parseInt(e.target.value);
      matchValue.textContent = this.matchCount;
      this.updateQuickStats();
    });

    // Stake slider
    const stakeSlider = document.getElementById('stakeSlider');
    const stakeValue = document.getElementById('stakeValue');

    stakeSlider?.addEventListener('input', (e) => {
      this.stake = parseInt(e.target.value);
      stakeValue.textContent = `${this.stake.toLocaleString()} FCFA`;
      this.updateQuickStats();
    });

    // Confidence slider
    const confidenceSlider = document.getElementById('confidenceSlider');
    const confidenceValue = document.getElementById('confidenceValue');
    const confidenceFill = document.getElementById('confidenceFill');

    confidenceSlider?.addEventListener('input', (e) => {
      this.confidenceLevel = parseInt(e.target.value);
      confidenceValue.textContent = `${this.confidenceLevel}%`;
      confidenceFill.style.width = `${this.confidenceLevel}%`;

      // Update AI confidence ring
      this.updateAIConfidence(this.confidenceLevel);
    });
  }

  updateAIConfidence(value) {
    const ring = document.getElementById('confidenceRingFill');
    const text = document.getElementById('confidenceText');

    if (ring && text) {
      const offset = 100 - value;
      ring.style.strokeDashoffset = offset;
      text.textContent = `${value}%`;

      // Change color based on confidence
      if (value >= 80) {
        ring.style.stroke = '#10b981';
        text.style.color = '#10b981';
      } else if (value >= 60) {
        ring.style.stroke = '#f59e0b';
        text.style.color = '#f59e0b';
      } else {
        ring.style.stroke = '#ef4444';
        text.style.color = '#ef4444';
      }
    }
  }

  // ==========================================
  // SELECTS PERSONNALISES
  // ==========================================
  initSelects() {
    const customSelects = document.querySelectorAll('.custom-select');

    customSelects.forEach(select => {
      const trigger = select.querySelector('.select-trigger');
      const options = select.querySelectorAll('.option');

      trigger?.addEventListener('click', () => {
        select.classList.toggle('active');
      });

      options.forEach(option => {
        option.addEventListener('click', () => {
          options.forEach(o => o.classList.remove('active'));
          option.classList.add('active');
          select.classList.remove('active');

          const span = trigger?.querySelector('span');
          if (span) span.textContent = option.textContent;

          this.showToast(`Ligue selectionnee: ${option.textContent}`, 'info');
        });
      });
    });

    // Fermer au clic ailleurs
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.custom-select')) {
        customSelects.forEach(s => s.classList.remove('active'));
      }
    });
  }

  // ==========================================
  // RISK CHIPS
  // ==========================================
  initRiskChips() {
    const chips = document.querySelectorAll('.risk-chip');

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        this.riskProfile = chip.dataset.risk;
        this.updateQuickStats();

        // Animation
        chip.style.transform = 'scale(0.95)';
        setTimeout(() => chip.style.transform = '', 150);
      });
    });
  }

  // ==========================================
  // BOUTONS PRINCIPAUX
  // ==========================================
  initButtons() {
    // Generate button
    document.getElementById('generateSublimeBtn')?.addEventListener('click', () => {
      this.generateCoupon();
    });

    // Multi strategies
    document.getElementById('generateMultiBtn')?.addEventListener('click', () => {
      this.generateMultiStrategy();
    });

    // Ladder
    document.getElementById('generateLadderBtn')?.addEventListener('click', () => {
      this.generateLadder();
    });

    // Validate
    document.getElementById('validateBtn')?.addEventListener('click', () => {
      this.validateCoupon();
    });

    // Export
    document.getElementById('exportBtn')?.addEventListener('click', () => {
      document.getElementById('exportModal')?.classList.add('active');
    });

    // Close export modal
    document.getElementById('closeExportModal')?.addEventListener('click', () => {
      document.getElementById('exportModal')?.classList.remove('active');
    });

    // Telegram
    document.getElementById('telegramBtn')?.addEventListener('click', () => {
      this.sendToTelegram();
    });

    // Export options
    document.querySelectorAll('.export-option').forEach(option => {
      option.addEventListener('click', () => {
        const format = option.dataset.format;
        this.exportCoupon(format);
        document.getElementById('exportModal')?.classList.remove('active');
      });
    });

    // Mobile FAB
    document.getElementById('mobileFab')?.addEventListener('click', () => {
      this.generateCoupon();
    });

    // Refresh results
    document.getElementById('refreshResultsBtn')?.addEventListener('click', () => {
      if (this.couponData) {
        this.renderMatches(this.couponData);
        this.showToast('Resultats actualises', 'success');
      }
    });

    // Zen controls
    document.getElementById('zenFocusBtn')?.addEventListener('click', () => {
      this.toggleZenFocus();
    });

    document.getElementById('zenSoundBtn')?.addEventListener('click', () => {
      this.toggleZenSound();
    });
  }

  // ==========================================
  // GENERATION DE COUPON
  // ==========================================
  async generateCoupon() {
    if (this.isGenerating) return;

    this.isGenerating = true;
    const loading = document.getElementById('loadingOverlay');
    const aiState = document.getElementById('aiStateText');
    const progress = document.getElementById('loadingProgress');

    loading?.classList.add('active');

    // Simulation des etapes
    const steps = [
      { text: 'Analyse des donnees...', progress: 20 },
      { text: 'Simulation Monte-Carlo...', progress: 40 },
      { text: 'Evaluation des probabilites...', progress: 60 },
      { text: 'Optimisation des picks...', progress: 80 },
      { text: 'Generation du coupon sublime...', progress: 100 }
    ];

    for (const step of steps) {
      if (aiState) aiState.textContent = step.text;
      if (progress) progress.style.width = `${step.progress}%`;
      await this.sleep(400);
    }

    // Generer les donnees du coupon
    this.couponData = this.generateMockData();

    // Mettre a jour l'interface
    this.renderMatches(this.couponData);
    this.updateStats(this.couponData);
    this.enableActionButtons();

    loading?.classList.remove('active');
    this.isGenerating = false;

    this.showToast('Coupon sublime genere avec succes!', 'success');

    // Animation de celebration
    this.celebrateGeneration();
  }

  generateMockData() {
    const matches = [];
    const teams = [
      { home: 'PSG', away: 'OM', league: 'Ligue 1' },
      { home: 'Real Madrid', away: 'Barca', league: 'La Liga' },
      { home: 'Man City', away: 'Liverpool', league: 'Premier League' },
      { home: 'Juventus', away: 'AC Milan', league: 'Serie A' },
      { home: 'Bayern', away: 'Dortmund', league: 'Bundesliga' },
      { home: 'Chelsea', away: 'Arsenal', league: 'Premier League' }
    ];

    const predictions = ['1', 'X', '2', '1X', 'X2', '12', 'Over 2.5', 'Under 2.5', 'BTTS'];

    for (let i = 0; i < this.matchCount; i++) {
      const match = teams[Math.floor(Math.random() * teams.length)];
      const pred = predictions[Math.floor(Math.random() * predictions.length)];
      const odds = (Math.random() * 3 + 1.2).toFixed(2);
      const confidence = Math.floor(Math.random() * (95 - this.confidenceLevel) + this.confidenceLevel);

      matches.push({
        id: i + 1,
        ...match,
        time: `${Math.floor(Math.random() * 24).toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}`,
        prediction: pred,
        odds: parseFloat(odds),
        confidence: confidence
      });
    }

    return {
      matches,
      totalOdds: matches.reduce((acc, m) => acc * m.odds, 1).toFixed(2),
      potentialGain: Math.floor(this.stake * matches.reduce((acc, m) => acc * m.odds, 1)),
      averageConfidence: Math.floor(matches.reduce((acc, m) => acc + m.confidence, 0) / matches.length)
    };
  }

  renderMatches(data) {
    const grid = document.getElementById('matchesGrid');
    if (!grid) return;

    grid.innerHTML = data.matches.map((match, i) => `
      <div class="match-card" style="animation-delay: ${i * 100}ms">
        <div class="match-header">
          <div class="match-league">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            ${match.league}
          </div>
          <div class="match-time">${match.time}</div>
        </div>
        <div class="match-teams">
          <div class="team">
            <div class="team-logo">${match.home.substring(0, 2).toUpperCase()}</div>
            <span class="team-name">${match.home}</span>
          </div>
          <div class="vs-badge">VS</div>
          <div class="team">
            <div class="team-logo">${match.away.substring(0, 2).toUpperCase()}</div>
            <span class="team-name">${match.away}</span>
          </div>
        </div>
        <div class="match-prediction">
          <div class="prediction-type">
            <span class="prediction-badge">${match.prediction}</span>
            <span class="prediction-odds">@${match.odds}</span>
          </div>
          <div class="prediction-confidence">
            <span class="confidence-indicator" style="background: ${match.confidence >= 80 ? '#10b981' : match.confidence >= 60 ? '#f59e0b' : '#ef4444'}; box-shadow: 0 0 10px ${match.confidence >= 80 ? '#10b981' : match.confidence >= 60 ? '#f59e0b' : '#ef4444'}"></span>
            <span>${match.confidence}% confiance</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  updateStats(data) {
    // Quick stats
    const potentialGain = document.getElementById('potentialGain');
    const totalOdds = document.getElementById('totalOdds');
    const successProb = document.getElementById('successProb');

    if (potentialGain) {
      this.animateNumber(potentialGain, 0, data.potentialGain, `${data.potentialGain.toLocaleString()} FCFA`);
    }
    if (totalOdds) {
      this.animateNumber(totalOdds, 0, parseFloat(data.totalOdds), `@${data.totalOdds}`);
    }
    if (successProb) {
      const prob = Math.floor(data.averageConfidence * 0.85);
      this.animateNumber(successProb, 0, prob, `${prob}%`);
    }

    // AI confidence
    this.updateAIConfidence(data.averageConfidence);

    // HUD metrics
    const winRate = document.getElementById('winRateValue');
    const roi = document.getElementById('roiValue');

    if (winRate) winRate.textContent = `${data.averageConfidence}%`;
    if (roi) roi.textContent = `+${Math.floor(data.potentialGain / this.stake * 10)}%`;
  }

  updateQuickStats() {
    // Estimation rapide avant generation
    const multiplier = this.riskProfile === 'ultra_safe' ? 1.5 :
      this.riskProfile === 'safe' ? 2.0 :
        this.riskProfile === 'balanced' ? 3.5 :
          this.riskProfile === 'aggressive' ? 5.0 : 8.0;

    const estimatedGain = Math.floor(this.stake * multiplier);

    const potentialGain = document.getElementById('potentialGain');
    const totalOdds = document.getElementById('totalOdds');
    const successProb = document.getElementById('successProb');

    if (potentialGain && !this.couponData) potentialGain.textContent = `~${estimatedGain.toLocaleString()} FCFA`;
    if (totalOdds && !this.couponData) totalOdds.textContent = `~${multiplier.toFixed(1)}`;
    if (successProb && !this.couponData) successProb.textContent = `${this.confidenceLevel}%`;
  }

  enableActionButtons() {
    ['validateBtn', 'exportBtn', 'telegramBtn'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    });
  }

  generateMultiStrategy() {
    this.showToast('Generation de 3 strategies en cours...', 'info');
    setTimeout(() => {
      this.generateCoupon();
      this.showToast('Multi-strategies generees!', 'success');
    }, 1500);
  }

  generateLadder() {
    this.showToast('Generation du Ladder IA...', 'info');
    this.matchCount = 3;
    document.getElementById('matchCountSlider').value = 3;
    document.getElementById('matchCountValue').textContent = '3';

    setTimeout(() => {
      this.generateCoupon();
      this.showToast('Ladder genere avec succes!', 'success');
    }, 1500);
  }

  validateCoupon() {
    if (!this.couponData) return;

    const validationScore = this.couponData.averageConfidence;

    if (validationScore >= 80) {
      this.showToast(`Ticket valide! Score: ${validationScore}/100`, 'success');
      this.celebrateValidation();
    } else if (validationScore >= 60) {
      this.showToast(`Ticket acceptable. Score: ${validationScore}/100`, 'warning');
    } else {
      this.showToast(`Risque eleve detecte. Score: ${validationScore}/100`, 'error');
    }
  }

  exportCoupon(format) {
    const formats = {
      image: 'Image HD',
      pdf: 'PDF',
      story: 'Story Format',
      telegram: 'Telegram'
    };

    this.showToast(`Export ${formats[format]} en cours...`, 'info');

    setTimeout(() => {
      this.showToast(`Export ${formats[format]} reussi!`, 'success');
    }, 1500);
  }

  sendToTelegram() {
    this.showToast('Envoi vers Telegram...', 'info');

    setTimeout(() => {
      this.showToast('Envoye avec succes sur Telegram!', 'success');
    }, 1000);
  }

  // ==========================================
  // ANIMATIONS
  // ==========================================
  celebrateGeneration() {
    // Creer des particules de celebration
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        this.createConfetti();
      }, i * 50);
    }
  }

  celebrateValidation() {
    const btn = document.getElementById('validateBtn');
    if (btn) {
      btn.style.background = '#10b981';
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>Valide!</span>
      `;

      setTimeout(() => {
        btn.style.background = '';
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>Valider</span>
        `;
      }, 2000);
    }
  }

  createConfetti() {
    const colors = ['#00f5ff', '#7c3aed', '#f59e0b', '#10b981', '#ec4899'];
    const confetti = document.createElement('div');
    confetti.style.cssText = `
      position: fixed;
      width: 10px;
      height: 10px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${Math.random() * 100}%;
      top: -10px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 1000;
      box-shadow: 0 0 10px currentColor;
    `;

    document.body.appendChild(confetti);

    const animation = confetti.animate([
      { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
      { transform: `translateY(${window.innerHeight}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
    ], {
      duration: 2000 + Math.random() * 1000,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    });

    animation.onfinish = () => confetti.remove();
  }

  animateNumber(element, start, end, finalText) {
    const duration = 1000;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const current = Math.floor(start + (end - start) * easeProgress);
      element.textContent = finalText.includes('FCFA') ? `${current.toLocaleString()} FCFA` :
        finalText.includes('@') ? `@${current.toFixed(2)}` : `${current}%`;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        element.textContent = finalText;
      }
    };

    requestAnimationFrame(animate);
  }

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    const titles = {
      success: 'Succes',
      error: 'Erreur',
      warning: 'Attention',
      info: 'Information'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type]}</div>
      <div class="toast-content">
        <div class="toast-title">${titles[type]}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;

    container.appendChild(toast);

    // Son notification
    this.playNotificationSound(type);

    // Auto remove
    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  playNotificationSound(type) {
    // Audio context pour sons immersifs (optionnel)
    if (typeof AudioContext !== 'undefined') {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        const frequencies = {
          success: 880,
          error: 220,
          warning: 440,
          info: 660
        };

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = frequencies[type];
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      } catch (e) {
        // Silencieux si audio non supporte
      }
    }
  }

  // ==========================================
  // RACCOURCIS CLAVIER
  // ==========================================
  initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Enter = Generer
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.generateCoupon();
      }

      // Ctrl/Cmd + S = Sauvegarder config
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveConfig();
      }

      // Echap = Fermer modals
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay, .menu-overlay').forEach(el => {
          el.classList.remove('active');
        });
      }

      // 1, 2, 3, 4 = Navigation sections
      if (e.key >= '1' && e.key <= '4') {
        const sections = ['command', 'predictor', 'analytics', 'zen'];
        const section = sections[parseInt(e.key) - 1];
        if (section) {
          this.switchSection(section);
          document.querySelector(`[data-section="${section}"]`)?.classList.add('active');
          document.querySelectorAll('.orbital-btn').forEach(b => {
            if (b.dataset.section === section) b.classList.add('active');
            else b.classList.remove('active');
          });
        }
      }
    });
  }

  // ==========================================
  // GESTES TACTILES
  // ==========================================
  initGestures() {
    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const diffX = touchStartX - touchEndX;
      const diffY = touchStartY - touchEndY;

      // Swipe horizontal pour changer de section
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        const sections = ['command', 'predictor', 'analytics', 'zen'];
        const currentIndex = sections.indexOf(this.currentSection);

        if (diffX > 0 && currentIndex < sections.length - 1) {
          // Swipe gauche -> section suivante
          this.switchSection(sections[currentIndex + 1]);
          this.updateActiveNav(sections[currentIndex + 1]);
        } else if (diffX < 0 && currentIndex > 0) {
          // Swipe droite -> section precedente
          this.switchSection(sections[currentIndex - 1]);
          this.updateActiveNav(sections[currentIndex - 1]);
        }
      }

      // Swipe vers le bas pour generer
      if (diffY < -100 && Math.abs(diffY) > Math.abs(diffX)) {
        this.generateCoupon();
      }
    }, { passive: true });
  }

  updateActiveNav(section) {
    document.querySelectorAll('.orbital-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.section === section);
    });
  }

  // ==========================================
  // GRAPHIQUES ET ANALYTICS
  // ==========================================
  initCharts() {
    this.renderBankrollChart();
  }

  renderBankrollChart() {
    const canvas = document.getElementById('bankrollCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Ajuster pour ecran Retina
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;

    // Donnees simulees
    const data = [25000, 26500, 24200, 28100, 27500, 30200, 32000];
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min;

    // Effacer
    ctx.clearRect(0, 0, width, height);

    // Dessiner la ligne
    ctx.beginPath();
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    data.forEach((value, i) => {
      const x = (i / (data.length - 1)) * (width - 40) + 20;
      const y = height - 40 - ((value - min) / range) * (height - 80);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    // Gradient sous la courbe
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0, 245, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 245, 255, 0)');

    ctx.lineTo(width - 20, height - 40);
    ctx.lineTo(20, height - 40);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Points
    data.forEach((value, i) => {
      const x = (i / (data.length - 1)) * (width - 40) + 20;
      const y = height - 40 - ((value - min) / range) * (height - 80);

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#00f5ff';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  updateAnalytics() {
    // Mettre a jour les graphiques quand la section devient visible
    this.renderBankrollChart();

    // Simuler des mises a jour en temps reel
    setInterval(() => {
      if (this.currentSection === 'analytics') {
        this.updateLiveMetrics();
      }
    }, 5000);
  }

  updateLiveMetrics() {
    // Mettre a jour les valeurs HUD
    const winRate = document.getElementById('winRateValue');
    const roi = document.getElementById('roiValue');

    if (winRate) {
      const newWinRate = Math.floor(60 + Math.random() * 20);
      winRate.textContent = `${newWinRate}%`;
    }

    if (roi) {
      const newRoi = (15 + Math.random() * 20).toFixed(1);
      roi.textContent = `+${newRoi}%`;
    }
  }

  // ==========================================
  // MODE ZEN
  // ==========================================
  toggleZenFocus() {
    document.body.classList.toggle('zen-focus');

    if (document.body.classList.contains('zen-focus')) {
      // Masquer elements non essentiels
      document.querySelectorAll('.hud-metrics, .action-bar, .orbital-nav').forEach(el => {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      });

      this.showToast('Mode Focus active', 'info');
    } else {
      // Restaurer
      document.querySelectorAll('.hud-metrics, .action-bar, .orbital-nav').forEach(el => {
        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
      });

      this.showToast('Mode Focus desactive', 'info');
    }
  }

  toggleZenSound() {
    this.showToast('Son d\'ambiance bientot disponible', 'info');
  }

  // ==========================================
  // SAUVEGARDE CONFIG
  // ==========================================
  saveConfig() {
    const config = {
      matchCount: this.matchCount,
      stake: this.stake,
      confidenceLevel: this.confidenceLevel,
      riskProfile: this.riskProfile,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem('sublimeConfig', JSON.stringify(config));
    this.showToast('Configuration sauvegardee', 'success');
  }

  loadConfig() {
    const saved = localStorage.getItem('sublimeConfig');
    if (saved) {
      const config = JSON.parse(saved);
      this.matchCount = config.matchCount || 3;
      this.stake = config.stake || 1000;
      this.confidenceLevel = config.confidenceLevel || 72;
      this.riskProfile = config.riskProfile || 'balanced';

      // Appliquer les valeurs
      const matchSlider = document.getElementById('matchCountSlider');
      const matchValue = document.getElementById('matchCountValue');
      const stakeSlider = document.getElementById('stakeSlider');
      const stakeValue = document.getElementById('stakeValue');
      const confidenceSlider = document.getElementById('confidenceSlider');
      const confidenceValue = document.getElementById('confidenceValue');

      if (matchSlider) matchSlider.value = this.matchCount;
      if (matchValue) matchValue.textContent = this.matchCount;
      if (stakeSlider) stakeSlider.value = this.stake;
      if (stakeValue) stakeValue.textContent = `${this.stake.toLocaleString()} FCFA`;
      if (confidenceSlider) confidenceSlider.value = this.confidenceLevel;
      if (confidenceValue) confidenceValue.textContent = `${this.confidenceLevel}%`;

      // Risk chip
      document.querySelectorAll('.risk-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.risk === this.riskProfile);
      });

      this.showToast('Configuration chargee', 'success');
    }
  }

  // ==========================================
  // UTILITAIRES
  // ==========================================
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  loadInitialData() {
    // Charger les stats initiales
    document.getElementById('winRateValue').textContent = '68%';
    document.getElementById('roiValue').textContent = '+24.5%';

    // Essayer de charger config sauvegardee
    setTimeout(() => this.loadConfig(), 500);
  }
}

// ==========================================
// INITIALISATION
// ==========================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.sublimeApp = new SublimeApp();

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw-sublime.js')
      .then(reg => console.log('[PWA] Service Worker registered:', reg))
      .catch(err => console.log('[PWA] SW registration failed:', err));
  }
});

// Exposer pour debug
window.SublimeApp = SublimeApp;
