// Demo Page - JavaScript pour la démonstration interactive

// Variables globales pour la démonstration
let mainChart = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    data: {
        real: [],
        virtual: [],
        prediction: [],
        uncertainty: [],
        timestamps: []
    },
    interaction: {
        isResizing: false,
        isPanning: false,
        isFullscreen: false,
        panStart: { x: 0, y: 0 },
        viewOffset: { x: 0, y: 0 },
        zoomLevel: 1
    }
};

let secondaryChart = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    data: {
        temperature: [],
        pressure: [],
        vibration: [],
        flow: [],
        timestamps: []
    },
    interaction: {
        isResizing: false,
        isPanning: false,
        isFullscreen: false,
        panStart: { x: 0, y: 0 },
        viewOffset: { x: 0, y: 0 },
        zoomLevel: 1
    }
};

let demoSettings = {
    noiseLevel: 20,
    uncertaintyRange: 15,
    signalFrequency: 3,
    timeWindow: 60,
    predictionHorizon: 10,
    verticalZoom: 100,
    timelinePosition: 100,
    syncCharts: true
};

let demoAnimation = {
    isRunning: true,
    lastTime: 0,
    currentTime: 0
};

// Initialisation de la démonstration
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, initializing demo...');
    
    // Vérifier que les éléments existent
    const mainCanvas = document.getElementById('virtualSensorChart');
    const secondaryCanvas = document.getElementById('machineDataChart');
    
    console.log('Main canvas found:', !!mainCanvas);
    console.log('Secondary canvas found:', !!secondaryCanvas);
    
    // Attendre que les éléments soient disponibles
    setTimeout(() => {
        try {
            initializeDemo();
            initializeDemoControls();
            initializeChartInteractions();
            initializeResizing();
            
            // Forcer un premier rendu
            setTimeout(() => {
                console.log('🎬 Starting animation...');
                startDemoAnimation();
            }, 100);
            
            console.log('✅ Demo interactive initialized');
        } catch (error) {
            console.error('❌ Error initializing demo:', error);
        }
    }, 100);
});

// ======================================
// INITIALISATION
// ======================================

function initializeDemo() {
    console.log('Initializing demo...');
    
    // Initialiser le graphique principal (capteur virtuel)
    mainChart.canvas = document.getElementById('virtualSensorChart');
    if (!mainChart.canvas) {
        console.error('Main canvas not found!');
        return;
    }
    
    mainChart.ctx = mainChart.canvas.getContext('2d');
    if (!mainChart.ctx) {
        console.error('Main canvas context not available!');
        return;
    }
    
    // Initialiser le graphique secondaire (données machine)
    secondaryChart.canvas = document.getElementById('machineDataChart');
    if (!secondaryChart.canvas) {
        console.error('Secondary canvas not found!');
        return;
    }
    
    secondaryChart.ctx = secondaryChart.canvas.getContext('2d');
    if (!secondaryChart.ctx) {
        console.error('Secondary canvas context not available!');
        return;
    }
    
    console.log('Both canvases found');
    
    // Définir les tailles initiales
    updateCanvasSizes();
    
    // Générer les données initiales
    generateInitialData();
    generateMachineData();
    
    console.log('Generated data for both charts');
    
    // Test de rendu immédiat
    setTimeout(() => {
        console.log('Testing initial render...');
        drawMainChart();
        drawSecondaryChart();
    }, 50);
    
    // Configurer les événements de redimensionnement
    window.addEventListener('resize', updateCanvasSizes);
}

function updateCanvasSizes() {
    updateCanvasSize('main');
    updateCanvasSize('secondary');
}

function updateCanvasSize(chartType) {
    let chart, containerId;
    
    if (chartType === 'main') {
        chart = mainChart;
        containerId = 'mainChartContainer';
    } else {
        chart = secondaryChart;
        containerId = 'secondaryChartContainer';
    }
    
    const container = document.getElementById(containerId);
    if (!container || !chart.canvas) return;
    
    const rect = container.getBoundingClientRect();
    const padding = 40; // Padding interne
    
    chart.width = Math.max(300, rect.width - padding);
    chart.height = Math.max(200, rect.height - padding);
    
    // Définir la résolution du canvas
    const dpr = window.devicePixelRatio || 1;
    chart.canvas.width = chart.width * dpr;
    chart.canvas.height = chart.height * dpr;
    
    // Définir la taille d'affichage
    chart.canvas.style.width = chart.width + 'px';
    chart.canvas.style.height = chart.height + 'px';
    
    // Ajuster le contexte pour la haute résolution
    chart.ctx.scale(dpr, dpr);
    
    console.log(`${chartType} canvas resized:`, chart.width, 'x', chart.height);
}

