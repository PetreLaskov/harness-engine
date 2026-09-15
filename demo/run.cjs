'use strict';
// New demonstration harness, September 2026. Uses only the Node.js standard library.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
const checkerPath = path.join(__dirname, 'lint-harness.cjs');
const fixturePath = path.join(__dirname, 'fixtures.json');
const fixtures = readJson(fixturePath);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-demo-'));
const rows = [];
try {
  for (const [name, files] of Object.entries(fixtures)) {
    if (!/^[a-z-]+$/.test(name)) throw new Error('Invalid fixture name');
    const root = path.join(tempRoot, name);
    for (const [relative, content] of Object.entries(files)) {
      const target = path.resolve(root, relative);
      if (!target.startsWith(root + path.sep)) throw new Error('Fixture path escapes its root');
      fs.mkdirSync(path.dirname(target), {recursive:true});
      fs.writeFileSync(target, content, 'utf8');
    }
    const run = spawnSync(process.execPath, [checkerPath, root], {encoding:'utf8', timeout:10000});
    if (run.error) throw run.error;
    if (run.signal || ![0,1].includes(run.status)) throw new Error(`Unexpected checker exit: ${name}`);
    const stdout = run.stdout.replace(/\r\n/g, '\n').replace(/\\/g, '/').trim();
    const match = stdout.match(/(\d+) FAIL, (\d+) WARN, (\d+) INFO$/);
    if (!match) throw new Error(`Missing summary for ${name}`);
    rows.push({name, exit_code:run.status, failures:Number(match[1]), warnings:Number(match[2]), info:Number(match[3]), stdout, stderr:run.stderr.trim()});
  }
  const sha256 = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const result = {
    experiment:'Five synthetic packages exercising an existing structural checker; no Claude runtime executed.',
    node_version:process.version,
    checker_sha256:sha256(checkerPath), fixtures_sha256:sha256(fixturePath),
    summary:{packages:rows.length, failed_packages:rows.filter(r=>r.exit_code===1).length, warning_only_packages:rows.filter(r=>r.exit_code===0 && r.warnings>0).length, clean_packages:rows.filter(r=>r.exit_code===0 && r.failures===0 && r.warnings===0).length},
    packages:rows
  };
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(result,null,2)+'\n');
  console.table(rows.map(({name,exit_code,failures,warnings})=>({name,exit_code,failures,warnings})));
  console.log(JSON.stringify(result.summary));
} finally {
  // Delete only this invocation's newly created fixture directory.
  const resolved = path.resolve(tempRoot);
  const expectedParent = path.resolve(os.tmpdir());
  if (path.dirname(resolved)!==expectedParent || !path.basename(resolved).startsWith('engine-demo-')) {
    throw new Error('Refusing cleanup outside the temporary fixture root');
  }
  fs.rmSync(resolved,{recursive:true,force:true});
}
