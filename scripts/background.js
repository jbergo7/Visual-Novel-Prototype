import { Header } from "./components/header.js";
import { Button } from "./components/button.js";
import { PopupNotif } from "./components/popup_notif.js";
import { StatsManager } from "./stats_manager.js";
import MenuButton from "./components/menu_button.js";
import MenuPopup from "./components/menu_popup.js";
// 👇 IMPORT SPRITE
import { Sprite } from "./components/sprite.js";

export class Background {
  constructor(core, backgroundId) {
    this.core = core;
    this.backgroundId = backgroundId;

    this.bgData = null;
    this.image = null;
    this.buttons = [];
    this.scale = 1;
    this.isLoading = false;

    // 👇 INITIALIZE SPRITE MANAGER
    this.sprite = new Sprite(core);

    // Shared singletons
    if (!core.header) core.header = new Header(core);
    if (!core.popupNotif) core.popupNotif = new PopupNotif(core);
    if (!core.statsManager) core.statsManager = new StatsManager(core);
    if (!core.menuButton) core.menuButton = new MenuButton(core);
    if (!core.menuPopup) core.menuPopup = new MenuPopup(core);

    this.header = core.header;
    this.popupNotif = core.popupNotif;
    this.statsManager = core.statsManager;
    this.menuButton = core.menuButton;
    this.menuPopup = core.menuPopup;
  }

  async load() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const bgCache = this.core.dataCache?.backgrounds;
      this.bgData = bgCache[this.backgroundId];

      if (this.bgData.autosave) {
        this.core.saveloadHandler.autosave(this.core);
        this.popupNotif?.show("Autosave", "blue");
        console.log(
          `%c[AUTOSAVE] Background loaded: ${this.backgroundId}`,
          "color: cyan; font-weight: bold;"
        );
      }

      if (!this.bgData)
        throw new Error(`Background '${this.backgroundId}' not found.`);

      // 🔥 NEW: Play Background Music if defined
      if (this.bgData.music) {
        this.core.audioManager.playBGM(this.bgData.music);
      }

      console.debug(`🎨 Loading background: ${this.backgroundId}`);

      // Load image
      const img = new Image();
      img.src = this.bgData.image;
      await new Promise((r) => (img.onload = r));
      this.image = img;

      this.unload();

      // 👇 LOAD SPRITES IF AVAILABLE
      if (this.bgData.sprite) {
        await this.sprite.update(this.bgData.sprite);
      } else {
        this.sprite.clear(); // Clear if no sprites defined for this background
      }

      // Create buttons
      this.buttons = (this.bgData.buttons || []).map((btnData) => {
        const btn = new Button(this.core, btnData);

        btn.addClickListener(async () => {
          if (this.menuPopup.visible) return;
          if (this.isLoading) return;

          // 🔥 NEW: Play Button SFX if defined
          if (btnData.soundeffects) {
            this.core.audioManager.playSFX(btnData.soundeffects);
          } else {
            // Optional: Default click sound kung walang specific sfx
            // this.core.audioManager.playSFX("click");
          }

          const action = btn.data?.action;
          if (!action) return;

          // 🔍 AUTOSAVE: action-level
          if (action.autosave) {
            this.core.saveloadHandler.autosave(this.core);
            this.popupNotif?.show("Autosave", "blue");
            console.log(
              `%c[AUTOSAVE] Button action triggered in ${this.backgroundId} → ${action.type}:${action.target}`,
              "color: yellow; font-weight: bold;"
            );
          }

          const check = this.statsManager.checkResources(action);
          if (!check.enough) {
            this.popupNotif.show(check.message, "red");
            return;
          }

          if (
            typeof action.max_energy === "number" &&
            action.max_energy !== 0
          ) {
            this.statsManager.modifyMaxEnergy(action.max_energy);
          }

          this.statsManager.applyStats(action);

          if (!action.type) return;

          this.isLoading = true;
          this.unload();

          switch (action.type) {
            case "background": {
              this.core.updateGameState("background", action.target);
              const { Background } = await import("./background.js");
              const bg = new Background(this.core, action.target);
              await bg.load();
              this.core.setActiveScene(bg);
              break;
            }
            case "scene": {
              this.core.updateGameState("scene", action.target, 0);
              const { Scene } = await import("./scene.js");
              const scene = new Scene(this.core, action.target);
              await scene.load();
              this.core.setActiveScene(scene);
              break;
            }
            case "function":
              this.executeGameFunction(action.name);
              break;
          }

          this.isLoading = false;
        });

        return btn;
      });

      this.onResize(this.scale);
      console.debug(`✅ Background ready: ${this.backgroundId}`);
    } catch (err) {
      console.error("❌ Failed to load background:", err);
    } finally {
      this.isLoading = false;
    }
  }

  unload() {
    this.buttons.forEach((btn) => btn.removeClickListener());
    this.buttons = [];
    // 👇 Clear sprites on unload
    this.sprite.clear();
  }

  onResize(scale) {
    this.scale = scale;

    this.buttons.forEach((btn) => btn.resize(scale));
    this.header?.onResize(scale);
    this.popupNotif?.onResize(scale);
    // Sprite handles its own resize via render percentages
  }

  executeGameFunction(name) {
    const c = this.core.currentCharacter;
    if (!c) return;

    switch (name) {
      case "restPlayer":
        c.energy = c.max_energy || 100;
        this.popupNotif.show("Energy Restored", "green");
        break;
    }
  }

  handleGlobalClick(e) {
    const rect = this.core.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.menuButton.containsPoint(x, y)) {
      this.menuPopup.toggle();
      return;
    }

    if (this.menuPopup.visible) return;
  }

  render(ctx) {
    const canvas = this.core.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Background Image
    if (this.image)
      ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    else ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 👇 2. Render Sprite (Over Background, Under Buttons)
    this.sprite.render(ctx);

    // 3. UI Elements
    this.header?.render(ctx);
    this.buttons.forEach((btn) => btn.render(ctx));
    this.popupNotif?.render(ctx);

    if (this.menuPopup.visible) {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    this.menuButton.render(ctx);
    this.menuPopup.render(ctx);
  }
}
