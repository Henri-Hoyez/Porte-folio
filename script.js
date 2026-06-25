// JavaScript pour le site portfolio

// Variables globales
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    initializeScrollEffects();
    initializeAnimations();
    initializeAccessibility();
    initializeExpandableBoxes();
    console.log('Portfolio site initialized');
});

// ======================================
// NAVIGATION MOBILE
// ======================================

function initializeNavigation() {
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', toggleMobileMenu);
        
        // Fermer le menu lors du clic sur un lien
        const navLinks = navMenu.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', closeMobileMenu);
        });
        
        // Fermer le menu lors du clic en dehors
        document.addEventListener('click', function(event) {
            if (!navToggle.contains(event.target) && !navMenu.contains(event.target)) {
                closeMobileMenu();
            }
        });
        
        // Fermer le menu avec Escape
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && navMenu.classList.contains('active')) {
                closeMobileMenu();
                navToggle.focus();
            }
        });
    }
}

function toggleMobileMenu() {
    navMenu.classList.toggle('active');
    navToggle.classList.toggle('active');
    
    // Animation du bouton hamburger
    const lines = navToggle.querySelectorAll('.nav-toggle-line');
    lines.forEach((line, index) => {
        if (navMenu.classList.contains('active')) {
            if (index === 0) line.style.transform = 'rotate(45deg) translate(5px, 5px)';
            if (index === 1) line.style.opacity = '0';
            if (index === 2) line.style.transform = 'rotate(-45deg) translate(7px, -6px)';
        } else {
            line.style.transform = '';
            line.style.opacity = '';
        }
    });
    
    // Accessibilité
    const isExpanded = navMenu.classList.contains('active');
    navToggle.setAttribute('aria-expanded', isExpanded);
    
    // Prévenir le scroll du body quand le menu est ouvert
    document.body.style.overflow = isExpanded ? 'hidden' : '';
}

function closeMobileMenu() {
    navMenu.classList.remove('active');
    navToggle.classList.remove('active');
    
    // Réinitialiser le bouton hamburger
    const lines = navToggle.querySelectorAll('.nav-toggle-line');
    lines.forEach(line => {
        line.style.transform = '';
        line.style.opacity = '';
    });
    
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
}

// ======================================
// EFFETS DE SCROLL
// ======================================

function initializeScrollEffects() {
    // Header transparent/opaque selon le scroll
    const header = document.querySelector('.header');
    if (header) {
        window.addEventListener('scroll', function() {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }
    
    // Smooth scroll pour les liens internes
    const internalLinks = document.querySelectorAll('a[href^="#"]');
    internalLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerHeight = header ? header.offsetHeight : 0;
                const targetPosition = target.offsetTop - headerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// ======================================
// ANIMATIONS D'APPARITION
// ======================================

function initializeAnimations() {
    // Observer pour les animations au scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // Éléments à animer
    const animatedElements = document.querySelectorAll(`
        .feature-card,
        .cv-timeline-item,
        .project-card,
        .document-card,
        .publication-item,
        .method-category,
        .info-card
    `);
    
    animatedElements.forEach(el => {
        el.classList.add('animate-ready');
        observer.observe(el);
    });
    
    // Animation de compteur pour les statistiques (si présentes)
    const counters = document.querySelectorAll('[data-counter]');
    counters.forEach(counter => {
        observer.observe(counter);
        counter.addEventListener('animateCounter', animateCounter);
    });
}

function animateCounter(event) {
    const counter = event.target;
    const target = parseInt(counter.getAttribute('data-counter'));
    const duration = 2000;
    const step = target / (duration / 16);
    let current = 0;
    
    const timer = setInterval(() => {
        current += step;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        counter.textContent = Math.floor(current);
    }, 16);
}

// ======================================
// ACCESSIBILITÉ
// ======================================

function initializeAccessibility() {
    // Focus trap dans le menu mobile
    const focusableElements = navMenu?.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])');
    
    if (focusableElements?.length > 0) {
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        
        navMenu.addEventListener('keydown', function(e) {
            if (e.key === 'Tab' && navMenu.classList.contains('active')) {
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        lastFocusable.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        firstFocusable.focus();
                        e.preventDefault();
                    }
                }
            }
        });
    }
    
    // Skip link
    addSkipLink();
    
    // Amélioration des messages d'état
    addAriaLiveRegion();
}

