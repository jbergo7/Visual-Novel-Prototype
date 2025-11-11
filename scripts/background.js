import { Header } from "./components/header.js";
import { Button } from "./components/button.js";
import { PopupNotif } from "./components/popup_notif.js";
import { StatsManager } from "./stats_manager.js";

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

    this.header = core.header;
    this.popupNotif = core.popupNotif;
    this.statsManager = core.statsManager;

    this.scale = 1;
    this.isLoading = false;
  }

  async load() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      // ✅ Use runtime cached backgrounds
      const bgCache = this.core.dataCache?.backgrounds;
      if (!bgCache) throw new Error("Background data not found in cache");

      this.bgData = bgCache[this.backgroundId];
      if (!this.bgData)
        throw new Error(`Background '${this.backgroundId}' not found.`);

      console.debug(`🎨 Loading background: ${this.backgroundId}`);

      // ✅ Load image
      const img = new Image();
      img.src = this.bgData.image;
      await new Promise((resolve) => (img.onload = resolve));
      this.image = img;

      // ✅ Clean previous buttons to avoid double event binding
      this.unload();

      // ✅ Build buttons
      this.buttons = (this.bgData.buttons || []).map((btnData) => {
        const btn = new Button(this.core, btnData);

        btn.addClickListener(async () => {
          if (this.isLoading) return;
          const action = btn.data?.action;
          if (!action) return;

          // ✅ 1. Check resources first
          const check = this.statsManager.checkResources(action);
          if (!check.enough) {
            this.popupNotif.show(check.message, "red");
            return;
          }

          // ✅ 2. Apply max_energy first
          if (
            typeof action.max_energy === "number" &&
            action.max_energy !== 0
          ) {
            this.statsManager.modifyMaxEnergy(action.max_energy);
          }

          // ✅ 3. Apply stat updates
          this.statsManager.applyStats(action);

          // ✅ 4. Stop if no transition
          if (!action.type) return;

          // ✅ 5. Handle transitions
          this.isLoading = true;
          this.unload();

          switch (action.type) {
            case "background": {
              // 🌀 Update runtime gamestate
              this.core.updateGameState("background", action.target);

              const { Background } = await import("./background.js");
              const bg = new Background(this.core, action.target);
              await bg.load();
              this.core.setActiveScene(bg);
              break;
            }

            case "scene": {
              // 🌀 Update runtime gamestate
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
    if (this.image) {
      ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    this.header?.render(ctx);
    this.buttons.forEach((btn) => btn.render(ctx));
    this.popupNotif?.render(ctx);
  }
}
