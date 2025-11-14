import { Header } from "./components/header.js";
import { Button } from "./components/button.js";
import { PopupNotif } from "./components/popup_notif.js";
import { StatsManager } from "./stats_manager.js";
import MenuPopup from "./components/menu_popup.js";

export class Background {
  constructor(core, backgroundId) {
    this.core = core;
    this.backgroundId = backgroundId;
    this.bgData = null;
    this.image = null;
    this.buttons = [];

    // Shared singletons
    if (!core.header) core.header = new Header(core);
    if (!core.popupNotif) core.popupNotif = new PopupNotif(core);
    if (!core.statsManager) core.statsManager = new StatsManager(core);
    if (!core.menuPopup) core.menuPopup = new MenuPopup(core);

    this.header = core.header;
    this.popupNotif = core.popupNotif;
    this.statsManager = core.statsManager;
    this.menuPopup = core.menuPopup;

    this.scale = 1;
    this.isLoading = false;
  }

  async load() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const bgCache = this.core.dataCache?.backgrounds;
      if (!bgCache) throw new Error("Background data not found in cache");

      this.bgData = bgCache[this.backgroundId];
      if (!this.bgData)
        throw new Error(`Background '${this.backgroundId}' not found.`);

      console.debug(`🎨 Loading background: ${this.backgroundId}`);

      // Load background image
      const img = new Image();
      img.src = this.bgData.image;
      await new Promise((resolve) => (img.onload = resolve));
      this.image = img;

      // Clean previous buttons
      this.unload();

      // Build buttons
      this.buttons = (this.bgData.buttons || []).map((btnData) => {
        const btn = new Button(this.core, btnData);

        // Add safe click listener that respects menu popup visibility
        btn.addClickListener(async () => {
          if (this.core.menuPopup?.visible) return;
          if (this.isLoading) return;

          const action = btn.data?.action;
          if (!action) return;

          // Check resources
          const check = this.statsManager.checkResources(action);
          if (!check.enough) {
            this.popupNotif.show(check.message, "red");
            return;
          }

          // Apply max_energy
          if (
            typeof action.max_energy === "number" &&
            action.max_energy !== 0
          ) {
            this.statsManager.modifyMaxEnergy(action.max_energy);
          }

          // Apply other stats
          this.statsManager.applyStats(action);

          // Stop if no transition
          if (!action.type) return;

          // Handle transitions
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

      // Initial resize
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
  }

  onResize(scale) {
    this.scale = scale;
    this.buttons.forEach((btn) => btn.resize(scale));
    this.header?.onResize(scale);
    this.popupNotif?.onResize(scale);
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

  render(ctx) {
    const canvas = this.core.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw background
    if (this.image)
      ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    else ctx.fillRect(0, 0, canvas.width, canvas.height);

    // draw header
    this.header?.render(ctx);

    // draw buttons
    this.buttons.forEach((btn) => btn.render(ctx));

    // draw popup notifications
    this.popupNotif?.render(ctx);

    // overlay if menuPopup visible
    if (this.menuPopup?.visible) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // render menu popup on top
    this.menuPopup?.render(ctx);
  }
}
