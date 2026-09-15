#!/usr/bin/env node
// lint-harness.js — deterministic structural floor for generated harnesses.
//
// Two modes:
//   node scripts/lint-harness.js <harness-dir>   Full lint. Exit 1 on FAIL findings.
//   node scripts/lint-harness.js --hook          PostToolUse hook mode: reads JSON on
//                                                stdin, warns on a single written file,
//                                                always exits 0 (fail-open).
//
// Scope discipline: this script checks what is mechanically checkable — layout,
// frontmatter presence, size CEILINGS, cross-reference resolution, engine-term
// contamination, plugin.json schema. It never checks size floors or content quality;
// depth is judged by coverage against the corpus (harness-reviewer) and behavior
// under scenarios (harness-evaluator), not by line count.

'use strict';
const fs = require('fs');
const path = require('path');

const PLUGIN_JSON_FIELDS = ['name', 'version', 'description', 'author', 'keywords', 'homepage', 'repository', 'license'];
const MODEL_ALIASES = ['haiku', 'sonnet', 'opus', 'fable', 'best', 'inherit', 'opusplan'];
const IGNORED_PLUGIN_AGENT_FIELDS = ['permissionMode', 'hooks', 'mcpServers'];
// Engine vocabulary that must never appear in a client harness (zone isolation, pattern A1).
const CONTAMINATION = [
  /\bharness-ir\b/, /\bzone input document\b/i, /\bescalation checklist\b/i,
  /\bcraft skill\b/i, /\bmeta-architecture\b/i, /\bUNDERSTAND\b/, /\bCONSTRUCT\b/, /\bSUSTAIN\b/,
  /\bskill-generator\b/, /\bagent-generator\b/, /\bcross-zone-generator\b/,
  /\bharness-reviewer\b/, /\bharness-evaluator\b/,
];
const XREF_RE = /\b(?:rules|skills|agents|commands|state)\/[a-z0-9][a-z0-9._/-]*\.(?:md|ya?ml|json)\b/g;

const findings = []; // {severity: FAIL|WARN|INFO, file, msg}
const add = (severity, file, msg) => findings.push({ severity, file, msg });

function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function lines(s) { return s.split(/\r?\n/); }
function listMd(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) out.push(p);
    }
  })(dir);
  return out;
}

// Minimal frontmatter parser: returns {fields: {key: rawValue}, present: bool}
function frontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { present: false, fields: {} };
  const fields = {};
  for (const line of lines(m[1])) {
    const kv = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2];
  }
  return { present: true, fields };
}

function checkContamination(file, content, rel) {
  lines(content).forEach((ln, i) => {
    for (const re of CONTAMINATION) {
      if (re.test(ln)) add('FAIL', rel, `engine-term contamination at line ${i + 1}: ${ln.trim().slice(0, 80)}`);
    }
  });
}

