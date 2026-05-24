/**
 * COUP SUBLIME - Three.js Visualization Engine
 * Visualisation 3D immersive des predictions et statistiques
 * SOLITAIRE HACK SIGNATURE
 */

/* global THREE */

class Sublime3DEngine {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.globe = null;
    this.particles = null;
    this.dataPoints = [];
    this.animationId = null;
    this.isActive = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetRotationX = 0;
    this.targetRotationY = 0;
    
    this.init();
  }

  init() {
    this.loadThreeJS().then(() => {
      this.setupScene();
      this.createGlobe();
      this.createParticles();
      this.createDataPoints();
      this.setupInteraction();
      this.animate();
      
      console.log('%c[Three.js Engine] 3D Visualization Active', 'color: #00f5ff; font-weight: bold;');
    }).catch(err => {
      console.warn('[Three.js] Fallback to CSS visualization:', err);
      this.enableFallback();
    });
  }

  async loadThreeJS() {
    return new Promise((resolve, reject) => {
      if (window.THREE) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  setupScene() {
    const container = document.getElementById('vizCanvas');
    if (!container) return;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0a0f, 0.03);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.z = 5;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    this.scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x00f5ff, 2, 50);
    pointLight1.position.set(5, 5, 5);
    this.scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x7c3aed, 2, 50);
    pointLight2.position.set(-5, -5, 5);
    this.scene.add(pointLight2);

    const pointLight3 = new THREE.PointLight(0xf59e0b, 1.5, 50);
    pointLight3.position.set(0, 5, -5);
    this.scene.add(pointLight3);

    // Resize handler
    window.addEventListener('resize', () => this.onResize(), { passive: true });
  }

  createGlobe() {
    // Wireframe globe
    const geometry = new THREE.IcosahedronGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });
    this.globe = new THREE.Mesh(geometry, material);
    this.scene.add(this.globe);

    // Inner glow sphere
    const glowGeometry = new THREE.IcosahedronGeometry(1.8, 1);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.1
    });
    const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
    this.globe.add(glowSphere);

    // Core sphere
    const coreGeometry = new THREE.SphereGeometry(0.8, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.6
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    this.globe.add(core);
  }

  createParticles() {
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 2000;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
      posArray[i] = (Math.random() - 0.5) * 20;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.02,
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(particlesGeometry, particlesMaterial);
    this.scene.add(this.particles);
  }

  createDataPoints() {
    // Mock data points representing match locations
    const locations = [
      { lat: 48.8566, lon: 2.3522, city: 'Paris', intensity: 0.9 },      // PSG
      { lat: 51.5074, lon: -0.1278, city: 'London', intensity: 0.85 },   // Premier League
      { lat: 40.4168, lon: -3.7038, city: 'Madrid', intensity: 0.8 },  // La Liga
      { lat: 45.4642, lon: 9.19, city: 'Milan', intensity: 0.75 },      // Serie A
      { lat: 52.52, lon: 13.405, city: 'Berlin', intensity: 0.7 },      // Bundesliga
      { lat: 53.4808, lon: -2.2426, city: 'Manchester', intensity: 0.88 },
      { lat: 41.3851, lon: 2.1734, city: 'Barcelona', intensity: 0.82 },
      { lat: 43.2965, lon: 5.3698, city: 'Marseille', intensity: 0.72 }
    ];

    locations.forEach((loc, index) => {
      const phi = (90 - loc.lat) * (Math.PI / 180);
      const theta = (loc.lon + 180) * (Math.PI / 180);

      const x = -(2.5 * Math.sin(phi) * Math.cos(theta));
      const z = (2.5 * Math.sin(phi) * Math.sin(theta));
      const y = (2.5 * Math.cos(phi));

      // Create marker
      const markerGeometry = new THREE.SphereGeometry(0.08, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: loc.intensity > 0.8 ? 0x10b981 : loc.intensity > 0.7 ? 0xf59e0b : 0xef4444,
        transparent: true,
        opacity: 0.9
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(x, y, z);
      marker.userData = { city: loc.city, intensity: loc.intensity };
      
      // Glow ring
      const ringGeometry = new THREE.RingGeometry(0.1, 0.15, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: markerMaterial.color,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.set(x, y, z);
      ring.lookAt(0, 0, 0);
      
      this.globe.add(marker);
      this.globe.add(ring);
      this.dataPoints.push({ marker, ring, city: loc.city });
    });
  }

  setupInteraction() {
    const container = document.getElementById('vizCanvas');
    if (!container) return;

    container.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      this.mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }, { passive: true });

    container.addEventListener('click', () => {
      this.explodeView();
    });

    // Touch support
    container.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const rect = container.getBoundingClientRect();
      this.mouseX = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseY = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
    }, { passive: true });
  }

  explodeView() {
    // Animate data points outward
    this.dataPoints.forEach((point, index) => {
      const targetScale = 2;
      const currentPos = point.marker.position.clone();
      const direction = currentPos.normalize();
      
      const animate = () => {
        point.marker.position.add(direction.multiplyScalar(0.02));
        point.ring.position.copy(point.marker.position);
        
        if (point.marker.position.length() < currentPos.length() * targetScale) {
          requestAnimationFrame(animate);
        }
      };
      
      setTimeout(() => animate(), index * 50);
    });

    // Reset after 2 seconds
    setTimeout(() => {
      this.dataPoints.forEach(point => {
        const originalPos = point.marker.position.clone().normalize().multiplyScalar(2.5);
        point.marker.position.copy(originalPos);
        point.ring.position.copy(originalPos);
      });
    }, 2000);
  }

  onResize() {
    const container = document.getElementById('vizCanvas');
    if (!container || !this.camera || !this.renderer) return;

    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  animate() {
    if (!this.isActive) return;

    this.animationId = requestAnimationFrame(() => this.animate());

    const time = Date.now() * 0.001;

    // Rotate globe
    if (this.globe) {
      this.globe.rotation.y += 0.002;
      this.globe.rotation.x = Math.sin(time * 0.5) * 0.1;
      
      // Mouse interaction
      this.targetRotationX = this.mouseY * 0.5;
      this.targetRotationY = this.mouseX * 0.5;
      
      this.globe.rotation.x += (this.targetRotationX - this.globe.rotation.x) * 0.05;
      this.globe.rotation.y += (this.targetRotationY - this.globe.rotation.y) * 0.05;
    }

    // Animate particles
    if (this.particles) {
      this.particles.rotation.y = time * 0.05;
      this.particles.rotation.x = time * 0.02;
    }

    // Pulse data points
    this.dataPoints.forEach((point, index) => {
      const scale = 1 + Math.sin(time * 2 + index) * 0.2;
      point.ring.scale.set(scale, scale, scale);
      point.ring.material.opacity = 0.5 + Math.sin(time * 3 + index) * 0.3;
    });

    this.renderer.render(this.scene, this.camera);
  }

  enableFallback() {
    const container = document.getElementById('vizCanvas');
    if (container) {
      container.innerHTML = `
        <div class="viz-fallback">
          <div class="viz-globe-fallback">
            <div class="globe-ring ring-1"></div>
            <div class="globe-ring ring-2"></div>
            <div class="globe-ring ring-3"></div>
            <div class="globe-core"></div>
          </div>
          <p>Visualisation 3D - Mode Fallback</p>
        </div>
      `;
    }
  }

  start() {
    this.isActive = true;
    this.animate();
  }

  stop() {
    this.isActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  dispose() {
    this.stop();
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize when Predictor section is active
  const observer = new MutationObserver((mutations) => {
    const predictorSection = document.getElementById('predictorSection');
    if (predictorSection && predictorSection.classList.contains('active')) {
      if (!window.sublime3D) {
        window.sublime3D = new Sublime3DEngine();
      } else {
        window.sublime3D.start();
      }
    } else if (window.sublime3D) {
      window.sublime3D.stop();
    }
  });

  observer.observe(document.body, { 
    attributes: true, 
    subtree: true,
    attributeFilter: ['class']
  });
});

window.Sublime3DEngine = Sublime3DEngine;
