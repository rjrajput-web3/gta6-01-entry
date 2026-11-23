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

## The open world, on foot and by car

Solmar Bay is a full procedural city — nine districts of towers, palms and
street lights: downtown, the marina, the beach strip, the market quarter, the
docks and the hills, with a beach and ocean to the south and a working day sky.
It is alive before you touch a single mission:

- **Traffic** — 30 cars cruise the road grid on their own: sedans, taxis,
  sports cars, vans and trucks that turn at intersections, slow for the car
  ahead and scatter when you block the road, plus parked cars on the quieter
  streets waiting to be stolen.
- **Pedestrians** — 48 locals stroll the sidewalks, cross the avenues, and
  run when a car mounts the kerb or a shot goes off.
- **On foot and behind the wheel** — walk the whole city, steal any car with
  one key, and drive it with arcade handling, boost, handbrake slides, horns
  and damage. Every district is reachable both ways.

## Wanted level and the police

Crime is watched. Steal a car, hit a pedestrian or open fire and your wanted
level climbs from one to five stars, and the Solmar Bay PD answers with a
named response system:

- **Patrol pursuit** — patrol cars spawn across the city and hunt you: they
  chase, cut corners, ram your car to damage it, and box you in. On foot, a
  patrol car that stays on top of you busts you.
- **Roadblocks** — at four and five stars, dispatch sets a roadblock on the
  road ahead of you: two patrol cars parked across the lane, lights flashing,
  an officer standing at each car. Hit it at speed and it wrecks your momentum
  and your car. Outrun it, loop around it, or lose the heat and watch it lift.
- **The cool-off** — break line of sight and stay clean and the stars fall,
  one by one, until the patrols give up and drive away. Get busted or wasted
  and you pay for it in cash.

## Nine story missions

Mara Voss has nine jobs that tell Jax's story, each with its own brief,
objective marker and beacon, timers where the job demands speed, and a cash
payout that autosaves your progress:

1. **First Wheels** — steal a getaway car and deliver it to the marina.
2. **Package Run** — pick up a package at the market and beat the clock to the docks.
3. **Lose the Tail** — draw two stars of police attention, then lose them completely.
4. **Repo Job** — take the red sports car from the beach lot to Mara's garage.
5. **Street Heat** — disable three patrol cars, by gunfire or by ramming.
6. **The Marina Score** — grab the marina van's cash and escape to the hills hideout.
7. **Marina to Hills Run** — a timed cross-city delivery from the marina to a buyer in the hills.
8. **Roadblock Run** — draw four stars and run the roadblocks to the hideout.
9. **The Big Score** — take the armored van's vault cash at the docks and run it to the garage under a four-star response, for the biggest payout of the story.

## Depth and systems

- **Combat** — fists and a pistol with muzzle flashes, hit reactions and
  patrol cars you can shoot out or ram out; pedestrians and police react.
- **Car damage** — every car has health: crashes, rams and roadblocks smoke,
  wreck and finally kill it, and a wrecked car throws you out hurt.
- **Cash economy** — mission payouts, cash pickups hidden around the city
  (each one also tops up your ammo), and real losses when you are busted or
  wasted.
- **Save and continue** — pause-menu saving to the browser (cash, missions,
  position, pickups), a title screen with the story, and a continue option
  that picks the city up where you left it.

## HUD with minimap

The screen always tells the story at a glance: cash, health bar, wanted
stars, speed and ammo, the current mission objective with its distance or
countdown timer, toasts and job banners — and a live circular minimap that
plots the road grid, the ocean, you, traffic, police, cash pickups and the
mission beacon, so a chase reads on the map exactly as it plays on the street.

## Look and originality

Solmar Bay is its own place: a warm, sun-soaked modern coastal city in late
afternoon light, built procedurally from a single seed — canvas-generated
building facades with lit windows, palms and lamps on every block, beach
umbrellas on the sand, a marina pier, and district signs to navigate by. The
sound is fully synthesized WebAudio — engine, sirens, gunshots, pickups and
mission jingles — with no audio files and no borrowed assets.

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

## Screenshots

The four images in `screenshots/` are real renders of the game running in a
browser, staged from live game states: a five-star chase with two patrol cars
on the player's tail and a police roadblock across the avenue ahead; downtown
on foot, crowded with pedestrians and traffic; a drive down the beach strip
past beach crowds and oncoming traffic; and a story mission in progress, on
foot toward the objective beacon with a patrol car rolling in.
All four images are real renders captured from the running game at 1280x720.

## Tech

- [three.js](https://threejs.org/) (vendored as `game/vendor/three.module.min.js`)
- Plain ES modules, no build step, no network requests
- Procedural city, canvas-generated textures, WebAudio synthesis
- Game structure: one module per system in `game/src/` — `world.js` owns the
  scene and steps every system together; `city.js`, `vehicles.js`,
  `pedestrians.js`, `police.js` (wanted levels, pursuit and roadblocks),
  `missions.js` (the nine jobs), `combat.js`, `hud.js` (HUD and minimap) and
  `shots.js` (the staged screenshot scenes) each do one job.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to
`/output` and writes `/output/dossier.json` with the vendored make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
