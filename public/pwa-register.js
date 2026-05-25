/**
 * PWA Registration Script
 * Enregistrement et gestion du service worker
 */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('[PWA] Service Worker enregistré avec succès:', registration.scope);
        
        // Vérifier les mises à jour du service worker
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nouveau service worker disponible
              console.log('[PWA] Nouveau service worker disponible');
              
              // Afficher une notification de mise à jour
              showUpdateNotification();
            }
          });
        });
      })
      .catch((error) => {
        console.error('[PWA] Erreur lors de l\'enregistrement du service worker:', error);
      });
  });
  
  // Écouter les messages du service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('[PWA] Message reçu du service worker:', event.data);
    
    if (event.data && event.data.type === 'CACHE_UPDATED') {
      console.log('[PWA] Cache mis à jour');
    }
  });
  
  // Gérer le changement de contrôleur
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[PWA] Nouveau contrôleur actif');
    // Désactivé pour éviter les rechargements en boucle
    // window.location.reload();
  });
}

// Afficher une notification de mise à jour
function showUpdateNotification() {
  // Créer un élément de notification
  const notification = document.createElement('div');
  notification.className = 'pwa-update-notification';
  notification.innerHTML = `
    <div class="pwa-update-content">
      <span class="pwa-update-icon">🔄</span>
      <span class="pwa-update-text">Une mise à jour est disponible</span>
      <button class="pwa-update-button" id="pwaUpdateBtn">Mettre à jour</button>
    </div>
  `;
  
  // Ajouter les styles
  const style = document.createElement('style');
  style.textContent = `
    .pwa-update-notification {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-secondary, #1a1a2e);
      border: 1px solid var(--brand, #42f56c);
      border-radius: 12px;
      padding: 16px 24px;
      z-index: 10000;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      animation: slideUp 0.3s ease-out;
    }
    
    .pwa-update-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .pwa-update-icon {
      font-size: 24px;
    }
    
    .pwa-update-text {
      color: var(--text-primary, #f2f2f7);
      font-size: 14px;
      font-weight: 500;
    }
    
    .pwa-update-button {
      background: var(--brand, #42f56c);
      color: var(--bg-0, #0a1628);
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .pwa-update-button:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(66, 245, 108, 0.3);
    }
    
    @keyframes slideUp {
      from {
        transform: translate(-50%, 100%);
        opacity: 0;
      }
      to {
        transform: translate(-50%, 0);
        opacity: 1;
      }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(notification);
  
  // Ajouter l'événement de clic
  document.getElementById('pwaUpdateBtn').addEventListener('click', () => {
    // Envoyer un message au service worker pour activer le nouveau worker
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // Supprimer la notification
    notification.remove();
  });
}

// Détecter le mode offline/online
window.addEventListener('online', () => {
  console.log('[PWA] Connexion rétablie');
  showOnlineStatus(true);
});

window.addEventListener('offline', () => {
  console.log('[PWA] Connexion perdue');
  showOnlineStatus(false);
});

// Afficher le statut de connexion
function showOnlineStatus(isOnline) {
  const existingStatus = document.querySelector('.pwa-online-status');
  if (existingStatus) {
    existingStatus.remove();
  }
  
  const status = document.createElement('div');
  status.className = 'pwa-online-status';
  status.innerHTML = isOnline ? '🟢 En ligne' : '🔴 Hors ligne';
  
  const style = document.createElement('style');
  style.textContent = `
    .pwa-online-status {
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--bg-secondary, #1a1a2e);
      border: 1px solid ${isOnline ? 'var(--brand, #42f56c)' : 'var(--danger, #ff4757)'};
      border-radius: 8px;
      padding: 8px 16px;
      z-index: 9999;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary, #f2f2f7);
      animation: fadeIn 0.3s ease-out;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(status);
  
  // Supprimer automatiquement après 3 secondes
  setTimeout(() => {
    status.remove();
  }, 3000);
}
