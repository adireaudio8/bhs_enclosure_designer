#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;

function fail(message) {
  throw new Error(`[engine-sync] ${message}`);
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) fail(`${name} requires a value.`);
  return value;
}

function run(command, args, cwd, capture = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.error) {
    fail(`${command} could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${command} ${args.join(' ')} failed${capture ? `: ${result.stderr || result.stdout}` : '.'}`);
  }
  return capture ? result.stdout.trim() : '';
}

function runNpm(args, cwd) {
  if (!npmCli) {
    fail('npm_execpath is unavailable; run this command through npm run sync:engine.');
  }
  return run(process.execPath, [npmCli, ...args], cwd);
}

const engineRepoArgument = optionValue('--engine-repo');
const revisionArgument = optionValue('--sha')?.toLowerCase();
const calculatorPackageArgument = optionValue('--calculator-package')
  ?? process.env.ENCLOSURE_CALCULATOR_PACKAGE_JSON
  ?? null;

if (!engineRepoArgument || !revisionArgument || !calculatorPackageArgument) {
  fail('Usage: npm run sync:engine -- --engine-repo <path> --sha <40-char SHA> --calculator-package <package.json path>');
}
if (!SHA_PATTERN.test(revisionArgument)) {
  fail('--sha must be an exact 40-character Git SHA.');
}

const engineRepo = resolve(engineRepoArgument);
const calculatorPackagePath = resolve(calculatorPackageArgument);
if (!existsSync(engineRepo)) fail(`Engine repository not found: ${engineRepo}`);
if (!existsSync(calculatorPackagePath)) fail(`Calculator package.json not found: ${calculatorPackagePath}`);

run('git', ['-C', engineRepo, 'fetch', 'origin'], root);
const resolvedRevision = run('git', ['-C', engineRepo, 'rev-parse', `${revisionArgument}^{commit}`], root, true).toLowerCase();
if (resolvedRevision !== revisionArgument) fail('Requested SHA did not resolve to the exact engine commit.');

const temporaryRoot = mkdtempSync(join(tmpdir(), 'bhs-engine-sync-'));
const cleanWorktree = join(temporaryRoot, 'engine');
const packDirectory = join(temporaryRoot, 'pack');
let worktreeAdded = false;

try {
  mkdirSync(packDirectory);
  run('git', ['-C', engineRepo, 'worktree', 'add', '--detach', cleanWorktree, revisionArgument], root);
  worktreeAdded = true;

  const cleanStatus = run('git', ['-C', cleanWorktree, 'status', '--porcelain'], root, true);
  if (cleanStatus) fail('Temporary engine checkout is not clean.');
  const checkedOutRevision = run('git', ['-C', cleanWorktree, 'rev-parse', 'HEAD'], root, true).toLowerCase();
  if (checkedOutRevision !== revisionArgument) fail('Temporary engine checkout is not on the requested SHA.');

  runNpm(['pack', '--pack-destination', packDirectory], cleanWorktree);
  const archives = readdirSync(packDirectory).filter((file) => file.endsWith('.tgz'));
  if (archives.length !== 1) fail(`Expected one packed engine archive, found ${archives.length}.`);

  const packedArchive = join(packDirectory, archives[0]);
  const vendoredArchive = join(root, 'vendor', 'adireaudio-enclosure-engine-0.0.0.tgz');
  copyFileSync(packedArchive, vendoredArchive);

  const tarballSha256 = createHash('sha256').update(readFileSync(vendoredArchive)).digest('hex');
  writeFileSync(join(root, 'vendor', 'enclosure-engine.commit'), `${revisionArgument}\n`, 'utf8');
  writeFileSync(join(root, 'vendor', 'enclosure-engine.sha256'), `${tarballSha256}\n`, 'utf8');

  runNpm(
    ['install', '@adireaudio/enclosure-engine@file:vendor/adireaudio-enclosure-engine-0.0.0.tgz'],
    root,
  );
  runNpm(
    ['run', 'verify:engine-parity', '--', '--calculator-package', calculatorPackagePath],
    root,
  );
  runNpm(['run', 'typecheck'], root);
  runNpm(['run', 'build'], root);

  console.log(`[engine-sync] Website engine updated and verified at ${revisionArgument}.`);
} finally {
  if (worktreeAdded) {
    spawnSync('git', ['-C', engineRepo, 'worktree', 'remove', '--force', cleanWorktree], {
      cwd: root,
      stdio: 'inherit',
    });
  }
  rmSync(temporaryRoot, { recursive: true, force: true });
}
