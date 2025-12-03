export default class AudioManager {
  constructor(core) {
    this.core = core;

    // Database of file paths (Populated from JSON)
    this.musicDB = {};
    this.sfxDB = {};

    // State
    this.currentBGM = null; // The actual Audio object for music
    this.currentBGMId = null;
    this.sfxCache = {}; // Cache loaded SFX so we don't reload them every click

    // Base Paths
    // Note: Siguraduhin na match ito sa folder structure mo (e.g., "assets/audio/soundeffects/" kung binago mo)
    this.musicPath = "assets/audio/music/";
    this.sfxPath = "assets/audio/soundeffects/";
  }

  // Called by GameCore after fetching JSONs
  init(musicData, sfxData) {
    this.musicDB = musicData || {};
    this.sfxDB = sfxData || {};

    // 🔥 PRELOADER: Sinusuportahan na ang String at Object format
    console.log("Preloading SFX...");
    Object.keys(this.sfxDB).forEach((key) => {
      const entry = this.sfxDB[key];

      // Check kung string ba ("click.wav") o object ({ src: "click.wav", ... })
      let filename = "";
      if (typeof entry === "string") {
        filename = entry;
      } else {
        filename = entry.src;
      }

      if (filename) {
        const audio = new Audio(this.sfxPath + filename);
        audio.load(); // Force load metadata
        this.sfxCache[key] = audio;
      }
    });

    console.log("AudioManager Initialized:", {
      music: this.musicDB,
      sfx: this.sfxDB,
    });
  }

  // --- HELPERS: Calculate Volume based on Settings ---
  getMasterVolume() {
    return (this.core.settings?.masterVolume ?? 100) / 100;
  }

  getMusicVolume() {
    return (
      ((this.core.settings?.musicVolume ?? 80) / 100) * this.getMasterVolume()
    );
  }

  getSfxVolume() {
    return (
      ((this.core.settings?.sfxVolume ?? 100) / 100) * this.getMasterVolume()
    );
  }

  // --- MUSIC HANDLING ---
  playBGM(id, fadeDuration = 1000) {
    if (this.currentBGMId === id) return; // Already playing this song

    const filename = this.musicDB[id];
    if (!filename) {
      console.warn(`[AudioManager] Music ID not found: ${id}`);
      return;
    }

    // 1. Fade out old music (if any)
    if (this.currentBGM) {
      this.fadeOutAndStop(this.currentBGM, fadeDuration);
    }

    // 2. Setup new music
    const audio = new Audio(this.musicPath + filename);
    audio.loop = true;
    audio.volume = 0; // Start at 0 for fade in

    // Play (Catch error for browser autoplay policies)
    audio
      .play()
      .then(() => {
        this.currentBGM = audio;
        this.currentBGMId = id;
        this.fadeIn(audio, this.getMusicVolume(), fadeDuration);
      })
      .catch((e) => {
        console.warn("[AudioManager] Autoplay blocked or file missing:", e);
      });
  }

  stopBGM(fadeDuration = 1000) {
    if (this.currentBGM) {
      this.fadeOutAndStop(this.currentBGM, fadeDuration);
      this.currentBGM = null;
      this.currentBGMId = null;
    }
  }

  // Call this whenever Settings Slider is moved to update running BGM immediately
  updateVolumes() {
    if (this.currentBGM) {
      this.currentBGM.volume = this.getMusicVolume();
    }
  }

  // --- SFX HANDLING (UPDATED) ---
  playSFX(id) {
    const entry = this.sfxDB[id];
    if (!entry) return;

    // 1. Determine Start Time & Filename
    let startTime = 0;

    // Check kung object may 'start' property
    if (typeof entry === "object" && entry.start) {
      startTime = entry.start;
    }

    // 2. Get Audio from Cache
    let audio = this.sfxCache[id];

    if (audio) {
      // Clone para pwedeng mag-overlap ang tunog (rapid clicks)
      audio = audio.cloneNode();
    } else {
      // Fallback kung sakaling wala sa cache (rare if init ran correctly)
      const filename = typeof entry === "string" ? entry : entry.src;
      audio = new Audio(this.sfxPath + filename);
      this.sfxCache[id] = audio;
    }

    // 3. Apply Start Time (Skip Dead Air)
    if (startTime > 0) {
      audio.currentTime = startTime;
    }

    // 4. Play
    audio.volume = this.getSfxVolume();
    audio.play().catch((e) => {});
  }

  // --- FADE UTILS ---
  fadeIn(audio, targetVol, duration) {
    const step = 50; // ms
    const diff = targetVol / (duration / step);
    const interval = setInterval(() => {
      if (!audio || audio.paused) {
        clearInterval(interval);
        return;
      }
      // Cap at target volume
      if (audio.volume + diff >= targetVol) {
        audio.volume = targetVol;
        clearInterval(interval);
      } else {
        audio.volume += diff;
      }
    }, step);
  }

  fadeOutAndStop(audio, duration) {
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
        audio.volume -= diff;
      }
    }, step);
  }
}