function generateInitialData() {
    const timePoints = demoSettings.timeWindow * 10; // 10 points par seconde
    const currentTime = Date.now();
    
    mainChart.data = {
        real: [],
        virtual: [],
        prediction: [],
        uncertainty: [],
        timestamps: []
    };
    
    for (let i = 0; i < timePoints; i++) {
        const t = i / 10; // Temps en secondes
        const timestamp = currentTime - (timePoints - i) * 100; // 100ms par point
        
        // Signal réel avec bruit (amplitude plus importante pour visibilité)
        const baseSignal = Math.sin(t * demoSettings.signalFrequency * 0.2) * 0.8 + 
                          Math.cos(t * 0.1) * 0.3 + 
                          Math.sin(t * 0.05) * 0.2;
        
        const noise = (Math.random() - 0.5) * (demoSettings.noiseLevel / 100) * 0.5;
        const realValue = baseSignal + noise;
        
        // Capteur virtuel (légèrement filtré)
        const virtualValue = baseSignal * 0.95 + noise * 0.3 + (Math.random() - 0.5) * 0.05;
        
        // Prédiction (basée sur la tendance)
        const futureT = t + 1;
        const predictionValue = Math.sin(futureT * demoSettings.signalFrequency * 0.2) * 0.7 + 
                               Math.cos(futureT * 0.1) * 0.25;
        
        // Incertitude
        const uncertaintyValue = (demoSettings.uncertaintyRange / 100) * (0.1 + Math.random() * 0.1);
        
        mainChart.data.real.push(realValue);
        mainChart.data.virtual.push(virtualValue);
        mainChart.data.prediction.push(predictionValue);
        mainChart.data.uncertainty.push(uncertaintyValue);
        mainChart.data.timestamps.push(timestamp);
    }
}

function generateMachineData() {
    const timePoints = demoSettings.timeWindow * 10; // 10 points par seconde
    const currentTime = Date.now();
    
    secondaryChart.data = {
        temperature: [],
        pressure: [],
        vibration: [],
        flow: [],
        timestamps: []
    };
    
    for (let i = 0; i < timePoints; i++) {
        const t = i / 10; // Temps en secondes
        const timestamp = currentTime - (timePoints - i) * 100; // 100ms par point
        
        // Température (80-120°C avec variations lentes)
        const tempBase = 100 + Math.sin(t * 0.05) * 15 + Math.cos(t * 0.02) * 5;
        const temperature = tempBase + (Math.random() - 0.5) * 3;
        
        // Pression (5-15 bar avec variations moyennes)
        const pressBase = 10 + Math.sin(t * 0.1) * 3 + Math.cos(t * 0.03) * 2;
        const pressure = pressBase + (Math.random() - 0.5) * 0.5;
        
        // Vibration (0-50 Hz avec pics occasionnels)
        const vibBase = 20 + Math.sin(t * 0.3) * 10 + Math.random() * 15;
        const vibration = Math.max(0, vibBase + (Math.random() - 0.5) * 8);
        
        // Débit (100-200 L/min avec variations rapides)
        const flowBase = 150 + Math.sin(t * 0.2) * 30 + Math.cos(t * 0.15) * 20;
        const flow = flowBase + (Math.random() - 0.5) * 10;
        
        secondaryChart.data.temperature.push(temperature);
        secondaryChart.data.pressure.push(pressure);
        secondaryChart.data.vibration.push(vibration);
        secondaryChart.data.flow.push(flow);
        secondaryChart.data.timestamps.push(timestamp);
    }
}

// ======================================
// CONTRÔLES INTERACTIFS
// ======================================

