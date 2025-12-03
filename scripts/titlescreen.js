import { Scene } from "./scene.js";
import { Background } from "./background.js";
import SettingsPopup from "./components/settings_popup.js"; // 🔥 IMPORT

export class TitleScreen {
  constructor(core) {
    this.core = core;
    this.buttons = [];
    this.hoveredButtonIndex = null;
    this.baseWidth = 1920;
    this.baseHeight = 1080;

    // 🔥 Initialize Settings Popup
    this.settingsPopup = new SettingsPopup(core);

    // --- Image Caching ---
    this.imageCache = {};
    this.failedImages = new Set();

    if (this.core.hasSave === undefined) {
      this.core.hasSave = false;
    }

    this.core.audioManager.playBGM("title_theme");

    this.checkLocalSaves();

    this.clickHandler = (e) => this.handleClick(e);
    this.mouseMoveHandler = (e) => this.handleMouseMove(e);

    this.core.canvas.addEventListener("click", this.clickHandler);
    this.core.canvas.addEventListener("mousemove", this.mouseMoveHandler);

    this.updateLayout();
  }

  // ... (Clean up listeners)
  unload() {
    if (this.clickHandler) {
      this.core.canvas.removeEventListener("click", this.clickHandler);
      this.clickHandler = null;
    }
    if (this.mouseMoveHandler) {
      this.core.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }
    // Dispose settings popup listeners too
    if (this.settingsPopup) {
      this.settingsPopup.dispose();
    }
  }

  // ... (Existing helpers: _loadImage, hexToRgba, resolveRadius, resolvePosition, drawStyledBox, drawFlexibleImage kept same) ...
  _loadImage(src) {
    if (!src) return null;
    if (this.failedImages.has(src)) return null;
    const existing = this.imageCache[src];
    if (existing) return existing;
    const img = new Image();
    img.onerror = () => {
      this.failedImages.add(src);
      delete this.imageCache[src];
    };
    img.onload = () => {
      if (img.naturalWidth === 0) {
        this.failedImages.add(src);
        delete this.imageCache[src];
      }
    };
    img.src = src;
    this.imageCache[src] = img;
    return img;
  }
  hexToRgba(color, alpha = 1) {
    /* ... same as before ... */ if (!color) return `rgba(0,0,0,${alpha})`;
    if (color.startsWith("rgba")) return color;
    if (color.startsWith("rgb")) return color;
    if (color[0] === "#") {
      let r, g, b;
      if (color.length === 4) {
        r = parseInt(color[1] + color[1], 16);
        g = parseInt(color[2] + color[2], 16);
        b = parseInt(color[3] + color[3], 16);
      } else {
        r = parseInt(color.slice(1, 3), 16);
        g = parseInt(color.slice(3, 5), 16);
        b = parseInt(color.slice(5, 7), 16);
      }
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }
  resolveRadius(rawRadius, scale) {
    if (Array.isArray(rawRadius) && rawRadius.length === 4) {
      return rawRadius.map((r) => r * scale);
    }
    const scaled =
      typeof rawRadius === "number" && rawRadius >= 0 ? rawRadius * scale : 0;
    return [scaled, scaled, scaled, scaled];
  }
  resolvePosition(posString, elWidth, elHeight, scaleY) {
    const canvas = this.core.canvas;
    let x = (canvas.width - elWidth) / 2;
    let y = (canvas.height - elHeight) / 2;
    if (!posString) return { x, y };
    const parts = posString
      .split(" ")
      .map((s) => s.trim())
      .filter(Boolean);
    const keyword = (parts[0] || "center").toLowerCase();
    const offset = (parseFloat(parts[1]) || 0) * scaleY;
    switch (keyword) {
      case "top":
        y = offset;
        break;
      case "bottom":
        y = canvas.height - elHeight - offset;
        break;
      case "left":
        x = offset;
        break;
      case "right":
        x = canvas.width - elWidth - offset;
        break;
      case "center":
      default:
        y = (canvas.height - elHeight) / 2 + offset;
        break;
    }
    return { x, y };
  }
  drawStyledBox(ctx, x, y, w, h, thickness, radii, bgColor, borderColor) {
    const resolved = Array.isArray(radii)
      ? radii
      : [radii, radii, radii, radii];
    const [tl, tr, br, bl] = resolved;
    const hasRadius = tl > 0 || tr > 0 || br > 0 || bl > 0;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (hasRadius) {
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, resolved);
      else ctx.rect(x, y, w, h);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();
    if (thickness > 0) {
      ctx.lineWidth = thickness;
      ctx.strokeStyle = borderColor;
      const overlap = 1;
      const offset = thickness / 2 - overlap;
      const bx = x - offset;
      const by = y - offset;
      const bw = w + thickness - overlap * 2;
      const bh = h + thickness - overlap * 2;
      const outerRadii = resolved.map((r) => (r > 0 ? r + offset : 0));
      ctx.beginPath();
      if (hasRadius) {
        if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, outerRadii);
        else ctx.rect(bx, by, bw, bh);
      } else {
        ctx.rect(bx, by, bw, bh);
      }
      ctx.stroke();
    }
  }
  drawFlexibleImage(ctx, source, x, y, w, h) {
    if (!source) return false;
    let srcPath = null;
    let spriteCoords = null;
    if (Array.isArray(source) && source.length >= 1) {
      srcPath = source[0];
      if (source.length >= 5) {
        spriteCoords = {
          sx: source[1],
          sy: source[2],
          sw: source[3],
          sh: source[4],
        };
      }
    } else if (typeof source === "string") {
      srcPath = source;
    }
    if (!srcPath || this.failedImages.has(srcPath)) return false;
    const img = this._loadImage(srcPath);
    if (!img || !img.complete || img.naturalWidth === 0) return false;
    if (spriteCoords) {
      ctx.drawImage(
        img,
        spriteCoords.sx,
        spriteCoords.sy,
        spriteCoords.sw,
        spriteCoords.sh,
        x,
        y,
        w,
        h
      );
    } else {
      ctx.drawImage(img, x, y, w, h);
    }
    return true;
  }

