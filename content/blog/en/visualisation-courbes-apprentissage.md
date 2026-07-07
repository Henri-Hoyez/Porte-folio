---
title: "Interactive visualization of learning curves"
slug: visualisation-courbes-apprentissage
date: 2025-06-25
description: "Explore deep learning training metrics with interactive Plotly charts — zoom, hover and optimizer comparison."
tags:
  - machine-learning
  - visualization
  - deep-learning
scripts:
  - visualisation-courbes-apprentissage.js
---

When training a neural network, tracking **loss** and **accuracy** over time is essential to detect overfitting, tune the learning rate, or compare architectures. Interactive charts go far beyond static screenshots.

This article is an example: content is written in **Markdown** (`content/blog/`), **data** comes from **CSV** files (`content/blog/data/`), and interactive charts are injected via simple `<div>` elements.

## Loss curve (train vs validation)

The gap between training and validation loss is a classic sign of overfitting. Data is loaded from `training_loss.csv`. Hover over points for exact values, or zoom into a region.

<div class="plot-controls" id="loss-controls">
  <label>
    Smoothing
    <input type="range" id="smooth-slider" min="1" max="15" value="1" step="1">
    <span id="smooth-value">none</span>
  </label>
  <label>
    Epochs displayed
    <input type="range" id="epochs-slider" min="20" max="100" value="50" step="5">
    <span id="epochs-value">50</span>
  </label>
</div>

<div class="plot-container" id="loss-plot"></div>

<p class="plot-caption">Data: <code>data/visualisation-courbes-apprentissage/training_loss.csv</code> — real-time interactive sliders.</p>

## Optimizer comparison

Adam usually converges faster than SGD in early epochs, but SGD with momentum can generalize better. Data from `optimizers.csv` — click the legend to show/hide curves.

<div class="plot-container" id="optimizer-plot"></div>

## Prediction distribution

An interactive histogram shows the distribution of model confidence scores on the test set (`predictions.csv`). Drag to select a range.

<div class="plot-container plot-sm" id="distribution-plot"></div>

## How to add a chart with CSV data

1. Create a `.md` file in `content/blog/fr/` or `content/blog/en/` with YAML front matter.
2. Place CSV files in `content/blog/data/<slug>/`.
3. Insert `<div class="plot-container" id="my-chart"></div>` in the Markdown.
4. Add a JS script in `content/blog/scripts/` that loads CSV via `BlogCSV.load()`.
5. Reference the script in front matter and run `npm run build`.

> **Tip**: Plotly.js is bundled locally (`blog/vendor/plotly.min.js`) for maximum browser compatibility, including Firefox.

## Conclusion

This approach cleanly separates **content** (Markdown), **presentation** (HTML/CSS templates) and **interactivity** (JS scripts).
