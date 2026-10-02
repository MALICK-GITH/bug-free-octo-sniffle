/**
 * Mobile Menu Toggle
 * Gestion du menu hamburger pour mobile
 */

document.addEventListener('DOMContentLoaded', () => {
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const controls = document.querySelector('.controls');

  if (mobileMenuToggle && controls) {
    mobileMenuToggle.addEventListener('click', () => {
      const isExpanded = mobileMenuToggle.getAttribute('aria-expanded') === 'true';
      mobileMenuToggle.setAttribute('aria-expanded', !isExpanded);
      controls.classList.toggle('mobile-menu-open');
    });

    // Fermer le menu quand on clique en dehors
    document.addEventListener('click', (e) => {
      if (!mobileMenuToggle.contains(e.target) && !controls.contains(e.target)) {
        if (mobileMenuToggle.getAttribute('aria-expanded') === 'true') {
          mobileMenuToggle.setAttribute('aria-expanded', 'false');
          controls.classList.remove('mobile-menu-open');
        }
      }
    });

    // Fermer le menu quand on clique sur un lien
    const links = controls.querySelectorAll('a');
    links.forEach(link => {
      link.addEventListener('click', () => {
        if (mobileMenuToggle.getAttribute('aria-expanded') === 'true') {
          mobileMenuToggle.setAttribute('aria-expanded', 'false');
          controls.classList.remove('mobile-menu-open');
        }
      });
    });
  }
});
