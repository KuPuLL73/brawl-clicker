/** The small platform boundary keeps the game playable without a platform in local development. */
export interface SavedData {
  bestScore: number;
  bestWave: number;
  wins: number;
  sound: boolean;
  music: boolean;
  muted?: boolean;
  run?: unknown;
}

type Language = "ru" | "en";
type SavedEnvelope = { version: 1; updatedAt: number; data: SavedData };
type Player = {
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
};
type SDK = {
  screen?: {
    fullscreen?: {
      status?: string;
      request?(): Promise<void>;
      exit?(): Promise<void>;
    };
  };
  serverTime?(): number;
  environment?: { i18n?: { lang?: string } };
  features?: {
    LoadingAPI?: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  on?(event: string, callback: () => void): void;
  getPlayer?(): Promise<Player>;
  adv?: {
    showFullscreenAdv?(options: {
      callbacks: {
        onOpen(): void;
        onClose(wasShown?: boolean): void;
        onError(error?: unknown): void;
      };
    }): void;
    showRewardedVideo?(options: {
      callbacks: {
        onOpen(): void;
        onRewarded(): void;
        onClose(): void;
        onError(error?: unknown): void;
      };
    }): void;
  };
};
type SDKWindow = Window & { YaGames?: { init(): Promise<SDK> } };

const STORAGE_KEY = "last-wagon.save.v1";
const CLOUD_KEY = "lastWagonV1";
const DEFAULTS: SavedData = {
  bestScore: 0,
  bestWave: 0,
  wins: 0,
  sound: true,
  music: true,
};

function finiteInteger(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function sanitize(value: unknown): SavedData {
  if (!value || typeof value !== "object") return { ...DEFAULTS };
  const data = value as Partial<SavedData>;
  return {
    bestScore: finiteInteger(data.bestScore),
    bestWave: finiteInteger(data.bestWave),
    wins: finiteInteger(data.wins),
    sound: typeof data.sound === "boolean" ? data.sound : true,
    music: typeof data.music === "boolean" ? data.music : true,
    ...(typeof data.muted === "boolean" ? { muted: data.muted } : {}),
    ...(data.run !== undefined ? { run: data.run } : {}),
  };
}

function envelope(value: unknown): SavedEnvelope | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Partial<SavedEnvelope>;
  if (item.version !== 1 || !item.data) return undefined;
  return {
    version: 1,
    updatedAt: finiteInteger(item.updatedAt),
    data: sanitize(item.data),
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Platform request timed out")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export class Platform {
  onPause?: () => void;
  onResume?: () => void;

  private sdk?: SDK;
  private player?: Player;
  private initializing?: Promise<{ lang: Language; connected: boolean }>;
  private language: Language = "ru";
  private saved: SavedEnvelope = {
    version: 1,
    updatedAt: 0,
    data: { ...DEFAULTS },
  };
  private pauseReasons = new Set<string>();
  private readyRequested = false;
  private readySent = false;
  private gameplayActive = false;
  private adPending = false;
  private cloudTimer?: ReturnType<typeof setTimeout>;
  private saveRevision = 0;

  constructor(
    private readonly keys = { local: STORAGE_KEY, cloud: CLOUD_KEY },
  ) {
    try {
      this.language = navigator.language.toLowerCase().startsWith("ru")
        ? "ru"
        : "en";
      const raw = localStorage.getItem(this.keys.local);
      this.saved = envelope(raw ? JSON.parse(raw) : undefined) ?? this.saved;
    } catch {
      // Private browsing, damaged saves, and disabled storage must not block play.
    }
  }

  /** Rejections are intentional: the app can show a retry button for a production SDK failure. */
  init(): Promise<{ lang: Language; connected: boolean }> {
    if (this.sdk)
      return Promise.resolve({ lang: this.language, connected: true });
    if (this.initializing) return this.initializing;
    const parts = location.hostname.split(".").map(Number);
    const ipv4 =
      parts.length === 4 &&
      parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
    const privateAddress =
      ipv4 &&
      (parts[0] === 127 ||
        parts[0] === 10 ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31));
    // A phone on the home router is a local preview, just like localhost.
    const local =
      privateAddress ||
      /^(localhost|\[::1\])$/.test(location.hostname) ||
      location.protocol === "file:";
    if (local && new URLSearchParams(location.search).get("platform") !== "1") {
      return Promise.resolve({ lang: this.language, connected: false });
    }
    this.initializing = this.connect().finally(() => {
      this.initializing = undefined;
    });
    return this.initializing;
  }

  private async connect(): Promise<{ lang: Language; connected: boolean }> {
    const sdkWindow = window as SDKWindow;
    if (!sdkWindow.YaGames) await this.loadScript();
    if (!sdkWindow.YaGames)
      throw new Error("Yandex Games SDK could not be loaded. Please retry.");
    const sdk = await withTimeout(sdkWindow.YaGames.init(), 12_000);
    if (!sdk || typeof sdk !== "object")
      throw new Error("Yandex Games SDK initialization failed. Please retry.");
    this.sdk = sdk;
    const sdkLanguage = sdk.environment?.i18n?.lang;
    if (sdkLanguage)
      this.language = sdkLanguage.toLowerCase().startsWith("ru") ? "ru" : "en";
    sdk.on?.("game_api_pause", () => this.setPaused("sdk", true));
    sdk.on?.("game_api_resume", () => this.setPaused("sdk", false));
    if (this.readyRequested) this.ready();
    // No login dialog is opened. Cloud storage is optional and may be unavailable for a guest.
    await this.restoreCloud();
    return { lang: this.language, connected: true };
  }

  private loadScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.getElementById("last-wagon-yandex-sdk");
      existing?.remove();
      const script = document.createElement("script");
      script.id = "last-wagon-yandex-sdk";
      script.src = "/sdk.js";
      script.async = true;
      const timer = setTimeout(
        () =>
          finish(new Error("Yandex Games SDK load timed out. Please retry.")),
        12_000,
      );
      const finish = (error?: Error) => {
        clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        if (error) {
          script.remove();
          reject(error);
        } else resolve();
      };
      script.onload = () => finish();
      script.onerror = () =>
        finish(
          new Error("Yandex Games SDK could not be loaded. Please retry."),
        );
      document.head.append(script);
    });
  }

  private setPaused(reason: string, paused: boolean): void {
    const wasPaused = this.pauseReasons.size > 0;
    if (paused) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
    const isPaused = this.pauseReasons.size > 0;
    if (isPaused === wasPaused) return;
    if (isPaused) this.onPause?.();
    else this.onResume?.();
  }

  ready(): void {
    this.readyRequested = true;
    if (this.readySent || !this.sdk) return;
    try {
      this.sdk.features?.LoadingAPI?.ready();
      this.readySent = true;
    } catch {
      // A retry of ready() is allowed if a platform implementation throws.
    }
  }

  gameplayStart(): void {
    if (this.gameplayActive || this.pauseReasons.size > 0) return;
    this.gameplayActive = true;
    try {
      this.sdk?.features?.GameplayAPI?.start();
    } catch {
      /* Telemetry must not interrupt play. */
    }
  }

  gameplayStop(): void {
    if (!this.gameplayActive) return;
    this.gameplayActive = false;
    try {
      this.sdk?.features?.GameplayAPI?.stop();
    } catch {
      /* Telemetry must not interrupt play. */
    }
  }

  get canReward(): boolean {
    return Boolean(this.sdk?.adv?.showRewardedVideo) && !this.adPending;
  }
  get canInterstitial(): boolean {
    return Boolean(this.sdk?.adv?.showFullscreenAdv) && !this.adPending;
  }
  interstitial(): Promise<boolean> {
    if (!this.canInterstitial) return Promise.resolve(false);
    this.adPending = true;
    this.setPaused("ad", true);
    return new Promise((resolve) => {
      let settled = false,
        opened = false;
      const timer = setTimeout(() => finish(false), 15_000);
      const finish = (shown: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.adPending = false;
        this.setPaused("ad", false);
        resolve(shown);
      };
      try {
        this.sdk!.adv!.showFullscreenAdv!({
          callbacks: {
            onOpen: () => {
              if (!settled) {
                opened = true;
                clearTimeout(timer);
              }
            },
            onClose: (shown) => finish(shown ?? opened),
            onError: () => finish(false),
          },
        });
      } catch {
        finish(false);
      }
    });
  }

  async fullscreen(): Promise<void> {
    const fullscreen = this.sdk?.screen?.fullscreen;
    if (fullscreen?.status === "on" || document.fullscreenElement) return;
    if (fullscreen?.request) {
      await fullscreen.request();
      return;
    }
    if (document.documentElement?.requestFullscreen) {
      await document.documentElement.requestFullscreen();
      return;
    }
    throw Error("fullscreen-unavailable");
  }

  time(): number {
    try {
      const value = this.sdk?.serverTime?.();
      if (typeof value === "number" && Number.isFinite(value)) return value;
    } catch {
      /* Offline previews use the device clock. */
    }
    return Date.now();
  }

  /** A reward is granted exclusively after the SDK's onRewarded callback, and only once. */
  rewarded(): Promise<boolean> {
    if (!this.canReward) return Promise.resolve(false);
    this.adPending = true;
    this.setPaused("ad", true);
    return new Promise((resolve) => {
      let rewarded = false;
      let settled = false;
      // Only time out an ad that never opens; an open video must keep the game muted.
      const openTimer = setTimeout(() => finish(false), 15_000);
      const finish = (success: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(openTimer);
        this.adPending = false;
        this.setPaused("ad", false);
        resolve(success);
      };
      try {
        this.sdk!.adv!.showRewardedVideo!({
          callbacks: {
            onOpen: () => {
              if (!settled) clearTimeout(openTimer);
            },
            onRewarded: () => {
              if (!settled) rewarded = true;
            },
            onClose: () => finish(rewarded),
            onError: () => finish(rewarded),
          },
        });
      } catch {
        finish(false);
      }
    });
  }

  load(): SavedData {
    // Return a clone so an unfinished run cannot mutate the persisted state accidentally.
    try {
      return sanitize(JSON.parse(JSON.stringify(this.saved.data)));
    } catch {
      return { ...this.saved.data };
    }
  }

  save(data: SavedData): void {
    const next = sanitize(data);
    // Callers may hold a clone from before cloud initialization. Records never go backwards.
    next.bestScore = Math.max(next.bestScore, this.saved.data.bestScore);
    next.bestWave = Math.max(next.bestWave, this.saved.data.bestWave);
    next.wins = Math.max(next.wins, this.saved.data.wins);
    this.saved = { version: 1, updatedAt: Date.now(), data: next };
    this.saveRevision += 1;
    this.writeLocal();
    if (this.player) {
      clearTimeout(this.cloudTimer);
      // Coalesce settings changes and checkpoints to stay comfortably below SDK limits.
      this.cloudTimer = setTimeout(() => this.writeCloud(), 1_500);
    }
  }

  private writeLocal(): void {
    try {
      localStorage.setItem(this.keys.local, JSON.stringify(this.saved));
    } catch {
      /* An in-memory save remains available when storage is full or disabled. */
    }
  }

  private async restoreCloud(): Promise<void> {
    const revision = this.saveRevision;
    let active = true;
    try {
      if (!this.sdk?.getPlayer) return;
      const result = await withTimeout(
        (async () => {
          const player = await this.sdk!.getPlayer!();
          if (!active) return undefined;
          const data = await player.getData([this.keys.cloud]);
          if (!active) return undefined;
          return { player, remote: envelope(data[this.keys.cloud]) };
        })(),
        2_500,
      );
      if (!active || !result) return;
      // Only a response that completed inside the boot deadline may affect game state.
      // Late requests cannot replace the caller's already-loaded settings or enable stale writes.
      this.player = result.player;
      const remote = result.remote;
      // A local change made while the request was in flight always wins for settings/run.
      const recent =
        remote &&
        remote.updatedAt > this.saved.updatedAt &&
        revision === this.saveRevision
          ? remote
          : this.saved;
      this.saved = {
        version: 1,
        updatedAt: recent.updatedAt,
        data: {
          ...recent.data,
          bestScore: Math.max(
            this.saved.data.bestScore,
            remote?.data.bestScore ?? 0,
          ),
          bestWave: Math.max(
            this.saved.data.bestWave,
            remote?.data.bestWave ?? 0,
          ),
          wins: Math.max(this.saved.data.wins, remote?.data.wins ?? 0),
        },
      };
      this.writeLocal();
    } catch {
      // A slow network or unavailable guest storage is never a loading screen blocker.
    } finally {
      active = false;
    }
  }

  private writeCloud(): void {
    if (!this.player) return;
    try {
      void this.player
        .setData({ [this.keys.cloud]: this.saved }, false)
        .catch(() => {});
    } catch {
      /* Local data is already saved. */
    }
  }
}
