// A local `npm install` (npm 10.x) strips the `libc` fields that Dependabot and CI write into
// package-lock.json for the Linux native binaries; the stripped lockfile looked like a legitimate
// change twice before this check existed (LESSONS of `docs-toolchain`, retro 2026-11-02). The fields
// are restored from HEAD (`git checkout -- <lockfile>`), never committed away.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const LOCKFILES = ['package-lock.json', 'app/products/package-lock.json'];

/** Entries of a Linux native binary that npm publishes with a `libc` field (`-gnu` or `-musl`). */
function linuxBinaries(lock) {
  return Object.entries(lock.packages).filter(
    ([name, pkg]) => /-(gnu|musl)$/.test(name) && Array.isArray(pkg.os) && pkg.os.includes('linux')
  );
}

describe('package-lock.json keeps the libc fields of the Linux native binaries', () => {
  for (const file of LOCKFILES) {
    it(`${file}: every linux -gnu or -musl binary entry carries libc`, () => {
      const lock = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
      const entries = linuxBinaries(lock);
      expect(entries.length).toBeGreaterThan(0);
      const stripped = entries
        .filter(([, pkg]) => !Array.isArray(pkg.libc) || pkg.libc.length === 0)
        .map(([name]) => name);
      expect(
        stripped,
        `a local npm install stripped libc; restore with: git checkout -- ${file}`
      ).toEqual([]);
    });
  }
});
