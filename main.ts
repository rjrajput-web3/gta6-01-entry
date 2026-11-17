// Solmar Heat — entry program for make.fun gta6-01 (Node 22, standard library only).
// The game lives in game/ as plain static files (game/index.html plus its ES modules and
// the vendored three.js build under game/vendor/). This program hands it in: it copies
// game/ and screenshots/ from beside this file into /output (or MAKEFUN_OUTPUT_DIR
// outside the grader) and writes /output/dossier.json with the vendored make.fun
// library, so the judge can read the game from the dossier alone.
//
// Run it with:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play it locally with:  node serve.ts   (then open http://localhost:8080)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly instead of handing in a half-empty output directory.
for (const needed of ['game', 'screenshots']) {
  if (!existsSync(join(here, needed))) {
    throw new Error(`Solmar Heat: missing ${needed}/ beside main.ts — nothing to hand in.`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The gate's own caps (reference/gate.json): the text cap shapes the dossier bytes;
// the others refuse an entry the scorer would refuse, so mirror them here.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