function initializeDemoControls() {
    // Sliders de paramètres
    const controls = {
        noiseLevel: document.getElementById('noiseLevel'),
        uncertaintyRange: document.getElementById('uncertaintyRange'),
        signalFrequency: document.getElementById('signalFrequency'),
        timeWindow: document.getElementById('timeWindow'),
        predictionHorizon: document.getElementById('predictionHorizon'),
        timelineSlider: document.getElementById('timelineSlider'),
        verticalZoom: document.getElementById('verticalZoom')
    };
    
    // Valeurs affichées
    const values = {
        noiseValue: document.getElementById('noiseValue'),
        uncertaintyValue: document.getElementById('uncertaintyValue'),
        frequencyValue: document.getElementById('frequencyValue'),
        timeValue: document.getElementById('timeValue'),
        horizonValue: document.getElementById('horizonValue'),
        zoomValue: document.getElementById('zoomValue')
    };
    
    // Événements des sliders
    Object.keys(controls).forEach(key => {
        const control = controls[key];
        if (!control) return;
        
        control.addEventListener('input', function() {
            const value = parseFloat(this.value);
            demoChart.settings[key] = value;
            
            // Mettre à jour l'affichage
            updateControlDisplay(key, value, values);
            
            // Régénérer les données si nécessaire
            if (['noiseLevel', 'uncertaintyRange', 'signalFrequency', 'timeWindow'].includes(key)) {
                generateInitialData();
            }
        });
    });
    
    // Boutons de contrôle
    document.getElementById('resetBtn')?.addEventListener('click', resetDemo);
    document.getElementById('pauseBtn')?.addEventListener('click', togglePause);
    document.getElementById('exportBtn')?.addEventListener('click', exportData);
    
    // Boutons de la barre d'outils
    document.getElementById('zoomInBtn')?.addEventListener('click', () => zoomChart(1.2));
    document.getElementById('zoomOutBtn')?.addEventListener('click', () => zoomChart(0.8));
    document.getElementById('panBtn')?.addEventListener('click', togglePanMode);
    document.getElementById('fullscreenBtn')?.addEventListener('click', toggleFullscreen);
}

function updateControlDisplay(key, value, values) {
    const formatters = {
        noiseLevel: (v) => `${v}%`,
        uncertaintyRange: (v) => `${v}%`,
        signalFrequency: (v) => `${v} Hz`,
        timeWindow: (v) => `${v}s`,
        predictionHorizon: (v) => `${v}s`,
        verticalZoom: (v) => `${v}%`
    };
    
    const valueElements = {
        noiseLevel: values.noiseValue,
        uncertaintyRange: values.uncertaintyValue,
        signalFrequency: values.frequencyValue,
        timeWindow: values.timeValue,
        predictionHorizon: values.horizonValue,
        verticalZoom: values.zoomValue
    };
    
    const element = valueElements[key];
    const formatter = formatters[key];
    
    if (element && formatter) {
        element.textContent = formatter(value);
    }
}

// ======================================
// INTERACTIONS GRAPHIQUE
// ======================================

function initializeChartInteractions() {
    const canvas = demoChart.canvas;
    if (!canvas) return;
    
    // Événements de souris
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    
    // Événements tactiles pour mobile
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);
}

function handleMouseDown(e) {
    const rect = demoChart.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (demoChart.interaction.isPanning) {
        demoChart.interaction.panStart = { x, y };
        demoChart.canvas.style.cursor = 'grabbing';
    }
}

function handleMouseMove(e) {
    const rect = demoChart.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Mise à jour de l'overlay d'information
    updateChartOverlay(x, y);
    
    if (demoChart.interaction.isPanning && demoChart.interaction.panStart) {
        const deltaX = x - demoChart.interaction.panStart.x;
        const deltaY = y - demoChart.interaction.panStart.y;
        
        demoChart.interaction.viewOffset.x += deltaX;
        demoChart.interaction.viewOffset.y += deltaY;
        
        demoChart.interaction.panStart = { x, y };
    }
}

function handleMouseUp() {
    demoChart.interaction.panStart = null;
    if (demoChart.interaction.isPanning) {
        demoChart.canvas.style.cursor = 'grab';
    } else {
        demoChart.canvas.style.cursor = 'default';
    }
}