function addSkipLink() {
    const skipLink = document.createElement('a');
    skipLink.href = '#main';
    skipLink.textContent = 'Aller au contenu principal';
    skipLink.className = 'skip-link';
    skipLink.style.cssText = `
        position: absolute;
        top: -40px;
        left: 6px;
        background: var(--primary-color);
        color: white;
        padding: 8px;
        text-decoration: none;
        z-index: 1001;
        border-radius: 4px;
        transition: top 0.2s;
    `;
    
    skipLink.addEventListener('focus', () => {
        skipLink.style.top = '6px';
    });
    
    skipLink.addEventListener('blur', () => {
        skipLink.style.top = '-40px';
    });
    
    document.body.insertBefore(skipLink, document.body.firstChild);
}

function addAriaLiveRegion() {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.style.cssText = `
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    `;
    document.body.appendChild(liveRegion);
    
    // Fonction globale pour annoncer des messages
    window.announceMessage = function(message) {
        liveRegion.textContent = message;
        setTimeout(() => {
            liveRegion.textContent = '';
        }, 1000);
    };
}

// ======================================
// BOÎTES EXTENSIBLES
// ======================================

function initializeExpandableBoxes() {
    const expandableBoxes = document.querySelectorAll('.cv-timeline-content.expandable, .project-card.expandable, .document-card.expandable');
    
    expandableBoxes.forEach(box => {
        // Ajouter l'indicateur visuel pour montrer que la boîte est cliquable
        box.style.cursor = 'pointer';
        
        // Ajouter l'attribut ARIA pour l'accessibilité
        box.setAttribute('role', 'button');
        box.setAttribute('aria-expanded', 'false');
        box.setAttribute('tabindex', '0');
        
        // Gérer le clic
        box.addEventListener('click', function(e) {
            // Empêcher la propagation si on clique sur un lien à l'intérieur
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                return;
            }
            
            toggleExpandableBox(box);
        });
        
        // Gérer l'appui sur Entrée ou Espace pour l'accessibilité
        box.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleExpandableBox(box);
            }
        });
        
        // Améliorer l'effet hover
        box.addEventListener('mouseenter', function() {
            if (!box.classList.contains('expanded')) {
                box.style.transform = 'translateY(-3px)';
            }
        });
        
        box.addEventListener('mouseleave', function() {
            if (!box.classList.contains('expanded')) {
                box.style.transform = 'translateY(-2px)';
            }
        });
    });
}

function toggleExpandableBox(box) {
    const isExpanded = box.classList.contains('expanded');
    const details = box.querySelector('.cv-timeline-details, .project-details, .document-details');
    
    if (!details) return;
    
    if (isExpanded) {
        // Réduire la boîte
        box.classList.remove('expanded');
        box.setAttribute('aria-expanded', 'false');
        
        // Animation de fermeture
        details.style.maxHeight = details.scrollHeight + 'px';
        details.offsetHeight; // Force reflow
        details.style.maxHeight = '0px';
        
        // Restaurer l'effet hover
        box.style.transform = 'translateY(-2px)';
        
        if (window.announceMessage) {
            window.announceMessage(window.SiteI18n ? window.SiteI18n.t('a11y.section_closed') : 'Section fermée');
        }
    } else {
        // Étendre la boîte
        box.classList.add('expanded');
        box.setAttribute('aria-expanded', 'true');
        
        // Animation d'ouverture
        details.style.maxHeight = 'none';
        const height = details.scrollHeight;
        details.style.maxHeight = '0px';
        details.offsetHeight; // Force reflow
        details.style.maxHeight = height + 'px';
        
        // Ajuster la transform pour l'état étendu
        box.style.transform = 'translateY(0px)';
        
        // Réinitialiser la hauteur max après l'animation
        setTimeout(() => {
            if (box.classList.contains('expanded')) {
                details.style.maxHeight = 'none';
            }
        }, 300);
        
        if (window.announceMessage) {
            window.announceMessage(window.SiteI18n ? window.SiteI18n.t('a11y.section_opened') : 'Section étendue, plus de détails disponibles');
        }
    }
    
    // Effet visuel lors du clic
    box.style.boxShadow = '0 8px 25px rgba(37, 99, 235, 0.15)';
    setTimeout(() => {
        box.style.boxShadow = '';
    }, 200);
}