  // ... (checkLocalSaves, getLatestSave kept same) ...
  checkLocalSaves() {
    this.core.hasSave = false;
    for (let i = 0; i < 10; i++) {
      const raw = localStorage.getItem("vn_save_slot_" + i);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (data?.gameState) {
        this.core.hasSave = true;
        return;
      }
    }
  }
  getLatestSave() {
    let latest = null;
    for (let i = 0; i < 10; i++) {
      const raw = localStorage.getItem("vn_save_slot_" + i);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (!data.timestamp) continue;
      if (!latest || new Date(data.timestamp) > new Date(latest.timestamp)) {
        latest = { ...data, slot: i };
      }
    }
    return latest;
  }

  onResize() {
    this.updateLayout();
  }

  updateLayout() {
    const canvas = this.core.canvas;
    const guiData = this.core.dataCache?.gameGUI?.gui_titlescreen;
    const scaleX = canvas.width / this.baseWidth;
    const scaleY = canvas.height / this.baseHeight;

    const btnW = (guiData?.gui_titlescreen_ButtonWidth || 300) * scaleX;
    const btnH = (guiData?.gui_titlescreen_ButtonHeight || 60) * scaleY;
    const spacing = (guiData?.gui_titlescreen_ButtonSpacing || 15) * scaleY;

    const list = [];
    if (this.core.hasSave) list.push({ text: "Continue", id: "continue" });
    list.push({ text: "New Game", id: "newgame" });
    list.push({ text: "Load Game", id: "loadgame" });
    list.push({ text: "Settings", id: "settings" });

    const totalGroupHeight = list.length * btnH + (list.length - 1) * spacing;
    const posString =
      guiData?.gui_titlescreen_ButtonGroupPosition || "center 50";
    const groupPos = this.resolvePosition(
      posString,
      btnW,
      totalGroupHeight,
      scaleY
    );
    const startX = groupPos.x + btnW / 2;
    const startY = groupPos.y;

    this.buttons = [];
    list.forEach((item, index) => {
      const yPos = startY + index * (btnH + spacing);
      this.buttons.push({
        ...item,
        x: startX,
        y: yPos,
        width: btnW,
        height: btnH,
      });
    });
  }

  handleMouseMove(e) {
    if (this.core.saveLoadPopup?.visible) return;
    // 🔥 Block input if Settings is open
    if (this.settingsPopup.visible) return;

    const rect = this.core.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    this.hoveredButtonIndex = null;

    this.buttons.forEach((btn, index) => {
      const halfW = btn.width / 2;
      if (
        mx > btn.x - halfW &&
        mx < btn.x + halfW &&
        my > btn.y &&
        my < btn.y + btn.height
      ) {
        this.hoveredButtonIndex = index;
      }
    });
  }

