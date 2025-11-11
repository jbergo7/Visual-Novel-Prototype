export class GameCore {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");

    this.baseWidth = 1920;
    this.baseHeight = 1080;

    this.scaleRatio = 1;
    this.activeScene = null;

    // Runtime global character data
    this.characters = [];
    this.currentCharacter = null;

    // ✅ Runtime cached game data (for backgrounds, scenes, etc.)
    this.dataCache = {
      backgrounds: null,
      scenes: null,
    };

    window.addEventListener("resize", () => this.resizeCanvas());
  }

  /**
   * Initialize the game system: preload JSON data, load characters, and start loop.
   */
  async initialize() {
    await this.preloadData(); // ✅ load all JSON first
    await this.loadCharacters();
    this.resizeCanvas();
    this.startGameLoop();
  }

  /**
   * ✅ Preload all game JSONs (backgrounds, scenes, etc.)
   * to avoid repeated fetch calls.
   */
  async preloadData() {
    try {
      const [bgRes, sceneRes] = await Promise.all([
        fetch("./data/data-backgrounds.json").then((r) => r.json()),
        fetch("./data/data-scenes.json").then((r) => r.json()),
      ]);

      this.dataCache.backgrounds = bgRes;
      this.dataCache.scenes = sceneRes;

      console.log("✅ Game data preloaded (backgrounds & scenes)");
    } catch (err) {
      console.error("❌ Failed to preload game data:", err);
    }
  }

  /**
   * Load all character data from JSON and set the active one.
   */
  async loadCharacters() {
    const res = await fetch("./data/data-characters.json");
    const data = await res.json();

    // Deep copy for runtime so original JSON is untouched
    this.characters = data.map((ch) => ({ ...ch }));
    this.currentCharacter =
      this.characters.find((ch) => ch.default === true) || this.characters[0];

    console.log("Runtime character data loaded:", this.characters);
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
    this.activeScene = scene;
    if (scene.onResize) scene.onResize(this.scaleRatio);
  }
}
