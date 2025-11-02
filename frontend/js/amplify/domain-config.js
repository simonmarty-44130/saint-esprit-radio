// Configuration domaine pour saint-esprit.link
const DOMAIN_CONFIG = {
  production: 'https://saint-esprit.link',
  staging: 'https://staging.saint-esprit.link',
  development: 'http://localhost:8000'
};

// Détection automatique de l'environnement
const getCurrentDomain = () => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return DOMAIN_CONFIG.development;
  } else if (hostname === 'saint-esprit.link') {
    return DOMAIN_CONFIG.production;
  } else if (hostname.includes('saint-esprit.link')) {
    return DOMAIN_CONFIG.staging;
  } else {
    // Pour S3 ou autres domaines
    return window.location.origin;
  }
};

window.SAINT_ESPRIT_DOMAIN = getCurrentDomain();
console.log('🌐 Domaine Saint-Esprit:', window.SAINT_ESPRIT_DOMAIN);

// Export pour les modules
export const CURRENT_DOMAIN = window.SAINT_ESPRIT_DOMAIN;