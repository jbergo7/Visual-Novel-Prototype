import SaveLoadPopup from "./components/save_load_popup.js";

export class GameCore {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.baseWidth = 1920;
    this.baseHeight = 1080;
    this.scaleRatio = 1;
    this.activeScene = null;

    // Runtime data
    this.characters = [];
    this.currentCharacter = null;

    // Cached JSON
    this.dataCache = {
      backgrounds: null,
      scenes: null,
      gameSettings: null,
    };

    // Global click handler
    this.canvas.addEventListener("click", (e) => {
      // if (this.saveLoadPopup?.visible) return;
      if (this.activeScene?.handleGlobalClick) {
        this.activeScene.handleGlobalClick(e);
      }
    });

    // Mutable save data
    this.gameState = null;

    this.saveLoadPopup = new SaveLoadPopup(this);

    window.addEventListener("resize", () => this.resizeCanvas());
  }

  async initialize() {
    await this.preloadData();
    await this.loadCharacters();

    // 🔥 Always start with a fresh NEW GAME state
    this.resetGameState();

    this.gameTitle = this.dataCache.gameSettings.gameTitle;
    this.version = this.dataCache.gameSettings.version;
    this.date_updated = this.dataCache.gameSettings.date_updated;

    console.log("Game Version: " + this.version);
    console.log("🆕 Fresh Runtime Game State:", this.gameState);

    // 🔥 Show ONLY the Title Screen
    await this.loadScene("TitleScreen");

    this.resizeCanvas();
    this.startGameLoop();
  }

  async preloadData() {
    try {
      const [bgRes, sceneRes, settingsRes] = await Promise.all([
        fetch("./data/data-backgrounds.json").then((r) => r.json()),
        fetch("./data/data-scenes.json").then((r) => r.json()),
        fetch("./data/data-gamesettings.json").then((r) => r.json()),
      ]);

      this.dataCache.backgrounds = bgRes;
      this.dataCache.scenes = sceneRes;
      this.dataCache.gameSettings = settingsRes;

      console.log("✅ Game data preloaded:", this.dataCache);
    } catch (err) {
      console.error("❌ Failed to preload game data:", err);
    }
  }

  async loadCharacters() {
    const res = await fetch("./data/data-characters.json");
    const data = await res.json();

    // 🔹 Cache original character data
    this.dataCache.characters = structuredClone(data);

    // 🔹 Runtime copy
    this.characters = data.map((ch) => ({ ...ch }));
    this.currentCharacter =
      this.characters.find((ch) => ch.default === true) || this.characters[0];

    console.log("👤 Characters loaded:", this.characters);
  }

  async loadScene(name) {
    if (this.activeScene?.unload) {
      this.activeScene.unload();
    }

    this.activeScene = null;

    if (name === "TitleScreen") {
      console.log("🔄 Loading Title Screen...");
      const { TitleScreen } = await import("./titlescreen.js");
      const ts = new TitleScreen(this);
      this.setActiveScene(ts);
      return;
    }

    console.warn(`⚠️ Unknown scene '${name}'`);
  }

  updateGameState(type, target, dialogueIndex = 0) {
    if (!this.gameState) return;

    const { currentBackground, currentScene } = this.gameState;
    if (!currentBackground || !currentScene) {
      console.warn("⚠️ Invalid gameState structure.");
      return;
    }

    if (type === "background") {
      currentBackground.active = true;
      currentBackground.target = target;

      currentScene.active = false;
      currentScene.target = null;
      currentScene.dialogues = 0;
    }

    if (type === "scene") {
      currentBackground.active = false;

      currentScene.active = true;
      currentScene.target = target;
      currentScene.dialogues = dialogueIndex ?? 0;
    }

    console.log("🌀 Updated Game State:", this.gameState);
  }

  resizeCanvas() {
    const aspect = this.baseWidth / this.baseHeight;
    let newWidth = window.innerWidth;
    let newHeight = window.innerHeight;

    if (newWidth / newHeight > aspect) {
      newWidth = newHeight * aspect;
    } else {
      newHeight = newWidth / aspect;
    }

    this.canvas.width = newWidth;
    this.canvas.height = newHeight;
    this.scaleRatio = newWidth / this.baseWidth;

    if (this.activeScene?.onResize) {
      this.activeScene.onResize(this.scaleRatio);
    }
  }

  startGameLoop() {
    const loop = () => {
      this.update();
      this.render();
      requestAnimationFrame(loop);
    };
    loop();
  }

  // 🔥 Always resets to ORIGINAL game settings
  resetGameState() {
    // Reset main game state
    this.gameState = structuredClone(this.dataCache.gameSettings.gameState);

    // Reset characters to their default stats from cached JSON
    if (this.dataCache.characters) {
      this.characters = this.dataCache.characters.map((ch) => ({ ...ch }));
      this.currentCharacter =
        this.characters.find((ch) => ch.default === true) || this.characters[0];
    }

    console.log("🔄 Game State reset to default:", this.gameState);
    console.log("🆕 Characters reset to default:", this.characters);
  }

  update() {
    if (this.activeScene?.update) this.activeScene.update();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.activeScene?.render) this.activeScene.render(ctx);
    this.saveLoadPopup.render(ctx);
  }

  setActiveScene(scene) {
    if (this.activeScene?.unload) this.activeScene.unload();
    this.activeScene = scene;
    if (scene.onResize) scene.onResize(this.scaleRatio);
  }
}
