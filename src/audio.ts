type Scene = "menu" | "rush" | "boss" | "win" | "lose";
type Voice = { source: AudioBufferSourceNode; gain: GainNode };
/** One context keeps all audio under SDK/focus pause control. */
export class StormAudio {
  enabled = true;
  private ctx?: AudioContext;
  private active = true;
  private musicEnabled = true;
  private musicVolume = 0.35;
  private effectVolume = 0.65;
  private musicBus?: GainNode;
  private effectBus?: GainNode;
  private scene: Scene = "menu";
  private playing?: Scene;
  private voice?: Voice;
  private buffers = new Map<string, Promise<AudioBuffer | undefined>>();
  private request = 0;
  private lastEffect = new Map<string, number>();
  unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.musicBus = this.ctx.createGain();
        this.effectBus = this.ctx.createGain();
        this.musicBus.connect(this.ctx.destination);
        this.effectBus.connect(this.ctx.destination);
        this.applyVolumes();
      }
      if (this.active) void this.ctx.resume().catch(() => {});
      void this.syncMusic();
    } catch {}
  }
  configure(
    sound: boolean,
    music: boolean,
    soundVolume: number,
    musicVolume: number,
  ) {
    this.enabled = sound;
    this.musicEnabled = music;
    this.effectVolume = soundVolume / 100;
    this.musicVolume = musicVolume / 100;
    this.applyVolumes();
    void this.syncMusic();
  }
  private applyVolumes() {
    const c = this.ctx;
    if (!c) return;
    this.effectBus?.gain.setTargetAtTime(
      this.enabled ? this.effectVolume : 0,
      c.currentTime,
      0.02,
    );
    this.musicBus?.gain.setTargetAtTime(
      this.musicEnabled ? this.musicVolume : 0,
      c.currentTime,
      0.12,
    );
  }
  setScene(scene: Scene) {
    this.scene = scene;
    void this.syncMusic();
  }
  setActive(active: boolean) {
    this.active = active;
    try {
      if (active) {
        if (this.ctx) void this.ctx.resume().catch(() => {});
        void this.syncMusic();
      } else if (this.ctx) void this.ctx.suspend().catch(() => {});
    } catch {}
  }
  private load(name: string) {
    const c = this.ctx!;
    let buffer = this.buffers.get(name);
    if (!buffer) {
      buffer = fetch(`${import.meta.env.BASE_URL}audio/${name}.mp3`)
        .then((r) => {
          if (!r.ok) throw Error("audio");
          return r.arrayBuffer();
        })
        .then((data) => c.decodeAudioData(data))
        .catch(() => undefined);
      this.buffers.set(name, buffer);
    }
    return buffer;
  }
  private async syncMusic() {
    const c = this.ctx;
    if (
      !c ||
      !this.active ||
      !this.musicEnabled ||
      this.musicVolume === 0 ||
      this.playing === this.scene
    )
      return;
    const scene = this.scene,
      token = ++this.request,
      buffer = await this.load(scene);
    if (
      !buffer ||
      token !== this.request ||
      !this.active ||
      !this.musicEnabled ||
      this.musicVolume === 0 ||
      scene !== this.scene
    )
      return;
    const source = c.createBufferSource(),
      gain = c.createGain();
    source.buffer = buffer;
    source.loop = scene !== "win" && scene !== "lose";
    source.connect(gain);
    gain.connect(this.musicBus!);
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(1, c.currentTime + 0.65);
    const old = this.voice;
    if (old) {
      old.gain.gain.cancelScheduledValues(c.currentTime);
      old.gain.gain.setValueAtTime(old.gain.gain.value, c.currentTime);
      old.gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.65);
      try {
        old.source.stop(c.currentTime + 0.7);
      } catch {}
    }
    this.voice = { source, gain };
    this.playing = scene;
    source.onended = () => {
      gain.disconnect();
      source.disconnect();
    };
    source.start();
  }
  private async sample(name: string, volume = 0.65) {
    const c = this.ctx;
    if (!c || !this.enabled || !this.active) return;
    const now = performance.now();
    if (now - (this.lastEffect.get(name) ?? -Infinity) < 70) return;
    this.lastEffect.set(name, now);
    const buffer = await this.load(name);
    if (!buffer || !this.active || !this.enabled) return;
    const source = c.createBufferSource(),
      gain = c.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(this.effectBus!);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  }
  private tone(
    freq: number,
    duration: number,
    volume = 0.04,
    delay = 0,
    type: OscillatorType = "sine",
  ) {
    const c = this.ctx;
    if (!c || !this.enabled || !this.active) return;
    const t = c.currentTime + delay,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g);
    g.connect(this.effectBus!);
    o.start(t);
    o.stop(t + duration + 0.01);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  ui() {
    void this.sample("ui", 0.4);
  }
  click() {
    this.tone(480 + Math.random() * 90, 0.045, 0.1, 0, "triangle");
  }
  tick() {
    this.tone(1100, 0.06, 0.1, 0, "triangle");
  }
  skill() {
    void this.sample("super", 0.7);
    this.tone(180, 0.16, 0.1, 0, "sawtooth");
  }
  dodge() {
    this.tone(360, 0.08, 0.08);
    this.tone(900, 0.1, 0.06, 0.06);
  }
  bomb() {
    this.tone(60, 0.35, 0.15, 0, "sawtooth");
  }
  box() {
    void this.sample("box");
  }
  win() {
    [523, 659, 784, 1046].forEach((f, i) =>
      this.tone(f, 0.25, 0.08, i * 0.075, "triangle"),
    );
  }
  lose() {
    this.tone(220, 0.3, 0.09, 0, "triangle");
    this.tone(164, 0.4, 0.07, 0.12, "triangle");
  }
  coin() {
    this.tone(1047, 0.1, 0.08);
    this.tone(1568, 0.13, 0.06, 0.04);
  }
}
