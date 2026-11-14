(() => {
  const SAVE_KEY = "ant-empire-save-v1";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const SURFACE_Y = 120;
  const SHAFT_LEFT = 420;
  const SHAFT_RIGHT = 540;
  const SHAFT_CENTER = 480;
  const CHAMBER_TOP = 820;
  const CHAMBER_Y = 960;
  const FOOD_SITE_X = 820;
  const NURSERY_X = 220;
  const NURSERY_Y = 560;
  const NURSERY_SLOTS = [80, 220, 360].map(x => ({ x, y: NURSERY_Y + 20, timer: null, workerRole: "hunter" }));
  const BLUE_NURSERY_X = 740;
  const BLUE_NURSERY_Y = 660;
  const BLUE_NURSERY_SLOTS = [600, 740, 880].map(x => ({ x, y: BLUE_NURSERY_Y + 20, timer: null, workerRole: "digger" }));
  const UPGRADE_ROOM_X = 740;
  const UPGRADE_ROOM_Y = 430;
  const MAX_CARRY = 3;
  const enemies = [];
  const droppedFood = [];
  const droppedCoins = [];
  const eggs = [];
  const workers = [];
  const keys = new Set();
  const touch = new Set();
  const player = { x: 250, y: 94, r: 12, facing: 1, walk: 0, attack: 0 };
  const queen = { x: 300, y: CHAMBER_Y, health: 5 };
  const lines = [
    "Oh! You're awake.",
    "Don't worry, that's not a problem. Also, YOU—yes, YOU—must protect this kingdom, fight enemies from the surface, and lay eggs to grow the colony. Dig new rooms and expand! Until then, GOOD LUCK!"
  ];

  let intro = "none";
  let lineIndex = 0;
  let displayed = "";
  let typeAt = 0;
  let promptAt = Infinity;
  let dirtStock = 30;
  let dirtStage = 1;
  let nextDirtBoxDelay = 0;
  const inventory = [];
  let dirtMineTimer = 0;
  let coins = 0;
  let surfaceDirtPixels = 0;
  let surfaceDirtExpiresAt = 0;
  let queenFoodValue = 5;
  let queenFoodShown = false;
  let zeroMealDisplay = 0;
  let nurseryOpen = false;
  let blueNurseryOpen = false;
  let upgradeRoomOpen = false;
  let upgradeScreenOpen = false;
  let upgradeScreenDismissed = false;
  let upgradeTab = "you";
  const upgrades = {
    youCarry: 0, youSpeed: 0,
    redDamage: 0, redSpeed: 0,
    blueCarry: 0, blueSpeed: 0
  };
  let extraRooms = 0;
  let colony = 1;
  let cameraX = 0;
  let cameraY = 0;
  let lastEnemy = 0;
  let lastAttack = 0;
  let now = performance.now();
  let lastFrame = now;
  let lastSavedAt = now;

  const worldWidth = () => W + extraRooms * 520;
  const worldLeft = () => 0;
  const pressed = name => keys.has(name) || touch.has(name);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const playerCarryCapacity = () => MAX_CARRY + upgrades.youCarry;
  const blueCarryCapacity = () => 1 + upgrades.blueCarry;
  const playerMoveSpeed = () => 180 + upgrades.youSpeed * 20;
  const currentDirtSite = () => {
    if (dirtStage === 1) return { x: SHAFT_CENTER, y: 286, maximum: 30 };
    if (dirtStage === 2) return { x: SHAFT_CENTER, y: 660, maximum: 45 };
    if (dirtStage === 3) return { x: BLUE_NURSERY_X, y: 540, maximum: 60 };
    return null;
  };
  const isInBlueNursery = (x, y) =>
    x >= BLUE_NURSERY_X - 140 && x <= BLUE_NURSERY_X + 140 &&
    y >= BLUE_NURSERY_Y - 140 && y <= BLUE_NURSERY_Y + 140;

  function roundRect(x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
  }

  function ellipse(x, y, rx, ry, fill, stroke, lineWidth = 3) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function drawAnt(x, y, scale = 1, color = "#a83228", isQueen = false, facing = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing < 0 ? -scale : scale, scale);
    ctx.lineCap = "round";
    ctx.lineWidth = isQueen ? 3 : 2.5;
    ctx.strokeStyle = "#3f2922";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-3, side * 3); ctx.lineTo(-9, side * 9);
      ctx.moveTo(1, side * 4); ctx.lineTo(1, side * 11);
      ctx.moveTo(6, side * 3); ctx.lineTo(11, side * 8);
      ctx.stroke();
    }
    ellipse(-7, 0, isQueen ? 12 : 7, isQueen ? 10 : 6, color, "#66281f", 2.5);
    ellipse(2, 0, 5, 5, color, "#66281f", 2.5);
    ellipse(10, 0, 6, 6, color, "#66281f", 2.5);
    ctx.strokeStyle = "#3f2922"; ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(12, -3); ctx.quadraticCurveTo(15, -11, 20, -9);
    ctx.moveTo(12, 3); ctx.quadraticCurveTo(17, 10, 21, 8);
    ctx.stroke();
    ellipse(12, -2, 1, 1, "#fff7dc");
    if (isQueen) {
      ctx.fillStyle = "#f4cf59";
      ctx.beginPath();
      ctx.moveTo(4, -11); ctx.lineTo(7, -23); ctx.lineTo(11, -13);
      ctx.lineTo(16, -25); ctx.lineTo(20, -11); ctx.closePath();
      ctx.fill(); ctx.strokeStyle = "#a8752d"; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.restore();
  }

  function drawArrow(x1, y1, x2, y2) {
    const pulse = 1 + Math.sin(now / 210) * .1;
    ctx.save();
    ctx.strokeStyle = "#fff2a3"; ctx.fillStyle = "#fff2a3";
    ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.translate(x2, y2);
    ctx.rotate(Math.atan2(y2 - y1, x2 - x1)); ctx.scale(pulse, pulse);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-14, -9); ctx.lineTo(-14, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawSurface() {
    const width = worldWidth();
    const sky = ctx.createLinearGradient(0, 0, 0, SURFACE_Y);
    sky.addColorStop(0, "#a7dcf4"); sky.addColorStop(1, "#e1f5bd");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, SURFACE_Y + 8);
    ellipse(790, 42, 29, 29, "#fff0a4");
    for (let i = 0; i < 9; i++) {
      const x = 60 + i * 105;
      ellipse(x, 58 + (i % 3) * 17, 21, 8, "rgba(255,255,255,.28)");
    }
    // A grassy lip sits above the side-view soil cross-section.
    ctx.fillStyle = "#72b844"; ctx.fillRect(0, 104, width, 20);
    ctx.fillStyle = "#97d45c"; ctx.fillRect(0, 100, width, 7);
    for (let x = 8; x < width; x += 19) {
      ctx.strokeStyle = x % 2 ? "#4c963e" : "#5da644";
      ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, 108); ctx.lineTo(x + Math.sin(x) * 4, 99 - (x % 5)); ctx.stroke();
    }
    for (const edge of [14, 29, 44, width - 14, width - 29, width - 44]) {
      ctx.strokeStyle = "#397a3c"; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(edge, 108); ctx.quadraticCurveTo(edge - 6, 88, edge + (edge < width / 2 ? 3 : -3), 72); ctx.stroke();
    }
    // The entrance is an open shaft, not a screen transition.
    ctx.fillStyle = "#29201b";
    ctx.fillRect(SHAFT_LEFT, 105, SHAFT_RIGHT - SHAFT_LEFT, 18);
    ctx.strokeStyle = "#d6b47d"; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(SHAFT_LEFT, 105); ctx.lineTo(SHAFT_LEFT, 128);
    ctx.moveTo(SHAFT_RIGHT, 105); ctx.lineTo(SHAFT_RIGHT, 128); ctx.stroke();
    if (intro === "none" && player.y < 150) {
      drawArrow(325, 62, SHAFT_CENTER, 111);
      ctx.fillStyle = "#344b2c"; ctx.font = "bold 14px Verdana"; ctx.textAlign = "center";
      ctx.fillText("FOLLOW THE ARROW", 650, 60); ctx.textAlign = "left";
    }
  }

  function drawSoil() {
    const width = worldWidth();
    const soil = ctx.createLinearGradient(0, SURFACE_Y, 0, 1140);
    soil.addColorStop(0, "#a7794c"); soil.addColorStop(.55, "#795337"); soil.addColorStop(1, "#563c2e");
    ctx.fillStyle = soil; ctx.fillRect(worldLeft(), SURFACE_Y, width - worldLeft(), 1040);
    ctx.fillStyle = "rgba(226,183,119,.16)";
    for (let i = 0; i < 110 + extraRooms * 55; i++) {
      const x = (i * 137 + 28) % width;
      const y = 145 + (i * 83) % 900;
      // Keep the shaft, chamber and dirt deposit visually clear.
      if ((x > SHAFT_LEFT - 20 && x < SHAFT_RIGHT + 20 && y < CHAMBER_TOP) || (y > 790 && y < 1120 && Math.abs(x - SHAFT_CENTER) < 440)) continue;
      ellipse(x, y, 3 + i % 5, 2 + i % 3, i % 2 ? "rgba(236,194,136,.24)" : "rgba(48,34,24,.16)");
    }
    // Wide underground chambers appear as open rooms in the soil.
    ellipse(SHAFT_CENTER, CHAMBER_Y, 430, 170, "#a9845a", "#d0a875", 13);
    if (nurseryOpen) ellipse(NURSERY_X, NURSERY_Y, 210, 140, "#a9845a", "#d0a875", 13);
    if (blueNurseryOpen) ellipse(BLUE_NURSERY_X, BLUE_NURSERY_Y, 210, 140, "#a9845a", "#d0a875", 13);
    if (upgradeRoomOpen) ellipse(UPGRADE_ROOM_X, UPGRADE_ROOM_Y, 135, 82, "#a9845a", "#d0a875", 12);
    for (let room = 0; room < extraRooms; room++) {
      const center = 1120 + room * 520;
      ellipse(center, CHAMBER_Y, 300, 150, "#a9845a", "#d0a875", 13);
      ctx.strokeStyle = "#8c6947"; ctx.lineWidth = 56; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(center - 350, CHAMBER_Y); ctx.lineTo(center - 250, CHAMBER_Y); ctx.stroke();
    }
    // Long, climbable shaft connects the surface directly to the nest.
    ctx.fillStyle = "#342720";
    ctx.fillRect(SHAFT_LEFT, SURFACE_Y, SHAFT_RIGHT - SHAFT_LEFT, CHAMBER_TOP - SURFACE_Y + 4);
    ctx.strokeStyle = "#916c47"; ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(SHAFT_LEFT, SURFACE_Y); ctx.lineTo(SHAFT_LEFT, CHAMBER_TOP);
    ctx.moveTo(SHAFT_RIGHT, SURFACE_Y); ctx.lineTo(SHAFT_RIGHT, CHAMBER_TOP); ctx.stroke();
    for (let y = 190; y < CHAMBER_TOP - 35; y += 95) {
      ellipse(SHAFT_LEFT + 10, y, 9, 4, "#b18a5b");
      ellipse(SHAFT_RIGHT - 10, y + 36, 8, 4, "#b18a5b");
    }
    if (nurseryOpen) {
      ctx.strokeStyle = "#a9845a"; ctx.lineWidth = 58; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(355, NURSERY_Y); ctx.lineTo(SHAFT_LEFT + 34, NURSERY_Y); ctx.stroke();
    }
    if (blueNurseryOpen) {
      ctx.strokeStyle = "#a9845a"; ctx.lineWidth = 58; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(SHAFT_RIGHT - 34, BLUE_NURSERY_Y); ctx.lineTo(605, BLUE_NURSERY_Y); ctx.stroke();
    }
    if (upgradeRoomOpen) {
      ctx.strokeStyle = "#a9845a"; ctx.lineWidth = 50; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(UPGRADE_ROOM_X, UPGRADE_ROOM_Y + 72); ctx.lineTo(UPGRADE_ROOM_X, 550); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(SHAFT_RIGHT, UPGRADE_ROOM_Y); ctx.lineTo(UPGRADE_ROOM_X - 135, UPGRADE_ROOM_Y); ctx.stroke();
    }
  }

  function drawSurfaceDirt() {
    if (surfaceDirtPixels <= 0) return;
    const left = SHAFT_RIGHT + 5;
    const logicalPixelsPerComputerPixel = W / (canvas.clientWidth || W);
    const height = surfaceDirtPixels * logicalPixelsPerComputerPixel;
    const width = 24 + height * .55;
    ctx.beginPath();
    ctx.moveTo(left, SURFACE_Y);
    ctx.lineTo(left, SURFACE_Y - height);
    ctx.lineTo(left + width * .62, SURFACE_Y - height * .72);
    ctx.lineTo(left + width, SURFACE_Y);
    ctx.closePath();
    ctx.fillStyle = "#986d45"; ctx.fill();
    ctx.strokeStyle = "#684a34"; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = "rgba(222,178,117,.75)"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(left + 3, SURFACE_Y - 2);
    ctx.lineTo(left + 3, SURFACE_Y - height + 3);
    ctx.lineTo(left + width * .62, SURFACE_Y - height * .72 + 3);
    ctx.stroke();
  }

  function drawDirtTile() {
    const site = currentDirtSite();
    if (!site) return;
    const { x, y, maximum: maxDirt } = site;
    ctx.save();
    ctx.strokeStyle = "#60d5ff"; ctx.lineWidth = 4;
    ctx.fillStyle = "rgba(57,174,220,.13)";
    ctx.fillRect(x - 36, y - 36, 72, 72); ctx.strokeRect(x - 36, y - 36, 72, 72);
    ctx.fillStyle = dirtStock > 0 ? "#9b754d" : "#65503c";
    ctx.fillRect(x - 27, y - 27, 54, 54);
    ctx.fillStyle = dirtStock > 0 ? "#c29a65" : "#80684c";
    ctx.beginPath(); ctx.moveTo(x - 27, y - 27); ctx.lineTo(x - 14, y - 35); ctx.lineTo(x + 39, y - 35); ctx.lineTo(x + 27, y - 27); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f8efd8"; ctx.font = "bold 11px Verdana"; ctx.textAlign = "center";
    ctx.fillText(`${dirtStock}/${maxDirt}`, x, y + 5);
    ctx.fillStyle = "#bfeeff"; ctx.font = "bold 12px Verdana";
    ctx.fillText("DIRT", x, y + 54); ctx.textAlign = "left";
    ctx.restore();
  }

  function drawQueenRoom() {
    // The queen is planted in her nest; only a small idle sway is animated.
    ellipse(queen.x, queen.y + 25, 115, 43, "#d8b17b", "#f1d59a");
    ellipse(queen.x, queen.y + 26, 88, 28, "#8f6947");
    drawAnt(queen.x, queen.y + Math.sin(now / 390) * 2, 3.25, "#87342c", true, 1);
    ctx.fillStyle = "#fff1d2"; ctx.font = "bold 14px Verdana"; ctx.textAlign = "center";
    ctx.fillText("QUEEN", queen.x, queen.y + 88); ctx.textAlign = "left";
    const mealValue = zeroMealDisplay > 0 ? 0 : queenFoodValue;
    if (queenFoodShown || zeroMealDisplay > 0) {
      roundRect(queen.x - 37, queen.y - 119, 74, 32, 8, "#fff8e8", "#a8754d");
      ctx.fillStyle = "#493628"; ctx.font = "bold 15px Verdana"; ctx.textAlign = "center";
      ctx.fillText(`${mealValue}/5`, queen.x, queen.y - 98); ctx.textAlign = "left";
    }
  }

  function drawEnemies() {
    for (const enemy of enemies) {
      ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.scale(1.4, 1.4);
      ellipse(0, 6, 17, 5, "rgba(49,36,26,.2)");
      ellipse(-6, 0, 9, 7, "#7d4937", "#452c25", 2);
      ellipse(5, 0, 8, 8, "#a55a3f", "#452c25", 2);
      ellipse(13, 0, 5, 5, "#58332b", "#452c25", 2);
      ctx.strokeStyle = "#452c25"; ctx.lineWidth = 2;
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(-3, side * 4); ctx.lineTo(-9, side * 10);
        ctx.moveTo(5, side * 4); ctx.lineTo(8, side * 10); ctx.stroke();
      }
      ellipse(14, -2, 1.5, 1.5, "#fff1a2");
      ctx.fillStyle = "#402b27"; ctx.fillRect(-9, -15, 26, 4);
      ctx.fillStyle = "#e45a4d"; ctx.fillRect(-9, -15, 26 * clamp(enemy.health / enemy.maxHealth, 0, 1), 4);
      ctx.restore();
    }
  }

  function drawFoodBlock(x, y) {
    roundRect(x - 9, y - 9, 18, 18, 3, "#e9c45d", "#805b31");
    ellipse(x, y + 1, 4, 5, "#ce6d39", "#805b31", 1.5);
    ctx.strokeStyle = "#538145"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.quadraticCurveTo(x + 3, y - 10, x + 7, y - 8); ctx.stroke();
  }

  function drawDroppedFood() {
    for (const food of droppedFood) {
      if (food.type === "meat") {
        roundRect(food.x - 10, food.y - 8, 20, 16, 4, "#b94a42", "#662d2a");
        ellipse(food.x, food.y, 4, 3, "#efb1a2", "#662d2a", 1);
      } else drawFoodBlock(food.x, food.y);
    }
  }

  function drawDroppedCoins() {
    for (const coin of droppedCoins) {
      ellipse(coin.x, coin.y, 10, 10, "#f4cf4f", "#8a5b19", 2);
      ellipse(coin.x, coin.y, 6, 6, "#ffe98a", "#b17a22", 1);
      ctx.fillStyle = "#684515"; ctx.font = "bold 8px Verdana"; ctx.textAlign = "center";
      ctx.fillText("C", coin.x, coin.y + 3);
      ctx.fillStyle = "#fff6df"; ctx.font = "bold 10px Verdana";
      ctx.fillText(String(coin.amount), coin.x, coin.y + 23);
      ctx.textAlign = "left";
    }
  }

  function drawEggs() {
    for (const egg of eggs) {
      ellipse(egg.x, egg.y, 18, 23, "#fff1d2", "#aa8551", 3);
      ellipse(egg.x - 5, egg.y - 8, 4, 6, "#ffffff");
      ctx.strokeStyle = "#cfb576"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(egg.x - 7, egg.y + 8); ctx.quadraticCurveTo(egg.x, egg.y + 12, egg.x + 7, egg.y + 7); ctx.stroke();
    }
  }

  function drawNurserySlots(slots, color, fill) {
    for (const slot of slots) {
      ctx.fillStyle = fill;
      ctx.strokeStyle = color; ctx.lineWidth = 4;
      ctx.fillRect(slot.x - 34, slot.y - 34, 68, 68);
      ctx.strokeRect(slot.x - 34, slot.y - 34, 68, 68);
      if (slot.timer !== null) {
        ellipse(slot.x, slot.y - 7, 15, 19, "#fff1d2", "#aa8551", 2);
        const seconds = Math.max(0, Math.ceil(slot.timer));
        const minutesText = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
        ctx.fillStyle = "#fff6df"; ctx.font = "bold 12px Verdana"; ctx.textAlign = "center";
        ctx.fillText(minutesText, slot.x, slot.y + 26);
      } else {
        ctx.fillStyle = "#ffe5df"; ctx.font = "bold 12px Verdana"; ctx.textAlign = "center";
        ctx.fillText("E: EGG", slot.x, slot.y + 5);
      }
      ctx.textAlign = "left";
    }
  }

  function drawNursery() {
    if (nurseryOpen) drawNurserySlots(NURSERY_SLOTS, "#f17870", "rgba(184,52,47,.22)");
    if (blueNurseryOpen) drawNurserySlots(BLUE_NURSERY_SLOTS, "#66caff", "rgba(47,148,207,.24)");
  }

  function drawWorkers() {
    for (const worker of workers) {
      drawAnt(worker.x, worker.y, .9, "#b64330", false, worker.dir || 1);
      if (worker.role === "digger" && worker.carrying) {
        ctx.fillStyle = "#9d7448";
        for (let i = 0; i < worker.carrying; i++) {
          ctx.fillRect(worker.x - 6, worker.y - 24 - i * 13, 12, 12);
          ctx.strokeStyle = "#4a3729"; ctx.lineWidth = 1.5;
          ctx.strokeRect(worker.x - 6, worker.y - 24 - i * 13, 12, 12);
        }
      }
    }
  }

  function drawDirtDigSiteHint() {
    if (blueNurseryOpen) {
      ctx.fillStyle = "#e5f8ff"; ctx.font = "bold 12px Verdana"; ctx.textAlign = "center";
      ctx.fillText(dirtStock > 0 ? `BLUE ANTS CARRY ${blueCarryCapacity()} DIRT` : "BLUE ANTS WAIT FOR DIRT", SHAFT_CENTER, 805);
      ctx.textAlign = "left";
    }
  }

  function drawUpgradePortal() {
    if (!upgradeRoomOpen) return;
    ellipse(UPGRADE_ROOM_X, UPGRADE_ROOM_Y + 4, 31, 21, "#080a10", "#4ac9ff", 5);
    ellipse(UPGRADE_ROOM_X, UPGRADE_ROOM_Y + 4, 19, 12, "#000000", "#6876ff", 2);
    ctx.fillStyle = "#e5f8ff"; ctx.font = "bold 12px Verdana"; ctx.textAlign = "center";
    ctx.fillText("UPGRADES", UPGRADE_ROOM_X, UPGRADE_ROOM_Y + 48); ctx.textAlign = "left";
    ctx.fillStyle = "#fff1d2"; ctx.font = "bold 11px Verdana"; ctx.textAlign = "center";
    ctx.fillText("← TO SURFACE", (SHAFT_RIGHT + UPGRADE_ROOM_X - 135) / 2, UPGRADE_ROOM_Y - 34);
    ctx.textAlign = "left";
  }

  function drawPlayer() {
    // Carried dirt, food and eggs stack above the ant's head.
    for (let i = 0; i < inventory.length; i++) {
      const size = 14;
      const item = inventory[i];
      const itemY = player.y - 27 - i * 18;
      if (item.type === "dirt") {
        ctx.fillStyle = "#9d7448"; ctx.fillRect(player.x - size / 2, itemY, size, size);
        ctx.strokeStyle = "#4a3729"; ctx.lineWidth = 2; ctx.strokeRect(player.x - size / 2, itemY, size, size);
        ctx.fillStyle = "#c49a64"; ctx.fillRect(player.x - size / 2, itemY, size, 3);
      } else if (item.type === "food") {
        roundRect(player.x - size / 2, itemY, size, size, 3, "#e9c45d", "#805b31");
        ellipse(player.x, itemY + 7, 3, 4, "#ce6d39", "#805b31", 1);
      } else if (item.type === "meat") {
        roundRect(player.x - size / 2, itemY, size, size, 3, "#b94a42", "#662d2a");
        ellipse(player.x, itemY + 7, 4, 3, "#efb1a2", "#662d2a", 1);
      } else {
        ellipse(player.x, itemY + 7, 7, 9, "#fff1d2", "#aa8551", 2);
        ellipse(player.x - 2, itemY + 3, 2, 3, "#ffffff");
      }
    }
    drawAnt(player.x, player.y, 1.08, "#d74732", false, player.facing);
    if (player.attack > 0) {
      ctx.strokeStyle = "#fff0a0"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(player.x + player.facing * 22, player.y, 24, -.8, .8); ctx.stroke();
    }
  }

  function drawFoodSite() {
    const x = FOOD_SITE_X + extraRooms * 520;
    ctx.fillStyle = "#82b94f"; ctx.strokeStyle = "#d5efa4"; ctx.lineWidth = 4;
    ctx.fillRect(x - 38, CHAMBER_Y - 38, 76, 76); ctx.strokeRect(x - 38, CHAMBER_Y - 38, 76, 76);
    ellipse(x, CHAMBER_Y - 5, 13, 9, "#f3d678", "#9f7639", 2);
    ellipse(x - 12, CHAMBER_Y - 12, 6, 5, "#f3d678", "#9f7639", 2);
    ctx.fillStyle = "#fff6df"; ctx.font = "bold 13px Verdana"; ctx.textAlign = "center";
    ctx.fillText("FOOD", x, CHAMBER_Y + 29);
    ctx.font = "bold 10px Verdana"; ctx.fillText("E: PLACE", x, CHAMBER_Y + 45); ctx.textAlign = "left";
  }

  function drawWorld() {
    ctx.save();
    ctx.translate(-cameraX, -cameraY);
    drawSurface();
    drawSoil();
    drawSurfaceDirt();
    drawDirtTile();
    drawQueenRoom();
    drawEnemies();
    drawDroppedFood();
    drawDroppedCoins();
    drawEggs();
    drawNursery();
    drawWorkers();
    drawDirtDigSiteHint();
    drawUpgradePortal();
    if (intro === "approach") {
      const pulse = 1 + Math.sin(now / 220) * .08;
      ctx.save(); ctx.translate(660, CHAMBER_Y - 10); ctx.scale(pulse, pulse);
      ctx.strokeStyle = "#70d9ff"; ctx.fillStyle = "rgba(99,206,255,.12)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      drawArrow(580, CHAMBER_Y - 42, 625, CHAMBER_Y - 10);
      ctx.fillStyle = "#ddf7ff"; ctx.font = "bold 13px Verdana"; ctx.textAlign = "center";
      ctx.fillText("STEP INTO THE GLOW", 660, CHAMBER_Y + 53); ctx.textAlign = "left";
    }
    if (intro === "playing") drawFoodSite();
    drawPlayer();
    ctx.restore();
    drawHud();
  }

  function drawHud() {
    roundRect(16, 14, 510, 64, 12, "rgba(38,45,29,.82)");
    ctx.fillStyle = "#fff6df"; ctx.font = "bold 14px Verdana"; ctx.textAlign = "left";
    const heart = "♥".repeat(queen.health);
    const foodCount = inventory.filter(item => item.type === "food" || item.type === "meat").length;
    const eggCount = inventory.filter(item => item.type === "egg").length;
    ctx.fillText(`Colony ${colony}  Pack ${inventory.length}/${playerCarryCapacity()}  Food ${foodCount}  Eggs ${eggCount}  Queen ${heart}`, 28, 39);
    ctx.fillText(`Coins ${coins}`, 28, 64);
    if (player.y < 145 && enemies.length) {
      ctx.fillStyle = "#53382b"; ctx.font = "bold 13px Verdana";
      ctx.fillText("Surface bugs!  Space to defend", W - 270, 37);
    }
  }

  function drawDialogue() {
    ctx.fillStyle = "rgba(17,23,18,.58)"; ctx.fillRect(0, 0, W, H);
    const boxW = 740, boxH = 236, bx = (W - boxW) / 2, by = (H - boxH) / 2;
    roundRect(bx, by, boxW, boxH, 24, "#fff8e8", "#ae8251");
    ellipse(bx + 67, by + 67, 42, 42, "#f3e0bd", "#d3b887");
    drawAnt(bx + 67, by + 68, 1.3, "#87342c", true, 1);
    ctx.fillStyle = "#57402f"; ctx.font = "bold 14px Verdana"; ctx.textAlign = "center";
    ctx.fillText("QUEEN", bx + 67, by + 126); ctx.textAlign = "left";
    ctx.fillStyle = "#4a3729"; ctx.font = "bold 16px Verdana";
    const textX = bx + 132, maxWidth = boxW - 172;
    let row = "", y = by + 50;
    for (const word of displayed.split(" ")) {
      const test = row ? `${row} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && row) {
        ctx.fillText(row, textX, y); row = word; y += 27;
      } else row = test;
    }
    if (row) ctx.fillText(row, textX, y);
    if (now >= promptAt && displayed === lines[lineIndex]) {
      roundRect(bx + boxW - 110, by + boxH - 58, 76, 38, 10, "#dff1bf", "#72944d");
      ctx.fillStyle = "#314529"; ctx.font = "bold 16px Verdana"; ctx.textAlign = "center";
      ctx.fillText("A  ▶", bx + boxW - 72, by + boxH - 33); ctx.textAlign = "left";
    }
  }

  function beginDialogue() {
    intro = "dialogue";
    lineIndex = 0;
    displayed = "";
    typeAt = now;
    promptAt = Infinity;
  }

  function advanceDialogue() {
    if (intro !== "dialogue" || now < promptAt || displayed !== lines[lineIndex]) return;
    if (lineIndex === 0) {
      lineIndex = 1; displayed = ""; typeAt = now; promptAt = Infinity;
    } else {
      intro = "playing";
      lastEnemy = now;
    }
  }

  function depleteDirtStock() {
    if (dirtStock <= 0) return;
    dirtStock -= 1;
    if (dirtStock === 0 && dirtStage === 1) {
      nurseryOpen = true;
      nextDirtBoxDelay = .45;
      dirtMineTimer = 0;
    } else if (dirtStock === 0 && dirtStage === 2) {
      blueNurseryOpen = true;
      nextDirtBoxDelay = .45;
      dirtMineTimer = 0;
    } else if (dirtStock === 0 && dirtStage === 3) {
      upgradeRoomOpen = true;
      dirtStage = 4;
      dirtMineTimer = 0;
    }
  }

  function mineWhileInside(dt) {
    const site = currentDirtSite();
    const inTile = site && Math.abs(player.x - site.x) < 36 && Math.abs(player.y - site.y) < 36;
    if (inTile && inventory.length < playerCarryCapacity() && dirtStock > 0) {
      dirtMineTimer += dt;
      while (dirtMineTimer >= 1 / 3 && inventory.length < playerCarryCapacity() && dirtStock > 0) {
        dirtMineTimer -= 1 / 3;
        inventory.push({ type: "dirt" });
        depleteDirtStock();
        if (dirtStock === 0) break;
      }
    } else {
      dirtMineTimer = 0;
    }
  }

  function unloadDirtOnSurface() {
    if (player.y <= 110) {
      const dirtCount = inventory.filter(item => item.type === "dirt").length;
      if (dirtCount > 0) {
        surfaceDirtPixels += dirtCount * 4;
        surfaceDirtExpiresAt = Date.now() + 5 * 60 * 1000;
        for (let i = inventory.length - 1; i >= 0; i--) {
          if (inventory[i].type === "dirt") inventory.splice(i, 1);
        }
      }
      dirtMineTimer = 0;
    }
  }

  function collectDroppedItems() {
    for (let i = droppedCoins.length - 1; i >= 0; i--) {
      const coin = droppedCoins[i];
      if (Math.hypot(player.x - coin.x, player.y - coin.y) < 32) {
        coins += coin.amount;
        droppedCoins.splice(i, 1);
      }
    }
    if (inventory.length >= playerCarryCapacity()) return;
    for (let i = droppedFood.length - 1; i >= 0 && inventory.length < playerCarryCapacity(); i--) {
      const food = droppedFood[i];
      if (Math.hypot(player.x - food.x, player.y - food.y) < 28) {
        inventory.push({ type: food.type });
        droppedFood.splice(i, 1);
      }
    }
    for (let i = eggs.length - 1; i >= 0 && inventory.length < playerCarryCapacity(); i--) {
      const egg = eggs[i];
      if (Math.hypot(player.x - egg.x, player.y - egg.y) < 36) {
        inventory.push({ type: "egg" });
        eggs.splice(i, 1);
      }
    }
  }

  function dropCoins(x, y) {
    droppedCoins.push({
      x: x + (Math.random() - .5) * 20,
      y: y + 8,
      amount: 15 + Math.floor(Math.random() * 11)
    });
  }

  function placeFood() {
    if (intro !== "playing" || queenFoodValue === 0 || zeroMealDisplay > 0) return;
    const siteX = FOOD_SITE_X + extraRooms * 520;
    if (Math.hypot(player.x - siteX, player.y - CHAMBER_Y) > 65) return;
    const foodIndex = inventory.findIndex(item => item.type === "food" || item.type === "meat");
    if (foodIndex < 0) return;
    inventory.splice(foodIndex, 1);
    queenFoodShown = true;
    if (queenFoodValue > 0) queenFoodValue -= 1;
    if (queenFoodValue === 0) {
      eggs.push({ x: queen.x + 110, y: queen.y + 8 });
      zeroMealDisplay = 1.2;
    }
  }

  function placeEgg() {
    if (intro !== "playing") return false;
    const eggIndex = inventory.findIndex(item => item.type === "egg");
    if (eggIndex < 0) return false;
    const availableSlots = [
      ...(nurseryOpen ? NURSERY_SLOTS : []),
      ...(blueNurseryOpen ? BLUE_NURSERY_SLOTS : [])
    ];
    const slot = availableSlots.find(candidate => candidate.timer === null && Math.hypot(player.x - candidate.x, player.y - candidate.y) < 66);
    if (!slot) return false;
    inventory.splice(eggIndex, 1);
    slot.timer = 120;
    return true;
  }

  function interact() {
    if (!placeEgg()) placeFood();
  }

  function updateNursery(dt) {
    if (zeroMealDisplay > 0) {
      zeroMealDisplay = Math.max(0, zeroMealDisplay - dt);
      if (zeroMealDisplay === 0) queenFoodValue = 5;
    }
    const activeSlots = [
      ...(nurseryOpen ? NURSERY_SLOTS : []),
      ...(blueNurseryOpen ? BLUE_NURSERY_SLOTS : [])
    ];
    for (const slot of activeSlots) {
      if (slot.timer === null) continue;
      slot.timer -= dt;
      if (slot.timer <= 0) {
        slot.timer = null;
        const isDigger = slot.workerRole === "digger";
        workers.push({
          x: slot.x, y: slot.y,
          state: isDigger ? "toDirt" : "toShaft",
          role: isDigger ? "digger" : "hunter",
          dir: 1, speed: 125, carrying: 0, mineTimer: 0,
          mineOffset: isDigger ? [-20, -10, 0, 10, 20][workers.length % 5] : 0
        });
        colony += 1;
      }
    }
  }

  function updateDiggerWorker(worker, dt) {
    const site = currentDirtSite();
    if (!site && worker.state !== "toSurface") {
      if (worker.carrying) worker.state = "toSurface";
      else {
        worker.state = "waiting";
        return;
      }
    }
    const targetX = site
      ? site.x + (site.x === BLUE_NURSERY_X ? worker.mineOffset || 0 : 0)
      : SHAFT_CENTER;
    const targetY = site ? site.y : 0;
    if (worker.state === "waiting") {
      if (dirtStock > 0) worker.state = "toDirt";
      return;
    }
    if (worker.state === "toDirt") {
      if (site.x !== BLUE_NURSERY_X) worker.blueDirtRoute = null;
      if (site.x === BLUE_NURSERY_X) {
        const entranceX = BLUE_NURSERY_X - 130;
        if (!["alignShaft", "alignY", "toDoor", "inside"].includes(worker.blueDirtRoute)) {
          worker.blueDirtRoute = isInBlueNursery(worker.x, worker.y) ? "inside" : "alignShaft";
        }
        if (worker.blueDirtRoute === "alignShaft") {
          if (Math.abs(worker.x - SHAFT_CENTER) > 10) {
            worker.dir = Math.sign(SHAFT_CENTER - worker.x);
            worker.x += worker.dir * worker.speed * dt;
          } else {
            worker.x = SHAFT_CENTER;
            worker.blueDirtRoute = "alignY";
          }
        } else if (worker.blueDirtRoute === "alignY") {
          if (Math.abs(worker.y - BLUE_NURSERY_Y) > 12) {
            worker.x = SHAFT_CENTER;
            worker.y += Math.sign(BLUE_NURSERY_Y - worker.y) * worker.speed * dt;
          } else {
            worker.y = BLUE_NURSERY_Y;
            worker.blueDirtRoute = "toDoor";
          }
        } else if (worker.blueDirtRoute === "toDoor") {
          if (Math.abs(worker.x - entranceX) > 10) {
            worker.y = BLUE_NURSERY_Y;
            worker.dir = Math.sign(entranceX - worker.x);
            worker.x += worker.dir * worker.speed * dt;
          } else {
            worker.x = entranceX;
            worker.y = BLUE_NURSERY_Y;
            worker.blueDirtRoute = "inside";
          }
        } else {
          const dx = targetX - worker.x;
          const dy = targetY - worker.y;
          const distance = Math.hypot(dx, dy);
          const step = worker.speed * dt;
          if (distance <= step || distance < 12) {
            worker.x = targetX;
            worker.y = targetY;
            worker.mineTimer = 0;
            worker.blueDirtRoute = null;
            worker.state = "mining";
          } else {
            worker.dir = Math.sign(dx) || worker.dir;
            worker.x += dx / distance * step;
            worker.y += dy / distance * step;
          }
        }
      } else if (Math.abs(worker.x - SHAFT_CENTER) > 10) {
        worker.dir = Math.sign(SHAFT_CENTER - worker.x);
        worker.x += worker.dir * worker.speed * dt;
      } else if (Math.abs(worker.y - targetY) > 12) {
        worker.x = SHAFT_CENTER;
        worker.y += Math.sign(targetY - worker.y) * worker.speed * dt;
      } else if (Math.abs(worker.x - targetX) > 10) {
        worker.y = targetY;
        worker.dir = Math.sign(targetX - worker.x);
        worker.x += worker.dir * worker.speed * dt;
      } else {
        worker.x = targetX;
        worker.y = targetY;
        worker.mineTimer = 0;
        worker.state = "mining";
      }
    } else if (worker.state === "mining") {
      if (Math.hypot(worker.x - targetX, worker.y - targetY) > 12) {
        worker.state = "toDirt";
        return;
      }
      worker.x = targetX;
      worker.y = targetY;
      if (dirtStock <= 0) {
        worker.state = worker.carrying ? "toSurface" : "waiting";
        return;
      }
      worker.mineTimer += dt;
      if (worker.mineTimer >= 1 / 3) {
        worker.mineTimer -= 1 / 3;
        if (dirtStock > 0) {
          worker.carrying += 1;
          depleteDirtStock();
          if (worker.carrying >= blueCarryCapacity() || dirtStock <= 0) worker.state = "toSurface";
        }
      }
    } else if (worker.state === "toSurface") {
      const entranceX = BLUE_NURSERY_X - 130;
      if (!worker.blueReturnRoute) {
        worker.blueReturnRoute = isInBlueNursery(worker.x, worker.y) ? "doorway" : "shaft";
      }
      if (worker.blueReturnRoute === "doorway") {
        const dx = entranceX - worker.x;
        const dy = BLUE_NURSERY_Y - worker.y;
        const distance = Math.hypot(dx, dy);
        const step = worker.speed * dt;
        if (distance <= step || distance < 10) {
          worker.x = entranceX;
          worker.y = BLUE_NURSERY_Y;
          worker.blueReturnRoute = "shaft";
        } else {
          worker.dir = Math.sign(dx) || worker.dir;
          worker.x += dx / distance * step;
          worker.y += dy / distance * step;
        }
      } else if (Math.abs(worker.x - SHAFT_CENTER) > 10) {
        worker.dir = Math.sign(SHAFT_CENTER - worker.x);
        worker.x += worker.dir * worker.speed * dt;
      } else {
        worker.x = SHAFT_CENTER;
        worker.y -= worker.speed * dt;
        if (worker.y <= 108) {
          worker.y = 98;
          surfaceDirtPixels += worker.carrying * 4;
          surfaceDirtExpiresAt = Date.now() + 5 * 60 * 1000;
          worker.carrying = 0;
          worker.blueDirtRoute = null;
          worker.blueReturnRoute = null;
          worker.state = "toDirt";
        }
      }
    }
  }

  function updateWorkers(dt) {
    for (const worker of workers) {
      worker.speed = worker.role === "digger" ? 125 + upgrades.blueSpeed * 20 : 125 + upgrades.redSpeed * 20;
      if (worker.role === "digger") {
        updateDiggerWorker(worker, dt);
        continue;
      }
      if (worker.state === "toShaft") {
        const difference = SHAFT_CENTER - worker.x;
        if (Math.abs(difference) < 10) {
          worker.x = SHAFT_CENTER;
          worker.state = "climbing";
        } else {
          worker.dir = Math.sign(difference);
          worker.x += worker.dir * worker.speed * dt;
        }
      } else if (worker.state === "climbing") {
        worker.x = SHAFT_CENTER;
        worker.y -= worker.speed * dt;
        if (worker.y <= 108) {
          worker.y = 98;
          worker.state = "surface";
          worker.dir = Math.random() < .5 ? -1 : 1;
        }
      } else {
        worker.y = 98;
        if (enemies.length) {
          const target = enemies.reduce((closest, enemy) =>
            Math.abs(enemy.x - worker.x) < Math.abs(closest.x - worker.x) ? enemy : closest
          );
          worker.dir = Math.sign(target.x - worker.x) || worker.dir;
          worker.x += worker.dir * worker.speed * 1.5 * dt;
          if (Math.abs(target.x - worker.x) < 25) {
            worker.attackTimer = (worker.attackTimer || 0) + dt;
            if (worker.attackTimer >= .6) {
              worker.attackTimer = 0;
              target.health -= 1 + upgrades.redDamage;
              if (target.health <= 0) {
                const index = enemies.indexOf(target);
                if (index >= 0) {
                  const [bug] = enemies.splice(index, 1);
                  droppedFood.push({ x: bug.x, y: bug.y, type: "meat" });
                  dropCoins(bug.x, bug.y);
                }
              }
            }
          } else worker.attackTimer = 0;
        } else {
          worker.attackTimer = 0;
          worker.x += worker.dir * worker.speed * .65 * dt;
        }
        if (worker.x < 70 || worker.x > 890) {
          worker.x = clamp(worker.x, 70, 890);
          worker.dir *= -1;
        }
      }
    }
  }

  function movePlayer(dt) {
    if (intro === "dialogue" || upgradeScreenOpen) return;
    const previousY = player.y;
    let dx = (pressed("right") ? 1 : 0) - (pressed("left") ? 1 : 0);
    let dy = (pressed("down") ? 1 : 0) - (pressed("up") ? 1 : 0);
    if (dx || dy) {
      const length = Math.hypot(dx, dy); dx /= length; dy /= length;
      const speed = playerMoveSpeed();
      player.x += dx * speed * dt;
      player.y += dy * speed * dt;
      if (dx) player.facing = Math.sign(dx);
      player.walk += dt * 12;
    }
    // Guide the player back into the vertical shaft when climbing out of
    // either side nursery, instead of letting them climb through its ceiling.
    const leftRoomTop = NURSERY_Y - 140;
    const rightRoomTop = BLUE_NURSERY_Y - 140;
    const enteringUpgradeRoom = upgradeRoomOpen && Math.abs(player.x - UPGRADE_ROOM_X) <= 50;
    if (nurseryOpen && dy < 0 && player.y >= leftRoomTop - 15 && player.y <= NURSERY_Y + 140 && player.x < SHAFT_LEFT + 14) {
      player.x = Math.min(SHAFT_LEFT + 14, player.x + playerMoveSpeed() * dt);
    }
    if (blueNurseryOpen && !enteringUpgradeRoom && dy < 0 && player.y >= rightRoomTop - 15 && player.y <= BLUE_NURSERY_Y + 140 && player.x > SHAFT_RIGHT - 14) {
      player.x = Math.max(SHAFT_RIGHT - 14, player.x - playerMoveSpeed() * dt);
    }
    if (nurseryOpen && player.x < SHAFT_LEFT + 12 && previousY >= leftRoomTop && player.y < leftRoomTop && player.y > SURFACE_Y + 10) {
      player.y = leftRoomTop;
    }
    if (blueNurseryOpen && !enteringUpgradeRoom && player.x > SHAFT_RIGHT - 12 && previousY >= rightRoomTop && player.y < rightRoomTop && player.y > SURFACE_Y + 10) {
      player.y = rightRoomTop;
    }
    const upgradeRoomTop = UPGRADE_ROOM_Y - 82;
    if (upgradeRoomOpen && Math.abs(player.x - UPGRADE_ROOM_X) <= 135 && previousY >= upgradeRoomTop && player.y < upgradeRoomTop && player.y > SURFACE_Y + 10) {
      player.y = upgradeRoomTop;
    }
    const width = worldWidth();
    if (player.y < 145) {
      player.x = clamp(player.x, 55, width - 55);
      if (player.y > 110 && (player.x < SHAFT_LEFT + 12 || player.x > SHAFT_RIGHT - 12)) player.y = 110;
      else player.y = clamp(player.y, 72, 158);
    }
    if (player.y >= 145 && player.y < CHAMBER_TOP) {
      const upgradeRoomBottom = UPGRADE_ROOM_Y + 82;
      const inLeftRoom = nurseryOpen && player.y >= leftRoomTop && player.y <= NURSERY_Y + 140;
      const inRightRoom = blueNurseryOpen && player.y >= rightRoomTop && player.y <= BLUE_NURSERY_Y + 140;
      const upgradeRoomLeft = UPGRADE_ROOM_X - 135;
      const inUpgradeRoom = upgradeRoomOpen && player.y >= upgradeRoomTop && player.y <= upgradeRoomBottom && player.x >= upgradeRoomLeft;
      const inUpgradeHall = upgradeRoomOpen && Math.abs(player.y - UPGRADE_ROOM_Y) <= 30 &&
        player.x >= SHAFT_RIGHT - 14 && player.x < upgradeRoomLeft;
      const inUpgradeDoor = upgradeRoomOpen && player.y > upgradeRoomBottom && player.y < BLUE_NURSERY_Y - 110;
      if (inUpgradeHall) {
        player.x = clamp(player.x, SHAFT_RIGHT - 14, upgradeRoomLeft);
      } else if (inUpgradeRoom) {
        player.x = clamp(player.x, UPGRADE_ROOM_X - 135, UPGRADE_ROOM_X + 135);
      } else if (inUpgradeDoor) {
        player.x = clamp(player.x, UPGRADE_ROOM_X - 50, UPGRADE_ROOM_X + 50);
      } else if (inLeftRoom && player.x < SHAFT_CENTER) {
        player.x = clamp(player.x, 25, SHAFT_RIGHT - 14);
      } else if (inRightRoom && player.x > SHAFT_CENTER) {
        player.x = clamp(player.x, SHAFT_LEFT + 14, width - 25);
      } else {
        player.x = clamp(player.x, SHAFT_LEFT + 14, SHAFT_RIGHT - 14);
      }
      player.y = clamp(player.y, 145, CHAMBER_TOP + 18);
    }
    if (player.y >= CHAMBER_TOP - 6) {
      player.x = clamp(player.x, worldLeft() + 80, width - 80);
      player.y = clamp(player.y, CHAMBER_TOP - 6, 1090);
    }
    mineWhileInside(dt);
    unloadDirtOnSurface();
    if (player.y >= CHAMBER_TOP && intro === "none") intro = "approach";
    if (intro === "approach" && Math.hypot(player.x - 660, player.y - (CHAMBER_Y - 10)) < 43) beginDialogue();
    const upgradePortalDistance = Math.hypot(player.x - UPGRADE_ROOM_X, player.y - (UPGRADE_ROOM_Y + 4));
    if (upgradeScreenDismissed && upgradePortalDistance > 80) upgradeScreenDismissed = false;
    if (upgradeRoomOpen && !upgradeScreenDismissed && upgradePortalDistance < 36) {
      upgradeScreenOpen = true;
      keys.clear();
      saveGame();
    }
    if (player.y < 145) cameraX = 0;
    else cameraX = clamp(player.x - W * .47, worldLeft(), width - W);
    const maxCameraY = 1120 - H;
    const targetY = player.y < 270 ? 0 : clamp(player.y - H * .5, 0, maxCameraY);
    cameraY += (targetY - cameraY) * Math.min(1, dt * 5);
  }

  function attack() {
    if (now - lastAttack < 380 || player.y > 145) return;
    lastAttack = now; player.attack = .18;
    const target = enemies.findIndex(enemy => Math.abs(enemy.x - player.x) < 68 && Math.abs(enemy.y - player.y) < 42);
    if (target >= 0) {
      enemies[target].health -= 1;
      if (enemies[target].health <= 0) {
        const [enemy] = enemies.splice(target, 1);
        droppedFood.push({ x: enemy.x, y: enemy.y, type: "food" });
        dropCoins(enemy.x, enemy.y);
        colony += 1;
      }
    }
  }

  function updateEnemies(dt) {
    if (intro !== "playing") return;
    if (now - lastEnemy > 10500 && enemies.length < 2) {
      const side = Math.random() < .5 ? "left" : "right";
      const x = side === "left" ? 90 : 870;
      enemies.push({
        x, y: 98, side,
        minX: side === "left" ? 70 : SHAFT_RIGHT + 25,
        maxX: side === "left" ? SHAFT_LEFT - 25 : 890,
        dir: side === "left" ? 1 : -1,
        speed: 28 + Math.random() * 14,
        health: 2,
        maxHealth: 2
      });
      lastEnemy = now;
    }
    for (const enemy of enemies) {
      // Surface bugs patrol and chase only while the player is above ground.
      const playerSide = player.x < SHAFT_LEFT ? "left" : (player.x > SHAFT_RIGHT ? "right" : "tunnel");
      if (player.y < 145 && playerSide === enemy.side && Math.abs(player.y - enemy.y) < 50 && Math.abs(player.x - enemy.x) < 210) {
        enemy.dir = Math.sign(player.x - enemy.x) || enemy.dir;
      }
      enemy.x += enemy.dir * enemy.speed * dt;
      if (enemy.x < enemy.minX || enemy.x > enemy.maxX) {
        enemy.x = clamp(enemy.x, enemy.minX, enemy.maxX);
        enemy.dir *= -1;
      }
      enemy.y = 98;
    }
  }

  function update(dt) {
    if (surfaceDirtPixels > 0 && surfaceDirtExpiresAt > 0 && Date.now() >= surfaceDirtExpiresAt) {
      surfaceDirtPixels = 0;
      surfaceDirtExpiresAt = 0;
    }
    if (upgradeScreenOpen) return;
    if (intro === "dialogue" && displayed !== lines[lineIndex]) {
      const chars = Array.from(lines[lineIndex]);
      displayed = chars.slice(0, Math.floor((now - typeAt) / 34)).join("");
      if (displayed === lines[lineIndex]) promptAt = lineIndex === 0 ? now + 3000 : now;
    }
    movePlayer(dt);
    if ((dirtStage === 1 || dirtStage === 2) && dirtStock === 0) {
      nextDirtBoxDelay -= dt;
      if (nextDirtBoxDelay <= 0) {
        dirtStage += 1;
        dirtStock = dirtStage === 2 ? 45 : 60;
      }
    }
    updateNursery(dt);
    updateEnemies(dt);
    updateWorkers(dt);
    collectDroppedItems();
    if (player.attack > 0) player.attack -= dt;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    if (upgradeScreenOpen) {
      drawUpgradeScreen();
      return;
    }
    drawWorld();
    if (intro === "dialogue") drawDialogue();
  }

  function upgradeOptions() {
    if (upgradeTab === "red") {
      return [
        { name: "ATTACK DAMAGE", level: upgrades.redDamage, value: 1 + upgrades.redDamage, key: "redDamage" },
        { name: "SPEED", level: upgrades.redSpeed, value: 125 + upgrades.redSpeed * 20, key: "redSpeed" }
      ];
    }
    if (upgradeTab === "blue") {
      return [
        { name: "CARRY CAPACITY", level: upgrades.blueCarry, value: blueCarryCapacity(), key: "blueCarry" },
        { name: "SPEED", level: upgrades.blueSpeed, value: 125 + upgrades.blueSpeed * 20, key: "blueSpeed" }
      ];
    }
    return [
      { name: "CARRY CAPACITY", level: upgrades.youCarry, value: playerCarryCapacity(), key: "youCarry" },
      { name: "SPEED", level: upgrades.youSpeed, value: playerMoveSpeed(), key: "youSpeed" }
    ];
  }

  const upgradeCost = level => 10 + level * 3;

  function drawUpgradeScreen() {
    ctx.fillStyle = "#283d2b"; ctx.fillRect(0, 0, W, H);
    ellipse(130, 500, 220, 100, "rgba(168,216,110,.12)");
    ellipse(830, 130, 250, 150, "rgba(112,217,255,.08)");
    const tabs = [
      { id: "you", text: "YOU", x: 30 },
      { id: "red", text: "RED ANTS", x: 345 },
      { id: "blue", text: "BLUE ANTS", x: 660 }
    ];
    for (const tab of tabs) {
      roundRect(tab.x, 24, 270, 60, 14, upgradeTab === tab.id ? "#dff1bf" : "#526d48", upgradeTab === tab.id ? "#fff4c2" : "#98bd76");
      ctx.fillStyle = upgradeTab === tab.id ? "#2e4327" : "#f2f5e8";
      ctx.font = "bold 19px Verdana"; ctx.textAlign = "center";
      ctx.fillText(tab.text, tab.x + 135, 61);
    }
    ctx.fillStyle = "#f8f3df"; ctx.font = "bold 23px Verdana"; ctx.textAlign = "center";
    ctx.fillText("UPGRADES", W / 2, 128);
    ctx.textAlign = "right"; ctx.font = "bold 16px Verdana";
    ctx.fillText(`COINS: ${coins}`, 930, 128);
    ctx.textAlign = "center";
    const options = upgradeOptions();
    const ys = [158, 300];
    options.forEach((option, index) => {
      roundRect(250, ys[index], 460, 112, 18, "#f8f3df", "#b5d586");
      ctx.fillStyle = "#354b2d"; ctx.font = "bold 18px Verdana";
      ctx.fillText(option.name, W / 2, ys[index] + 34);
      ctx.font = "bold 15px Verdana";
      const valueLabel = option.key.includes("Speed") ? `${option.value} speed` : `${option.value} ${option.key === "redDamage" ? "damage" : "items"}`;
      ctx.fillText(`LEVEL ${option.level}  ·  ${valueLabel}`, W / 2, ys[index] + 61);
      ctx.font = "bold 13px Verdana";
      const cost = upgradeCost(option.level);
      ctx.fillStyle = option.level >= 10 ? "#75806d" : (coins >= cost ? "#5b7d3c" : "#a34433");
      ctx.fillText(option.level >= 10 ? "MAX LEVEL" : `UPGRADE: ${cost} COINS`, W / 2, ys[index] + 88);
    });
    ctx.fillStyle = "#e5efd8"; ctx.font = "14px Verdana";
    ctx.fillText("Defeat bugs to earn coins · Max all upgrades: 1,410 coins", W / 2, 466);
    roundRect(390, 510, 180, 52, 12, "#dff1bf", "#fff4c2");
    ctx.fillStyle = "#34472d"; ctx.font = "bold 15px Verdana";
    ctx.fillText("RETURN", W / 2, 542);
    ctx.textAlign = "left";
  }

  function applySelectedUpgrade(optionIndex) {
    const option = upgradeOptions()[optionIndex];
    if (!option || option.level >= 10) return;
    const cost = upgradeCost(option.level);
    if (coins < cost) return;
    coins -= cost;
    upgrades[option.key] += 1;
    for (const worker of workers) {
      if (worker.role === "digger") worker.speed = 125 + upgrades.blueSpeed * 20;
      else worker.speed = 125 + upgrades.redSpeed * 20;
    }
    saveGame();
  }

  function handleUpgradeScreenClick(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / (canvas.clientWidth || W);
    const scaleY = H / (canvas.clientHeight || H);
    const x = (event.clientX - rect.left - canvas.clientLeft) * scaleX;
    const y = (event.clientY - rect.top - canvas.clientTop) * scaleY;
    if (y >= 24 && y <= 84) {
      if (x >= 30 && x < 300) upgradeTab = "you";
      else if (x >= 345 && x < 615) upgradeTab = "red";
      else if (x >= 660 && x < 930) upgradeTab = "blue";
      saveGame();
    } else if (x >= 390 && x <= 570 && y >= 510 && y <= 562) {
      closeUpgradeScreen();
    } else if (x >= 250 && x <= 710 && y >= 158 && y <= 270) {
      applySelectedUpgrade(0);
    } else if (x >= 250 && x <= 710 && y >= 300 && y <= 412) {
      applySelectedUpgrade(1);
    }
  }

  function closeUpgradeScreen() {
    upgradeScreenOpen = false;
    upgradeScreenDismissed = true;
    player.x = UPGRADE_ROOM_X - 120;
    player.y = UPGRADE_ROOM_Y;
    keys.clear();
    saveGame();
  }

  function saveGame() {
    const save = {
      version: 1,
      player: { x: player.x, y: player.y, facing: player.facing },
      intro, lineIndex, displayed,
      promptRemaining: Number.isFinite(promptAt) ? Math.max(0, promptAt - now) : null,
      dirtStock, dirtStage, nextDirtBoxDelay,
      inventory: inventory.map(item => item.type),
      dirtMineTimer, surfaceDirtPixels, surfaceDirtExpiresAt, coins,
      queenFoodValue, queenFoodShown, zeroMealDisplay, nurseryOpen, blueNurseryOpen,
      upgradeRoomOpen, upgradeScreenOpen, upgradeScreenDismissed, upgradeTab, upgrades,
      extraRooms, colony, cameraX, cameraY, queenHealth: queen.health,
      nurserySlots: NURSERY_SLOTS.map(slot => slot.timer),
      blueNurserySlots: BLUE_NURSERY_SLOTS.map(slot => slot.timer),
      enemies, droppedFood, droppedCoins, eggs, workers,
      enemySpawnRemaining: Math.max(0, 10500 - (now - lastEnemy))
    };
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (_) {
      // Private browsing or storage limits should never prevent the game from running.
    }
  }

  function loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const save = JSON.parse(raw);
      if (!save || save.version !== 1) return;

      const number = (value, fallback, min, max) => Number.isFinite(value) ? clamp(value, min, max) : fallback;
      const savedPlayer = save.player || {};
      player.x = number(savedPlayer.x, player.x, 0, W + 3000);
      player.y = number(savedPlayer.y, player.y, 72, 1090);
      player.facing = savedPlayer.facing < 0 ? -1 : 1;

      if (["none", "approach", "dialogue", "playing"].includes(save.intro)) intro = save.intro;
      lineIndex = Number.isInteger(save.lineIndex) ? clamp(save.lineIndex, 0, lines.length - 1) : 0;
      displayed = typeof save.displayed === "string" ? Array.from(save.displayed).slice(0, Array.from(lines[lineIndex]).length).join("") : "";
      typeAt = now - Array.from(displayed).length * 34;
      promptAt = intro === "dialogue" && Number.isFinite(save.promptRemaining)
        ? now + Math.max(0, save.promptRemaining)
        : Infinity;

      dirtStage = [1, 2, 3, 4].includes(save.dirtStage) ? save.dirtStage : 1;
      const dirtMaximum = dirtStage === 1 ? 30 : (dirtStage === 2 ? 45 : (dirtStage === 3 ? 60 : 0));
      dirtStock = number(save.dirtStock, dirtMaximum, 0, dirtMaximum);
      nextDirtBoxDelay = number(save.nextDirtBoxDelay, 0, 0, .45);
      nurseryOpen = Boolean(save.nurseryOpen) || dirtStage >= 2 || dirtStock === 0;
      blueNurseryOpen = Boolean(save.blueNurseryOpen) || dirtStage >= 3 || (dirtStage === 2 && dirtStock === 0);
      upgradeRoomOpen = Boolean(save.upgradeRoomOpen) || dirtStage === 4;
      if (dirtStage === 3 && dirtStock === 0) {
        dirtStage = 4;
        upgradeRoomOpen = true;
      }
      upgradeScreenOpen = Boolean(save.upgradeScreenOpen) && upgradeRoomOpen;
      upgradeScreenDismissed = Boolean(save.upgradeScreenDismissed);
      upgradeTab = ["you", "red", "blue"].includes(save.upgradeTab) ? save.upgradeTab : "you";
      for (const key of Object.keys(upgrades)) upgrades[key] = number(save.upgrades && save.upgrades[key], 0, 0, 10);
      inventory.splice(0, inventory.length, ...(Array.isArray(save.inventory)
        ? save.inventory.filter(type => ["dirt", "food", "meat", "egg"].includes(type)).slice(0, playerCarryCapacity()).map(type => ({ type }))
        : []));
      dirtMineTimer = number(save.dirtMineTimer, 0, 0, 1 / 3);
      coins = Math.floor(number(save.coins, 0, 0, Number.MAX_SAFE_INTEGER));
      surfaceDirtPixels = number(save.surfaceDirtPixels, 0, 0, 100000);
      surfaceDirtExpiresAt = number(save.surfaceDirtExpiresAt, surfaceDirtPixels > 0 ? Date.now() + 5 * 60 * 1000 : 0, 0, Number.MAX_SAFE_INTEGER);
      if (surfaceDirtPixels > 0 && surfaceDirtExpiresAt <= Date.now()) {
        surfaceDirtPixels = 0;
        surfaceDirtExpiresAt = 0;
      }
      queenFoodValue = number(save.queenFoodValue, 5, 0, 5);
      queenFoodShown = Boolean(save.queenFoodShown);
      zeroMealDisplay = number(save.zeroMealDisplay, 0, 0, 1.2);
      extraRooms = number(save.extraRooms, 0, 0, 5);
      colony = number(save.colony, 1, 1, 100000);
      cameraX = number(save.cameraX, 0, 0, Math.max(0, worldWidth() - W));
      cameraY = number(save.cameraY, 0, 0, 1120 - H);
      queen.health = number(save.queenHealth, 5, 1, 5);

      NURSERY_SLOTS.forEach((slot, index) => {
        const timer = Array.isArray(save.nurserySlots) ? save.nurserySlots[index] : null;
        slot.timer = Number.isFinite(timer) ? clamp(timer, 0, 120) : null;
      });
      BLUE_NURSERY_SLOTS.forEach((slot, index) => {
        const timer = Array.isArray(save.blueNurserySlots) ? save.blueNurserySlots[index] : null;
        slot.timer = Number.isFinite(timer) ? clamp(timer, 0, 120) : null;
      });

      enemies.length = 0;
      for (const enemy of Array.isArray(save.enemies) ? save.enemies.slice(0, 2) : []) {
        if (!Number.isFinite(enemy.x)) continue;
        const side = enemy.side === "right" ? "right" : "left";
        const minX = side === "left" ? 70 : SHAFT_RIGHT + 25;
        const maxX = side === "left" ? SHAFT_LEFT - 25 : 890;
      enemies.push({
          x: clamp(enemy.x, minX, maxX), y: 98, side, minX, maxX,
          dir: enemy.dir < 0 ? -1 : 1,
          speed: number(enemy.speed, 34, 20, 80),
          health: number(enemy.health, 2, 1, 2),
          maxHealth: 2
        });
      }
      droppedFood.length = 0;
      for (const item of Array.isArray(save.droppedFood) ? save.droppedFood.slice(0, 100) : []) {
        if (Number.isFinite(item.x) && Number.isFinite(item.y) && ["food", "meat"].includes(item.type)) {
          droppedFood.push({ x: item.x, y: item.y, type: item.type });
        }
      }
      droppedCoins.length = 0;
      for (const coin of Array.isArray(save.droppedCoins) ? save.droppedCoins.slice(0, 100) : []) {
        if (Number.isFinite(coin.x) && Number.isFinite(coin.y) && Number.isFinite(coin.amount)) {
          droppedCoins.push({
            x: coin.x, y: coin.y,
            amount: number(coin.amount, 15, 1, 1000)
          });
        }
      }
      eggs.length = 0;
      for (const egg of Array.isArray(save.eggs) ? save.eggs.slice(0, 100) : []) {
        if (Number.isFinite(egg.x) && Number.isFinite(egg.y)) eggs.push({ x: egg.x, y: egg.y });
      }
      workers.length = 0;
      for (const worker of Array.isArray(save.workers) ? save.workers.slice(0, 100) : []) {
        if (!Number.isFinite(worker.x) || !Number.isFinite(worker.y)) continue;
        const state = ["toShaft", "climbing", "surface", "toDirt", "mining", "toSurface", "waiting"].includes(worker.state) ? worker.state : "surface";
        workers.push({
          x: worker.x, y: worker.y, state,
          role: worker.role === "digger" ? "digger" : "hunter",
          dir: worker.dir < 0 ? -1 : 1,
          speed: number(worker.speed, 125, 20, 200),
          carrying: number(worker.carrying, 0, 0, worker.role === "digger" ? blueCarryCapacity() : 1),
          mineTimer: number(worker.mineTimer, 0, 0, 1 / 3),
          attackTimer: number(worker.attackTimer, 0, 0, .6),
          mineOffset: number(worker.mineOffset, [-20, -10, 0, 10, 20][workers.length % 5], -20, 20),
          blueDirtRoute: ["alignShaft", "alignY", "toDoor", "inside"].includes(worker.blueDirtRoute) ? worker.blueDirtRoute : null,
          blueReturnRoute: ["doorway", "shaft"].includes(worker.blueReturnRoute) ? worker.blueReturnRoute : null
        });
      }

      const spawnRemaining = number(save.enemySpawnRemaining, 10500, 0, 10500);
      lastEnemy = now - (10500 - spawnRemaining);
      lastFrame = now;
      lastSavedAt = now;
    } catch (_) {
      // Ignore invalid or unavailable saves and start a fresh game instead.
    }
  }

  function frame(timestamp) {
    now = timestamp;
    const dt = Math.min((timestamp - lastFrame) / 1000, .04);
    lastFrame = timestamp;
    update(dt); render();
    if (now - lastSavedAt >= 1000) {
      saveGame();
      lastSavedAt = now;
    }
    requestAnimationFrame(frame);
  }

  const codeMap = {
    KeyW: "up", ArrowUp: "up", KeyA: "left", ArrowLeft: "left",
    KeyS: "down", ArrowDown: "down", KeyD: "right", ArrowRight: "right",
    Space: "attack", KeyE: "feed", Enter: "a"
  };
  window.addEventListener("keydown", event => {
    if (upgradeScreenOpen) {
      event.preventDefault();
      if (event.code === "Escape") closeUpgradeScreen();
      return;
    }
    if (event.code === "KeyA" && intro === "dialogue") {
      event.preventDefault(); advanceDialogue(); return;
    }
    const control = codeMap[event.code];
    if (!control) return;
    event.preventDefault();
    if (control === "attack") attack();
    else if (control === "feed") interact();
    else if (control === "a") advanceDialogue();
    else keys.add(control);
  });
  window.addEventListener("keyup", event => {
    const control = codeMap[event.code];
    if (control) keys.delete(control);
  });
  window.addEventListener("blur", () => keys.clear());

  document.querySelectorAll("[data-control]").forEach(button => {
    const control = button.dataset.control;
    const down = event => {
      event.preventDefault(); button.classList.add("is-down");
      if (control === "a") advanceDialogue();
      else if (control === "attack") attack();
      else if (control === "feed") interact();
      else touch.add(control);
      if (button.setPointerCapture && event.pointerId !== undefined) button.setPointerCapture(event.pointerId);
    };
    const up = event => { event.preventDefault(); button.classList.remove("is-down"); touch.delete(control); };
    button.addEventListener("pointerdown", down);
    button.addEventListener("pointerup", up);
    button.addEventListener("pointercancel", up);
    button.addEventListener("lostpointercapture", up);
  });
  canvas.addEventListener("pointerdown", () => canvas.focus());
  canvas.addEventListener("click", event => {
    if (upgradeScreenOpen) handleUpgradeScreenClick(event);
    else if (intro === "dialogue") advanceDialogue();
  });
  loadGame();
  window.addEventListener("pagehide", saveGame);
  window.addEventListener("beforeunload", saveGame);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveGame();
  });
  requestAnimationFrame(frame);
})();
