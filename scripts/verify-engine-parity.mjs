#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = '@adireaudio/enclosure-engine';
const TARBALL_RELATIVE_PATH = 'vendor/adireaudio-enclosure-engine-0.0.0.tgz';
const EXPECTED_DEPENDENCY = `file:${TARBALL_RELATIVE_PATH}`;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  throw new Error(`[engine-parity] ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readText(path) {
  assert(existsSync(path), `Missing required file: ${relative(root, path)}`);
  return readFileSync(path, 'utf8').trim();
}

function digest(buffer, algorithm, encoding = 'hex') {
  return createHash(algorithm).update(buffer).digest(encoding);
}

function listFiles(directory) {
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.isFile()) {
        files.push(relative(directory, absolute).replaceAll('\\', '/'));
      }
    }
  };
  visit(directory);
  return files.sort();
}

function comparePackageTrees(packagedDirectory, installedDirectory) {
  const packagedFiles = listFiles(packagedDirectory);
  const installedFiles = listFiles(installedDirectory);
  assert(
    JSON.stringify(installedFiles) === JSON.stringify(packagedFiles),
    'Installed engine file list does not match the vendored tarball.',
  );

  for (const file of packagedFiles) {
    const packagedHash = digest(readFileSync(join(packagedDirectory, file)), 'sha256');
    const installedHash = digest(readFileSync(join(installedDirectory, file)), 'sha256');
    assert(installedHash === packagedHash, `Installed engine file differs from tarball: ${file}`);
  }
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  assert(value && !value.startsWith('--'), `${name} requires a path.`);
  return value;
}

const revisionPath = join(root, 'vendor', 'enclosure-engine.commit');
const sha256Path = join(root, 'vendor', 'enclosure-engine.sha256');
const tarballPath = join(root, ...TARBALL_RELATIVE_PATH.split('/'));
const packageJsonPath = join(root, 'package.json');
const packageLockPath = join(root, 'package-lock.json');
const installedPackagePath = join(root, 'node_modules', '@adireaudio', 'enclosure-engine');

const revision = readText(revisionPath).toLowerCase();
assert(SHA_PATTERN.test(revision), 'Recorded engine revision must be an exact 40-character Git SHA.');

const expectedSha256 = readText(sha256Path).toLowerCase();
assert(/^[0-9a-f]{64}$/.test(expectedSha256), 'Recorded tarball SHA-256 must be 64 hexadecimal characters.');

assert(existsSync(tarballPath) && statSync(tarballPath).isFile(), 'Vendored engine tarball is missing.');
const tarball = readFileSync(tarballPath);
const actualSha256 = digest(tarball, 'sha256');
const actualIntegrity = `sha512-${digest(tarball, 'sha512', 'base64')}`;
assert(actualSha256 === expectedSha256, 'Vendored engine tarball does not match enclosure-engine.sha256.');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
assert(
  packageJson.dependencies?.[PACKAGE_NAME] === EXPECTED_DEPENDENCY,
  `package.json must pin ${PACKAGE_NAME} to ${EXPECTED_DEPENDENCY}.`,
);

const packageLock = JSON.parse(readFileSync(packageLockPath, 'utf8'));
assert(
  packageLock.packages?.['']?.dependencies?.[PACKAGE_NAME] === EXPECTED_DEPENDENCY,
  `package-lock.json root dependency must pin ${PACKAGE_NAME} to ${EXPECTED_DEPENDENCY}.`,
);
const lockEntry = packageLock.packages?.[`node_modules/${PACKAGE_NAME}`];
assert(lockEntry?.resolved === EXPECTED_DEPENDENCY, 'package-lock.json engine resolution does not match the vendored tarball.');
assert(lockEntry?.integrity === actualIntegrity, 'package-lock.json engine integrity does not match the vendored tarball.');

assert(existsSync(installedPackagePath), 'Installed engine package is missing; run npm install first.');
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'bhs-engine-parity-'));
try {
  const extraction = spawnSync(
    'tar',
    ['-xzf', tarballPath, '-C', temporaryDirectory],
    { encoding: 'utf8' },
  );
  assert(
    extraction.status === 0,
    `Could not inspect the vendored tarball: ${extraction.stderr || extraction.stdout}`,
  );
  comparePackageTrees(join(temporaryDirectory, 'package'), installedPackagePath);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

const calculatorPackageArgument = optionValue('--calculator-package');
const calculatorPackagePath = calculatorPackageArgument
  ? resolve(calculatorPackageArgument)
  : process.env.ENCLOSURE_CALCULATOR_PACKAGE_JSON
    ? resolve(process.env.ENCLOSURE_CALCULATOR_PACKAGE_JSON)
    : null;

if (calculatorPackagePath) {
  assert(existsSync(calculatorPackagePath), `Calculator package.json not found: ${calculatorPackagePath}`);
  const calculatorPackage = JSON.parse(readFileSync(calculatorPackagePath, 'utf8'));
  const calculatorDependency = calculatorPackage.dependencies?.[PACKAGE_NAME];
  const calculatorRevision = typeof calculatorDependency === 'string'
    ? calculatorDependency.match(/#([0-9a-f]{40})$/i)?.[1]?.toLowerCase()
    : null;
  assert(calculatorRevision, `Calculator does not pin ${PACKAGE_NAME} to an exact Git SHA.`);
  assert(calculatorRevision === revision, 'Calculator and customer designer engine revisions do not match.');
}

console.log(`[engine-parity] revision ${revision}`);
console.log(`[engine-parity] tarball sha256 ${actualSha256}`);
console.log('[engine-parity] package.json, lockfile, tarball, and installed package match.');
if (calculatorPackagePath) {
  console.log(`[engine-parity] calculator pin matches: ${calculatorPackagePath}`);
}
