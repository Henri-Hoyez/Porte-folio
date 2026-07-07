(function () {
  'use strict';

  const DATA_BASE = '/blog/data/visualisation-courbes-apprentissage';

  const plotConfig = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    displaylogo: false,
  };

  const layoutBase = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: '#f8fafc',
    font: { family: 'Inter, sans-serif', color: '#1e293b' },
    margin: { t: 40, r: 20, b: 50, l: 60 },
    hovermode: 'x unified',
    autosize: true,
  };

  const OPTIMIZER_COLORS = {
    Adam: '#2563eb',
    SGD: '#10b981',
    AdamW: '#8b5cf6',
    RMSprop: '#f59e0b',
  };

  let lossData = [];
  let optimizerData = [];
  let predictionData = [];
  let lossPlotReady = false;

  function smoothLabel(value) {
    if (value === 1) return document.documentElement.lang === 'fr' ? 'aucun' : 'none';
    return value + ' pts';
  }

  function plotAndResize(elementId, traces, layout, isUpdate) {
    const plotFn = isUpdate ? Plotly.react : Plotly.newPlot;
    return plotFn(elementId, traces, layout, plotConfig).then(function () {
      return requestAnimationFrame(function () {
        Plotly.Plots.resize(document.getElementById(elementId));
      });
    });
  }

  function renderLossPlot(epochs, smoothWindow) {
    const filtered = lossData.filter((row) => row.epoch <= epochs);
    const x = filtered.map((row) => row.epoch);
    const trainLoss = window.BlogCSV.movingAverage(
      filtered.map((row) => row.train_loss),
      smoothWindow
    );
    const valLoss = window.BlogCSV.movingAverage(
      filtered.map((row) => row.val_loss),
      smoothWindow
    );

    const traces = [
      {
        x,
        y: trainLoss,
        name: 'Train loss',
        type: 'scatter',
        mode: 'lines+markers',
        marker: { size: 4 },
        line: { color: '#2563eb', width: 2 },
      },
      {
        x,
        y: valLoss,
        name: 'Validation loss',
        type: 'scatter',
        mode: 'lines+markers',
        marker: { size: 4 },
        line: { color: '#ef4444', width: 2, dash: 'dot' },
      },
    ];

    const layout = {
      ...layoutBase,
      title: { text: 'Évolution de la loss', font: { size: 16 } },
      xaxis: { title: 'Époque', gridcolor: '#e2e8f0' },
      yaxis: { title: 'Loss', gridcolor: '#e2e8f0' },
      legend: { orientation: 'h', y: 1.12 },
      height: 400,
    };

    if (lossPlotReady) {
      plotAndResize('loss-plot', traces, layout, true);
    } else {
      plotAndResize('loss-plot', traces, layout, false).then(function () {
        lossPlotReady = true;
      });
    }
  }

  function renderOptimizerPlot() {
    const grouped = window.BlogCSV.groupBy(optimizerData, 'optimizer');

    const traces = Object.entries(grouped).map(([name, rows]) => ({
      x: rows.map((row) => row.epoch),
      y: rows.map((row) => row.loss),
      name,
      type: 'scatter',
      mode: 'lines',
      line: { color: OPTIMIZER_COLORS[name] || '#64748b', width: 2 },
    }));

    const layout = {
      ...layoutBase,
      title: { text: 'Comparaison des optimiseurs', font: { size: 16 } },
      xaxis: { title: 'Époque', gridcolor: '#e2e8f0' },
      yaxis: { title: 'Loss', gridcolor: '#e2e8f0' },
      legend: { orientation: 'h', y: 1.12 },
      height: 400,
    };

    return plotAndResize('optimizer-plot', traces, layout, false);
  }

  function renderDistributionPlot() {
    const correct = predictionData
      .filter((row) => row.label === 'correct')
      .map((row) => row.confidence);
    const incorrect = predictionData
      .filter((row) => row.label === 'incorrect')
      .map((row) => row.confidence);

    const traces = [
      {
        x: correct,
        type: 'histogram',
        name: 'Prédictions correctes',
        opacity: 0.7,
        marker: { color: '#2563eb' },
        nbinsx: 30,
      },
      {
        x: incorrect,
        type: 'histogram',
        name: 'Prédictions incorrectes',
        opacity: 0.7,
        marker: { color: '#ef4444' },
        nbinsx: 30,
      },
    ];

    const layout = {
      ...layoutBase,
      title: { text: 'Distribution des scores de confiance', font: { size: 16 } },
      xaxis: { title: 'Score de confiance', gridcolor: '#e2e8f0', range: [0, 1] },
      yaxis: { title: 'Fréquence', gridcolor: '#e2e8f0' },
      barmode: 'overlay',
      legend: { orientation: 'h', y: 1.12 },
      height: 300,
    };

    return plotAndResize('distribution-plot', traces, layout, false);
  }

  function initControls() {
    const smoothSlider = document.getElementById('smooth-slider');
    const epochsSlider = document.getElementById('epochs-slider');
    const smoothValue = document.getElementById('smooth-value');
    const epochsValue = document.getElementById('epochs-value');

    if (!smoothSlider || !epochsSlider) return;

    function update() {
      const smooth = parseInt(smoothSlider.value, 10);
      const epochs = parseInt(epochsSlider.value, 10);
      if (smoothValue) smoothValue.textContent = smoothLabel(smooth);
      if (epochsValue) epochsValue.textContent = String(epochs);
      renderLossPlot(epochs, smooth);
    }

    smoothSlider.addEventListener('input', update);
    smoothSlider.addEventListener('change', update);
    epochsSlider.addEventListener('input', update);
    epochsSlider.addEventListener('change', update);
  }

  async function init() {
    if (!window.BlogCSV) {
      throw new Error('BlogCSV non chargé — vérifiez que blog-csv.js est bien inclus avant ce script.');
    }
    if (!window.Plotly) {
      throw new Error('Plotly non chargé — relancez npm run build pour copier vendor/plotly.min.js.');
    }

    const [loss, optimizers, predictions] = await Promise.all([
      window.BlogCSV.load(`${DATA_BASE}/training_loss.csv`),
      window.BlogCSV.load(`${DATA_BASE}/optimizers.csv`),
      window.BlogCSV.load(`${DATA_BASE}/predictions.csv`),
    ]);

    lossData = loss;
    optimizerData = optimizers;
    predictionData = predictions;

    const epochsSlider = document.getElementById('epochs-slider');
    const smoothSlider = document.getElementById('smooth-slider');
    const maxEpochs = lossData.length;

    if (epochsSlider && maxEpochs > 0) {
      epochsSlider.min = '1';
      epochsSlider.max = String(maxEpochs);
      epochsSlider.step = '1';
      epochsSlider.value = String(Math.min(50, maxEpochs));
    }

    const epochs = epochsSlider ? parseInt(epochsSlider.value, 10) : maxEpochs;
    const smooth = smoothSlider ? parseInt(smoothSlider.value, 10) : 1;

    const smoothValue = document.getElementById('smooth-value');
    const epochsValue = document.getElementById('epochs-value');
    if (smoothValue) smoothValue.textContent = smoothLabel(smooth);
    if (epochsValue) epochsValue.textContent = String(epochs);

    await renderLossPlotInitial(epochs, smooth);
    await Promise.all([renderOptimizerPlot(), renderDistributionPlot()]);
    initControls();
  }

  async function renderLossPlotInitial(epochs, smoothWindow) {
    const filtered = lossData.filter((row) => row.epoch <= epochs);
    const x = filtered.map((row) => row.epoch);
    const trainLoss = window.BlogCSV.movingAverage(
      filtered.map((row) => row.train_loss),
      smoothWindow
    );
    const valLoss = window.BlogCSV.movingAverage(
      filtered.map((row) => row.val_loss),
      smoothWindow
    );

    const traces = [
      {
        x,
        y: trainLoss,
        name: 'Train loss',
        type: 'scatter',
        mode: 'lines+markers',
        marker: { size: 4 },
        line: { color: '#2563eb', width: 2 },
      },
      {
        x,
        y: valLoss,
        name: 'Validation loss',
        type: 'scatter',
        mode: 'lines+markers',
        marker: { size: 4 },
        line: { color: '#ef4444', width: 2, dash: 'dot' },
      },
    ];

    const layout = {
      ...layoutBase,
      title: { text: 'Évolution de la loss', font: { size: 16 } },
      xaxis: { title: 'Époque', gridcolor: '#e2e8f0' },
      yaxis: { title: 'Loss', gridcolor: '#e2e8f0' },
      legend: { orientation: 'h', y: 1.12 },
      height: 400,
    };

    await plotAndResize('loss-plot', traces, layout, false);
    lossPlotReady = true;
  }

  function start() {
    init().catch(function (err) {
      console.error('Erreur de chargement des données CSV :', err);
      const container = document.getElementById('loss-plot');
      if (container) {
        container.innerHTML =
          '<p style="padding:2rem;text-align:center;color:#ef4444;">Impossible de charger les graphiques : ' +
          err.message +
          '</p>';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
