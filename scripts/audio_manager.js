export default class AudioManager {
  constructor(core) {
    this.core = core;

    this.musicDB = {};
    this.sfxDB = {};

    this.currentBGM = null;
    this.currentBGMId = null;
    this.sfxCache = {};

    // 🔥 TRACKER: Hawakan natin ang timer ng fade para mapatay natin ito
    this.fadeInterval = null;

    // Paths
    this.musicPath = "assets/audio/music/";
    this.sfxPath = "assets/audio/soundeffects/";
  }

  init(musicData, sfxData) {
    this.musicDB = musicData || {};
    this.sfxDB = sfxData || {};

    console.log("Preloading SFX...");
    Object.keys(this.sfxDB).forEach((key) => {
      const entry = this.sfxDB[key];
      let filename = typeof entry === "string" ? entry : entry.src;

      if (filename) {
        const audio = new Audio(this.sfxPath + filename);
        audio.load();
        this.sfxCache[key] = audio;
      }
    });
    console.log("AudioManager Ready");
  }

  // --- VOLUME CALCULATIONS (With Curve) ---
  // Note: Gumamit tayo ng exponent (vol * vol) para mas natural ang paghina sa tenga.

  getMasterVolume() {
    const raw = (this.core.settings?.masterVolume ?? 100) / 100;
    return raw * raw; // Curve
  }

  getMusicVolume() {
    const raw = (this.core.settings?.musicVolume ?? 80) / 100;
    return raw * raw * this.getMasterVolume();
  }

  getSfxVolume() {
    const raw = (this.core.settings?.sfxVolume ?? 100) / 100;
    return raw * raw * this.getMasterVolume();
  }

  // --- MUSIC HANDLING ---
  playBGM(id, fadeDuration = 1000) {
    if (this.currentBGMId === id) return;

    const filename = this.musicDB[id];
    if (!filename) {
      console.warn(`[AudioManager] Music ID not found: ${id}`);
      return;
    }

    // 1. Fade out old music
    if (this.currentBGM) {
      this.fadeOutAndStop(this.currentBGM, fadeDuration);
    }

    // 2. Setup new music
    const audio = new Audio(this.musicPath + filename);
    audio.loop = true;
    audio.volume = 0; // Start silent

    // 🔥 UPDATE REFERENCE AGAD:
    // Para kung galawin mo ang slider habang nagloload, alam ng system kung sino ang aayusin.
    this.currentBGM = audio;
    this.currentBGMId = id;

    // Kill any existing fade loop from previous song
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    audio
      .play()
      .then(() => {
        // Start Fade In
        this.fadeIn(audio, this.getMusicVolume(), fadeDuration);
      })
      .catch((e) => {
        console.warn("[AudioManager] Autoplay blocked:", e);
      });
  }

  stopBGM(fadeDuration = 1000) {
    // Kill fade loop
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    if (this.currentBGM) {
      this.fadeOutAndStop(this.currentBGM, fadeDuration);
      this.currentBGM = null;
      this.currentBGMId = null;
    }
  }

  // 🔥 IMPORTANT FIX: UPDATE VOLUMES REAL-TIME
  // Tinatawag ito ng SettingsPopup habang nag-dadrag ka.
  updateVolumes() {
    // 1. Stop Fade Loop:
    // "User na ang bahala, wag mo na galawin ang volume automatic."
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    // 2. Apply Volume Instantly:
    if (this.currentBGM) {
      this.currentBGM.volume = this.getMusicVolume();
    }

    // Debugging (Para makita mo sa console kung nagbabago talaga)
    // console.log("Music Vol Updated:", this.getMusicVolume());
  }

  // --- SFX HANDLING ---
  playSFX(id) {
    const entry = this.sfxDB[id];
    if (!entry) return;

    let startTime = 0;
    if (typeof entry === "object" && entry.start) {
      startTime = entry.start;
    }

    let audio = this.sfxCache[id];
    if (audio) {
      audio = audio.cloneNode();
    } else {
      const filename = typeof entry === "string" ? entry : entry.src;
      audio = new Audio(this.sfxPath + filename);
      this.sfxCache[id] = audio;
    }

    if (startTime > 0) audio.currentTime = startTime;

    audio.volume = this.getSfxVolume();
    audio.play().catch((e) => {});
  }

  // --- FADE UTILS ---
  fadeIn(audio, targetVol, duration) {
    // Clear existing interval
    if (this.fadeInterval) clearInterval(this.fadeInterval);

    const step = 50;
    // Calculate amount to change per step
    const diff = targetVol / (duration / step);

    this.fadeInterval = setInterval(() => {
      // Safety check
      if (!audio || audio.paused) {
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
        return;
      }

      // If reached target OR EXCEEDED (important!)
      if (audio.volume + diff >= targetVol) {
        audio.volume = targetVol;
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
      } else {
        // Safe increment
        const next = audio.volume + diff;
        audio.volume = Math.min(next, 1);
      }
    }, step);
  }

  fadeOutAndStop(audio, duration) {
    // Use local interval for fadeOut (since we don't control "old" music anymore)
    const startVol = audio.volume;
    const step = 50;
    const diff = startVol / (duration / step);

    const interval = setInterval(() => {
      if (audio.volume - diff <= 0) {
        audio.volume = 0;
        audio.pause();
        audio.currentTime = 0;
        clearInterval(interval);
      } else {
        const next = audio.volume - diff;
        audio.volume = Math.max(0, next);
      }
    }, step);
  }
}