  handleClick(e) {
    if (this.core.saveLoadPopup?.visible) return;
    // 🔥 Block click if Settings is open
    if (this.settingsPopup.visible) return;

    const rect = this.core.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    this.buttons.forEach((btn) => {
      const halfW = btn.width / 2;
      if (
        mx > btn.x - halfW &&
        mx < btn.x + halfW &&
        my > btn.y &&
        my < btn.y + btn.height
      ) {
        this.core.audioManager.stopBGM("title_theme");
        this.core.audioManager.playSFX("click");
        if (btn.id === "continue") this.continueGame();
        if (btn.id === "newgame") this.startNewGame();
        if (btn.id === "loadgame") this.core.saveLoadPopup.open("load");

        // 🔥 Open Settings
        if (btn.id === "settings") {
          this.settingsPopup.open();
        }
      }
    });
  }

  // ... (startNewGame, continueGame, resumeFromGameState kept same) ...
  async startNewGame() {
    this.core.hasSave = false;
    this.unload();
    this.core.resetGameState();
    const gs = this.core.gameState;
    let started = false;
    if (gs.currentBackground?.active && gs.currentBackground.target) {
      const bg = new Background(this.core, gs.currentBackground.target);
      await bg.load();
      this.core.setActiveScene(bg);
      started = true;
    }
    if (!started && gs.currentScene?.active && gs.currentScene.target) {
      const scene = new Scene(this.core, gs.currentScene.target);
      await scene.load();
      scene.currentLine = gs.currentScene.dialogues || 0;
      this.core.setActiveScene(scene);
      started = true;
    }
    if (!started) console.warn("⚠ No default starting scene/bg found!");
  }
  async continueGame() {
    const latest = this.getLatestSave();
    if (this.core.hasRuntimeDataCache) {
      const hasProg =
        this.core.gameState?.currentBackground?.active ||
        this.core.gameState?.currentScene?.active;
      if (hasProg) {
        this.unload();
        return this.resumeFromGameState(this.core.gameState);
      }
    } else {
      if (!latest) return;
      this.core.gameState = structuredClone(latest.gameState);
      this.core.characters = structuredClone(latest.characters);
      this.core.currentCharacter =
        this.core.characters.find((ch) => ch.default) ||
        this.core.characters[0];
      this.unload();
      this.core.hasRuntimeDataCache = true;
      return this.resumeFromGameState(this.core.gameState);
    }
  }
  async resumeFromGameState(gs) {
    if (gs.currentBackground?.active) {
      const bg = new Background(this.core, gs.currentBackground.target);
      await bg.load();
      this.core.setActiveScene(bg);
      return;
    }
    if (gs.currentScene?.active) {
      const scene = new Scene(this.core, gs.currentScene.target);
      await scene.load();
      scene.currentLine = gs.currentScene.dialogues || 0;
      scene.resumeIndex = scene.currentLine;
      this.core.setActiveScene(scene);
      return;
    }
  }
  update() {}

