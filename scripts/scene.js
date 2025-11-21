import { DialogueBox } from "./components/dialoguebox.js";
import { DialogueChoices } from "./components/dialogue_choices.js";
import { PopupNotif } from "./components/popup_notif.js";
import { StatsManager } from "./stats_manager.js";
import MenuButton from "./components/menu_button.js";
import MenuPopup from "./components/menu_popup.js";
// import SaveLoad from "./components/save_load_method.js";

export class Scene {
  constructor(core, sceneId) {
    this.core = core;
    this.sceneId = sceneId;
    this.data = null;
    this.image = null;
    this.dialogues = [];
    this.currentLine = -1;

    // this.autosaver = new SaveLoad();

    this.appliedStats = {};
    this.appliedChoiceStats = {};
    // NEW: track original state before entering a choice line
    this.preChoiceState = {};

    this.dialogueBox = new DialogueBox(core);
    this.choicesBox = new DialogueChoices(core, (choice) =>
      this.handleChoice(choice)
    );

    if (!core.popupNotif) core.popupNotif = new PopupNotif(core);
    this.popupNotif = core.popupNotif;

    if (!core.statsManager) core.statsManager = new StatsManager(core);
    this.statsManager = core.statsManager;

    if (!core.menuPopup) core.menuPopup = new MenuPopup(core);
    this.menuPopup = core.menuPopup;

    if (!core.menuButton) core.menuButton = new MenuButton(core);
    this.menuButton = core.menuButton;

    this.isLoading = false;
    this.ignoreNextClick = false;
    this.resumeIndex = 0;
  }

  async load() {
    const sceneCache = this.core.dataCache?.scenes;
    if (!sceneCache) return;
    this.data = sceneCache[this.sceneId];
    if (!this.data) return;
    this.dialogues = this.data.dialogues || [];

    // Load initial background
    const bgCache = this.core.dataCache?.backgrounds;
    const initialBgId = this.data.background || "home";
    const bg = bgCache?.[initialBgId];
    if (bg?.image) {
      this.image = new Image();
      this.image.src = bg.image;
      await new Promise((resolve) => (this.image.onload = resolve));
    }

    this.unload();

    // click handler
    this.clickHandler = (e) => {
      // ✅ Check if SaveLoadPopup is open
      if (this.core.saveLoadPopup?.visible) return;
      if (this.menuPopup.visible) return;

      const rect = this.core.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (this.menuButton.containsPoint(x, y)) {
        this.menuPopup.toggle();
        this.ignoreNextClick = true;
        return;
      }

      if (this.ignoreNextClick) {
        this.ignoreNextClick = false;
        return;
      }

      this.nextDialogue();
    };
    this.core.canvas.addEventListener("click", this.clickHandler);

    // right-click = previous
    this.backHandler = (e) => {
      if (this.menuPopup.visible) return;
      // ✅ Check if SaveLoadPopup is open
      if (this.core.saveLoadPopup?.visible) return;

      e.preventDefault();
      this.prevDialogue();
    };
    this.core.canvas.addEventListener("contextmenu", this.backHandler);

    // Restore saved state
    const saved = this.core.gameState?.currentScene;
    if (saved?.target === this.sceneId && typeof saved.dialogues === "number") {
      this.currentLine = saved.dialogues;
      this.resumeIndex = saved.dialogues; // ← set resume point
      this.appliedStats = { ...(saved.appliedStats || {}) };
      this.appliedChoiceStats = { ...(saved.appliedChoiceStats || {}) };
    } else {
      this.currentLine = 0;
      this.resumeIndex = 0;
    }

    // Process background-only lines up to currentLine
    for (let i = 0; i < this.currentLine; i++) {
      const dlg = this.dialogues[i];
      if (dlg?.background) {
        await this.changeBackground(dlg.background, dlg.transition);
      }
    }

    // Show choices if current line is a choice
    const current = this.dialogues[this.currentLine];
    if (current?.choices) this.choicesBox.setChoices(current.choices);

    // Re-apply stats for previously applied lines
    for (const idx in this.appliedStats)
      this.applyStats(this.dialogues[idx], idx, true);
    for (const idx in this.appliedChoiceStats)
      this.applyChoiceStatsDirect(idx, this.appliedChoiceStats[idx], true);

    this.core.updateGameState("scene", this.sceneId, this.currentLine);
  }