function checkAgent(file, root) {
  const rel = path.relative(root, file);
  if (path.basename(file) === 'AGENT.md') {
    add('WARN', rel, 'AGENT.md-in-directory is non-canonical — use flat agents/{name}.md');
  }
  const c = read(file);
  const fm = frontmatter(c);
  if (!fm.present || !fm.fields.name || !fm.fields.description) {
    add('FAIL', rel, 'agent missing frontmatter name/description');
  }
  if (fm.fields.model) {
    const v = fm.fields.model.replace(/['"]/g, '');
    if (!MODEL_ALIASES.includes(v) && !v.startsWith('claude-')) add('WARN', rel, `unknown model alias "${v}"`);
  }
  for (const f of IGNORED_PLUGIN_AGENT_FIELDS) {
    if (fm.fields[f] !== undefined) add('WARN', rel, `"${f}" is silently ignored for plugin agents`);
  }
  const n = lines(c).length;
  if (n > 200) add('WARN', rel, `agent is ${n} lines (ceiling guidance: 200)`);
  checkContamination(file, c, rel);
}

function checkSkill(file, root) {
  const rel = path.relative(root, file);
  const c = read(file);
  const fm = frontmatter(c);
  if (!fm.present || !fm.fields.name || !fm.fields.description) {
    add('FAIL', rel, 'skill missing frontmatter name/description');
  }
  if (fm.fields.description && fm.fields.description.length > 1024) {
    add('WARN', rel, 'description over ~1024 chars — risks truncation in the skill index');
  }
  const n = lines(c).length;
  if (n > 500) add('WARN', rel, `SKILL.md is ${n} lines (hard ceiling 500 — split via references/)`);
  else if (n > 200) add('INFO', rel, `SKILL.md is ${n} lines (target ≤200; fine if the knowledge demands it)`);
  checkContamination(file, c, rel);
}

function checkXrefs(file, root) {
  const rel = path.relative(root, file);
  const c = read(file);
  const seen = new Set();
  for (const m of c.matchAll(XREF_RE)) {
    const ref = m[0];
    if (seen.has(ref) || ref.includes('{')) continue;
    seen.add(ref);
    if (!fs.existsSync(path.join(root, ref)) && !fs.existsSync(path.join(root, '.claude', ref))) {
      add('FAIL', rel, `dangling reference: ${ref}`);
    }
  }
}

function fullLint(root) {
  root = path.resolve(root);
  if (!fs.existsSync(root)) { console.error(`no such directory: ${root}`); process.exit(2); }

  if (fs.existsSync(path.join(root, 'plugin.json'))) {
    add('FAIL', 'plugin.json', 'manifest at harness root is not discovered — must live at .claude-plugin/plugin.json');
  }
  const pj = path.join(root, '.claude-plugin', 'plugin.json');
  if (fs.existsSync(pj)) {
    try {
      const obj = JSON.parse(read(pj));
      for (const k of Object.keys(obj)) {
        if (!PLUGIN_JSON_FIELDS.includes(k)) add('FAIL', '.claude-plugin/plugin.json', `field "${k}" not in current plugin.json schema (${PLUGIN_JSON_FIELDS.join(', ')})`);
      }
      if (obj.name && !/^[a-z0-9][a-z0-9-]*$/.test(obj.name)) add('WARN', '.claude-plugin/plugin.json', 'name should be kebab-case');
    } catch (e) { add('FAIL', '.claude-plugin/plugin.json', `invalid JSON: ${e.message}`); }
  }

  const claudeMd = path.join(root, 'CLAUDE.md');
  let alwaysLoaded = 0;
  if (fs.existsSync(claudeMd)) {
    const n = lines(read(claudeMd)).length;
    alwaysLoaded += n;
    if (n > 200) add('WARN', 'CLAUDE.md', `${n} lines (ceiling guidance: 200)`);
    checkContamination(claudeMd, read(claudeMd), 'CLAUDE.md');
    checkXrefs(claudeMd, root);
  } else add('WARN', 'CLAUDE.md', 'no root CLAUDE.md found');

  for (const f of listMd(path.join(root, 'agents'))) { checkAgent(f, root); checkXrefs(f, root); }
  for (const f of listMd(path.join(root, 'skills'))) {
    if (path.basename(f) === 'SKILL.md') checkSkill(f, root);
    checkXrefs(f, root);
  }
  for (const f of listMd(path.join(root, 'commands'))) {
    const rel = path.relative(root, f);
    const fm = frontmatter(read(f));
    if (!fm.present || !fm.fields.description) add('WARN', rel, 'command missing description frontmatter');
    add('INFO', rel, 'commands/ is legacy — consider a user-invocable skill instead');
    checkContamination(f, read(f), rel); checkXrefs(f, root);
  }
  for (const dir of [path.join(root, 'rules'), path.join(root, '.claude', 'rules')]) {
    for (const f of listMd(dir)) {
      const rel = path.relative(root, f);
      const n = lines(read(f)).length;
      alwaysLoaded += n;
      if (n > 50) add('WARN', rel, `rule is ${n} lines (ceiling guidance: 50)`);
      checkContamination(f, read(f), rel); checkXrefs(f, root);
    }
  }
  if (alwaysLoaded > 500) add('WARN', '(total)', `always-loaded budget is ${alwaysLoaded} lines (CLAUDE.md + rules; guidance ≤500)`);

  const fails = findings.filter(f => f.severity === 'FAIL');
  for (const f of findings) console.log(`${f.severity}  ${f.file} — ${f.msg}`);
  console.log(`\n${fails.length} FAIL, ${findings.filter(f => f.severity === 'WARN').length} WARN, ${findings.filter(f => f.severity === 'INFO').length} INFO`);
  process.exit(fails.length ? 1 : 0);
}

function hookMode() {
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
  let input; try { input = JSON.parse(raw); } catch { process.exit(0); }
  const fp = input && input.tool_input && (input.tool_input.file_path || input.tool_input.filePath);
  if (!fp || !/builds[\\/][^\\/]+[\\/]harness[\\/]/.test(fp) || !fs.existsSync(fp)) process.exit(0);

  const c = read(fp); if (c == null) process.exit(0);
  const rel = fp.replace(/^.*builds[\\/]/, 'builds/');
  const n = lines(c).length;
  if (/[\\/]agents[\\/].*\.md$/.test(fp)) {
    const fm = frontmatter(c);
    if (!fm.present || !fm.fields.name || !fm.fields.description) console.log(`lint: ${rel} — agent missing name/description frontmatter`);
    if (n > 200) console.log(`lint: ${rel} — ${n} lines (agent ceiling 200)`);
  } else if (/SKILL\.md$/.test(fp)) {
    const fm = frontmatter(c);
    if (!fm.present || !fm.fields.name || !fm.fields.description) console.log(`lint: ${rel} — skill missing name/description frontmatter`);
    if (n > 500) console.log(`lint: ${rel} — ${n} lines (skill hard ceiling 500; split via references/)`);
  } else if (/CLAUDE\.md$/.test(fp) && n > 200) {
    console.log(`lint: ${rel} — ${n} lines (CLAUDE.md ceiling 200)`);
  }
  for (const re of CONTAMINATION) {
    if (re.test(c)) { console.log(`lint: ${rel} — engine-term contamination (${re.source}); client harnesses must contain zero engine vocabulary`); break; }
  }
  process.exit(0);
}

const arg = process.argv[2];
if (arg === '--hook') hookMode();
else if (arg) fullLint(arg);
else { console.error('usage: lint-harness.js <harness-dir> | --hook'); process.exit(2); }
