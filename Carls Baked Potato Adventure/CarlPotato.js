// Made by West and David on 8/2/2025
// Web version

const WIDTH = 800;
const HEIGHT = 600;
const FPS = 60;

const canvas = document.getElementById("game");
const screen = canvas.getContext("2d");

const keys = {
  left: false,
  right: false,
  space: false,
};

const images = {
  carl: new Image(),
  potatoBag: new Image(),
  bakedPotato: new Image(),
  poisonousPotato: new Image(),
  store: new Image(),
  sun: new Image(),
};

let carl = { x: 0, y: 0, width: 0, height: 0 };
let potatoBag = { x: 0, y: 0, width: 0, height: 0 };
let sun = { x: 20, y: 20, width: 0, height: 0 };
let house = { x: 20, y: 20, width: 0, height: 0 };
const ground = { x: 0, y: HEIGHT - 60, width: WIDTH, height: 60 };

let storePanel = { x: 0, y: 0, width: 200, height: 0 };
let speedButton = { x: 0, y: 0, width: 0, height: 50 };
let extraPotatoButton = { x: 0, y: 0, width: 0, height: 50 };
let groundButton = { x: 0, y: 0, width: 0, height: 50 };

const bakedSpeed = 5;
let desiredPotatoCount = 1;
let potatoes = [];

let score = 0;
let carlSpeed = 5.0;
let paused = false;
let storeOpen = false;
let groundUnlocked = false;

function randint(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function colliderect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function mousePos(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) * WIDTH) / bounds.width,
    y: ((event.clientY - bounds.top) * HEIGHT) / bounds.height,
  };
}

function spawnBakedPotato(width, height) {
  return {
    x: randint(0, WIDTH - width),
    y: -height,
    width,
    height,
  };
}

function createPotatoState() {
  const width = images.bakedPotato.naturalWidth;
  const height = images.bakedPotato.naturalHeight;
  return {
    rect: spawnBakedPotato(width, height),
    landed: false,
    poisonous: false,
    landTime: 0,
  };
}

function resetPotatoState(potato) {
  Object.assign(potato, createPotatoState());
}

function layoutStoreUi() {
  storePanel.x = house.x;
  storePanel.y = house.y + house.height + 10;
  storePanel.height = Math.max(0, HEIGHT - (house.y + house.height + 30));

  speedButton.x = storePanel.x + 20;
  speedButton.y = storePanel.y + 20;
  speedButton.width = storePanel.width - 40;

  extraPotatoButton.x = storePanel.x + 20;
  extraPotatoButton.y = speedButton.y + speedButton.height + 20;
  extraPotatoButton.width = storePanel.width - 40;

  groundButton.x = storePanel.x + 20;
  groundButton.y = extraPotatoButton.y + extraPotatoButton.height + 20;
  groundButton.width = storePanel.width - 40;
}

function drawRectSprite(rect, image) {
  screen.drawImage(image, rect.x, rect.y, rect.width, rect.height);
}

function drawStoreUi() {
  screen.fillStyle = "#ffff00";
  screen.fillRect(storePanel.x, storePanel.y, storePanel.width, storePanel.height);

  screen.fillStyle = "#ffd700";
  screen.fillRect(speedButton.x, speedButton.y, speedButton.width, speedButton.height);
  screen.strokeStyle = "#000000";
  screen.lineWidth = 2;
  screen.strokeRect(speedButton.x, speedButton.y, speedButton.width, speedButton.height);
  screen.fillStyle = "#000000";
  screen.font = "32px Verdana, sans-serif";
  screen.textAlign = "center";
  screen.textBaseline = "middle";
  screen.fillText(
    "Faster Carl (1)",
    speedButton.x + speedButton.width / 2,
    speedButton.y + speedButton.height / 2
  );

  screen.fillStyle = "#add8e6";
  screen.fillRect(
    extraPotatoButton.x,
    extraPotatoButton.y,
    extraPotatoButton.width,
    extraPotatoButton.height
  );
  screen.strokeRect(
    extraPotatoButton.x,
    extraPotatoButton.y,
    extraPotatoButton.width,
    extraPotatoButton.height
  );
  screen.fillStyle = "#000000";
  screen.fillText(
    "+1 Potato (5)",
    extraPotatoButton.x + extraPotatoButton.width / 2,
    extraPotatoButton.y + extraPotatoButton.height / 2
  );

  if (!groundUnlocked) {
    screen.fillStyle = "#22b14c";
    screen.fillRect(
      groundButton.x,
      groundButton.y,
      groundButton.width,
      groundButton.height
    );
    screen.strokeStyle = "#006400";
    screen.strokeRect(
      groundButton.x,
      groundButton.y,
      groundButton.width,
      groundButton.height
    );
    screen.fillStyle = "#000000";
    screen.fillText(
      "Build Ground (2)",
      groundButton.x + groundButton.width / 2,
      groundButton.y + groundButton.height / 2
    );
  }
}

function drawScore() {
  screen.font = "48px Verdana, sans-serif";
  screen.textAlign = "right";
  screen.textBaseline = "middle";
  screen.fillStyle = "#000000";
  screen.fillText(String(score), potatoBag.x - 10, potatoBag.y + potatoBag.height / 2);
}

