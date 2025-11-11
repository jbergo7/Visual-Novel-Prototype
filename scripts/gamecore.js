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

    // ✅ Live runtime game state (mutable copy)
    this.gameState = null;

    window.addEventListener("resize", () => this.resizeCanvas());
  }

  /**
   * 🔹 Main game initialization
   */
  async initialize() {
    await this.preloadData();
    await this.loadCharacters();

    // Clone the gameState for runtime use
    this.gameState = structuredClone(this.dataCache.gameSettings.gameState);
    console.log("✅ Runtime Game State:", this.gameState);

    this.resizeCanvas();

    // 🔹 Auto-start based on active field
    let started = false;

    // 1️⃣ If background is active
    if (this.gameState.currentBackground?.active) {
      const bgTarget = this.gameState.currentBackground.target;
      if (bgTarget) {
        const { Background } = await import("./background.js");
        const bg = new Background(this, bgTarget);
        await bg.load();
        this.setActiveScene(bg);
        started = true;
        console.log(`🎬 Started game with background: ${bgTarget}`);
      }
    }

    // 2️⃣ If scene is active
    if (!started && this.gameState.currentScene?.active) {
      const sceneTarget = this.gameState.currentScene.target;
      const dialogueIndex = this.gameState.currentScene.dialogues || 0;

      if (sceneTarget) {
        const { Scene } = await import("./scene.js");
        const scene = new Scene(this, sceneTarget);
        await scene.load();

        // Continue from saved dialogue index
        scene.currentLine = dialogueIndex;
        this.setActiveScene(scene);
        started = true;
        console.log(
          `🎬 Started game with scene: ${sceneTarget} (dialogue ${dialogueIndex})`
        );
      }
    }

    if (!started) {
      console.warn("⚠️ No active background or scene found in settings!");
    }

    // 🔹 Start game loop
    this.startGameLoop();
  }

  /**
   * 🔹 Fetch all main JSON data before starting
   */
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

  /**
   * 🔹 Load characters JSON
   */
  async loadCharacters() {
    const res = await fetch("./data/data-characters.json");
    const data = await res.json();
    this.characters = data.map((ch) => ({ ...ch }));
    this.currentCharacter =
      this.characters.find((ch) => ch.default === true) || this.characters[0];
    console.log("👤 Characters loaded:", this.characters);
  }

  /**
   * 🔹 Update runtime game state (called by scenes/backgrounds)
   */
  updateGameState(type, target, dialogueIndex = 0) {
    if (!this.gameState) return;

    if (type === "background") {
      this.gameState.currentBackground.active = true;
      this.gameState.currentBackground.target = target;

      this.gameState.currentScene.active = false;
      this.gameState.currentScene.target = null;
      this.gameState.currentScene.dialogues = 0;
    }

    if (type === "scene") {
      this.gameState.currentBackground.active = false;
      this.gameState.currentScene.active = true;
      this.gameState.currentScene.target = target;
      this.gameState.currentScene.dialogues = dialogueIndex ?? 0;
    }

    console.log("🌀 Updated Game State:", this.gameState);
  }

  /**
   * 🔹 Canvas & loop
   */
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
    // 🔹 Properly unload old one before switching
    if (this.activeScene?.unload) {
      this.activeScene.unload();
    }

    this.activeScene = scene;
    if (scene.onResize) scene.onResize(this.scaleRatio);
  }
}
