import { DialogueBox } from "./components/dialoguebox.js";
import { DialogueChoices } from "./components/dialogue_choices.js";
import { PopupNotif } from "./components/popup_notif.js";
import { StatsManager } from "./stats_manager.js";
import MenuButton from "./components/menu_button.js";
import MenuPopup from "./components/menu_popup.js";
import { Sprite } from "./components/sprite.js";

export class Scene {
  constructor(core, sceneId) {
    this.core = core;
    this.sceneId = sceneId;
    this.data = null;
    this.image = null;
    this.dialogues = [];
    this.currentLine = -1;

    this.appliedStats = {};
    this.appliedChoiceStats = {};
    this.preChoiceState = {};

    this.dialogueBox = new DialogueBox(core);
    this.choicesBox = new DialogueChoices(core, (choice) =>
      this.handleChoice(choice)
    );

    this.sprite = new Sprite(core);

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

    this.clickHandler = (e) => {
      if (this.core.saveLoadPopup?.visible) return;
      if (this.menuPopup.visible) return;
      const rect = this.core.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (this.dialogueBox.handleClick(x, y)) {
        return;
      }

      // If typing, skip
      if (this.dialogueBox.isTyping) {
        this.dialogueBox.skipTypewriter();
        return;
      }

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

    this.backHandler = (e) => {
      if (this.menuPopup.visible) return;
      if (this.core.saveLoadPopup?.visible) return;
      e.preventDefault();
      this.prevDialogue();
    };
    this.core.canvas.addEventListener("contextmenu", this.backHandler);

    // Restore saved state
    const saved = this.core.gameState?.currentScene;
    if (saved?.target === this.sceneId && typeof saved.dialogues === "number") {
      this.currentLine = saved.dialogues;
      this.resumeIndex = saved.dialogues;
      this.appliedStats = { ...(saved.appliedStats || {}) };
      this.appliedChoiceStats = { ...(saved.appliedChoiceStats || {}) };
    } else {
      this.currentLine = 0;
      this.resumeIndex = 0;
    }

    // Process lines up to currentLine (Fast Forward logic)
    // IMPORTANT: Kailangan nating i-set ang tamang background kahit nasa gitna tayo
    // Para kung nasa line 5 tayo at ang background ay nagbago sa line 2 at 4,
    // dapat ang background ng line 4 ang makita.
    let targetBg = initialBgId;

    for (let i = 0; i <= this.currentLine; i++) {
      const dlg = this.dialogues[i];
      if (!dlg) continue;

      // Track latest background
      if (dlg.background) targetBg = dlg.background;

      // Re-apply stats
      if (i < this.currentLine) {
        // Huwag i-apply ang stats ng current line dito, sa processLine na
        if (this.appliedStats[i]) this.applyStats(dlg, i, true);
        if (this.appliedChoiceStats[i])
          this.applyChoiceStatsDirect(i, this.appliedChoiceStats[i], true);
      }
    }

    // Set the correct background for the resume point
    await this.changeBackground(targetBg, "none"); // "none" transition para instant

    const current = this.dialogues[this.currentLine];
    if (current?.choices) this.choicesBox.setChoices(current.choices);
    //if (current?.sprite) await this.sprite.update(current.sprite);

    // 👇 Restore Sprite/s
    if (current?.sprites) {
      await this.sprite.update(current.sprites);
    } else if (current?.sprite) {
      await this.sprite.update(current.sprite);
    }

    this.core.updateGameState("scene", this.sceneId, this.currentLine);
  }

  unload() {
    this.core.canvas.removeEventListener("click", this.clickHandler);
    if (this.backHandler) {
      this.core.canvas.removeEventListener("contextmenu", this.backHandler);
      this.backHandler = null;
    }
    this.choicesBox.clear();
    this.sprite.clear();
  }

  async processLine() {
    if (this.currentLine < 0 || this.currentLine >= this.dialogues.length)
      return;

    const obj = this.dialogues[this.currentLine];

    // AUTOSAVE
    if (obj?.autosave) {
      this.core.saveloadHandler.autosave(this.core);
      this.popupNotif?.show("Autosave", "blue");
    }

    // BACKGROUND ONLY (Auto-Advance)
    if (obj?.background) {
      await this.changeBackground(obj.background, obj.transition);
      this.currentLine++;
      // Recursive call to proceed immediately
      if (this.currentLine < this.dialogues.length) {
        await this.processLine();
      } else if (this.data.goto) {
        await this.gotoNext();
      }
      return;
    }

    // SPRITE
    if (obj.sprites) {
      // Case A: Multiple sprites (Array)
      await this.sprite.update(obj.sprites);
    } else if (obj.sprite) {
      // Case B: Single sprite (Object) - Legacy support
      await this.sprite.update(obj.sprite);
    } else {
      // Optional: Retain previous sprite or clear.
      // Usually better to keep unless explicitly cleared.
      this.sprite.clear();
    }

    // CHOICES
    if (obj?.choices) {
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

    // STAT-ONLY (Auto-Advance)
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

    // NORMAL DIALOGUE (Stop here and wait for click)
    if (!this.appliedStats.hasOwnProperty(this.currentLine)) {
      this.applyStats(obj, this.currentLine);
    }
    this.core.updateGameState("scene", this.sceneId, this.currentLine);
    this.render(this.core.ctx);
  }

  async nextDialogue() {
    if (this.isLoading) return;
    if (this.core.saveLoadPopup?.visible) return;
    if (this.choicesBox.choices.length > 0) return;

    // CHECK IF TYPING → skip first click
    if (this.dialogueBox.isTyping) {
      this.dialogueBox.skipTypewriter();
      this.render(this.core.ctx);
      return; // STOP HERE (no next dialogue yet)
    }

    // NORMAL NEXT DIALOGUE
    this.currentLine++;
    if (this.currentLine >= this.dialogues.length) {
      if (this.data.goto) {
        await this.gotoNext();
      }
      return;
    }

    await this.processLine();
  }

  // ---------------------------------------------------------
  // 🔥 FIX: IMPROVED PREV DIALOGUE LOGIC
  // ---------------------------------------------------------
  async prevDialogue() {
    if (this.isLoading) return;

    const minIndex = this.resumeIndex ?? 0;
    if (this.currentLine <= minIndex) return;

    if (this.choicesBox.choices.length > 0) {
      this.choicesBox.clear();
    }

    // Start checking backward
    let targetIndex = this.currentLine - 1;
    let foundStop = false;

    // Loop backwards hanggang makakita ng line na HINDI auto-advance (may speaker/text/choice)
    // O kaya hanggang umabot sa minIndex
    while (targetIndex >= minIndex) {
      // Revert stats of the line we are leaving/skipping
      this.revertStats(targetIndex + 1); // Revert current/next line logic if needed (simplified)
      // Actually, we usually revert the stats of the line we are stepping *out* of or *over*.
      // Since we are moving from currentLine to targetIndex, we need to revert currentLine logic.

      // Revert stats of the specific line index we are checking (since we might skip it)
      this.revertStats(this.currentLine);
      // Note: Logic on reverting stats while skipping multiple lines can be tricky.
      // For simplicity, we just revert the current line's effects first.

      const line = this.dialogues[targetIndex];
      const isBackgroundOnly = !!line.background;
      const isStatOnly =
        !line.speaker && !line.text && !line.choices && !line.background;

      // Kung background-only or stat-only, i-revert natin ang effect nito (kung meron) at ituloy ang loop
      if (isBackgroundOnly || isStatOnly) {
        this.revertStats(targetIndex); // Revert stats if it was a stat-only line

        // Kung background change ito, kailangan nating hanapin ang background
        // ng line BAGO ito para bumalik sa dati.
        // Gagawin ito sa dulo pag may final targetIndex na.

        targetIndex--; // Skip further back
      } else {
        // Nakakita tayo ng dialogue/choice! Dito tayo hihinto.
        foundStop = true;
        break;
      }
    }

    // Kung lumagpas sa minIndex at walang nakitang stop, force stop sa minIndex
    if (targetIndex < minIndex) targetIndex = minIndex;

    // Apply the move
    this.currentLine = targetIndex;

    // Cleanups for previous state
    const prevIndex = this.currentLine; // Technically current now
    if (this.appliedChoiceStats[prevIndex]) {
      // Logic fix: choice stats are usually applied AFTER clicking choice, leading to next line.
      // If we go back TO a choice line, we revert the choice made.
    }

    // 🔥 RESTORE CORRECT BACKGROUND & SPRITE FOR THIS NEW LINE
    // Dahil nag-skip tayo ng background lines pabalik, kailangan nating malaman
    // kung ano dapat ang background sa point na ito.
    // Scan from 0 to currentLine to find the latest background.
    let correctBg = this.data.background || "home";
    for (let i = 0; i <= this.currentLine; i++) {
      if (this.dialogues[i].background)
        correctBg = this.dialogues[i].background;
    }
    // Change background instantly (no transition when going back usually)
    await this.changeBackground(correctBg, "none");

    const prev = this.dialogues[this.currentLine];
    if (prev?.choices) {
      this.choicesBox.setChoices(prev.choices);
    }

    // Restore Sprite
    if (prev?.sprite) {
      await this.sprite.update(prev.sprite);
    } else {
      // Find last used sprite if current line doesn't have one?
      // Or just clear? For now, update if exists.
    }

    this.core.updateGameState("scene", this.sceneId, this.currentLine);
    this.render(this.core.ctx);
  }

  async gotoNext() {
    if (!this.data.goto) return;
    await this.core.updateGameState("background", this.data.goto);
    this.unload();
    const { Background } = await import("./background.js");
    const bg = new Background(this.core, this.data.goto);
    await bg.load();
    this.core.setActiveScene(bg);
  }

  handleChoice(choice) {
    const idx = this.currentLine;
    const c = this.core.currentCharacter;

    if (choice.autosave === true) {
      this.core.saveloadHandler.autosave(this.core);
      this.popupNotif?.show("Autosave", "blue");
    }

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

    const pre = this.preChoiceState[choiceIndex];
    if (pre) {
      c.energy = pre.energy;
      c.max_energy = pre.max_energy;
      this.popupNotif?.show("Stats Reverted", "yellow");
    }

    if (typeof deltas.money === "number" && deltas.money !== 0) {
      this.statsManager.applyStats({ money: -deltas.money });
    }

    delete this.appliedChoiceStats[choiceIndex];
  }

  // HELPER: Re-apply choice stats (needed for load)
  applyChoiceStatsDirect(index, deltas, skipStore) {
    // Simple re-application logic if needed, usually stats are already in state
    // This is a placeholder if you need to re-calculate logic on load
  }

  autoNextDialogueIfReady() {
    // Auto mode OFF? return.
    if (!this.dialogueBox.autoMode) return;

    // Is currently typing? wait.
    if (this.dialogueBox.isTyping) return;

    // If choices exist → STOP auto mode until user picks.
    if (this.currentDialogue?.choices) return;

    // Auto next after a small delay (e.g., 500ms)
    if (!this._autoTimer) {
      this._autoTimer = Date.now();
      return;
    }

    if (Date.now() - this._autoTimer >= 1200) {
      this._autoTimer = null;
      this.nextDialogue();
    }
  }

  async changeBackground(bgId, transition) {
    const bgCache = this.core.dataCache?.backgrounds;
    const bg = bgCache?.[bgId];
    if (!bg?.image) return;

    const newImg = new Image();
    newImg.src = bg.image;
    await new Promise((resolve) => (newImg.onload = resolve));

    if (transition === "fade" && transition !== "none") {
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
    } else {
      this.image = newImg;
    }

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

    if (this.sprite) {
      this.sprite.render(ctx);
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

  update() {
    this.autoNextDialogueIfReady();
  }
}
