// Made by West and David on April 9th 2025
// Web version

const WIDTH = 1000;
const HEIGHT = 1000;
const SAVE_KEY = "number-meyhem-save";

const Numberrect = {
  x: WIDTH / 3,
  y: HEIGHT / 3,
  width: WIDTH / 3,
  height: HEIGHT / 3,
};

const Upgraderect = {
  x: 350,
  y: 930,
  width: 300,
  height: 70,
};

const defaultData = {
  Money: 100,
  clickmoney: 1,
  UpgradeMoney: 5,
};

let data = loadSave();

const canvas = document.getElementById("game");
const screen = canvas.getContext("2d");

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return { ...defaultData };
    }
    const saved = JSON.parse(raw);
    return {
      Money: Number(saved.Money) || defaultData.Money,
      clickmoney: Number(saved.clickmoney) || defaultData.clickmoney,
      UpgradeMoney: Number(saved.UpgradeMoney) || defaultData.UpgradeMoney,
    };
  } catch (error) {
    return { ...defaultData };
  }
}

function saveGame() {
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function pointInRect(pos, rect) {
  return (
    pos.x >= rect.x &&
    pos.x <= rect.x + rect.width &&
    pos.y >= rect.y &&
    pos.y <= rect.y + rect.height
  );
}

function mousePos(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) * WIDTH) / bounds.width,
    y: ((event.clientY - bounds.top) * HEIGHT) / bounds.height,
  };
}

function draw() {
  screen.fillStyle = "#000000";
  screen.fillRect(0, 0, WIDTH, HEIGHT);

  screen.fillStyle = "red";
  screen.font = "200px Helvetica, Arial, sans-serif";
  screen.textAlign = "center";
  screen.textBaseline = "middle";
  screen.fillText(String(data.clickmoney), WIDTH / 2, HEIGHT / 2);

  const moneyLabel = "$" + String(data.Money);
  screen.font = "50px Helvetica, Arial, sans-serif";
  screen.textAlign = "left";
  screen.textBaseline = "top";
  const moneyWidth = screen.measureText(moneyLabel).width;
  screen.fillStyle = "white";
  screen.fillRect(0, 0, moneyWidth + 24, 70);
  screen.fillStyle = "black";
  screen.fillText(moneyLabel, 10, 10);

  screen.fillStyle = "white";
  screen.fillRect(Upgraderect.x, Upgraderect.y, Upgraderect.width, Upgraderect.height);
  screen.fillStyle = "black";
  screen.font = "50px Helvetica, Arial, sans-serif";
  screen.textAlign = "center";
  screen.textBaseline = "middle";
  screen.fillText("Upgrade=$" + String(data.UpgradeMoney), WIDTH / 2, HEIGHT - 50);
}

function onMouseDown(event) {
  const pos = mousePos(event);

  if (pointInRect(pos, Numberrect)) {
    data.Money = data.Money + data.clickmoney;
  }

  if (pointInRect(pos, Upgraderect)) {
    if (data.Money > data.UpgradeMoney) {
      data.clickmoney = data.clickmoney + 1;
      data.Money = data.Money - data.UpgradeMoney;
      data.UpgradeMoney = data.UpgradeMoney + 5;
    }
  }

  saveGame();
  draw();
}

function onMouseMove(event) {
  const pos = mousePos(event);
  if (pointInRect(pos, Numberrect) || pointInRect(pos, Upgraderect)) {
    canvas.style.cursor = "pointer";
  } else {
    canvas.style.cursor = "default";
  }
}

canvas.addEventListener("mousedown", onMouseDown);
canvas.addEventListener("mousemove", onMouseMove);
draw();
