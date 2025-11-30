import SaveLoadPopup from "./components/save_load_popup.js";
import SaveLoad from "./components/save_load_method.js";

export class GameCore {
  constructor(canvasId) {
    // [PURPOSE] Setup the Canvas and 2D Drawing Context
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");

    // [PURPOSE] Base Resolution (Full HD). logic uses this 1920x1080 coordinate system.
    this.baseWidth = 1920;
    this.baseHeight = 1080;
    this.scaleRatio = 1; // Used to scale mouse clicks/UI when window resizes
    this.activeScene = null;

    // [PURPOSE] Helper class for saving/loading strings to LocalStorage
    this.saveloadHandler = new SaveLoad();

    this.characters = [];
    this.currentCharacter = null;

    // [PURPOSE] Stores active runtime settings (Volume, Speed, Fullscreen)
    // [DEBUGGING TIP] If settings are not applying, check if this is null.
    this.settings = null;

    // [PURPOSE] Central Cache for all loaded JSON data.
    // Instead of fetching repeatedly, we fetch once and store here.
    this.dataCache = {
      gameGUI: null, // GUI Styles
      backgrounds: null, // Background definitions
      scenes: null, // Dialogue/Script data
      gameSettings: null, // Game Meta (Version, Title)
      userSettings: null, // User Preferences
      characterSprites: null, // Sprite coordinates
      characters: null, // Character stats
    };

    // [PURPOSE] Global Click Listener
    // This captures ALL clicks on the canvas and sends them to the current scene.
    // [DEBUGGING TIP] If buttons aren't working, check if 'handleGlobalClick' exists in the active scene.
    this.canvas.addEventListener("click", (e) => {
      if (this.activeScene?.handleGlobalClick) {
        this.activeScene.handleGlobalClick(e);
      }
    });

    this.gameState = null; // Holds current progress (Chapter, Day, Variables)

    // [PURPOSE] Initialize the Save/Load GUI Overlay
    this.saveLoadPopup = new SaveLoadPopup(this);

    // [PURPOSE] Handle Window Resizing
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  // ========================================================
  // CORE INITIALIZATION
  // ========================================================
  async initialize() {
    // 1. Wait for all JSON files to load
    await this.preloadData();
    await this.loadCharacters();

    // [PURPOSE] Initialize User Settings (Volume/Speed)
    // [FETCH SOURCE] data-settings.json (stored in dataCache.userSettings)
    if (this.dataCache.userSettings) {
      this.settings = { ...this.dataCache.userSettings };
    } else {
      // [FALLBACK] If JSON fails, use these defaults
      this.settings = {
        masterVolume: 100,
        musicVolume: 80,
        sfxVolume: 100,
        textSpeed: 50,
        fullscreen: false,
      };
    }

    // [PURPOSE] Start a "New Game" state based on defaults
    this.resetGameState();

    // [PURPOSE] Set Meta Data
    this.gameTitle = this.dataCache.gameSettings.gameTitle;
    this.version = this.dataCache.gameSettings.version;
    this.date_updated = this.dataCache.gameSettings.date_updated;

    console.log("Active Settings:", this.settings);

    // [PURPOSE] Load the first scene (Title Screen)
    await this.loadScene("TitleScreen");

    // [PURPOSE] Final setup
    this.resizeCanvas();
    this.startGameLoop();
  }

  // ========================================================
  // DATA FETCHING (CRITICAL FOR DEBUGGING)
  // ========================================================
  async preloadData() {
    try {
      // [PURPOSE] Parallel Fetching. We load all JSONs at once for speed.
      // [DEBUGGING TIP] If the game freezes at start, check the Network Tab in browser.
      // One of these files might be 404 (Not Found) or invalid JSON.
      const [
        gameGUI,
        bgRes,
        sceneRes,
        settingsRes,
        userSettingsRes,
        characterSprites,
      ] = await Promise.all([
        // [FETCH SOURCE] GUI Styling (Colors, Borders)
        fetch("./data/data-game-gui.json").then((r) => r.json()),

        // [FETCH SOURCE] Background Image Definitions
        fetch("./data/data-backgrounds.json").then((r) => r.json()),

        // [FETCH SOURCE] Story Script (Dialogues)
        fetch("./data/data-scenes.json").then((r) => r.json()),

        // [FETCH SOURCE] Game Metadata (Version, Title, Start State)
        fetch("./data/data-gamesettings.json").then((r) => r.json()),

        // [FETCH SOURCE] User Preferences (Volume, Text Speed defaults)
        fetch("./data/data-settings.json").then((r) => r.json()),

        // [FETCH SOURCE] Sprite Sheet Coordinates
        fetch("./data/data-character-sprites.json").then((r) => r.json()),
      ]);

      // Store loaded data into Cache
      this.dataCache.gameGUI = gameGUI;
      this.dataCache.backgrounds = bgRes;
      this.dataCache.scenes = sceneRes;
      this.dataCache.gameSettings = settingsRes;
      this.dataCache.userSettings = userSettingsRes;
      this.dataCache.characterSprites = characterSprites;

      console.log("Game data preloaded:", this.dataCache);
    } catch (err) {
      // [DEBUGGING TIP] This error usually means a JSON syntax error or missing file.
      console.error("Failed to preload data:", err);
    }
  }

  async loadCharacters() {
    // [FETCH SOURCE] Character Stats (Name, Money, Energy)
    const res = await fetch("./data/data-characters.json");
    const data = await res.json();

    // Keep a clean copy in cache (for resets)
    this.dataCache.characters = structuredClone(data);
    // Create a runtime copy (that changes during game)
    this.characters = data.map((ch) => ({ ...ch }));
    console.log("Characters loaded:", this.characters);
  }

  // ========================================================
  // SCENE MANAGEMENT
  // ========================================================
  async loadScene(name) {
    // Unload previous scene to free memory/stop listeners
    if (this.activeScene?.unload) this.activeScene.unload();
    this.activeScene = null;

    // [PURPOSE] Dynamic Scene Loading
    if (name === "TitleScreen") {
      const { TitleScreen } = await import("./titlescreen.js");
      const ts = new TitleScreen(this);
      this.setActiveScene(ts);
      return;
    }

    console.warn(`Unknown scene '${name}'`);
  }

  // [PURPOSE] Updates the global game state (current background, scene pointer)
  updateGameState(type, target, dialogueIndex = 0) {
    if (!this.gameState) return;

    const { currentBackground, currentScene } = this.gameState;

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
  }

  // ========================================================
  // DISPLAY & LOOP
  // ========================================================
  resizeCanvas() {
    // [PURPOSE] Maintains Aspect Ratio (Letterboxing)
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

    // [PURPOSE] scaleRatio is used by UI elements (buttons/text) to resize themselves
    this.scaleRatio = newWidth / this.baseWidth;

    if (this.activeScene?.onResize) {
      this.activeScene.onResize(this.scaleRatio);
    }
  }

  startGameLoop() {
    // [PURPOSE] The Heart of the Game. Runs ~60 times per second.
    const loop = () => {
      this.update(); // Logic
      this.render(); // Drawing
      requestAnimationFrame(loop);
    };
    loop();
  }

  // [PURPOSE] Hard Reset. Used when clicking "New Game".
  // Reloads state from 'data-gamesettings.json'
  resetGameState() {
    this.gameState = structuredClone(this.dataCache.gameSettings.gameState);
    if (this.dataCache.characters) {
      this.characters = this.dataCache.characters.map((ch) => ({ ...ch }));
    }
    const targetId = this.gameState.currentCharacterId;
    this.currentCharacter =
      this.characters.find((ch) => ch.id === targetId) || this.characters[0];
  }

  // [PURPOSE] Propagates logic updates to the active scene
  update() {
    if (this.activeScene?.update) this.activeScene.update();
  }

  // [PURPOSE] Propagates drawing commands to the active scene
  // [DEBUGGING TIP] We pass 'this.ctx' (Context 2D) to the scene.
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render Scene first (Background/Characters)
    if (this.activeScene?.render) this.activeScene.render(ctx);

    // Render Save/Load Popup on top of everything
    this.saveLoadPopup.render(ctx);
  }

  setActiveScene(scene) {
    if (this.activeScene?.unload) this.activeScene.unload();
    this.activeScene = scene;
    if (scene.onResize) scene.onResize(this.scaleRatio);
  }
}
