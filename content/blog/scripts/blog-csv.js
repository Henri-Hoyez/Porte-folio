/**
 * Utilitaire partagé — chargement et parsing de fichiers CSV pour les articles du blog.
 * Usage : BlogCSV.load('data/mon-article/fichier.csv')
 */
window.BlogCSV = (function () {
  'use strict';

  function parse(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const values = line.split(',');
      const row = {};
      headers.forEach((header, i) => {
        const raw = (values[i] || '').trim();
        const num = Number(raw);
        row[header] = raw !== '' && !Number.isNaN(num) ? num : raw;
      });
      return row;
    });
  }

  async function load(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Impossible de charger ${url} (${response.status})`);
    }
    return parse(await response.text());
  }

  function groupBy(rows, key) {
    return rows.reduce((groups, row) => {
      const k = row[key];
      if (!groups[k]) groups[k] = [];
      groups[k].push(row);
      return groups;
    }, {});
  }

  function movingAverage(values, window) {
    if (window <= 1) return values.slice();
    return values.map((_, i) => {
      const start = Math.max(0, i - window + 1);
      const slice = values.slice(start, i + 1);
      return slice.reduce((a, b) => a + b, 0) / slice.length;
    });
  }

  return { load, parse, groupBy, movingAverage };
})();
