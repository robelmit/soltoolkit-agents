// Until the soltoolkit packages of the other repositories are on npm, a checkout that has those repositories
// cloned beside it uses them directly. Without them beside it, this file does nothing and npm is used.
/* eslint-disable @typescript-eslint/no-require-imports -- pnpm loads this file as CommonJS */
const fs = require('node:fs');
const path = require('node:path');

const SIBLINGS = {
  '@soltoolkit/bot-core': 'soltoolkit-bots/packages/bot-core',
  '@soltoolkit/launchpad-sdk': 'soltoolkit-sdk/packages/launchpad-sdk',
  '@soltoolkit/rpc': 'soltoolkit-sdk/packages/rpc',
  '@soltoolkit/holder-map-react': 'soltoolkit-insights/packages/holder-map-react',
  '@soltoolkit/app-registry': 'soltoolkit-insights/packages/app-registry',
  '@soltoolkit/holder-map': 'soltoolkit-insights/packages/holder-map',
  '@soltoolkit/token-safety': 'soltoolkit-insights/packages/token-safety',
  '@soltoolkit/wallet-pnl': 'soltoolkit-insights/packages/wallet-pnl',
};

function readPackage(pkg) {
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const name of Object.keys(pkg[field] || {})) {
      const rel = SIBLINGS[name];
      if (!rel) continue;
      const dir = path.resolve(__dirname, '..', rel);
      if (fs.existsSync(path.join(dir, 'package.json'))) pkg[field][name] = `link:${dir}`;
    }
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
