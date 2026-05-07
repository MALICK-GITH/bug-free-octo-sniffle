/**
 * SOLITFIFPRO225 - Lazy Loading & Pagination System
 * Images chargées au scroll + Pagination 20 matchs/page
 */

class LazyLoadingPagination {
  constructor(options = {}) {
    this.itemsPerPage = options.itemsPerPage || 20;
    this.currentPage = 1;
    this.allMatches = [];
    this.visibleMatches = [];
    this.loading = false;
    this.hasMore = true;
    
    this.selectors = {
      container: options.container || '#matchList',
      loader: options.loader || '#paginationLoader',
      sentinel: options.sentinel || '#scrollSentinel'
    };
    
    this.init();
  }
  
  init() {
    this.setupIntersectionObserver();
    this.setupImageObserver();
    this.createSentinel();
    this.createLoader();
  }
  
  /**
   * Crée l'élément sentinelle pour le scroll infini
   */
  createSentinel() {
    const container = document.querySelector(this.selectors.container);
    if (!container) return;
    
    const sentinel = document.createElement('div');
    sentinel.id = this.selectors.sentinel.replace('#', '');
    sentinel.className = 'scroll-sentinel';
    sentinel.style.cssText = 'height: 20px; margin: 20px 0;';
    container.appendChild(sentinel);
  }
  
  /**
   * Crée l'indicateur de chargement
   */
  createLoader() {
    const existingLoader = document.querySelector(this.selectors.loader);
    if (existingLoader) return;
    
    const container = document.querySelector(this.selectors.container);
    if (!container) return;
    
    const loader = document.createElement('div');
    loader.id = this.selectors.loader.replace('#', '');
    loader.className = 'pagination-loader';
    loader.innerHTML = `
      <div class="loader-spinner"></div>
      <span>Chargement des matchs...</span>
    `;
    loader.style.cssText = `
      display: none;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 20px;
      color: var(--text-secondary);
    `;
    container.appendChild(loader);
  }
  
  /**
   * Configure l'Intersection Observer pour le scroll infini
   */
  setupIntersectionObserver() {
    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0
    };
    