function handleWheel(e) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomChart(zoomFactor);
}

function handleMouseLeave() {
    demoChart.interaction.panStart = null;
    demoChart.canvas.style.cursor = 'default';
}

function updateChartOverlay(mouseX, mouseY) {
    const overlay = document.getElementById('chartOverlay');
    if (!overlay) return;
    
    // Calculer la position dans les données
    const dataIndex = Math.floor((mouseX / demoChart.width) * demoChart.data.real.length);
    
    if (dataIndex >= 0 && dataIndex < demoChart.data.real.length) {
        const timestamp = new Date(demoChart.data.timestamps[dataIndex]);
        const realValue = demoChart.data.real[dataIndex];
        const virtualValue = demoChart.data.virtual[dataIndex];
        const predictionValue = demoChart.data.prediction[dataIndex];
        
        document.getElementById('overlayTime').textContent = timestamp.toLocaleTimeString();
        document.getElementById('realValue').textContent = realValue.toFixed(3);
        document.getElementById('virtualValue').textContent = virtualValue.toFixed(3);
        document.getElementById('predictionValue').textContent = predictionValue.toFixed(3);
    }
}

// ======================================
// FONCTIONS DE CONTRÔLE
// ======================================

function resetDemo() {
    // Réinitialiser les paramètres
    demoChart.settings = {
        noiseLevel: 20,
        uncertaintyRange: 15,
        signalFrequency: 3,
        timeWindow: 60,
        predictionHorizon: 10,
        verticalZoom: 100,
        timelinePosition: 100
    };
    
    // Réinitialiser les sliders
    document.getElementById('noiseLevel').value = 20;
    document.getElementById('uncertaintyRange').value = 15;
    document.getElementById('signalFrequency').value = 3;
    document.getElementById('timeWindow').value = 60;
    document.getElementById('predictionHorizon').value = 10;
    document.getElementById('verticalZoom').value = 100;
    
    // Mettre à jour les affichages
    document.getElementById('noiseValue').textContent = '20%';
    document.getElementById('uncertaintyValue').textContent = '15%';
    document.getElementById('frequencyValue').textContent = '3 Hz';
    document.getElementById('timeValue').textContent = '60s';
    document.getElementById('horizonValue').textContent = '10s';
    document.getElementById('zoomValue').textContent = '100%';
    
    // Régénérer les données
    generateInitialData();
    
    // Réinitialiser la vue
    demoChart.interaction.viewOffset = { x: 0, y: 0 };
    demoChart.interaction.zoomLevel = 1;
}

function togglePause() {
    const btn = document.getElementById('pauseBtn');
    if (demoChart.animation.isRunning) {
        demoChart.animation.isRunning = false;
        btn.textContent = 'Reprendre';
        btn.classList.add('active');
    } else {
        demoChart.animation.isRunning = true;
        btn.textContent = 'Pause';
        btn.classList.remove('active');
    }
}

