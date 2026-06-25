// DataSight Technologies - JavaScript Interactions et Visualisations

// Variables globales
let particles = [];
let animationId;

// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', function() {
    initializeParticles();
    initializeSignalVisualization();
    initializePerformanceChart();
    initializeScrollEffects();
    initializeCounterAnimations();
    initializeParallaxEffects();
    initializeNavigation();
    console.log('DataSight Technologies initialized');
});

// ======================================
// SYSTÈME DE PARTICULES
// ======================================

function initializeParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 50;
    
    // Créer les particules
    for (let i = 0; i < particleCount; i++) {
        createParticle();
    }
    
    // Animer les particules
    animateParticles();
}

function createParticle() {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    // Position aléatoire
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight;
    
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    
    // Propriétés aléatoires
    const size = Math.random() * 3 + 1;
    const opacity = Math.random() * 0.8 + 0.2;
    const duration = Math.random() * 10 + 5;
    
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.opacity = opacity;
    particle.style.animationDuration = duration + 's';
    
    document.getElementById('particles').appendChild(particle);
    
    particles.push({
        element: particle,
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5
    });
}

function animateParticles() {
    particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Rebond sur les bords
        if (particle.x <= 0 || particle.x >= window.innerWidth) {
            particle.vx *= -1;
        }
        if (particle.y <= 0 || particle.y >= window.innerHeight) {
            particle.vy *= -1;
        }
        
        // Garder dans les limites
        particle.x = Math.max(0, Math.min(window.innerWidth, particle.x));
        particle.y = Math.max(0, Math.min(window.innerHeight, particle.y));
        
        particle.element.style.left = particle.x + 'px';
        particle.element.style.top = particle.y + 'px';
    });
    
    animationId = requestAnimationFrame(animateParticles);
}

// ======================================
// VISUALISATION DES SIGNAUX
// ======================================

function initializeSignalVisualization() {
    const canvas = document.getElementById('signalCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Configuration
    const timePoints = 200;
    const signals = 3;
    const colors = ['#00d4ff', '#7c3aed', '#f59e0b'];
    const signalNames = ['Capteur Réel', 'Capteur Virtuel', 'Prédiction'];
    
    // Générer des données de signal avec incertitude
    function generateSignalData() {
        const data = [];
        for (let s = 0; s < signals; s++) {
            const signal = [];
            const uncertainty = [];
            
            for (let i = 0; i < timePoints; i++) {
                const t = i / timePoints * 4 * Math.PI;
                const base = Math.sin(t + s * 0.5) * Math.cos(t * 0.3) + Math.sin(t * 2) * 0.3;
                const noise = (Math.random() - 0.5) * 0.2;
                const value = base + noise;
                
                // Bande d'incertitude
                const uncertaintyRange = 0.1 + Math.abs(Math.sin(t)) * 0.15;
                
                signal.push(value);
                uncertainty.push(uncertaintyRange);
            }
            
            data.push({ signal, uncertainty, color: colors[s], name: signalNames[s] });
        }
        return data;
    }
    
    // Dessiner le graphique
    function drawSignals() {
        ctx.clearRect(0, 0, width, height);
        
        // Fond du graphique
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(0, 212, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(124, 58, 237, 0.1)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Grille
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        // Lignes horizontales
        for (let i = 0; i <= 4; i++) {
            const y = (height / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Lignes verticales
        for (let i = 0; i <= 8; i++) {
            const x = (width / 8) * i;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        const signalData = generateSignalData();
        
        signalData.forEach((data, index) => {
            const { signal, uncertainty, color } = data;
            
            // Dessiner la bande d'incertitude
            ctx.fillStyle = color + '20'; // Transparence
            ctx.beginPath();
            
            // Partie supérieure de la bande
            for (let i = 0; i < timePoints; i++) {
                const x = (i / timePoints) * width;
                const y = height/2 - (signal[i] + uncertainty[i]) * height/4;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            
            // Partie inférieure de la bande (en sens inverse)
            for (let i = timePoints - 1; i >= 0; i--) {
                const x = (i / timePoints) * width;
                const y = height/2 - (signal[i] - uncertainty[i]) * height/4;
                ctx.lineTo(x, y);
            }
            
            ctx.closePath();
            ctx.fill();
            
            // Dessiner la ligne du signal
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            for (let i = 0; i < timePoints; i++) {
                const x = (i / timePoints) * width;
                const y = height/2 - signal[i] * height/4;
                
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            
            ctx.stroke();
        });
        
        // Légende
        ctx.font = '12px Inter';
        signalData.forEach((data, index) => {
            const x = 20;
            const y = 30 + index * 20;
            
            // Carré de couleur
            ctx.fillStyle = data.color;
            ctx.fillRect(x, y - 8, 12, 12);
            
            // Texte
            ctx.fillStyle = '#ffffff';
            ctx.fillText(data.name, x + 20, y + 2);
        });
    }
    
    // Animation continue
    function animateSignals() {
        drawSignals();
        setTimeout(() => requestAnimationFrame(animateSignals), 100);
    }
    
    animateSignals();
}

// ======================================
// GRAPHIQUE DE PERFORMANCE
// ======================================

function initializePerformanceChart() {
    const canvas = document.getElementById('performanceChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    function drawPerformanceChart() {
        ctx.clearRect(0, 0, width, height);
        
        // Fond
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Données de performance
        const metrics = [
            { label: 'Précision', value: 95, color: '#00d4ff' },
            { label: 'Rapidité', value: 88, color: '#7c3aed' },
            { label: 'Fiabilité', value: 92, color: '#f59e0b' },
            { label: 'Efficacité', value: 90, color: '#10b981' }
        ];
        
        const barWidth = width / (metrics.length * 1.5);
        const maxBarHeight = height * 0.7;
        
        metrics.forEach((metric, index) => {
            const x = (index + 0.5) * (width / metrics.length);
            const barHeight = (metric.value / 100) * maxBarHeight;
            const y = height - barHeight - 40;
            
            // Barre avec gradient
            const barGradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
            barGradient.addColorStop(0, metric.color);
            barGradient.addColorStop(1, metric.color + '60');
            
            ctx.fillStyle = barGradient;
            ctx.fillRect(x - barWidth/2, y, barWidth, barHeight);
            
            // Bordure brillante
            ctx.strokeStyle = metric.color;
            ctx.lineWidth = 2;
            ctx.strokeRect(x - barWidth/2, y, barWidth, barHeight);
            
            // Valeur
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText(metric.value + '%', x, y - 10);
            
            // Label
            ctx.font = '12px Inter';
            ctx.fillText(metric.label, x, height - 20);
        });
    }
    
    drawPerformanceChart();
}

// ======================================
// EFFETS DE SCROLL ET PARALLAXE
// ======================================

function initializeScrollEffects() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
            }
        });
    }, observerOptions);
    
    // Observer les éléments
    const animatedElements = document.querySelectorAll('.glass-card, .service-card, .process-step');
    animatedElements.forEach(el => observer.observe(el));
}

function initializeParallaxEffects() {
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll('[data-parallax]');
        
        parallaxElements.forEach(element => {
            const speed = element.dataset.parallax;
            const yPos = -(scrolled * speed);
            element.style.transform = `translateY(${yPos}px)`;
        });
    });
}