    this.scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.loading && this.hasMore) {
          this.loadMoreMatches();
        }
      });
    }, options);
    
    // Observer la sentinelle
    const sentinel = document.querySelector(this.selectors.sentinel);
    if (sentinel) {
      this.scrollObserver.observe(sentinel);
    }
  }
  
  /**
   * Configure l'Intersection Observer pour le lazy loading des images
   */
  setupImageObserver() {
    const imageOptions = {
      root: null,
      rootMargin: '50px',
      threshold: 0
    };
    
    this.imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadImage(entry.target);
          this.imageObserver.unobserve(entry.target);
        }
      });
    }, imageOptions);
  }
  
  /**
   * Charge une image (lazy)
   */
  loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;
    
    // Crée une nouvelle image pour précharger
    const preloadImg = new Image();
    preloadImg.onload = () => {
      img.src = src;
      img.classList.add('loaded');
      img.removeAttribute('data-src');
    };
    preloadImg.onerror = () => {
      // Image par défaut si erreur
      img.src = '/default-team-logo.png';
      img.classList.add('loaded', 'error');
    };
    preloadImg.src = src;
  }
  
  /**
   * Initialise les données des matchs
   */
  setMatches(matches) {
    this.allMatches = matches;
    this.currentPage = 1;
    this.hasMore = matches.length > this.itemsPerPage;
    
    // Affiche la première page
    this.renderPage(1);
  }
  
  /**
   * Charge plus de matchs (pagination)
   */
  loadMoreMatches() {
    if (this.loading || !this.hasMore) return;
    
    this.loading = true;
    this.showLoader();
    
    // Simule un délai de chargement pour UX
    setTimeout(() => {
      this.currentPage++;
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      const newMatches = this.allMatches.slice(startIndex, endIndex);
      
      if (newMatches.length > 0) {
        this.appendMatches(newMatches);
        this.setupLazyImages();
        
        // Vérifie s'il reste des matchs
        this.hasMore = endIndex < this.allMatches.length;
      } else {
        this.hasMore = false;
        this.hideSentinel();
      }
      
      this.loading = false;
      this.hideLoader();
    }, 300);
  }
  
  /**
   * Affiche une page spécifique
   */
  renderPage(pageNum) {
    const startIndex = (pageNum - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageMatches = this.allMatches.slice(startIndex, endIndex);
    
    const container = document.querySelector(this.selectors.container);
    if (!container) return;
    
    // Garde la sentinelle et le loader
    const sentinel = container.querySelector(this.selectors.sentinel);
    const loader = container.querySelector(this.selectors.loader);
    
    // Vide le conteneur sauf sentinelle et loader
    Array.from(container.children).forEach(child => {
      if (!child.matches(this.selectors.sentinel) && 
          !child.matches(this.selectors.loader)) {
        child.remove();
      }
    });
    
    // Ajoute les matchs
    pageMatches.forEach((match, index) => {
      const matchElement = this.createMatchElement(match, startIndex + index);
      container.insertBefore(matchElement, sentinel);
    });
    
    // Configure le lazy loading des images
    this.setupLazyImages();
    
    // Met à jour l'état
    this.visibleMatches = pageMatches;
    this.hasMore = endIndex < this.allMatches.length;
  }
  
  /**
   * Ajoute des matchs au conteneur existant
   */
  appendMatches(matches) {
    const container = document.querySelector(this.selectors.container);
    if (!container) return;
    
    const sentinel = container.querySelector(this.selectors.sentinel);
    const startIndex = this.visibleMatches.length;
    
    matches.forEach((match, index) => {
      const matchElement = this.createMatchElement(match, startIndex + index);
      container.insertBefore(matchElement, sentinel);
    });
    
    this.visibleMatches = [...this.visibleMatches, ...matches];
  }
  
  /**
   * Crée l'élément HTML d'un match
   */
  createMatchElement(match, index) {
    const div = document.createElement('div');
    div.className = 'match-card';
    div.dataset.matchId = match.id;
    div.style.animationDelay = `${(index % 20) * 0.05}s`;
    
    div.innerHTML = `
      <div class="match-header">
        <span class="league-tag">${match.league}</span>
        <span class="match-time">${match.time}</span>
      </div>
      
      <div class="teams-row">
        <div class="team home">
          <img class="team-logo lazy-img" 
               data-src="${match.homeTeam.logo}" 
               alt="${match.homeTeam.name}"
               src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E">
          <span class="team-name">${match.homeTeam.name}</span>
        </div>
        
        <div class="vs">VS</div>
        
        <div class="team away">
          <img class="team-logo lazy-img" 
               data-src="${match.awayTeam.logo}" 
               alt="${match.awayTeam.name}"
               src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E">
          <span class="team-name">${match.awayTeam.name}</span>
        </div>
      </div>
      
      <div class="odds-row">
        <div class="odd-box" data-type="1" data-odd="${match.odds.home}">
          <span>1</span>
          <strong>${match.odds.home}</strong>
        </div>
        <div class="odd-box" data-type="X" data-odd="${match.odds.draw}">
          <span>X</span>
          <strong>${match.odds.draw}</strong>
        </div>
        <div class="odd-box" data-type="2" data-odd="${match.odds.away}">
          <span>2</span>
          <strong>${match.odds.away}</strong>
        </div>
      </div>
      
      <div class="reliability-pill">
        Fiabilité: ${match.reliability}%
      </div>
    `;
    
    return div;
  }
  
  /**
   * Configure le lazy loading pour les images
   */
  setupLazyImages() {
    const lazyImages = document.querySelectorAll('.lazy-img[data-src]');
    lazyImages.forEach(img => {
      this.imageObserver.observe(img);
    });
  }
  
  /**
   * Affiche le loader
   */
  showLoader() {
    const loader = document.querySelector(this.selectors.loader);
    if (loader) {
      loader.style.display = 'flex';
    }
  }
  
  /**
   * Cache le loader
   */
  hideLoader() {
    const loader = document.querySelector(this.selectors.loader);
    if (loader) {
      loader.style.display = 'none';
    }
  }
  
  /**
   * Cache la sentinelle quand il n'y a plus de matchs
   */
  hideSentinel() {
    const sentinel = document.querySelector(this.selectors.sentinel);
    if (sentinel) {
      sentinel.style.display = 'none';
    }
  }
  
  /**
   * Détruit l'instance proprement
   */
  destroy() {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
    }
    if (this.imageObserver) {
      this.imageObserver.disconnect();
    }
  }
}

// CSS associé (à ajouter dans le fichier CSS)
const lazyLoadingStyles = `
  .lazy-img {
    opacity: 0;
    transition: opacity 0.3s ease;
    background: linear-gradient(90deg, 
      rgba(255,255,255,0.05) 0%, 
      rgba(255,255,255,0.1) 50%, 
      rgba(255,255,255,0.05) 100%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }
  
  .lazy-img.loaded {
    opacity: 1;
    animation: none;
  }
  
  .lazy-img.error {
    opacity: 1;
    background: #2a3a4a;
    animation: none;
  }
  
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  
  .pagination-loader .loader-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-subtle);
    border-top-color: var(--primary-light);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LazyLoadingPagination;
}
