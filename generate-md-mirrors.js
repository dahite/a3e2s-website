const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const TurndownService = require('turndown');

const SITE_DIR = __dirname;
const BASE_URL = 'https://a3e2s.ma';
const TODAY = new Date().toISOString().split('T')[0];

// URL mapping per file
const URL_MAP = {
  'index.html': '/',
  'management-performance.html': '/management-performance',
};

const td = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

// Ignore purely decorative/structural nodes
td.addRule('remove-empty', {
  filter: (node) => {
    const text = node.textContent.trim();
    return text === '' && node.nodeName !== 'BR';
  },
  replacement: () => '',
});

function htmlToMd(filePath, urlPath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(raw);

  // Extract meta before stripping
  const title = $('title').text().trim() || 'A3E2S';
  const description = $('meta[name="description"]').attr('content') || '';

  // Strip everything we don't want
  $('nav, footer, script, style, noscript').remove();
  $('[id="navbar"], [class*="nav-"], [class*="footer"]').remove();
  $('[class*="hero-scroll"], [class*="hero-grid"], [class*="hero-noise"], [class*="hero-overlay"]').remove();
  $('[class*="reveal"]').removeAttr('class'); // keep content, remove animation class
  $('svg').remove(); // remove inline SVG icons
  $('[class*="divider"]').remove();
  $('[class*="mobile-menu"]').remove();

  // Clean up empty elements left behind
  $('div, section, p').each(function () {
    if ($(this).text().trim() === '' && $(this).find('img').length === 0) {
      $(this).remove();
    }
  });

  const bodyHtml = $('body').html() || '';
  let md = td.turndown(bodyHtml);

  // Clean up excessive blank lines
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  const fullUrl = BASE_URL + urlPath;
  const header = `---
title: ${title}
description: ${description}
url: ${fullUrl}
last_updated: ${TODAY}
---

`;

  return header + md;
}

const htmlFiles = fs.readdirSync(SITE_DIR).filter(f => f.endsWith('.html'));
let generated = 0;

for (const file of htmlFiles) {
  const filePath = path.join(SITE_DIR, file);
  const urlPath = URL_MAP[file] || '/' + file.replace('.html', '');
  const mdPath = path.join(SITE_DIR, file.replace('.html', '.md'));

  try {
    const markdown = htmlToMd(filePath, urlPath);
    fs.writeFileSync(mdPath, markdown, 'utf8');
    const lines = markdown.split('\n').length;
    console.log(`✓ ${file} → ${file.replace('.html', '.md')} (${lines} lines)`);
    generated++;
  } catch (err) {
    console.error(`✗ ${file}: ${err.message}`);
  }
}

console.log(`\nDone. ${generated}/${htmlFiles.length} markdown mirrors generated.`);
console.log('Files:');
htmlFiles.forEach(f => {
  const md = f.replace('.html', '.md');
  const mdPath = path.join(SITE_DIR, md);
  if (fs.existsSync(mdPath)) {
    const size = (fs.statSync(mdPath).size / 1024).toFixed(1);
    console.log(`  ${md} — ${size} KB`);
  }
});
