// All sound is synthesized with WebAudio: no audio files, no network. The engine
// hum follows the player's speed, sirens wail while police are close, and every
// action (gunshot, punch, pickup, crash, mission jingle) is a small oscillator or
// noise burst. Audio starts on the first user gesture, as browsers require.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      ctx = null;
    }
    return !!ctx;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.4;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  // A slow, warm bass line that plays under the game once it has started.
  const BASS = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];
  function startMusic() {
    if (musicTimer || !ensure()) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const freq = BASS[musicStep % BASS.length];
      musicStep += 1;
      if (freq) blip(freq, 0.34, 'triangle', 0.10);
    }, 340);
  }

  return {
    unlock() { ensure(); startMusic(); },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
      // Silence the loops outright, so a muted engine cannot linger.
      if (muted && engineGain) engineGain.gain.value = 0;
      if (muted && sirenGain) sirenGain.gain.value = 0;
    },
    isMuted() { return muted; },
    engine(speed01, driving) {
      if (!ctx || muted) return;
      const target = driving ? 0.05 + speed01 * 0.10 : 0.0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
    },
    siren(active, dt) {
      if (!ctx || muted) return;
      sirenTimer += dt;
      const target = active ? 0.045 : 0;
      sirenGain.gain.setTargetAtTime(target, ctx.currentTime, 0.15);
      const phase = Math.floor(sirenTimer * 1.6) % 2;
      sirenOsc.frequency.setTargetAtTime(phase === 0 ? 720 : 960, ctx.currentTime, 0.05);
    },
    gunshot() { noise(0.16, 0.5, 2600); blip(160, 0.1, 'square', 0.18, 60); },
    punch() { noise(0.09, 0.35, 500); },
    pickup() { blip(880, 0.12, 'sine', 0.28); window.setTimeout(() => blip(1320, 0.16, 'sine', 0.28), 90); },
    crash() { noise(0.3, 0.5, 700); },
    horn() { blip(370, 0.22, 'square', 0.12); blip(466, 0.22, 'square', 0.10); },
    jingle() {
      [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => blip(f, 0.22, 'triangle', 0.26), i * 110));
    },
    fail() { [330, 262, 196].forEach((f, i) => window.setTimeout(() => blip(f, 0.3, 'sawtooth', 0.16), i * 160)); },
    click() { blip(660, 0.06, 'sine', 0.18); },
  };
}
