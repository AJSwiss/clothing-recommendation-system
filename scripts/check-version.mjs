import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const baseRef = process.argv[2];
if (!baseRef) {
  console.error('Usage: npm run check:version -- <base-commit>');
  process.exit(1);
}

const readVersion = (contents, source, required = true) => {
  let packageJson;
  try {
    packageJson = JSON.parse(contents);
  } catch {
    throw new Error(`Could not parse ${source}`);
  }

  if (typeof packageJson.version !== 'string') {
    if (!required) return null;
    throw new Error(`${source} does not define a version`);
  }

  const match = packageJson.version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) {
    throw new Error(`${source} has invalid semver: ${packageJson.version}`);
  }

  return {
    text: packageJson.version,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? ''
  };
};

const compareVersions = (left, right) => {
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }

  if (!left.prerelease && right.prerelease) return 1;
  if (left.prerelease && !right.prerelease) return -1;
  return left.prerelease.localeCompare(right.prerelease);
};

let baseContents;
try {
  baseContents = execFileSync('git', ['show', `${baseRef}:package.json`], {encoding: 'utf8'});
} catch {
  console.error(`Could not read package.json from base commit ${baseRef}`);
  process.exit(1);
}

try {
  const baseVersion = readVersion(baseContents, 'base package.json', false);
  const currentVersion = readVersion(readFileSync('package.json', 'utf8'), 'current package.json');

  if (!baseVersion) {
    console.log(`Version check passed: initial version ${currentVersion.text}`);
    process.exit(0);
  }

  if (compareVersions(currentVersion, baseVersion) <= 0) {
    throw new Error(`Version must increase from ${baseVersion.text} to a newer version (current: ${currentVersion.text})`);
  }

  console.log(`Version check passed: ${baseVersion.text} -> ${currentVersion.text}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