function drawScene() {
  screen.fillStyle = "#87ceeb";
  screen.fillRect(0, 0, WIDTH, HEIGHT);

  if (groundUnlocked) {
    screen.fillStyle = "#228b22";
    screen.fillRect(ground.x, ground.y, ground.width, ground.height);
  }

  drawRectSprite(sun, images.sun);
  drawRectSprite(carl, images.carl);
  drawRectSprite(potatoBag, images.potatoBag);

  for (const potato of potatoes) {
    drawRectSprite(
      potato.rect,
      potato.poisonous ? images.poisonousPotato : images.bakedPotato
    );
  }

  drawRectSprite(house, images.store);

  if (storeOpen) {
    drawStoreUi();
  }

  drawScore();
}

function updatePotatoes(currentTime) {
  while (potatoes.length < desiredPotatoCount) {
    potatoes.push(createPotatoState());
  }

  for (const potato of potatoes) {
    const rect = potato.rect;

    if (!potato.landed) {
      rect.y += bakedSpeed;
    }

    if (groundUnlocked && !potato.landed && rect.y + rect.height >= ground.y) {
      rect.y = ground.y - rect.height;
      potato.landed = true;
      potato.poisonous = false;
      potato.landTime = currentTime;
      rect.x = Math.max(
        ground.x,
        Math.min(rect.x, ground.x + ground.width - rect.width)
      );
    }

    if (rect.y > HEIGHT) {
      resetPotatoState(potato);
      continue;
    }

    if (
      groundUnlocked &&
      potato.landed &&
      !potato.poisonous &&
      currentTime - potato.landTime >= 5000
    ) {
      potato.poisonous = true;
    }

    if (colliderect(carl, rect)) {
      if (potato.poisonous) {
        score = Math.max(0, score - 1);
      } else {
        score += 1;
      }
      resetPotatoState(potato);
    }
  }
}

function update() {
  while (potatoes.length < desiredPotatoCount) {
    potatoes.push(createPotatoState());
  }

  if (paused) {
    return;
  }

  if (keys.left) {
    carl.x -= carlSpeed;
  }
  if (keys.right) {
    carl.x += carlSpeed;
  }

  carl.x = Math.max(carl.x, 0);
  carl.x = Math.min(carl.x, WIDTH - carl.width);

  updatePotatoes(performance.now());
}

function draw() {
  drawScene();
}

function gameLoop() {
  update();
  draw();
}

function buySpeedUpgrade() {
  if (score >= 1) {
    score -= 1;
    carlSpeed *= 1.05;
  }
}

function buyExtraPotatoUpgrade() {
  if (score >= 5) {
    score -= 5;
    desiredPotatoCount += 1;
  }
}

function buyGroundUpgrade() {
  if (score >= 2 && !groundUnlocked) {
    score -= 2;
    groundUnlocked = true;
    carl.y = ground.y - carl.height;
    for (const potato of potatoes) {
      potato.landed = false;
      potato.poisonous = false;
      potato.landTime = 0;
    }
  }
}

function onMouseDown(event) {
  const pos = mousePos(event);

  if (pointInRect(pos, house)) {
    storeOpen = !storeOpen;
    return;
  }

  if (!storeOpen) {
    return;
  }

  if (pointInRect(pos, speedButton)) {
    buySpeedUpgrade();
  } else if (pointInRect(pos, extraPotatoButton)) {
    buyExtraPotatoUpgrade();
  } else if (!groundUnlocked && pointInRect(pos, groundButton)) {
    buyGroundUpgrade();
  }
}

function onKey(event, isDown) {
  if (event.code === "ArrowLeft") {
    keys.left = isDown;
  }
  if (event.code === "ArrowRight") {
    keys.right = isDown;
  }
  if (event.code === "Space") {
    if (isDown && !keys.space) {
      paused = !paused;
    }
    keys.space = isDown;
  }

  if (event.code.startsWith("Arrow") || event.code === "Space") {
    event.preventDefault();
  }
}

window.addEventListener("keydown", (event) => onKey(event, true));
window.addEventListener("keyup", (event) => onKey(event, false));
canvas.addEventListener("mousedown", onMouseDown);

function start() {
  carl.width = images.carl.naturalWidth;
  carl.height = images.carl.naturalHeight;
  carl.x = WIDTH / 2 - carl.width / 2;
  carl.y = HEIGHT - 20 - carl.height;

  potatoBag.width = images.potatoBag.naturalWidth;
  potatoBag.height = images.potatoBag.naturalHeight;
  potatoBag.x = WIDTH - 20 - potatoBag.width;
  potatoBag.y = 20;

  sun.width = images.sun.naturalWidth;
  sun.height = images.sun.naturalHeight;

  house.width = images.store.naturalWidth;
  house.height = images.store.naturalHeight;

  layoutStoreUi();
  potatoes = [createPotatoState()];

  canvas.focus();
  canvas.addEventListener("click", () => canvas.focus());
  window.setInterval(gameLoop, 1000 / FPS);
}

let imagesReady = 0;
const imageCount = Object.keys(images).length;

function onImageLoad() {
  imagesReady += 1;
  if (imagesReady === imageCount) {
    start();
  }
}

for (const image of Object.values(images)) {
  image.onload = onImageLoad;
}

images.carl.src = "images/carl.png";
images.potatoBag.src = "images/SmallBagOfPotatoes.png";
images.bakedPotato.src = "images/BakedPotato.png";
images.poisonousPotato.src = "images/PoisonousPotato.png";
images.store.src = "images/store.png";
images.sun.src = "images/sunSmall.png";
