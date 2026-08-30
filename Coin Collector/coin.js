// Written by West and David on December 24th 2023
// Web version

// To Hack
// 1. Spacebar pause
// 2. Red coin negative points
// 3. Trees to hide coin
// 4. Fox looks where they are going
// 5. Jumping fox
// 6. Different character
// 7. Coin randomly moves
// 8.

const WIDTH = 400;
const HEIGHT = 400;
const FPS = 60;

let score = 0;
const game_time = 60.0; // seconds
let time_left = game_time - 1;
let game_over = false;
let gameTimer = null;

const canvas = document.getElementById("game");
const screen = canvas.getContext("2d");

const keys = {
  left: false,
  right: false,
  up: false,
  down: false,
  space: false,
};

const fox = {
  image: new Image(),
  x: 200,
  y: 100,
  width: 0,
  height: 0,
};

const coin = {
  image: new Image(),
  x: 200,
  y: 400,
  width: 0,
  height: 0,
};

function actorLeft(actor) {
  return actor.x - actor.width / 2;
}

function actorTop(actor) {
  return actor.y - actor.height / 2;
}

function colliderect(a, b) {
  return (
    actorLeft(a) < actorLeft(b) + b.width &&
    actorLeft(a) + a.width > actorLeft(b) &&
    actorTop(a) < actorTop(b) + b.height &&
    actorTop(a) + a.height > actorTop(b)
  );
}

function drawActor(actor) {
  screen.drawImage(actor.image, actorLeft(actor), actorTop(actor));
}

function draw() {
  screen.fillStyle = "green";
  screen.fillRect(0, 0, WIDTH, HEIGHT);

  drawActor(fox);
  drawActor(coin);

  screen.fillStyle = "black";
  screen.font = "16px Verdana, sans-serif";
  screen.textAlign = "left";
  screen.textBaseline = "top";
  screen.fillText("Score: " + score + " Time Left: " + String(Math.trunc(time_left)), 10, 10);

  if (game_over) {
    screen.fillStyle = "pink";
    screen.fillRect(0, 0, WIDTH, HEIGHT);
    screen.fillStyle = "black";
    screen.font = "36px Verdana, sans-serif";
    screen.fillText("Final Score: " + score, 10, 10);
    screen.font = "16px Verdana, sans-serif";
    screen.fillText("Press Space to play again", 10, 60);
  }
}

function place_coin() {
  coin.x = randint(20, WIDTH - 20);
  coin.y = randint(20, HEIGHT - 20);
}

function randint(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function time_up() {
  game_over = true;
}

function start_timer() {
  if (gameTimer !== null) {
    window.clearTimeout(gameTimer);
  }
  gameTimer = window.setTimeout(time_up, game_time * 1000);
}

function reset_game() {
  score = 0;
  time_left = game_time - 1;
  game_over = false;
  fox.x = 200;
  fox.y = 100;
  place_coin();
  start_timer();
}

function update() {
  if (game_over) {
    if (keys.space) {
      keys.space = false;
      reset_game();
    }
    return;
  }

  time_left = time_left - 1 / FPS;

  if (keys.left) {
    fox.x = fox.x - 4;
  } else if (keys.right) {
    fox.x = fox.x + 4;
  } else if (keys.up) {
    fox.y = fox.y - 4;
  } else if (keys.down) {
    fox.y = fox.y + 4;
  }

  const coin_collected = colliderect(fox, coin);

  if (coin_collected) {
    score = score + 10;
    place_coin();
  }
}

function onKey(event, isDown) {
  if (event.code === "ArrowLeft") keys.left = isDown;
  if (event.code === "ArrowRight") keys.right = isDown;
  if (event.code === "ArrowUp") keys.up = isDown;
  if (event.code === "ArrowDown") keys.down = isDown;
  if (event.code === "Space") keys.space = isDown;

  if (event.code.startsWith("Arrow") || event.code === "Space") {
    event.preventDefault();
  }
}

window.addEventListener("keydown", (event) => onKey(event, true));
window.addEventListener("keyup", (event) => onKey(event, false));

function gameLoop() {
  update();
  draw();
}

function start() {
  fox.width = fox.image.naturalWidth;
  fox.height = fox.image.naturalHeight;
  coin.width = coin.image.naturalWidth;
  coin.height = coin.image.naturalHeight;

  canvas.focus();
  canvas.addEventListener("click", () => canvas.focus());
  place_coin();
  start_timer();
  window.setInterval(gameLoop, 1000 / FPS);
}

let imagesReady = 0;
function onImageLoad() {
  imagesReady += 1;
  if (imagesReady === 2) {
    start();
  }
}

fox.image.onload = onImageLoad;
coin.image.onload = onImageLoad;
fox.image.src = "images/fox.png";
coin.image.src = "images/coin.png";
