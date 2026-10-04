// Release tooling for the publishable workspace packages (packages/*, unless "private"). Used by .github/workflows.
//
//   node scripts/release.mjs check --base <git-ref>   PR gate: workspace dependency ranges, and every package changed
//                                                     since <ref> must carry a version that is not published yet
//   node scripts/release.mjs publish [--dry-run]      publish each package whose version is not on the registry,
//                                                     dependencies first; tag and create a GitHub release for each
//
// A release is a version bump: `npm version patch -w @gurps-sheet/character --no-git-tag-version` in the PR.
// The registry and its token come from the npm config (actions/setup-node writes them from NPM_REGISTRY_TOKEN).
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import semver from 'semver';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

/** Publishable workspace packages, dependencies before dependents. */
function workspacePackages() {
  const all = readdirSync('packages', { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ dir: `packages/${e.name}`, short: e.name, pkg: readJson(`packages/${e.name}/package.json`) }));
  const byName = new Map(all.map((w) => [w.pkg.name, w]));
  const ordered = [];
  const visit = (w, path = []) => {
    if (ordered.includes(w)) return;
    if (path.includes(w)) throw new Error(`Dependency cycle: ${[...path, w].map((x) => x.pkg.name).join(' -> ')}`);
    for (const field of DEPENDENCY_FIELDS) {
      for (const dep of Object.keys(w.pkg[field] ?? {})) if (byName.has(dep)) visit(byName.get(dep), [...path, w]);
    }
    ordered.push(w);
  };
  all.forEach((w) => visit(w));
  return { ordered: ordered.filter((w) => !w.pkg.private), byName };
}

/** True when name@version is on the registry; a missing package or version is false; any other failure throws. */
function isPublished(name, version) {
  const r = spawnSync('npm', ['view', `${name}@${version}`, 'version', '--json'], { encoding: 'utf8' });
  if (r.status === 0) return r.stdout.trim() !== '';
  if (/E404|404 Not Found/.test(r.stderr)) return false;
  throw new Error(`npm view ${name}@${version} failed:\n${r.stderr}`);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const summary = (text) => process.env.GITHUB_STEP_SUMMARY && appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);

// ---------------- check (pull requests) ----------------
function check(base) {
  const { ordered, byName } = workspacePackages();
  const problems = [];

  // A range the local version doesn't satisfy makes npm install the registry copy instead of linking the workspace.
  for (const { path, pkg } of [{ path: 'package.json', pkg: readJson('package.json') }, ...ordered.map((w) => ({ path: `${w.dir}/package.json`, pkg: w.pkg }))]) {
    for (const field of DEPENDENCY_FIELDS) {
      for (const [dep, range] of Object.entries(pkg[field] ?? {})) {
        const local = byName.get(dep);
        if (local && !semver.satisfies(local.pkg.version, range)) {
          problems.push(`${path}: ${field}["${dep}"] is "${range}", which ${local.pkg.version} (the workspace version) doesn't satisfy.`);
        }
      }
    }
  }

  if (base) {
    const changed = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
    for (const { dir, pkg } of ordered) {
      const files = changed.filter((f) => f.startsWith(`${dir}/`) && !f.startsWith(`${dir}/test/`));
      if (!files.length) continue;
      if (isPublished(pkg.name, pkg.version)) {
        problems.push(`${pkg.name} changed (${files.length} file(s), e.g. ${files[0]}) but ${pkg.version} is already published: `
          + `bump it, e.g. \`npm version patch -w ${pkg.name} --no-git-tag-version\`.`);
      } else {
        console.log(`${pkg.name}: changed; ${pkg.version} will be released when this is merged.`);
        summary(`- **${pkg.name}** ${pkg.version} will be released on merge`);
      }
    }
  }

  if (problems.length) {
    for (const p of problems) console.error(`::error::${p}`);
    process.exit(1);
  }
  console.log('Release check passed.');
}

// ---------------- publish (pushes to main) ----------------
function releaseNotes(short, dir) {
  const previous = git('tag', '--list', `${short}-v*`, '--sort=-v:refname').split('\n').filter(Boolean)[0];
  const log = git('log', '--no-merges', '--format=- %s (%h)', ...(previous ? [`${previous}..HEAD`] : []), '--', dir);
  return `${previous ? `Changes since ${previous}:` : 'First release.'}\n\n${log || '- (no commits touching the package)'}`;
}

function publish(dryRun) {
  const { ordered } = workspacePackages();
  summary(`### Package release${dryRun ? ' (dry run)' : ''}\n`);
  for (const { dir, short, pkg } of ordered) {
    const { name, version } = pkg;
    if (isPublished(name, version)) {
      console.log(`${name}@${version} is already published; skipping.`);
      summary(`- ${name}@${version}: already published`);
      continue;
    }
    const prerelease = semver.prerelease(version);
    const distTag = prerelease ? (typeof prerelease[0] === 'string' ? prerelease[0] : 'next') : 'latest';
    const args = ['publish', '-w', dir, '--tag', distTag];
    if (process.env.NPM_PROVENANCE === 'true') args.push('--provenance');
    if (dryRun) args.push('--dry-run');
    console.log(`> npm ${args.join(' ')}`);
    execFileSync('npm', args, { stdio: 'inherit' });

    const tag = `${short}-v${version}`;
    if (!dryRun && process.env.GITHUB_ACTIONS === 'true') {
      execFileSync('gh', ['release', 'create', tag, '--target', process.env.GITHUB_SHA, '--title', `${name} ${version}`,
        '--notes', releaseNotes(short, dir), ...(prerelease ? ['--prerelease'] : [])], { stdio: 'inherit' });
    }
    summary(`- **${name}@${version}** ${dryRun ? 'would be published' : 'published'} (dist-tag \`${distTag}\`, release \`${tag}\`)`);
  }
}

const [command, ...rest] = process.argv.slice(2);
const option = (flag) => {
  const i = rest.indexOf(flag);
  return i >= 0 ? rest[i + 1] : undefined;
};
if (command === 'check') check(option('--base'));
else if (command === 'publish') publish(rest.includes('--dry-run'));
else {
  console.error('usage: node scripts/release.mjs check [--base <git-ref>] | publish [--dry-run]');
  process.exit(2);
}
