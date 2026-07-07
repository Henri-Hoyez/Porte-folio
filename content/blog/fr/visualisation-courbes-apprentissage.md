---
title: "Visualisation interactive des courbes d'apprentissage"
slug: visualisation-courbes-apprentissage
date: 2025-06-25
description: "Explorez les métriques d'entraînement d'un modèle de deep learning avec des graphiques Plotly interactifs — zoom, survol et comparaison d'optimiseurs."
tags:
  - machine-learning
  - visualisation
  - deep-learning
scripts:
  - visualisation-courbes-apprentissage.js
---

Lors de l'entraînement d'un réseau de neurones, suivre l'évolution de la **loss** et de l'**accuracy** est essentiel pour détecter du sur-apprentissage, ajuster le learning rate ou comparer des architectures. Plutôt que des captures d'écran statiques, les graphiques interactifs permettent d'explorer les données en profondeur.

Cet article est un exemple : le contenu est rédigé en **Markdown** (`content/blog/`), les **données** proviennent de fichiers **CSV** (`content/blog/data/`), et les graphiques interactifs sont injectés via de simples `<div>`.

## Courbe de loss (train vs validation)

La divergence entre la loss d'entraînement et celle de validation est un signal classique de sur-apprentissage. Les données sont lues depuis `training_loss.csv`. Survolez les points pour voir les valeurs exactes, ou zoomez sur une région précise.

<div class="plot-controls" id="loss-controls">
  <label>
    Lissage
    <input type="range" id="smooth-slider" min="1" max="15" value="1" step="1">
    <span id="smooth-value">aucun</span>
  </label>
  <label>
    Époques affichées
    <input type="range" id="epochs-slider" min="20" max="100" value="50" step="5">
    <span id="epochs-value">50</span>
  </label>
</div>

<div class="plot-container" id="loss-plot"></div>

<p class="plot-caption">Données : <code>data/visualisation-courbes-apprentissage/training_loss.csv</code> — curseurs interactifs en temps réel.</p>

## Comparaison d'optimiseurs

Adam converge généralement plus vite que SGD sur les premières époques, mais SGD avec momentum peut atteindre une meilleure généralisation. Données issues de `optimizers.csv` — cliquez sur la légende pour masquer/afficher une courbe.

<div class="plot-container" id="optimizer-plot"></div>

## Distribution des prédictions

Un histogramme interactif permet de visualiser la distribution des scores de confiance du modèle sur l'ensemble de test (`predictions.csv`). Faites glisser pour sélectionner une plage.

<div class="plot-container plot-sm" id="distribution-plot"></div>

## Comment ajouter un graphique avec des données CSV

1. Créez un fichier `.md` dans `content/blog/fr/` ou `content/blog/en/` avec un en-tête YAML (titre, date, slug…).
2. Placez vos fichiers CSV dans `content/blog/data/<slug>/` (ex. `training_loss.csv`).
3. Insérez un `<div class="plot-container" id="mon-graphique"></div>` dans le Markdown.
4. Ajoutez un script JS dans `content/blog/scripts/` qui charge les CSV via `BlogCSV.load()` :

```javascript
const rows = await BlogCSV.load('data/mon-slug/mes-donnees.csv');
```

5. Référencez le script dans le frontmatter et lancez `npm run build` (ou `docker compose up --build`).

> **Astuce** : Plotly.js est inclus localement (`blog/vendor/plotly.min.js`) pour une compatibilité maximale avec tous les navigateurs, y compris Firefox.

## Conclusion

Cette approche sépare clairement le **contenu** (Markdown) de la **présentation** (templates HTML/CSS) et de l'**interactivité** (scripts JS). Vous pouvez vous concentrer sur l'écriture sans toucher au HTML du site.