  unload() {
    this.core.canvas.removeEventListener("click", this.clickHandler);
    if (this.backHandler) {
      this.core.canvas.removeEventListener("contextmenu", this.backHandler);
      this.backHandler = null;
    }
    this.choicesBox.clear();
  }

  async processLine() {
    if (this.currentLine < 0 || this.currentLine >= this.dialogues.length)
      return;

    // Check dialouge data
    const obj = this.dialogues[this.currentLine];

    // 🔍 AUTOSAVE DETECTION HERE
    if (obj?.autosave) {
      this.core.saveloadHandler.autosave(this.core);

      console.log(
        `%c[AUTOSAVE TRIGGERED] Scene: ${this.sceneId}, Line: ${this.currentLine}`,
        "color: #627563ff; font-weight: bold;"
      );

      this.popupNotif?.show("Autosave", "blue");

      // const slotKey = "vn_save_slot_0";
      // const timestamp = new Date().toLocaleString();

      // // Delay to next frame so siguradong rendered ang scene
      // requestAnimationFrame(() => {
      //   requestAnimationFrame(() => {
      //     const screenshotBase64 = this.core.canvas.toDataURL(
      //       "image/jpeg",
      //       0.07
      //     );

      //     const saveData = {
      //       timestamp,
      //       screenshot: screenshotBase64,
      //       gameState: structuredClone(this.core.gameState),
      //       characters: structuredClone(this.core.characters),
      //     };

      //     localStorage.setItem(slotKey, JSON.stringify(saveData));

      //     console.log(
      //       `%c[AUTOSAVE TRIGGERED] Scene: ${this.sceneId}, Line: ${this.currentLine}`,
      //       "color: #4CAF50; font-weight: bold;"
      //     );

      //     this.popupNotif?.show("Autosave", "blue");
      //   });
      // });
    }
    // ----------------- BACKGROUND ONLY -----------------
    if (obj?.background) {
      await this.changeBackground(obj.background, obj.transition);
      this.currentLine++;
      // auto-advance to next line if available
      if (this.currentLine < this.dialogues.length) {
        await this.processLine();
      } else if (this.data.goto) {
        // if end of scene, go to next background/scene
        await this.gotoNext();
      }
      return;
    }

    // ----------------- CHOICES -----------------
    if (obj?.choices) {
      // Store pre-choice state if not already stored
      if (!this.preChoiceState[this.currentLine]) {
        const c = this.core.currentCharacter;
        this.preChoiceState[this.currentLine] = {
          energy: c.energy,
          max_energy: c.max_energy,
        };
      }
      this.choicesBox.setChoices(obj.choices);
      this.core.updateGameState("scene", this.sceneId, this.currentLine);
      this.render(this.core.ctx);
      return;
    }

    // ----------------- STAT-ONLY LINES -----------------
    const isStatOnly = !obj?.speaker && !obj?.text && !obj?.choices;
    if (isStatOnly) {
      if (!this.appliedStats.hasOwnProperty(this.currentLine)) {
        this.applyStats(obj, this.currentLine);
      }
      this.currentLine++;
      if (this.currentLine < this.dialogues.length) {
        await this.processLine();
      } else if (this.data.goto) {
        await this.gotoNext();
      }
      return;
    }

    // ----------------- NORMAL DIALOGUE -----------------
    if (!this.appliedStats.hasOwnProperty(this.currentLine)) {
      this.applyStats(obj, this.currentLine);
    }
    this.core.updateGameState("scene", this.sceneId, this.currentLine);
    this.render(this.core.ctx);
  }