  render(ctx) {
    const canvas = this.core.canvas;
    const guiData = this.core.dataCache?.gameGUI?.gui_titlescreen;
    const scaleX = canvas.width / this.baseWidth;
    const scaleY = canvas.height / this.baseHeight;

    // --- 1. Background ---
    const bgColor = guiData?.gui_titlescreen_BackgroundColor || "#1a1a1a";
    const bgImgSource = guiData?.gui_titlescreen_BackgroundImg || null;
    const bgDrawn = this.drawFlexibleImage(
      ctx,
      bgImgSource,
      0,
      0,
      canvas.width,
      canvas.height
    );
    if (!bgDrawn) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // --- 2. Title ---
    const titleW = (guiData?.gui_titlescreen_TitleWidth || 300) * scaleX;
    const titleH = (guiData?.gui_titlescreen_TitleHeight || 60) * scaleY;
    const titlePosString =
      guiData?.gui_titlescreen_TitlePosition || "center 300";
    const titlePos = this.resolvePosition(
      titlePosString,
      titleW,
      titleH,
      scaleY
    );
    const titleImgSource = guiData?.gui_titlescreen_TitleImg || null;
    let titleDrawn = this.drawFlexibleImage(
      ctx,
      titleImgSource,
      titlePos.x,
      titlePos.y,
      titleW,
      titleH
    );

    if (!titleDrawn) {
      const titleFontSize =
        (guiData?.gui_titlescreen_TitleFontSize || 60) * scaleX;
      const titleFontColor = guiData?.gui_titlescreen_TitleFontColor || "#fff";
      const fontFamily =
        guiData?.gui_titlescreen_FontFamily || "Arial, sans-serif";
      ctx.fillStyle = titleFontColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${titleFontSize}px ${fontFamily}`;
      const textX = titlePos.x + titleW / 2;
      const textY = titlePos.y + titleH / 2;
      ctx.fillText(this.core.gameTitle || "My Visual Novel", textX, textY);
    }

    // --- 3. Buttons ---
    const btnFontSize =
      (guiData?.gui_titlescreen_ButtonFontSize || 20) * scaleX;
    const btnFontColor = guiData?.gui_titlescreen_ButtonFontColor || "#fff";
    const btnBorderColor =
      guiData?.gui_titlescreen_ButtonBorderColor || "#43321e";
    const btnBorderThickness =
      (guiData?.gui_titlescreen_ButtonBorderThickness || 2) * scaleX;
    const btnRadii = this.resolveRadius(
      guiData?.gui_titlescreen_ButtonBorderCorner || 0,
      scaleX
    );
    const btnBgColor =
      guiData?.gui_titlescreen_ButtonBackgroundColor || "#ffcc95";
    const btnBgHover =
      guiData?.gui_titlescreen_ButtonBackgroundColor_Hover || "#e0b383";
    const btnImgSource = guiData?.gui_titlescreen_ButtonBackgroundImg || null;
    const btnImgHoverSource =
      guiData?.gui_titlescreen_ButtonBackgroundImg_Hover || null;
    const fontFamily =
      guiData?.gui_titlescreen_FontFamily || "Arial, sans-serif";

    ctx.font = `bold ${btnFontSize}px ${fontFamily}`;

    this.buttons.forEach((btn, idx) => {
      const isHover =
        idx === this.hoveredButtonIndex && !this.settingsPopup.visible; // No hover if settings open
      const drawX = btn.x - btn.width / 2;
      const drawY = btn.y;

      if (btnBorderThickness > 0) {
        this.drawStyledBox(
          ctx,
          drawX,
          drawY,
          btn.width,
          btn.height,
          btnBorderThickness,
          btnRadii,
          "transparent",
          btnBorderColor
        );
      }

      const currentImgSource = isHover
        ? btnImgHoverSource || btnImgSource
        : btnImgSource;
      const currentColor = isHover ? btnBgHover : btnBgColor;

      let imgDrawn = false;
      if (currentImgSource) {
        ctx.save();
        this.drawStyledBox(
          ctx,
          drawX,
          drawY,
          btn.width,
          btn.height,
          0,
          btnRadii,
          "transparent",
          "transparent"
        );
        ctx.clip();
        imgDrawn = this.drawFlexibleImage(
          ctx,
          currentImgSource,
          drawX,
          drawY,
          btn.width,
          btn.height
        );
        ctx.restore();
      }

      if (!imgDrawn) {
        this.drawStyledBox(
          ctx,
          drawX,
          drawY,
          btn.width,
          btn.height,
          0,
          btnRadii,
          currentColor,
          "transparent"
        );
      }

      ctx.fillStyle = btnFontColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(btn.text, btn.x, btn.y + btn.height / 2);
    });

    // --- 4. Info ---
    const smallFontSize =
      (guiData?.gui_titlescreen_SmallFontSize || 14) * scaleX;
    const smallFontColor = guiData?.gui_titlescreen_SmallFontColor || "#686868";
    ctx.font = `${smallFontSize}px ${fontFamily}`;
    ctx.fillStyle = smallFontColor;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    const margin = 20 * scaleX;
    let infoY = canvas.height - margin;
    if (this.core.version) {
      ctx.fillText(`v${this.core.version}`, canvas.width - margin, infoY);
      infoY -= smallFontSize * 1.5;
    }
    if (this.core.date_updated) {
      const d = new Date(this.core.date_updated);
      const opt = { month: "short", day: "numeric", year: "numeric" };
      ctx.fillText(
        `Last Update ${d.toLocaleDateString("en-US", opt)}`,
        canvas.width - margin,
        infoY
      );
    }

    // 🔥 Render Settings Popup on TOP
    this.settingsPopup.render(ctx);
  }
}
