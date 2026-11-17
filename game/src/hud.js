// The HUD: cash, health, wanted stars, the mission objective, speed, toasts and
// banners, plus the live minimap — a top-down canvas of the roads, the player,
// traffic, police and the mission beacon.
import { CITY } from './config.js';
import { currentMission, currentStep, MISSIONS } from './missions.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    hud: $('hud'), cashval: $('cashval'), healthfill: $('healthfill'),
    stars: $('stars'), mtitle: $('mtitle'), mtext: $('mtext'), mdist: $('mdist'),
    speedval: $('speedval'), toast: $('toast'), banner: $('banner'),
    bannerbig: $('bannerbig'), bannersub: $('bannersub'), crosshair: $('crosshair'),
    ammoval: $('ammoval'),
    vignette: $('vignette'), menu: $('menu'), pause: $('pause'), end: $('end'),
    endTitle: $('end-title'), endText: $('end-text'), pauseStats: $('pause-stats'),
    minimap: $('minimap'), status: $('status'),
  };
  const mapCtx = els.minimap.getContext('2d');
  let toastTimer = null;
  let bannerTimer = null;

  function announce(message) {
    els.status.textContent = message;
  }

  return {
    els,
    showHud() { els.hud.classList.add('on'); },
    hideHud() { els.hud.classList.remove('on'); },
    showMenu() { els.menu.classList.add('on'); },
    hideMenu() { els.menu.classList.remove('on'); },
    showPause() { els.pause.classList.add('on'); },
    hidePause() { els.pause.classList.remove('on'); },
    showEnd(title, text) {
      els.endTitle.textContent = title;
      els.endText.textContent = text;
      els.end.classList.add('on');
    },
    hideEnd() { els.end.classList.remove('on'); },
    toast(message, ms) {
      els.toast.textContent = message;
      els.toast.style.display = 'block';
      announce(message);
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { els.toast.style.display = 'none'; }, ms || 3200);
    },
    banner(big, sub, ms) {
      els.bannerbig.textContent = big;
      els.bannersub.textContent = sub || '';
      els.banner.style.display = 'block';
      announce(`${big}. ${sub || ''}`);
      if (bannerTimer) clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { els.banner.style.display = 'none'; }, ms || 3600);
    },
    flashDamage() {
      els.vignette.style.display = 'block';
      setTimeout(() => { els.vignette.style.display = 'none'; }, 260);
    },
    setCrosshair(on) { els.crosshair.style.display = on ? 'block' : 'none'; },
    setPauseStats(text) { els.pauseStats.textContent = text; },

    // Per-frame HUD refresh from the world state.
    update(world) {
      const player = world.player;
      els.cashval.textContent = world.cash.toLocaleString('en-US');
      els.healthfill.style.width = `${Math.max(0, player.health)}%`;
      els.healthfill.style.background = player.health > 50
        ? 'linear-gradient(90deg, #37d67a, #a5e635)'
        : player.health > 25 ? 'linear-gradient(90deg, #e8a13a, #e8d23a)' : 'linear-gradient(90deg, #e83a3a, #e86a3a)';
      let starHtml = '';
      for (let i = 1; i <= 5; i += 1) {
        starHtml += i <= world.police.level ? '★' : '<span class="dim">★</span>';
      }
      els.stars.innerHTML = starHtml;
      const speed = player.inCar ? Math.abs(player.inCar.speed) * 2.237 : Math.abs(player.speed || 0) * 2.237;
      els.speedval.textContent = String(Math.round(speed));
      els.ammoval.textContent = String(world.combat.ammo);
      // The crosshair only matters on foot, when the pistol is the weapon.
      els.crosshair.style.display = player.inCar ? 'none' : 'block';
      const mission = currentMission(world.missions);
      if (mission) {
        const step = currentStep(world.missions);
        els.mtitle.textContent = world.missions.active ? mission.title : `${mission.title} — ready`;
        els.mtext.textContent = world.missions.active ? step.text : mission.brief;
        if (world.missions.active && world.missions.timerMax > 0) {
          els.mdist.textContent = `⏱ ${Math.ceil(world.missions.timer)}s left`;
        } else if (world.missions.active) {
          const target = world.missionTargetPos;
          els.mdist.textContent = target
            ? `◆ ${Math.round(Math.hypot(target.x - player.pos.x, target.z - player.pos.z))} m`
            : '';
        } else {
          els.mdist.textContent = 'Press E near Mara\'s marker — or just explore.';
        }
      } else {
        els.mtitle.textContent = 'Story complete';
        els.mtext.textContent = `All ${MISSIONS.length} jobs done. Free roam Solmar Bay — the city is yours.`;
        els.mdist.textContent = '';
      }
      drawMinimap(mapCtx, world);
    },
  };
}

function drawMinimap(ctx, world) {
  const S = 200;
  const range = CITY.bound + 40;
  const toMap = (x, z) => [S / 2 + (x / range) * (S / 2), S / 2 + (z / range) * (S / 2)];
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#16283d';
  ctx.fillRect(0, 0, S, S);
  // Ocean to the south.
  ctx.fillStyle = '#2e7fa8';
  const [, bayY] = toMap(0, -CITY.half - 20);
  ctx.fillRect(0, 0, S, bayY);
  // Blocks.
  ctx.fillStyle = '#3a4a5c';
  for (let bx = 0; bx < CITY.blocks; bx += 1) {
    for (let bz = 0; bz < CITY.blocks; bz += 1) {
      const cx = -CITY.half + bx * CITY.pitch + CITY.block / 2;
      const cz = -CITY.half + bz * CITY.pitch + CITY.block / 2;
      const [x, y] = toMap(cx - CITY.block / 2, cz - CITY.block / 2);
      const w = (CITY.block / range) * (S / 2);
      ctx.fillRect(x, y, w, w);
    }
  }
  // Roads.
  ctx.strokeStyle = '#8a929e';
  ctx.lineWidth = 2;
  for (const line of world.city.roadLines) {
    const [x1] = toMap(line, 0);
    ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke();
    const [, y1] = toMap(0, line);
    ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(S, y1); ctx.stroke();
  }
  // Mission beacon.
  if (world.missionTargetPos) {
    const [x, y] = toMap(world.missionTargetPos.x, world.missionTargetPos.z);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke();
  }
  // Cash pickups.
  ctx.fillStyle = '#7dff9b';
  for (const p of world.pickups) {
    if (p.taken) continue;
    const [x, y] = toMap(p.pos.x, p.pos.z);
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
  // Traffic.
  ctx.fillStyle = '#dfe6ee';
  for (const car of world.traffic.cars) {
    if (car.dead) continue;
    const [x, y] = toMap(car.pos.x, car.pos.z);
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  // Police.
  ctx.fillStyle = '#4da3ff';
  for (const car of world.police.cars) {
    if (car.dead) continue;
    const [x, y] = toMap(car.pos.x, car.pos.z);
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // The player: a white arrow pointing where they face. Canvas +y is world +z,
  // and the arrow is drawn pointing up, so rotate by PI minus the heading.
  const player = world.player;
  const [px, py] = toMap(player.pos.x, player.pos.z);
  const heading = player.inCar ? player.inCar.heading : player.heading;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI - heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();
}