  // ----------------- HELPER METHOD -----------------
  async gotoNext() {
    if (!this.data.goto) return;
    await this.core.updateGameState("background", this.data.goto);
    this.unload();
    const { Background } = await import("./background.js");
    const bg = new Background(this.core, this.data.goto);
    await bg.load();
    this.core.setActiveScene(bg);
  }

  async nextDialogue() {
    if (this.isLoading) return;
    if (this.choicesBox.choices.length > 0) return;

    this.currentLine++;
    if (this.currentLine >= this.dialogues.length) {
      if (this.data.goto) {
        await this.core.updateGameState("background", this.data.goto);
        this.unload();
        const { Background } = await import("./background.js");
        const bg = new Background(this.core, this.data.goto);
        await bg.load();
        this.core.setActiveScene(bg);
      }
      return;
    }

    await this.processLine();
  }

  async prevDialogue() {
    if (this.isLoading) return;

    // Prevent going back before the resume point
    const minIndex = this.resumeIndex ?? 0;
    if (this.currentLine <= minIndex) return;

    // if choices are visible currently, just clear them (we'll reset if needed)
    if (this.choicesBox.choices.length > 0) {
      this.choicesBox.clear();
    }

    // Revert any stats applied on the current line (normal dialogue)
    this.revertStats(this.currentLine);

    // Revert choice stats if previous line was a choices line
    const prevIndex = this.currentLine - 1;
    if (this.appliedChoiceStats[prevIndex]) {
      this.revertChoiceStats(prevIndex);
    }

    // move back
    this.currentLine = prevIndex;

    // If landed on a choices line, show choices again
    const prev = this.dialogues[this.currentLine];
    if (prev?.choices) {
      this.choicesBox.setChoices(prev.choices);
    }

    this.core.updateGameState("scene", this.sceneId, this.currentLine);
    this.render(this.core.ctx);
  }

  handleChoice(choice) {
    const idx = this.currentLine;
    const c = this.core.currentCharacter;

    // 🔥 If this choice triggers autosave
    if (choice.autosave === true) {
      this.core.saveloadHandler.autosave(this.core);

      console.log(
        `%c[AUTOSAVE TRIGGERED] Scene: ${this.sceneId}, Line: ${this.currentLine}`,
        "color: #4CAF50; font-weight: bold;"
      );

      this.popupNotif?.show("Autosave", "blue");
    }

    // Ensure preChoiceState exists
    if (!this.preChoiceState[idx]) {
      this.preChoiceState[idx] = { energy: c.energy, max_energy: c.max_energy };
    }

    const deltas = { money: 0, energy: 0, max_energy: 0, prevEnergy: c.energy };

    if (typeof choice.max_energy === "number" && choice.max_energy !== 0) {
      this.statsManager.modifyMaxEnergy(choice.max_energy);
      deltas.max_energy = choice.max_energy;
    }

    if (choice.money !== undefined) {
      this.statsManager.applyStats({ money: choice.money });
      if (typeof choice.money === "number") deltas.money = choice.money;
    }

    if (choice.energy !== undefined) {
      deltas.prevEnergy = c.energy;
      this.statsManager.applyStats({ energy: choice.energy });
      if (typeof choice.energy === "number") deltas.energy = choice.energy;
      else if (choice.energy === "reset") deltas.energy = "reset";
    }

    this.appliedChoiceStats[idx] = deltas;

    if (choice.goto_scene) {
      this.unload();
      import("./scene.js").then(async (mod) => {
        const newScene = new mod.Scene(this.core, choice.goto_scene);
        await newScene.load();
        this.core.setActiveScene(newScene);
      });
      return;
    }

    this.choicesBox.clear();
    this.currentLine = idx + 1;
    this.processLine();
  }