function exportData() {
    const data = {
        timestamp: new Date().toISOString(),
        settings: demoChart.settings,
        data: demoChart.data
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `datasight-demo-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function zoomChart(factor) {
    demoChart.interaction.zoomLevel *= factor;
    demoChart.interaction.zoomLevel = Math.max(0.5, Math.min(5, demoChart.interaction.zoomLevel));
}

function togglePanMode() {
    const btn = document.getElementById('panBtn');
    demoChart.interaction.isPanning = !demoChart.interaction.isPanning;
    
    if (demoChart.interaction.isPanning) {
        btn.classList.add('active');
        demoChart.canvas.style.cursor = 'grab';
    } else {
        btn.classList.remove('active');
        demoChart.canvas.style.cursor = 'default';
    }
}

function toggleFullscreen() {
    const container = document.getElementById('chartContainer');
    const btn = document.getElementById('fullscreenBtn');
    
    demoChart.interaction.isFullscreen = !demoChart.interaction.isFullscreen;
    
    if (demoChart.interaction.isFullscreen) {
        container.classList.add('fullscreen');
        btn.classList.add('active');
        btn.textContent = '⛶';
    } else {
        container.classList.remove('fullscreen');
        btn.classList.remove('active');
        btn.textContent = '⛶';
    }
    
    setTimeout(updateCanvasSize, 100);
}

// ======================================
// REDIMENSIONNEMENT
// ======================================

function initializeResizing() {
    const container = document.getElementById('chartContainer');
    const handles = container.querySelectorAll('.resize-handle');
    
    handles.forEach(handle => {
        handle.addEventListener('mousedown', startResize);
    });
}

function startResize(e) {
    e.preventDefault();
    demoChart.interaction.isResizing = true;
    
    const container = document.getElementById('chartContainer');
    const direction = e.target.dataset.direction;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = container.offsetWidth;
    const startHeight = container.offsetHeight;
    
    function resize(e) {
        if (!demoChart.interaction.isResizing) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        
        if (direction.includes('e')) {
            newWidth = Math.max(400, startWidth + deltaX);
        }
        if (direction.includes('s')) {
            newHeight = Math.max(300, startHeight + deltaY);
        }
        
        container.style.width = newWidth + 'px';
        container.style.height = newHeight + 'px';
        
        updateCanvasSize();
    }
    
    function stopResize() {
        demoChart.interaction.isResizing = false;
        document.removeEventListener('mousemove', resize);
        document.removeEventListener('mouseup', stopResize);
    }
    
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResize);
}

// ======================================
// RENDU DU GRAPHIQUE
// ======================================

function drawMainChart() {
    const chart = mainChart;
    const ctx = chart.ctx;
    if (!ctx || chart.width <= 0 || chart.height <= 0) {
        console.warn('Main canvas not ready:', chart.width, chart.height);
        return;
    }
    
    // Sauvegarder l'état du contexte
    ctx.save();
    
    // Effacer le canvas
    ctx.clearRect(0, 0, chart.width, chart.height);
    
    // Fond du graphique
    const gradient = ctx.createLinearGradient(0, 0, 0, chart.height);
    gradient.addColorStop(0, 'rgba(0, 212, 255, 0.05)');
    gradient.addColorStop(1, 'rgba(124, 58, 237, 0.05)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, chart.width, chart.height);
    
    // Grille
    drawGrid(ctx, chart);
    
    // Données du capteur virtuel
    if (chart.data.real.length > 0) {
        drawVirtualSensorData(ctx, chart);
    } else {
        // Afficher un message si pas de données
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Génération des données...', chart.width / 2, chart.height / 2);
    }
    
    // Axes et labels
    drawAxes(ctx, chart, 'Capteur Virtuel');
    
    // Restaurer l'état du contexte
    ctx.restore();
}

function drawSecondaryChart() {
    const chart = secondaryChart;
    const ctx = chart.ctx;
    if (!ctx || chart.width <= 0 || chart.height <= 0) {
        console.warn('Secondary canvas not ready:', chart.width, chart.height);
        return;
    }
    
    // Sauvegarder l'état du contexte
    ctx.save();
    
    // Effacer le canvas
    ctx.clearRect(0, 0, chart.width, chart.height);
    
    // Fond du graphique
    const gradient = ctx.createLinearGradient(0, 0, 0, chart.height);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.05)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.05)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, chart.width, chart.height);
    
    // Grille
    drawGrid(ctx, chart);
    
    // Données machine
    if (chart.data.temperature.length > 0) {
        drawMachineData(ctx, chart);
    } else {
        // Afficher un message si pas de données
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Génération des données machine...', chart.width / 2, chart.height / 2);
    }
    
    // Axes et labels
    drawAxes(ctx, chart, 'Données Machine');
    
    // Restaurer l'état du contexte
    ctx.restore();
}

function drawGrid(ctx, chart) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Lignes horizontales
    for (let i = 0; i <= 10; i++) {
        const y = (chart.height / 10) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chart.width, y);
        ctx.stroke();
    }
    
    // Lignes verticales
    for (let i = 0; i <= 20; i++) {
        const x = (chart.width / 20) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, chart.height);
        ctx.stroke();
    }
}

function drawVirtualSensorData(ctx, chart) {
    const dataLength = chart.data.real.length;
    if (dataLength === 0) {
        console.log('No virtual sensor data to draw');
        return;
    }
    
    const zoomLevel = chart.interaction.zoomLevel || 1;
    const verticalZoom = demoSettings.verticalZoom / 100;
    
    // Calculer la plage visible (afficher toutes les données par défaut)
    const visibleStart = 0;
    const visibleEnd = dataLength;
    
    console.log('Drawing virtual sensor data:', dataLength, 'points');
    
    // Dessiner les bandes d'incertitude d'abord
    drawUncertaintyBands(ctx, chart, visibleStart, visibleEnd, verticalZoom);
    
    // Dessiner les signaux du capteur virtuel
    const signals = [
        { data: chart.data.real, color: '#00d4ff', width: 3, name: 'real' },
        { data: chart.data.virtual, color: '#7c3aed', width: 3, name: 'virtual' },
        { data: chart.data.prediction, color: '#f59e0b', width: 2, name: 'prediction' }
    ];
    
    signals.forEach(signal => {
        drawSignalLine(ctx, chart, signal.data, signal.color, signal.width, visibleStart, visibleEnd, verticalZoom);
    });
}

function drawMachineData(ctx, chart) {
    const dataLength = chart.data.temperature.length;
    if (dataLength === 0) {
        console.log('No machine data to draw');
        return;
    }
    
    const zoomLevel = chart.interaction.zoomLevel || 1;
    const verticalZoom = demoSettings.verticalZoom / 100;
    
    // Calculer la plage visible
    const visibleStart = 0;
    const visibleEnd = dataLength;
    
    console.log('Drawing machine data:', dataLength, 'points');
    
    // Normaliser et dessiner les données machine (différentes échelles)
    const machineSignals = [
        { data: chart.data.temperature, color: '#10b981', width: 2, name: 'temperature', scale: { min: 80, max: 120 } },
        { data: chart.data.pressure, color: '#ef4444', width: 2, name: 'pressure', scale: { min: 5, max: 15 } },
        { data: chart.data.vibration, color: '#8b5cf6', width: 2, name: 'vibration', scale: { min: 0, max: 50 } },
        { data: chart.data.flow, color: '#f59e0b', width: 2, name: 'flow', scale: { min: 100, max: 200 } }
    ];
    
    machineSignals.forEach(signal => {
        drawMachineSignalLine(ctx, chart, signal.data, signal.color, signal.width, signal.scale, visibleStart, visibleEnd, verticalZoom);
    });
}

function drawUncertaintyBands(ctx, chart, start, end, verticalZoom) {
    ctx.fillStyle = 'rgba(124, 58, 237, 0.2)';
    ctx.beginPath();
    
    // Bande supérieure
    for (let i = start; i < end; i++) {
        const x = (i / (end - 1)) * chart.width;
        const value = chart.data.virtual[i] + chart.data.uncertainty[i];
        const y = chart.height/2 - (value * verticalZoom * chart.height/3);
        
        if (i === start) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    
    // Bande inférieure (en sens inverse)
    for (let i = end - 1; i >= start; i--) {
        const x = (i / (end - 1)) * chart.width;
        const value = chart.data.virtual[i] - chart.data.uncertainty[i];
        const y = chart.height/2 - (value * verticalZoom * chart.height/3);
        
        ctx.lineTo(x, y);
    }
    
    ctx.closePath();
    ctx.fill();
}

function drawSignalLine(ctx, chart, data, color, width, start, end, verticalZoom) {
    if (!data || data.length === 0) return;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    let hasMoveTo = false;
    
    for (let i = start; i < end && i < data.length; i++) {
        const x = (i / (end - 1)) * chart.width;
        const normalizedValue = data[i] * verticalZoom;
        const y = chart.height/2 - (normalizedValue * chart.height/3);
        
        // S'assurer que y est dans les limites du canvas
        const clampedY = Math.max(0, Math.min(chart.height, y));
        
        if (!hasMoveTo) {
            ctx.moveTo(x, clampedY);
            hasMoveTo = true;
        } else {
            ctx.lineTo(x, clampedY);
        }
    }
    
    ctx.stroke();
}

function drawMachineSignalLine(ctx, chart, data, color, width, scale, start, end, verticalZoom) {
    if (!data || data.length === 0) return;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    
    let hasMoveTo = false;
    
    for (let i = start; i < end && i < data.length; i++) {
        const x = (i / (end - 1)) * chart.width;
        
        // Normaliser la valeur selon l'échelle spécifique
        const normalizedValue = (data[i] - scale.min) / (scale.max - scale.min);
        const scaledValue = (normalizedValue - 0.5) * 2; // Centrer autour de 0
        const y = chart.height/2 - (scaledValue * verticalZoom * chart.height/3);
        
        // S'assurer que y est dans les limites du canvas
        const clampedY = Math.max(0, Math.min(chart.height, y));
        
        if (!hasMoveTo) {
            ctx.moveTo(x, clampedY);
            hasMoveTo = true;
        } else {
            ctx.lineTo(x, clampedY);
        }
    }
    
    ctx.stroke();
}

function drawAxes(ctx, chart, title) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    
    // Axe horizontal (temps)
    ctx.beginPath();
    ctx.moveTo(0, chart.height/2);
    ctx.lineTo(chart.width, chart.height/2);
    ctx.stroke();
    
    // Labels de temps
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    
    for (let i = 0; i <= 4; i++) {
        const x = (chart.width / 4) * i;
        const timeOffset = (demoSettings.timeWindow / 4) * i;
        const label = `-${demoSettings.timeWindow - timeOffset}s`;
        ctx.fillText(label, x, chart.height - 10);
    }
    
    // Titre du graphique
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(title, 10, 20);
}

// ======================================
// ANIMATION ET MISE À JOUR
// ======================================

function startDemoAnimation() {
    function animate(currentTime) {
        if (demoAnimation.isRunning) {
            // Ajouter de nouveaux points de données
            if (currentTime - demoAnimation.lastTime > 100) { // 10 FPS
                updateDataPoints();
                updateMetrics();
                demoAnimation.lastTime = currentTime;
            }
        }
        
        // Dessiner les deux graphiques
        drawMainChart();
        drawSecondaryChart();
        requestAnimationFrame(animate);
    }
    
    requestAnimationFrame(animate);
}

function updateDataPoints() {
    const currentTime = Date.now();
    const t = mainChart.data.real.length / 10; // Temps en secondes
    
    // Nouveau point de données pour le capteur virtuel
    const baseSignal = Math.sin(t * demoSettings.signalFrequency * 0.2) * 0.8 + 
                      Math.cos(t * 0.1) * 0.3 + 
                      Math.sin(t * 0.05) * 0.2;
    
    const noise = (Math.random() - 0.5) * (demoSettings.noiseLevel / 100) * 0.5;
    const realValue = baseSignal + noise;
    const virtualValue = baseSignal * 0.95 + noise * 0.3 + (Math.random() - 0.5) * 0.05;
    const futureT = t + 1;
    const predictionValue = Math.sin(futureT * demoSettings.signalFrequency * 0.2) * 0.7 + 
                           Math.cos(futureT * 0.1) * 0.25;
    const uncertaintyValue = (demoSettings.uncertaintyRange / 100) * (0.1 + Math.random() * 0.1);
    
    // Ajouter les nouveaux points au graphique principal
    mainChart.data.real.push(realValue);
    mainChart.data.virtual.push(virtualValue);
    mainChart.data.prediction.push(predictionValue);
    mainChart.data.uncertainty.push(uncertaintyValue);
    mainChart.data.timestamps.push(currentTime);
    
    // Nouveau point de données pour les données machine
    const tempBase = 100 + Math.sin(t * 0.05) * 15 + Math.cos(t * 0.02) * 5;
    const temperature = tempBase + (Math.random() - 0.5) * 3;
    
    const pressBase = 10 + Math.sin(t * 0.1) * 3 + Math.cos(t * 0.03) * 2;
    const pressure = pressBase + (Math.random() - 0.5) * 0.5;
    
    const vibBase = 20 + Math.sin(t * 0.3) * 10 + Math.random() * 15;
    const vibration = Math.max(0, vibBase + (Math.random() - 0.5) * 8);
    
    const flowBase = 150 + Math.sin(t * 0.2) * 30 + Math.cos(t * 0.15) * 20;
    const flow = flowBase + (Math.random() - 0.5) * 10;
    
    // Ajouter les nouveaux points au graphique secondaire
    secondaryChart.data.temperature.push(temperature);
    secondaryChart.data.pressure.push(pressure);
    secondaryChart.data.vibration.push(vibration);
    secondaryChart.data.flow.push(flow);
    secondaryChart.data.timestamps.push(currentTime);
    
    // Maintenir la taille de la fenêtre pour les deux graphiques
    const maxPoints = demoSettings.timeWindow * 10;
    
    if (mainChart.data.real.length > maxPoints) {
        mainChart.data.real.shift();
        mainChart.data.virtual.shift();
        mainChart.data.prediction.shift();
        mainChart.data.uncertainty.shift();
        mainChart.data.timestamps.shift();
    }
    
    if (secondaryChart.data.temperature.length > maxPoints) {
        secondaryChart.data.temperature.shift();
        secondaryChart.data.pressure.shift();
        secondaryChart.data.vibration.shift();
        secondaryChart.data.flow.shift();
        secondaryChart.data.timestamps.shift();
    }
}

function updateMetrics() {
    // Calculer les métriques en temps réel
    const recentData = mainChart.data.real.slice(-50); // 50 derniers points
    const recentVirtual = mainChart.data.virtual.slice(-50);
    
    if (recentData.length > 0) {
        // Précision (corrélation)
        const correlation = calculateCorrelation(recentData, recentVirtual);
        const accuracy = Math.max(0, Math.min(100, correlation * 100));
        
        // Latence simulée
        const latency = 40 + Math.random() * 20;
        
        // Confiance basée sur l'incertitude
        const avgUncertainty = mainChart.data.uncertainty.slice(-10).reduce((a, b) => a + b, 0) / 10;
        const confidence = Math.max(0, Math.min(100, (1 - avgUncertainty) * 100));
        
        // Mettre à jour l'affichage
        document.getElementById('accuracyMetric').textContent = accuracy.toFixed(1) + '%';
        document.getElementById('latencyMetric').textContent = Math.round(latency) + 'ms';
        document.getElementById('confidenceMetric').textContent = confidence.toFixed(1) + '%';
        
        // Statistiques d'analyse
        const errors = recentData.map((real, i) => Math.abs(real - recentVirtual[i]));
        const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
        const maxError = Math.max(...errors);
        
        document.getElementById('meanError').textContent = (meanError * 100).toFixed(1) + '%';
        document.getElementById('maxError').textContent = (maxError * 100).toFixed(1) + '%';
        document.getElementById('correlation').textContent = correlation.toFixed(2);
        document.getElementById('reliability').textContent = (95 + Math.random() * 5).toFixed(1) + '%';
    }
}

function calculateCorrelation(x, y) {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;
    
    const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
    const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
    const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
}

// ======================================
// GRAPHIQUE DE DISTRIBUTION DES ERREURS
// ======================================

function initializeErrorDistribution() {
    const canvas = document.getElementById('errorDistribution');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    function drawErrorDistribution() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Simuler une distribution normale des erreurs
        const bins = 20;
        const binWidth = canvas.width / bins;
        const maxHeight = canvas.height * 0.8;
        
        ctx.fillStyle = 'rgba(0, 212, 255, 0.6)';
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 2;
        
        for (let i = 0; i < bins; i++) {
            const x = i * binWidth;
            const normalizedPos = (i - bins/2) / (bins/4);
            const height = maxHeight * Math.exp(-normalizedPos * normalizedPos / 2);
            const y = canvas.height - height;
            
            ctx.fillRect(x, y, binWidth - 2, height);
            ctx.strokeRect(x, y, binWidth - 2, height);
        }
        
        // Ligne de moyenne
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(canvas.width/2, 0);
        ctx.lineTo(canvas.width/2, canvas.height);
        ctx.stroke();
    }
    
    drawErrorDistribution();
    setInterval(drawErrorDistribution, 2000); // Mise à jour toutes les 2 secondes
}

// Initialiser le graphique de distribution
setTimeout(initializeErrorDistribution, 1000);

console.log('🚀 Demo interactive ready! Resize the chart, adjust parameters, and explore the virtual sensor data.');
