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

    // 🔥 NEW: Check for Scene-level Music on Load
    if (this.data.music) {
      this.core.audioManager.playBGM(this.data.music);
    }

    this.unload();

    this.clickHandler = (e) => {
      if (this.core.saveLoadPopup?.visible) return;
      if (this.menuPopup.visible) return;
      const rect = this.core.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Handle Auto/FF Button Click
      if (this.dialogueBox.handleClick(x, y)) {
        return;
      }

      // If typing, skip animation
      if (this.dialogueBox.isTyping) {
        this.dialogueBox.skipTypewriter();
        this.render(this.core.ctx); // Re-render to show full text immediately
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

    // Fast forward logic (Restore State Loop)
    let targetBg = initialBgId;

    // 🔥 NEW: Track Music for Restore
    let targetMusic = this.data.music || null;

    for (let i = 0; i <= this.currentLine; i++) {
      const dlg = this.dialogues[i];
      if (!dlg) continue;
      if (dlg.background) targetBg = dlg.background;

      // Check music history
      if (dlg.music) targetMusic = dlg.music;

      if (i < this.currentLine) {
        if (this.appliedStats[i]) this.applyStats(dlg, i, true);
        if (this.appliedChoiceStats[i])
          this.applyChoiceStatsDirect(i, this.appliedChoiceStats[i], true);
      }
    }

    await this.changeBackground(targetBg, "none");

    // 🔥 NEW: Ensure correct music is playing after restore
    if (targetMusic) {
      this.core.audioManager.playBGM(targetMusic);
    }

    const current = this.dialogues[this.currentLine];
    if (current?.choices) this.choicesBox.setChoices(current.choices);

    // Restore Sprite/s
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

  // 🔥 NEW: Audio Helper
  _triggerAudio(obj) {
    if (!obj) return;
    // 1. Music Change
    if (obj.music) {
      this.core.audioManager.playBGM(obj.music);
    }
    // 2. Sound Effects
    if (obj.soundeffects) {
      this.core.audioManager.playSFX(obj.soundeffects);
    }
  }

  async processLine() {
    if (this.currentLine < 0 || this.currentLine >= this.dialogues.length)
      return;

    const obj = this.dialogues[this.currentLine];

    // 🔥 NEW: Trigger Audio for this line immediately
    this._triggerAudio(obj);

    if (obj?.autosave) {
      this.core.saveloadHandler.autosave(this.core);
      this.popupNotif?.show("Autosave", "blue");
    }

    if (obj?.background) {
      await this.changeBackground(obj.background, obj.transition);
      this.currentLine++;
      if (this.currentLine < this.dialogues.length) {
        await this.processLine();
      } else if (this.data.goto) {
        await this.gotoNext();
      }
      return;
    }

    // SPRITE
    if (obj.sprites) {
      await this.sprite.update(obj.sprites);
    } else if (obj.sprite) {
      await this.sprite.update(obj.sprite);
    } else {
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

      // 🔥 STOP Fast Forward on choices
      if (this.dialogueBox.fastForwardMode) {
        this.dialogueBox.fastForwardMode = false; // Auto-stop FF
        console.log("Fast Forward stopped at choice.");
      }

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

    // NORMAL DIALOGUE
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

    if (this.dialogueBox.isTyping) {
      this.dialogueBox.skipTypewriter();
      this.render(this.core.ctx);
      return;
    }

    this.currentLine++;
    if (this.currentLine >= this.dialogues.length) {
      if (this.data.goto) {
        await this.gotoNext();
      }
      return;
    }

    await this.processLine();
  }

  async prevDialogue() {
    if (this.isLoading) return;

    const minIndex = this.resumeIndex ?? 0;
    if (this.currentLine <= minIndex) return;

    if (this.choicesBox.choices.length > 0) {
      this.choicesBox.clear();
    }

    let targetIndex = this.currentLine - 1;
    let foundStop = false;

    while (targetIndex >= minIndex) {
      this.revertStats(this.currentLine);

      const line = this.dialogues[targetIndex];
      const isBackgroundOnly = !!line.background;
      const isStatOnly =
        !line.speaker && !line.text && !line.choices && !line.background;

      if (isBackgroundOnly || isStatOnly) {
        this.revertStats(targetIndex);
        targetIndex--;
      } else {
        foundStop = true;
        break;
      }
    }

    if (targetIndex < minIndex) targetIndex = minIndex;

    this.currentLine = targetIndex;

    // Restore Background Logic
    let correctBg = this.data.background || "home";

    // 🔥 NEW: Restore Music Logic (Backtracking)
    let correctMusic = this.data.music || null;

    for (let i = 0; i <= this.currentLine; i++) {
      if (this.dialogues[i].background)
        correctBg = this.dialogues[i].background;
      // Check latest music up to this point
      if (this.dialogues[i].music) correctMusic = this.dialogues[i].music;
    }

    await this.changeBackground(correctBg, "none");

    // 🔥 Play the corrected music
    if (correctMusic) {
      this.core.audioManager.playBGM(correctMusic);
    }

    const prev = this.dialogues[this.currentLine];
    if (prev?.choices) {
      this.choicesBox.setChoices(prev.choices);
    }

    if (prev?.sprites) {
      await this.sprite.update(prev.sprites);
    } else if (prev?.sprite) {
      await this.sprite.update(prev.sprite);
    } else {
      this.sprite.clear();
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

  applyChoiceStatsDirect(index, deltas, skipStore) {
    // Re-application logic logic would go here
  }

  // 🔥🔥🔥 UPDATED: AUTO & FAST FORWARD LOGIC
  autoNextDialogueIfReady() {
    const db = this.dialogueBox;

    // 1. Stop if choices exist
    if (this.choicesBox.choices.length > 0) return;

    // 2. Fast Forward Mode (Priority)
    if (db.fastForwardMode) {
      // If typing, skip instantly
      if (db.isTyping) {
        db.skipTypewriter();
        return;
      }

      // Small delay (e.g., 100ms) just so it's not literally instant render loop
      if (!this._autoTimer) {
        this._autoTimer = Date.now();
        return;
      }

      if (Date.now() - this._autoTimer >= 100) {
        this._autoTimer = null;
        this.nextDialogue();
      }
      return;
    }

    // 3. Auto Mode
    if (db.autoMode) {
      if (db.isTyping) return; // Wait for typing

      const WAIT_TIME = 2000; // 5 seconds
      if (
        db.typingFinishedTime &&
        Date.now() - db.typingFinishedTime > WAIT_TIME
      ) {
        db.typingFinishedTime = null;
        this.nextDialogue();
      }
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

  // 🔥🔥🔥 UPDATED onResize: Match logic with Header.js
  onResize(scaleRatio) {
    this.choicesBox?.onResize(scaleRatio);
    this.popupNotif?.onResize(scaleRatio);

    const canvas = this.core.canvas;
    const guiData = this.core.dataCache?.gameGUI?.gui_header;

    // Use header height logic (default 6%)
    const heightRatio = guiData?.header_HeightRatio || 0.06;
    const headerHeight = canvas.height * heightRatio;

    // Button size relative to header height (70%)
    const btnSize = headerHeight * 0.7;
    this.menuButton.setSize(btnSize);

    // Position Button: Right aligned with margin, centered vertically
    const padding = (headerHeight - btnSize) / 2;
    this.menuButton.x = canvas.width - btnSize - 20; // 20px right margin
    this.menuButton.y = padding;
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