// ======================================
// ANIMATIONS DE COMPTEURS
// ======================================

function initializeCounterAnimations() {
    const counters = document.querySelectorAll('[data-target]');
    
    const observerOptions = {
        threshold: 0.5
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element) {
    const target = parseInt(element.getAttribute('data-target'));
    const duration = 2000;
    const step = target / (duration / 16);
    let current = 0;
    
    const timer = setInterval(() => {
        current += step;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current);
    }, 16);
}

// ======================================
// NAVIGATION FLUIDE
// ======================================

function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Effet de navigation au scroll
    window.addEventListener('scroll', function() {
        const nav = document.querySelector('.nav-glass');
        if (window.scrollY > 100) {
            nav.style.background = 'rgba(10, 10, 15, 0.95)';
        } else {
            nav.style.background = 'rgba(10, 10, 15, 0.8)';
        }
    });
}

// ======================================
// EFFETS INTERACTIFS
// ======================================

// Effet de glow sur les cartes
document.addEventListener('mousemove', function(e) {
    const cards = document.querySelectorAll('.glass-card');
    
    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const deltaX = (x - centerX) / centerX;
            const deltaY = (y - centerY) / centerY;
            
            card.style.transform = `perspective(1000px) rotateX(${deltaY * 5}deg) rotateY(${deltaX * 5}deg) translateZ(10px)`;
        } else {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
        }
    });
});

// Formulaire de contact
const contactForm = document.querySelector('.contact-form form');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Animation de soumission
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        submitBtn.textContent = 'Envoi en cours...';
        submitBtn.disabled = true;
        
        // Simulation d'envoi
        setTimeout(() => {
            submitBtn.textContent = 'Message envoyé !';
            submitBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            
            setTimeout(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                submitBtn.style.background = '';
                this.reset();
            }, 2000);
        }, 1500);
    });
}

// ======================================
// RESPONSIVE ET PERFORMANCE
// ======================================

// Optimisation pour mobile
function handleResize() {
    if (window.innerWidth <= 768) {
        // Réduire le nombre de particules sur mobile
        const particleElements = document.querySelectorAll('.particle');
        particleElements.forEach((particle, index) => {
            if (index > 20) {
                particle.style.display = 'none';
            }
        });
    }
}

window.addEventListener('resize', handleResize);
handleResize(); // Appel initial

// Pause des animations quand la page n'est pas visible
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
    } else {
        animateParticles();
    }
});

// ======================================
// EASTER EGGS ET INTERACTIONS AVANCÉES
// ======================================

// Konami Code pour activer des effets spéciaux
let konamiCode = [];
const konamiSequence = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65]; // ↑↑↓↓←→←→BA

document.addEventListener('keydown', function(e) {
    konamiCode.push(e.keyCode);
    if (konamiCode.length > konamiSequence.length) {
        konamiCode.shift();
    }
    
    if (JSON.stringify(konamiCode) === JSON.stringify(konamiSequence)) {
        activateSpecialEffects();
        konamiCode = [];
    }
});

function activateSpecialEffects() {
    // Effet Matrix sur les particules
    particles.forEach(particle => {
        particle.element.style.background = '#00ff00';
        particle.element.style.boxShadow = '0 0 10px #00ff00';
    });
    
    // Message secret
    const message = document.createElement('div');
    message.textContent = '🚀 Mode développeur activé ! 🚀';
    message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 255, 0, 0.1);
        color: #00ff00;
        padding: 2rem;
        border: 1px solid #00ff00;
        border-radius: 10px;
        z-index: 10000;
        font-family: 'JetBrains Mono', monospace;
        backdrop-filter: blur(20px);
    `;
    
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.remove();
        // Restaurer les couleurs normales
        particles.forEach(particle => {
            particle.element.style.background = '';
            particle.element.style.boxShadow = '';
        });
    }, 3000);
}

console.log('🚀 DataSight Technologies - Ready to transform your data into virtual sensors!');
console.log('💡 Tip: Try the Konami code for a surprise...');