  // -------------------- existing methods --------------------
  applyStats(obj, index, skipStore = false) {
    const deltas = { money: 0, energy: 0, max_energy: 0, prevEnergy: null };
    if (typeof obj.max_energy === "number" && obj.max_energy !== 0) {
      this.statsManager.modifyMaxEnergy(obj.max_energy);
      deltas.max_energy = obj.max_energy;
    }
    if (obj.money !== undefined) {
      this.statsManager.applyStats({ money: obj.money });
      if (typeof obj.money === "number") deltas.money = obj.money;
    }
    if (obj.energy !== undefined) {
      const c = this.core.currentCharacter;
      deltas.prevEnergy = c?.energy ?? null;
      this.statsManager.applyStats({ energy: obj.energy });
      if (typeof obj.energy === "number") deltas.energy = obj.energy;
      else if (obj.energy === "reset") deltas.energy = "reset";
    }

    if (!skipStore) this.appliedStats[index] = deltas;
  }

  revertStats(index) {
    const deltas = this.appliedStats[index];
    if (!deltas) return;

    const reverse = {};
    if (typeof deltas.money === "number" && deltas.money !== 0)
      reverse.money = -deltas.money;

    if (deltas.energy !== undefined) {
      if (deltas.energy === "reset" && deltas.prevEnergy !== null) {
        const c = this.core.currentCharacter;
        c.energy = deltas.prevEnergy;
        this.popupNotif?.show("Energy Reverted", "yellow");
      } else if (typeof deltas.energy === "number" && deltas.energy !== 0) {
        reverse.energy = -deltas.energy;
      }
    }

    if (typeof deltas.max_energy === "number" && deltas.max_energy !== 0)
      this.statsManager.modifyMaxEnergy(-deltas.max_energy);

    if (Object.keys(reverse).length > 0) this.statsManager.applyStats(reverse);

    delete this.appliedStats[index];
  }

  revertChoiceStats(choiceIndex) {
    const deltas = this.appliedChoiceStats[choiceIndex];
    if (!deltas) return;

    const c = this.core.currentCharacter;

    // Revert to preChoiceState
    const pre = this.preChoiceState[choiceIndex];
    if (pre) {
      c.energy = pre.energy;
      c.max_energy = pre.max_energy;
      this.popupNotif?.show("Stats Reverted", "yellow");
    }

    // Revert money delta
    if (typeof deltas.money === "number" && deltas.money !== 0) {
      this.statsManager.applyStats({ money: -deltas.money });
    }

    delete this.appliedChoiceStats[choiceIndex];
  }

  async changeBackground(bgId, transition) {
    const bgCache = this.core.dataCache?.backgrounds;
    const bg = bgCache?.[bgId];
    if (!bg?.image) return;

    const newImg = new Image();
    newImg.src = bg.image;
    await new Promise((resolve) => (newImg.onload = resolve));

    if (transition === "fade") {
      const canvas = this.core.canvas;
      const ctx = this.core.ctx;
      let alpha = 0;
      await new Promise((resolve) => {
        const step = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (this.image)
            ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = alpha;
          ctx.drawImage(newImg, 0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1;
          if (this.popupNotif) this.popupNotif.render(ctx);
          if (alpha < 1) {
            alpha += 0.05;
            requestAnimationFrame(step);
          } else {
            this.image = newImg;
            resolve();
          }
        };
        step();
      });
    } else this.image = newImg;

    this.core.updateGameState("background", bgId);
  }

  onResize(scaleRatio) {
    this.choicesBox?.onResize(scaleRatio);
    this.popupNotif?.onResize(scaleRatio);

    const canvas = this.core.canvas;
    const size = canvas.height * 0.06;
    this.menuButton.setSize(size);

    this.menuButton.x = canvas.width - size - 10;
    this.menuButton.y = size / 2 + 10;
  }

  render(ctx) {
    const canvas = this.core.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (this.image)
      ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
    else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const line =
      this.dialogues[
        Math.max(0, Math.min(this.currentLine, this.dialogues.length - 1))
      ];
    if (line?.speaker && line?.text)
      this.dialogueBox.render(ctx, line.speaker, line.text);

    this.choicesBox.render(ctx);
    this.popupNotif.render(ctx);

    if (this.menuPopup.visible) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    this.menuButton.render(ctx);
    this.menuPopup.render(ctx);
  }

  update() {}
}
