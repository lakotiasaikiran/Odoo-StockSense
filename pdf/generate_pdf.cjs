const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const mdPath = path.join(__dirname, 'VIDEO_SCRIPT.md');
const mdContent = fs.readFileSync(mdPath, 'utf8');

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function parseMarkdown(md) {
  const lines = md.split('\n');
  let html = '';
  let inTable = false;
  let tableHeaderDone = false;
  let inCode = false;
  let codeContent = '';
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCode) {
        html += `<pre><code>${escapeHtml(codeContent.trim())}</code></pre>\n`;
        codeContent = '';
        inCode = false;
      } else {
        inCode = true;
        codeContent = '';
      }
      continue;
    }
    if (inCode) {
      codeContent += line + '\n';
      continue;
    }

    // Tables
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHeaderDone = false;
        html += '<table>\n';
      }
      // Check if separator row
      if (/^\|(\s*[-:]+[-|\s:]*)\|$/.test(line.trim())) {
        tableHeaderDone = true;
        continue;
      }
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      const tag = tableHeaderDone ? 'td' : 'th';
      html += '  <tr>' + cells.map(c => `<${tag}>${formatInline(c)}</${tag}>`).join('') + '</tr>\n';
      continue;
    } else if (inTable) {
      inTable = false;
      html += '</table>\n';
    }

    // Unordered lists
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      if (!inList) {
        inList = true;
        html += '<ul>\n';
      }
      html += `  <li>${formatInline(line.trim().substring(2))}</li>\n`;
      continue;
    } else if (inList) {
      inList = false;
      html += '</ul>\n';
    }

    // Horizontal rule
    if (line.trim() === '---') {
      html += '<hr/>\n';
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      html += `<h1>${formatInline(line.substring(2))}</h1>\n`;
      continue;
    }
    if (line.startsWith('## ')) {
      html += `<h2>${formatInline(line.substring(3))}</h2>\n`;
      continue;
    }
    if (line.startsWith('### ')) {
      html += `<h3>${formatInline(line.substring(4))}</h3>\n`;
      continue;
    }
    if (line.startsWith('#### ')) {
      html += `<h4>${formatInline(line.substring(5))}</h4>\n`;
      continue;
    }

    // Blockquotes / Cues
    if (line.startsWith('> ')) {
      html += `<blockquote>${formatInline(line.substring(2))}</blockquote>\n`;
      continue;
    }

    // Empty lines
    if (line.trim() === '') {
      continue;
    }

    // Highlight speaking cues or screen actions
    if (line.startsWith('**[SHOW:') || line.startsWith('**[CLICK:') || line.startsWith('**[TYPE:') || line.startsWith('**[POINT TO') || line.startsWith('**[FILL:') || line.startsWith('**[CHECK') || line.startsWith('**[ALT-TAB') || line.startsWith('**[NAVIGATE') || line.startsWith('**[SCROLL') || line.startsWith('**[CONTINUE') || line.startsWith('**[SWITCH') || line.startsWith('**[OPEN') || line.startsWith('**[ENTER') || line.startsWith('**[SAVE]')) {
      html += `<div class="cue-screen">${formatInline(line)}</div>\n`;
      continue;
    }

    if (line.startsWith('**SPEAK:**')) {
      html += `<div class="cue-speaker">${formatInline(line)}</div>\n`;
      continue;
    }

    // Paragraph
    html += `<p>${formatInline(line)}</p>\n`;
  }

  if (inTable) html += '</table>\n';
  if (inList) html += '</ul>\n';

  return html;
}

function formatInline(str) {
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>');
}

const bodyHtml = parseMarkdown(mdContent);

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>StockSense — Video Recording Script (Odoo x LPU Hackathon)</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13.5px;
      line-height: 1.6;
      color: #1e293b;
      background: #f8fafc;
      padding: 30px;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px 50px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }

    h1 {
      font-size: 26px;
      font-weight: 800;
      color: #4f46e5;
      margin-bottom: 6px;
      border-bottom: 2px solid #e0e7ff;
      padding-bottom: 10px;
    }

    h2 {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 26px;
      margin-bottom: 12px;
      padding-left: 10px;
      border-left: 4px solid #6366f1;
    }

    h3 {
      font-size: 15px;
      font-weight: 600;
      color: #334155;
      margin-top: 18px;
      margin-bottom: 8px;
    }

    h4 {
      font-size: 14px;
      font-weight: 600;
      color: #475569;
      margin-top: 14px;
      margin-bottom: 6px;
    }

    p {
      margin-bottom: 10px;
      color: #334155;
    }

    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 22px 0;
    }

    blockquote {
      background: #eef2ff;
      border-left: 4px solid #6366f1;
      padding: 12px 18px;
      border-radius: 0 8px 8px 0;
      margin: 14px 0;
      color: #312e81;
      font-size: 13px;
    }

    .cue-screen {
      background: #fdf2f8;
      border-left: 4px solid #ec4899;
      padding: 8px 14px;
      border-radius: 0 6px 6px 0;
      margin: 10px 0;
      font-weight: 600;
      color: #9d174d;
      font-size: 13px;
    }

    .cue-speaker {
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
      padding: 6px 12px;
      border-radius: 0 6px 6px 0;
      margin-top: 12px;
      margin-bottom: 4px;
      font-weight: 700;
      color: #15803d;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 12.5px;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 600;
    }

    tr:nth-child(even) {
      background: #f8fafc;
    }

    ul {
      margin-left: 20px;
      margin-bottom: 12px;
    }

    li {
      margin-bottom: 4px;
      color: #334155;
    }

    code {
      font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
      background: #f1f5f9;
      color: #6b21a8;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }

    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 12px 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 12px 0;
    }

    pre code {
      background: transparent;
      color: #38bdf8;
      padding: 0;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
        font-size: 12px;
      }
      .container {
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      h2 {
        page-break-before: auto;
      }
      .cue-screen, .cue-speaker, blockquote {
        break-inside: avoid;
      }
      table {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    ${bodyHtml}
  </div>
</body>
</html>
`;

const htmlPath = path.join(__dirname, 'StockSense_Video_Script.html');
fs.writeFileSync(htmlPath, fullHtml, 'utf8');
console.log('HTML written successfully to:', htmlPath);

const pdfPath = path.join(__dirname, 'StockSense_Video_Script.pdf');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

if (fs.existsSync(edgePath)) {
  console.log('Generating PDF via Microsoft Edge headless...');
  const cmd = `"${edgePath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${pdfPath}" "${htmlPath}"`;
  execSync(cmd, { stdio: 'inherit' });
  console.log('PDF generated successfully at:', pdfPath);
} else {
  console.log('Edge not found at standard path, HTML is ready for browser print.');
}