// Fonction pour fermer toutes les boîtes étendues (utile pour mobile)
function collapseAllExpandableBoxes() {
    const expandedBoxes = document.querySelectorAll('.cv-timeline-content.expanded, .project-card.expanded, .document-card.expanded');
    expandedBoxes.forEach(box => {
        if (box.classList.contains('expanded')) {
            toggleExpandableBox(box);
        }
    });
}

// Fonction pour étendre toutes les boîtes (pour impression par exemple)
function expandAllBoxesForPrint() {
    const expandableBoxes = document.querySelectorAll('.cv-timeline-content.expandable, .project-card.expandable, .document-card.expandable');
    expandableBoxes.forEach(box => {
        if (!box.classList.contains('expanded')) {
            box.classList.add('expanded');
            const details = box.querySelector('.cv-timeline-details, .project-details, .document-details');
            if (details) {
                details.style.maxHeight = 'none';
            }
        }
    });
}

// Ajouter un gestionnaire pour l'impression
window.addEventListener('beforeprint', expandAllBoxesForPrint);

// ======================================
// FONCTIONNALITÉS SPÉCIFIQUES AUX PAGES
// ======================================

// Fonctions pour la page documents (simulations de téléchargement)
function simulateDownload(filename, button) {
    if (!button) return;
    
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="btn-icon">⏳</span> Préparation...';
    
    // Simulation d'un délai de téléchargement
    setTimeout(() => {
        button.innerHTML = '<span class="btn-icon">✅</span> Téléchargé !';
        if (window.announceMessage) {
            window.announceMessage(`${filename} téléchargé avec succès`);
        }
        
        setTimeout(() => {
            button.disabled = false;
            button.innerHTML = originalText;
        }, 2000);
    }, 1500);
}

// Gestionnaire d'erreurs globales
window.addEventListener('error', function(event) {
    console.error('Erreur JavaScript:', event.error);
    if (window.announceMessage) {
        window.announceMessage('Une erreur s\'est produite. Veuillez rafraîchir la page.');
    }
});

// ======================================
// UTILS ET HELPERS
// ======================================

// Debounce pour optimiser les événements de scroll/resize
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle pour les événements fréquents
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Vérifier si un élément est visible
function isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
}

// ======================================
// STYLES CSS DYNAMIQUES
// ======================================

// Ajouter les styles pour les animations
const animationStyles = `
    .animate-ready {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease, transform 0.6s ease;
    }
    
    .animate-in {
        opacity: 1;
        transform: translateY(0);
    }
    
    .header.scrolled {
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 2px 20px rgba(0, 0, 0, 0.1);
    }
    
    @media (prefers-reduced-motion: reduce) {
        .animate-ready,
        .animate-in {
            animation: none !important;
            transition: none !important;
            opacity: 1 !important;
            transform: none !important;
        }
    }
`;

// Injecter les styles
const styleSheet = document.createElement('style');
styleSheet.textContent = animationStyles;
document.head.appendChild(styleSheet);

// ======================================
// PERFORMANCE ET DIAGNOSTICS
// ======================================

// Mesurer les performances de base
if ('performance' in window) {
    window.addEventListener('load', function() {
        setTimeout(() => {
            const perfData = {
                loadTime: Math.round(performance.now()),
                domReady: document.readyState,
                resources: performance.getEntriesByType('resource').length
            };
            console.log('Performance metrics:', perfData);
        }, 0);
    });
}

// Service Worker pour la mise en cache (optionnel, pour plus tard)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        // Possibilité d'ajouter un service worker plus tard
        console.log('Service Worker support detected');
    });
}
