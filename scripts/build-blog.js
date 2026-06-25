const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'blog');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const OUTPUT_DIR = path.join(ROOT, 'blog');
const SCRIPTS_SRC = path.join(CONTENT_DIR, 'scripts');
const SCRIPTS_OUT = path.join(OUTPUT_DIR, 'scripts');
const LOCALES = ['fr', 'en'];

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

const UI_STRINGS = {
  fr: { read_more: "Lire l'article →", empty: 'Aucun article pour le moment.' },
  en: { read_more: 'Read article →', empty: 'No articles yet.' },
};

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf-8');
}

function formatDate(dateStr, locale) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLayout(template, vars) {
  return Object.entries(vars).reduce(
    (html, [key, value]) => html.replaceAll(`{{${key}}}`, value ?? ''),
    template
  );
}

function collectPosts(locale) {
  const localeDir = path.join(CONTENT_DIR, locale);
  if (!fs.existsSync(localeDir)) return [];

  return fs
    .readdirSync(localeDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const raw = fs.readFileSync(path.join(localeDir, file), 'utf-8');
      const { data, content } = matter(raw);
      const slug = data.slug || path.basename(file, '.md');

      return {
        slug,
        title: data.title || slug,
        date: data.date || new Date().toISOString().slice(0, 10),
        description: data.description || '',
        tags: data.tags || [],
        scripts: data.scripts || [],
        content: md.render(content),
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function buildPostPage(post, layoutTemplate, locale) {
  const scriptTags = post.scripts
    .map((script) => `<script src="../scripts/${escapeHtml(script)}"></script>`)
    .join('\n    ');

  const tagsHtml = post.tags.length
    ? `<div class="blog-tags">${post.tags.map((t) => `<span class="blog-tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : '';

  return renderLayout(layoutTemplate, {
    locale,
    root: '../../',
    asset_root: '../',
    title: escapeHtml(post.title),
    description: escapeHtml(post.description),
    date: formatDate(post.date, locale),
    tags: tagsHtml,
    content: post.content,
    scripts: scriptTags,
  });
}

function buildIndexPage(posts, listTemplate, locale) {
  const ui = UI_STRINGS[locale];
  const cards = posts
    .map(
      (post) => `
      <article class="blog-card">
        <time class="blog-card-date" datetime="${escapeHtml(post.date)}">${formatDate(post.date, locale)}</time>
        <h2 class="blog-card-title"><a href="${escapeHtml(post.slug)}.html">${escapeHtml(post.title)}</a></h2>
        <p class="blog-card-excerpt">${escapeHtml(post.description)}</p>
        ${
          post.tags.length
            ? `<div class="blog-tags">${post.tags.map((t) => `<span class="blog-tag">${escapeHtml(t)}</span>`).join('')}</div>`
            : ''
        }
        <a href="${escapeHtml(post.slug)}.html" class="blog-card-link">${ui.read_more}</a>
      </article>`
    )
    .join('\n');

  const emptyMessage =
    posts.length === 0
      ? `<p class="blog-empty">${ui.empty}</p>`
      : `<div class="blog-grid">${cards}</div>`;

  return renderLayout(listTemplate, {
    locale,
    root: '../../',
    asset_root: '../',
    posts: emptyMessage,
  });
}

function copyScripts() {
  if (!fs.existsSync(SCRIPTS_SRC)) return;

  fs.mkdirSync(SCRIPTS_OUT, { recursive: true });
  for (const file of fs.readdirSync(SCRIPTS_SRC)) {
    if (file.endsWith('.js')) {
      fs.copyFileSync(path.join(SCRIPTS_SRC, file), path.join(SCRIPTS_OUT, file));
    }
  }
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;

  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyVendor() {
  const plotlySrc = path.join(ROOT, 'node_modules', 'plotly.js-dist-min', 'plotly.min.js');
  const vendorOut = path.join(OUTPUT_DIR, 'vendor');
  fs.mkdirSync(vendorOut, { recursive: true });

  if (!fs.existsSync(plotlySrc)) {
    console.warn('Plotly introuvable — lancez npm install avant le build.');
    return;
  }

  fs.copyFileSync(plotlySrc, path.join(vendorOut, 'plotly.min.js'));
}

function copyData() {
  const dataSrc = path.join(CONTENT_DIR, 'data');
  const dataOut = path.join(OUTPUT_DIR, 'data');
  copyDirRecursive(dataSrc, dataOut);
}

function main() {
  const layoutTemplate = readTemplate('blog-post.html');
  const listTemplate = readTemplate('blog-list.html');

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  copyScripts();
  copyData();
  copyVendor();

  let totalPosts = 0;

  for (const locale of LOCALES) {
    const posts = collectPosts(locale);
    const localeOut = path.join(OUTPUT_DIR, locale);
    fs.mkdirSync(localeOut, { recursive: true });

    for (const post of posts) {
      const html = buildPostPage(post, layoutTemplate, locale);
      fs.writeFileSync(path.join(localeOut, `${post.slug}.html`), html);
    }

    const indexHtml = buildIndexPage(posts, listTemplate, locale);
    fs.writeFileSync(path.join(localeOut, 'index.html'), indexHtml);
    totalPosts += posts.length;
  }

  console.log(`Blog généré : ${totalPosts} article(s) (${LOCALES.join(', ')}) → ${OUTPUT_DIR}`);
}

main();
