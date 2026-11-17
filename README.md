[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/rjrajput-web3/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/rjrajput-web3/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar Heat — an open-world crime game

**Solmar Heat** is an original open-world crime game in the spirit of GTA 6, built for
the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). Everything in it is
our own: the sun-soaked coastal city of Solmar Bay, its people, cars, story and
sounds. Nothing is taken from Rockstar Games or any other commercial game.

You play Jax Marlowe, a driver fresh out of the Solmar Bay docks, taking jobs from
the fixer Mara Voss while the Solmar Bay Police Department watches every move.
Explore the city on foot or behind the wheel, steal cars, outrun the law, take on
six story missions, fight back when cornered, and build your cash and reputation.

## How to play

Serve `game/` with any static server and open `game/index.html` in a desktop
browser (Chrome recommended), or run it locally:

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests, no install — every file the game loads lives
under `game/`.

### Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move / drive |
| Mouse drag | Orbit camera (click to aim) |
| Shift | Sprint (on foot) / boost (driving) |
| E | Steal / enter a car, exit a car |
| F or left click | Punch (on foot) / shoot |
| Space | Handbrake |
| Esc / P | Pause menu (save, resume, restart) |
| M | Mute sound |

## What is in the game

- **A city to explore** — nine districts of Solmar Bay: downtown towers, the
  marina, the beach strip, the market quarter, the docks and the hills, with
  traffic, pedestrians, palms, street lights and a working day sky.
- **Cars to steal and drive** — traffic cars, parked cars and mission cars, each
  with arcade handling, damage, smoke and a horn.
- **A wanted system** — one to five stars. Steal a car, hit a pedestrian or shoot
  and the Solmar Bay police respond: patrol cars chase, ram and try to bust you.
  Lose them to cool off, or get busted or wasted and pay the price.
- **Missions and a story** — six story jobs for Mara Voss: a first getaway car, a
  package run against the clock, losing a tail, a repo job, a street chase and the
  big marina score, plus cash pickups scattered around the city.
- **Combat** — fists and a pistol, muzzle flashes, hit reactions and police cars
  you can disable.
- **HUD with minimap** — cash, health, wanted stars, speed, mission objective
  with distance, and a live minimap showing you, traffic, police and the mission
  marker.
- **Start screen and save** — a title screen with the story, a pause menu, and
  saving to the browser (cash, missions, position) so you can continue later.
- **Sound** — fully synthesized WebAudio: engine, sirens, gunshots, pickups and
  mission jingles. No audio files.

## Screenshots

The four images in `screenshots/` are real renders of the game running in a
browser: a police chase, the city on foot, driving the beach strip, and a mission
in progress.

## Tech

- [three.js](https://threejs.org/) (vendored as `game/vendor/three.module.min.js`)
- Plain ES modules, no build step, no network requests
- Procedural city, canvas-generated textures, WebAudio synthesis

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to
`/output` and writes `/output/dossier.json` with the vendored make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
