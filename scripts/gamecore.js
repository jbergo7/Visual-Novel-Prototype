export class GameCore {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");

    this.baseWidth = 1920;
    this.baseHeight = 1080;
    this.scaleRatio = 1;
    this.activeScene = null;

    // ✅ Runtime global data
    this.characters = [];
    this.currentCharacter = null;

    // ✅ Cached JSON data
    this.dataCache = {
      backgrounds: null,
      scenes: null,
      gameSettings: null,
    };

    // ✅ Mutable runtime state
    this.gameState = null;

    window.addEventListener("resize", () => this.resizeCanvas());
  }

  async initialize() {
    await this.preloadData();
    await this.loadCharacters();

    if (!this.dataCache.gameSettings?.gameState) {
      console.error("❌ Invalid or missing game settings JSON");
      return;
    }

    this.gameState = structuredClone(this.dataCache.gameSettings.gameState);
    this.gameTitle = this.dataCache.gameSettings.gameTitle;
    this.version = this.dataCache.gameSettings.version;
    console.log("Game Version: " + this.version);
    console.log("✅ Runtime Game State:", this.gameState);

    this.resizeCanvas();
    let started = false;

    // 🔹 1️⃣ If SCENE is active
    if (this.gameState.currentScene?.active) {
      const sceneTarget = this.gameState.currentScene.target;
      const dialogueIndex = this.gameState.currentScene.dialogues || 0;

      if (sceneTarget) {
        const { Scene } = await import("./scene.js");
        const scene = new Scene(this, sceneTarget);
        await scene.load(dialogueIndex);
        this.setActiveScene(scene);
        console.log(
          `🎬 Started scene '${sceneTarget}' (dialogue ${dialogueIndex})`
        );
        started = true;
      }
    }

    // 🔹 2️⃣ If BACKGROUND is active
    if (!started && this.gameState.currentBackground?.active) {
      const bgTarget = this.gameState.currentBackground.target;
      if (bgTarget) {
        const { Background } = await import("./background.js");
        const bg = new Background(this, bgTarget);
        await bg.load();
        this.setActiveScene(bg);
        console.log(`🏠 Started background '${bgTarget}'`);
        started = true;
      }
    }

    if (!started) {
      console.warn("⚠️ No active background or scene found in settings!");
    }

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
    this.characters = data.map((ch) => ({ ...ch }));
    this.currentCharacter =
      this.characters.find((ch) => ch.default === true) || this.characters[0];
    console.log("👤 Characters loaded:", this.characters);
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

  update() {
    if (this.activeScene?.update) this.activeScene.update();
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.activeScene?.render) this.activeScene.render(ctx);
  }

  setActiveScene(scene) {
    if (this.activeScene?.unload) this.activeScene.unload();
    this.activeScene = scene;
    if (scene.onResize) scene.onResize(this.scaleRatio);
  }
}
