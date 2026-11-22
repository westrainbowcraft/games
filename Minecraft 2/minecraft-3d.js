(() => {
  const SAVE_KEY_3D = "minecraft2-3d-world-v1";
  const SIZE = 40;
  const MAX_Y = 20;
  const CHUNK = 8;
  const REACH = 8;
  const BLOCK_TYPES = new Set(["grass", "dirt", "stone", "wood", "leaves", "planks", "crafting_table", "water"]);

  window.startMinecraft3D = function startMinecraft3D() {
    if (!window.THREE) return false;

    const THREE = window.THREE;
    const canvas = document.getElementById("world3d");
    const instructions = document.getElementById("instructions");
    const blocks = new Map();
    const chunkMeshes = new Map();
    const animals3D = [];
    const droppedItems = [];
    let pendingDrops = [];
    const vector = new THREE.Vector3();
    let renderer;
    let scene;
    let camera;
    let atlas;
    let blockMaterial;
    let animalGeometries;
    let player = { x: 20.5, y: 10, z: 20.5, vy: 0, grounded: false };
    let yaw = Math.PI / 2;
    let pitch = 0;
    let mineTarget = null;
    let mineActive = false;
    let currentTarget = null;
    let targetOutline = null;
    let touchLook = null;
    let lastSave = 0;
    let lastTargetCheck = 0;
    let lastFrame = performance.now();

    const blockKey = (x, y, z) => `${x},${y},${z}`;
    const blockAt = (x, y, z) => blocks.get(blockKey(x, y, z)) || null;
    const setBlock = (x, y, z, type) => {
      const key = blockKey(x, y, z);
      if (type) blocks.set(key, type);
      else blocks.delete(key);
    };

    function terrainHeight(x, z) {
      return 7 + Math.floor(Math.sin(x * .22) * 1.15 + Math.cos(z * .19) * .95 + Math.sin((x + z) * .12) * .6);
    }

    function generateWorld() {
      for (let x = 0; x < SIZE; x++) {
        for (let z = 0; z < SIZE; z++) {
          const surface = terrainHeight(x, z);
          for (let y = 0; y <= surface; y++) {
            const type = y === surface ? "grass" : (y >= surface - 4 ? "dirt" : "stone");
            setBlock(x, y, z, type);
          }
        }
      }

      // A shallow lake basin on the west side, with its water below the grassy banks.
      for (let x = 3; x <= 10; x++) {
        for (let z = 13; z <= 23; z++) {
          for (let y = 6; y <= MAX_Y; y++) setBlock(x, y, z, null);
          setBlock(x, 3, z, "dirt");
          setBlock(x, 4, z, "water");
          setBlock(x, 5, z, "water");
        }
      }

      for (const [x, z] of [[13, 10], [17, 29], [25, 11], [29, 27], [35, 17]]) {
        const ground = terrainHeight(x, z);
        for (let h = 1; h <= 4; h++) setBlock(x, ground + h, z, "wood");
        for (let y = ground + 3; y <= ground + 6; y++) {
          const radius = y === ground + 6 ? 1 : 2;
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              if (Math.abs(dx) === radius && Math.abs(dz) === radius && y !== ground + 4) continue;
              if (!blockAt(x + dx, y, z + dz)) setBlock(x + dx, y, z + dz, "leaves");
            }
          }
        }
      }
    }

    function loadWorld() {
      try {
        const saved = JSON.parse(localStorage.getItem(SAVE_KEY_3D) || "null");
        if (!saved || !Array.isArray(saved.blocks)) return false;
        for (const entry of saved.blocks) {
          if (!Array.isArray(entry) || entry.length !== 4) continue;
          const [x, y, z, type] = entry;
          if (Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z) &&
              x >= 0 && x < SIZE && z >= 0 && z < SIZE && y >= 0 && y <= MAX_Y && BLOCK_TYPES.has(type)) {
            setBlock(x, y, z, type);
          }
        }
        pendingDrops = Array.isArray(saved.drops)
          ? saved.drops.filter(drop => itemTypes.includes(drop.type) && [drop.x, drop.y, drop.z].every(Number.isFinite)).slice(0, 200)
          : [];
        if (saved.player && [saved.player.x, saved.player.y, saved.player.z].every(Number.isFinite)) {
          player.x = saved.player.x;
          player.y = saved.player.y;
          player.z = saved.player.z;
          yaw = Number.isFinite(saved.yaw) ? saved.yaw : yaw;
          pitch = Number.isFinite(saved.pitch) ? saved.pitch : pitch;
        }
        return true;
      } catch (error) {
        console.warn("Could not load the 3D world save.", error);
        return false;
      }
    }

    function saveWorld() {
      try {
        localStorage.setItem(SAVE_KEY_3D, JSON.stringify({
          blocks: Array.from(blocks, ([key, type]) => [...key.split(",").map(Number), type]),
          drops: droppedItems.map(drop => ({ type: drop.type, x: drop.x, y: drop.baseY, z: drop.z, phase: drop.phase })),
          player: { x: player.x, y: player.y, z: player.z }, yaw, pitch
        }));
        saveGame();
      } catch (error) {
        console.warn("Could not save the 3D world.", error);
      }
    }

    function createAtlas() {
      const size = 64;
      const tile = 16;
      const atlasCanvas = document.createElement("canvas");
      atlasCanvas.width = atlasCanvas.height = size;
      const context = atlasCanvas.getContext("2d", { alpha: false });
      const colors = [
        ["#4e923d", "#71b950", "#367936"], // grass top
        ["#538d3d", "#83562f", "#a1703d"], // grass side
        ["#87552c", "#a66f3b", "#684021"], // dirt
        ["#777d81", "#969b9e", "#5c6267"], // stone
        ["#80512d", "#a87542", "#5b3922"], // log
        ["#347a35", "#58a147", "#235b32"], // leaves
        ["#b8894e", "#d3a969", "#8c6037"], // planks
        ["#c3975b", "#e0bd7f", "#744727"], // table top
        ["#80512d", "#a87542", "#51331f"], // table side
        ["#3398cc", "#74c8e8", "#2075a8"]  // water
      ];
      for (let id = 0; id < colors.length; id++) {
        const ox = (id % 4) * tile;
        const oy = Math.floor(id / 4) * tile;
        const palette = colors[id];
        context.fillStyle = palette[0];
        context.fillRect(ox, oy, tile, tile);
        for (let py = 0; py < tile; py++) {
          for (let px = 0; px < tile; px++) {
            const hash = Math.sin((px + 1) * 12.9898 + (py + 7) * 78.233 + (id + 3) * 37.719) * 43758.5453;
            const noise = hash - Math.floor(hash);
            let color = noise > .86 ? palette[1] : (noise < .08 ? palette[2] : palette[0]);
            if (id === 1 && py < 4) color = noise > .8 ? "#79b94c" : "#4e923d";
            if (id === 6 && py % 5 === 0) color = palette[2];
            if ((id === 7 || id === 8) && (px % 7 === 0 || py % 7 === 0)) color = palette[2];
            if (id === 4 && px % 6 === 0) color = palette[2];
            if (id === 9 && py % 7 < 2 && noise > .3) color = palette[1];
            context.fillStyle = color;
            context.fillRect(ox + px, oy + py, 1, 1);
          }
        }
        if (id === 0) {
          context.fillStyle = "#85ca5b";
          for (let i = 0; i < 5; i++) context.fillRect(ox + (i * 7 + 2) % 15, oy + (i * 11 + 1) % 15, 2, 1);
        }
      }
      const texture = new THREE.CanvasTexture(atlasCanvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      if ("colorSpace" in texture) texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    const faceDefinitions = [
      { d: [0, 0, 1], n: [0, 0, 1], v: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], shade: .82 },
      { d: [0, 0, -1], n: [0, 0, -1], v: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], shade: .68 },
      { d: [1, 0, 0], n: [1, 0, 0], v: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], shade: .76 },
      { d: [-1, 0, 0], n: [-1, 0, 0], v: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], shade: .62 },
      { d: [0, 1, 0], n: [0, 1, 0], v: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], shade: 1 },
      { d: [0, -1, 0], n: [0, -1, 0], v: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], shade: .5 }
    ];

    function textureId(type, face) {
      if (type === "grass") return face === 4 ? 0 : 1;
      if (type === "dirt") return 2;
      if (type === "stone") return 3;
      if (type === "wood") return 4;
      if (type === "leaves") return 5;
      if (type === "planks") return 6;
      if (type === "crafting_table") return face === 4 ? 7 : 8;
      return 9;
    }

    function addFace(data, x, y, z, face, type, faceIndex) {
      const texture = textureId(type, faceIndex);
      const column = texture % 4;
      const row = Math.floor(texture / 4);
      const inset = .001;
      const u0 = column / 4 + inset;
      const u1 = (column + 1) / 4 - inset;
      const v0 = 1 - (row + 1) / 4 + inset;
      const v1 = 1 - row / 4 - inset;
      const uvs = [[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
      const indices = [0, 1, 2, 0, 2, 3];
      for (const index of indices) {
        const vertex = face.v[index];
        data.positions.push(x + vertex[0], y + vertex[1], z + vertex[2]);
        data.normals.push(...face.n);
        data.uvs.push(...uvs[index]);
        data.colors.push(face.shade, face.shade, face.shade);
      }
    }

    function rebuildChunk(cx, cz) {
      const key = `${cx},${cz}`;
      const previous = chunkMeshes.get(key);
      if (previous) {
        scene.remove(previous);
        previous.geometry.dispose();
        chunkMeshes.delete(key);
      }
      const data = { positions: [], normals: [], uvs: [], colors: [] };
      const minX = cx * CHUNK;
      const minZ = cz * CHUNK;
      for (let x = minX; x < Math.min(minX + CHUNK, SIZE); x++) {
        for (let z = minZ; z < Math.min(minZ + CHUNK, SIZE); z++) {
          for (let y = 0; y <= MAX_Y; y++) {
            const type = blockAt(x, y, z);
            if (!type) continue;
            for (let fi = 0; fi < faceDefinitions.length; fi++) {
              const face = faceDefinitions[fi];
              const neighbor = blockAt(x + face.d[0], y + face.d[1], z + face.d[2]);
              if (neighbor && !(type === "water" && neighbor !== "water") && !(neighbor === "water" && type !== "water")) continue;
              addFace(data, x, y, z, face, type, fi);
            }
          }
        }
      }
      if (!data.positions.length) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, blockMaterial);
      mesh.frustumCulled = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      scene.add(mesh);
      chunkMeshes.set(key, mesh);
    }

    function rebuildNear(x, z) {
      const cx = Math.floor(x / CHUNK);
      const cz = Math.floor(z / CHUNK);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const nx = cx + dx;
          const nz = cz + dz;
          if (nx >= 0 && nz >= 0 && nx * CHUNK < SIZE && nz * CHUNK < SIZE) rebuildChunk(nx, nz);
        }
      }
    }

    function isSolid(x, y, z) {
      const type = blockAt(Math.floor(x), Math.floor(y), Math.floor(z));
      return Boolean(type && type !== "water");
    }

    function playerInWater() {
      return blockAt(Math.floor(player.x), Math.floor(player.y - .05), Math.floor(player.z)) === "water" ||
        blockAt(Math.floor(player.x), Math.floor(player.y + .25), Math.floor(player.z)) === "water" ||
        blockAt(Math.floor(player.x), Math.floor(player.y + .55), Math.floor(player.z)) === "water" ||
        blockAt(Math.floor(player.x), Math.floor(player.y + 1.35), Math.floor(player.z)) === "water";
    }

    function waterSurfaceAt(x, z) {
      const bx = Math.floor(x);
      const bz = Math.floor(z);
      for (let y = MAX_Y; y >= 0; y--) {
        if (blockAt(bx, y, bz) === "water" && blockAt(bx, y + 1, bz) !== "water") return y + 1;
      }
      return null;
    }

    function collides(x, feetY, z) {
      const radius = .28;
      for (let bx = Math.floor(x - radius); bx <= Math.floor(x + radius); bx++) {
        for (let bz = Math.floor(z - radius); bz <= Math.floor(z + radius); bz++) {
          for (const by of [Math.floor(feetY + .06), Math.floor(feetY + .95), Math.floor(feetY + 1.72)]) {
            if (isSolid(bx + .5, by + .5, bz + .5)) return true;
          }
        }
      }
      return false;
    }

    function groundHeight(x, z) {
      for (let y = MAX_Y; y >= 0; y--) {
        if (blockAt(Math.floor(x), y, Math.floor(z)) && blockAt(Math.floor(x), y, Math.floor(z)) !== "water") return y + 1;
      }
      return 1;
    }

    function grassGroundHeight(x, z) {
      const bx = Math.floor(x);
      const bz = Math.floor(z);
      for (let y = MAX_Y - 2; y >= 0; y--) {
        if (blockAt(bx, y, bz) === "grass" && !blockAt(bx, y + 1, bz) && !blockAt(bx, y + 2, bz)) return y + 1;
      }
      return null;
    }

    function makeAtlasMaterial() {
      atlas = createAtlas();
      blockMaterial = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, side: THREE.FrontSide });
    }

    function addAnimalPart(group, geometry, material, x, y, z, sx, sy, sz) {
      const part = new THREE.Mesh(geometry, material);
      part.position.set(x, y, z);
      part.scale.set(sx, sy, sz);
      group.add(part);
      return part;
    }

    function createAnimal(type, x, z) {
      const group = new THREE.Group();
      const mats = {
        pig: ["#e88fa0", "#f4acb5", "#bc687a"],
        cow: ["#f2eee3", "#55463d", "#e9c9a2"],
        sheep: ["#eee9d9", "#d6bd9e", "#766858"],
        chicken: ["#f5f2e8", "#d84838", "#f2b52c"]
      }[type];
      const main = new THREE.MeshLambertMaterial({ color: mats[0] });
      const detail = new THREE.MeshLambertMaterial({ color: mats[1] });
      const dark = new THREE.MeshLambertMaterial({ color: mats[2] });
      const eye = new THREE.MeshLambertMaterial({ color: "#29221e" });
      if (type === "chicken") {
        addAnimalPart(group, animalGeometries.body, main, 0, .48, 0, .48, .55, .42);
        addAnimalPart(group, animalGeometries.body, main, .14, .88, -.02, .34, .36, .34);
        addAnimalPart(group, animalGeometries.body, detail, .2, 1.13, -.02, .12, .18, .14);
        addAnimalPart(group, animalGeometries.body, dark, .35, .83, -.02, .22, .12, .15);
        addAnimalPart(group, animalGeometries.body, eye, .27, .95, -.2, .06, .07, .05);
      } else {
        const width = type === "cow" ? .95 : .82;
        addAnimalPart(group, animalGeometries.body, main, 0, .62, 0, width, .62, .56);
        addAnimalPart(group, animalGeometries.body, type === "cow" ? detail : main, .39, .78, -.01, .38, .46, .42);
        if (type === "cow") {
          addAnimalPart(group, animalGeometries.body, detail, -.24, .77, -.285, .22, .2, .035);
          addAnimalPart(group, animalGeometries.body, detail, -.38, .5, -.29, .18, .16, .035);
        }
        if (type === "sheep") {
          for (let i = 0; i < 5; i++) addAnimalPart(group, animalGeometries.body, main, -.28 + i * .14, .96, -.12, .12, .14, .14);
        }
        addAnimalPart(group, animalGeometries.body, dark, .56, .66, -.01, .18, .16, .2);
        addAnimalPart(group, animalGeometries.body, eye, .52, .88, -.23, .055, .055, .04);
      }
      const legMaterial = type === "pig" ? dark : new THREE.MeshLambertMaterial({ color: type === "chicken" ? "#e5a92d" : "#51443d" });
      const legPositions = type === "chicken" ? [[-.12,0,-.13],[.15,0,-.13]] : [[-.28,0,-.18],[.22,0,-.18],[-.28,0,.18],[.22,0,.18]];
      const legs = [];
      for (const [lx, , lz] of legPositions) legs.push(addAnimalPart(group, animalGeometries.body, legMaterial, lx, .22, lz, .13, .42, .13));
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(type === "cow" ? .46 : .38, 12),
        new THREE.MeshBasicMaterial({ color: "#182018", transparent: true, opacity: .28, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = .015;
      group.add(shadow);
      scene.add(group);
      const animal = { type, group, x, z, y: grassGroundHeight(x, z), dir: Math.random() < .5 ? -1 : 1, timer: 1 + Math.random() * 4, health: type === "chicken" ? 1 : (type === "sheep" ? 2 : (type === "cow" ? 4 : 3)), legs };
      animals3D.push(animal);
      return animal;
    }

    function spawnDroppedItem(type, x, y, z, phase = Math.random() * Math.PI * 2) {
      const colors = {
        grass: "#68a847", dirt: "#986235", stone: "#858b8e", wood: "#956032", leaves: "#4d9441",
        planks: "#c49a5d", crafting_table: "#a67542", raw_meat: "#bd514b", feather: "#eee5ce", wool: "#eee9d9"
      };
      const geometry = new THREE.BoxGeometry(type === "feather" ? .13 : .3, type === "raw_meat" ? .22 : (type === "feather" ? .42 : .3), type === "feather" ? .06 : .3);
      const material = new THREE.MeshLambertMaterial({ color: colors[type] || "#ba8b52" });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.rotation.set(.35, phase, .45);
      mesh.userData.dropType = type;
      scene.add(mesh);
      const drop = { type, x, z, baseY: y, phase, mesh };
      droppedItems.push(drop);
      return drop;
    }

    function restoreDroppedItems() {
      for (const drop of pendingDrops) spawnDroppedItem(drop.type, drop.x, drop.y, drop.z, Number.isFinite(drop.phase) ? drop.phase : 0);
      pendingDrops = [];
    }

    function updateDroppedItems(dt, now) {
      for (let i = droppedItems.length - 1; i >= 0; i--) {
        const drop = droppedItems[i];
        drop.mesh.position.y = drop.baseY + Math.sin(now * .003 + drop.phase) * .1;
        drop.mesh.rotation.y += dt * .75;
        if (Math.hypot(player.x - drop.x, player.y + .7 - drop.baseY, player.z - drop.z) < 1.2 && addToInventory(drop.type)) {
          scene.remove(drop.mesh);
          drop.mesh.geometry.dispose();
          drop.mesh.material.dispose();
          droppedItems.splice(i, 1);
          saveWorld();
        }
      }
    }

    function canSpawnAnimal(x, z) {
      return grassGroundHeight(x, z) !== null;
    }

    function spawnAnimals() {
      const types = ["pig", "chicken", "cow", "sheep"];
      for (let i = 0; i < 14; i++) {
        for (let attempt = 0; attempt < 40; attempt++) {
          const x = 2 + Math.random() * (SIZE - 4);
          const z = 2 + Math.random() * (SIZE - 4);
          if (!canSpawnAnimal(x, z) || Math.hypot(x - player.x, z - player.z) < 5) continue;
          if (animals3D.some(animal => Math.hypot(x - animal.x, z - animal.z) < 2)) continue;
          createAnimal(types[Math.floor(Math.random() * types.length)], x, z);
          break;
        }
      }
    }

    function updateAnimals(dt, now) {
      for (let i = animals3D.length - 1; i >= 0; i--) {
        const animal = animals3D[i];
        if (grassGroundHeight(animal.x, animal.z) === null) {
          scene.remove(animal.group);
          animals3D.splice(i, 1);
          continue;
        }
        // Keep each animal anchored to its grassy spawn tile; animate only a tiny leg sway.
        animal.group.position.set(animal.x, animal.y, animal.z);
        const swing = Math.sin(now * .003 + i) * .025;
        animal.legs.forEach((leg, index) => { leg.rotation.x = index % 2 ? swing : -swing; });
      }
    }

    function rayTarget() {
      camera.getWorldDirection(vector);
      const direction = vector.clone().normalize();
      const origin = camera.position;
      let prev = null;
      for (let t = .12; t <= REACH; t += .035) {
        const px = origin.x + direction.x * t;
        const py = origin.y + direction.y * t;
        const pz = origin.z + direction.z * t;
        for (const animal of animals3D) {
          if (px >= animal.x - .55 && px <= animal.x + .7 && py >= animal.y && py <= animal.y + 1.35 && pz >= animal.z - .48 && pz <= animal.z + .48) {
            return { kind: "animal", animal, distance: t };
          }
        }
        const bx = Math.floor(px);
        const by = Math.floor(py);
        const bz = Math.floor(pz);
        const type = blockAt(bx, by, bz);
        if (type && type !== "water") {
          return { kind: "block", x: bx, y: by, z: bz, type, place: prev, distance: t };
        }
        if (bx >= 0 && bx < SIZE && by >= 0 && by <= MAX_Y && bz >= 0 && bz < SIZE) prev = { x: bx, y: by, z: bz };
      }
      return null;
    }

    function durationFor(type) {
      const times = { grass: .8, dirt: .7, stone: 3.8, wood: 2.2, leaves: .25, planks: 2, crafting_table: 2.2 };
      const tool = inventory[selected].type;
      const correct = (type === "stone" && tool === "wooden_pickaxe") ||
        (["wood", "planks", "crafting_table"].includes(type) && tool === "wooden_axe") ||
        (["grass", "dirt"].includes(type) && tool === "wooden_shovel") ||
        (type === "leaves" && tool === "wooden_sword");
      return (times[type] || 1) / (correct ? 4 : 1);
    }

    function attackAnimal(animal) {
      if (inventory[selected].type !== "wooden_sword" || !animals3D.includes(animal)) return;
      animal.health--;
      animal.group.traverse(object => {
        if (!object.material || !object.material.color) return;
        object.material.emissive = new THREE.Color("#aa2218");
        object.material.emissiveIntensity = .6;
      });
      setTimeout(() => animal.group.traverse(object => {
        if (object.material && object.material.emissive) object.material.emissiveIntensity = 0;
      }), 140);
      animal.dir += Math.PI;
      if (animal.health <= 0) {
        const drop = animal.type === "chicken" ? "feather" : (animal.type === "sheep" ? "wool" : "raw_meat");
        spawnDroppedItem(drop, animal.x, animal.y + .55, animal.z);
        scene.remove(animal.group);
        animals3D.splice(animals3D.indexOf(animal), 1);
        saveWorld();
      }
    }

    function startMining() {
      mineTarget = null;
      mineActive = false;
      updateMineMeter(0, "");
      const target = rayTarget();
      currentTarget = target;
      if (!target) return;
      if (target.kind === "animal") {
        if (inventory[selected].type === "wooden_sword") attackAnimal(target.animal);
        return;
      }
      mineTarget = { x: target.x, y: target.y, z: target.z, elapsed: 0 };
      mineActive = true;
    }

    function stopMining() {
      mineActive = false;
      mineTarget = null;
      updateMineMeter(0, "");
    }

    function updateMineMeter(progress, label) {
      const meter = document.getElementById("mining-meter");
      if (!meter) return;
      meter.classList.toggle("active", Boolean(label));
      document.getElementById("mining-label").textContent = label;
      document.getElementById("mining-fill").style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
    }

    function placeTargetBlock() {
      stopMining();
      const target = rayTarget();
      if (!target || target.kind !== "block" || !target.place) return;
      const { x, y, z } = target.place;
      const type = inventory[selected].type;
      if (!placeableBlocks.has(type) || inventory[selected].count <= 0 || blockAt(x, y, z)) return;
      if (player.x + .3 > x && player.x - .3 < x + 1 && player.y < y + 1 && player.y + 1.75 > y && player.z + .3 > z && player.z - .3 < z + 1) return;
      setBlock(x, y, z, type);
      inventory[selected].count--;
      if (inventory[selected].count <= 0) inventory[selected] = { type: null, count: 0 };
      rebuildNear(x, z);
      saveWorld();
    }

    function updateMining(dt) {
      if (!mineActive || !mineTarget) return;
      const { x, y, z } = mineTarget;
      const type = blockAt(x, y, z);
      if (!type || type === "water") { stopMining(); return; }
      if (Math.hypot(x + .5 - camera.position.x, y + .5 - camera.position.y, z + .5 - camera.position.z) > REACH + .5) { stopMining(); return; }
      mineTarget.elapsed += dt;
      const duration = durationFor(type);
      const progress = Math.min(1, mineTarget.elapsed / duration);
      updateMineMeter(progress, `Mining ${type.replaceAll("_", " ")} · ${Math.round(progress * 100)}%`);
      if (progress < 1) return;
      setBlock(x, y, z, null);
      spawnDroppedItem(type, x + .5, y + .65, z + .5);
      rebuildNear(x, z);
      saveWorld();
      stopMining();
    }

    function updateTargetOutline(now) {
      if (now - lastTargetCheck < .12) return;
      lastTargetCheck = now;
      currentTarget = rayTarget();
      const breakButton = document.getElementById("break-button");
      if (breakButton) breakButton.textContent = currentTarget && currentTarget.kind === "animal" && inventory[selected].type === "wooden_sword" ? "Attack" : "Break";
      if (!targetOutline) return;
      if (currentTarget && currentTarget.kind === "block") {
        targetOutline.visible = true;
        targetOutline.position.set(currentTarget.x + .5, currentTarget.y + .5, currentTarget.z + .5);
        targetOutline.material.color.set(mineTarget ? 0xffcc54 : 0x273039);
        targetOutline.material.opacity = mineTarget ? .95 : .55;
      } else targetOutline.visible = false;
    }

    function updatePlayer(dt) {
      const forwardX = -Math.sin(yaw);
      const forwardZ = -Math.cos(yaw);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);
      let dx = ((keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0)) * forwardX +
        ((keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0)) * rightX;
      let dz = ((keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0)) * forwardZ +
        ((keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0)) * rightZ;
      const length = Math.hypot(dx, dz);
      if (length > 0) { dx /= length; dz /= length; }
      const swimming = playerInWater();
      const speed = swimming ? 3.1 : (keys.has("ShiftLeft") ? 6 : 4.4);
      const nextX = player.x + dx * speed * dt;
      if (!collides(nextX, player.y, player.z)) player.x = nextX;
      const nextZ = player.z + dz * speed * dt;
      if (!collides(player.x, player.y, nextZ)) player.z = nextZ;
      player.x = THREE.MathUtils.clamp(player.x, .35, SIZE - .35);
      player.z = THREE.MathUtils.clamp(player.z, .35, SIZE - .35);

      if (swimming) {
        const surface = waterSurfaceAt(player.x, player.z);
        if (surface !== null) {
          const targetFeet = surface - 1.35;
          player.vy += ((targetFeet - player.y) * 9 - player.vy * 3.2) * dt;
          if (keys.has("Space")) player.vy += 11 * dt;
          if (keys.has("ShiftLeft")) player.vy -= 9 * dt;
          player.vy = THREE.MathUtils.clamp(player.vy, -3, 4);
        }
      } else {
        if (keys.has("Space") && player.grounded) {
          player.vy = 7.2;
          player.grounded = false;
        }
        player.vy -= 19 * dt;
      }
      const nextY = player.y + player.vy * dt;
      if (!collides(player.x, nextY, player.z)) {
        player.y = nextY;
        player.grounded = false;
      } else {
        if (player.vy < 0) player.grounded = true;
        player.vy = 0;
      }
      if (player.y < -5) {
        player.y = groundHeight(player.x, player.z);
        player.vy = 0;
      }
      camera.position.set(player.x, player.y + 1.62, player.z);
      camera.rotation.set(pitch, yaw, 0, "YXZ");
    }

    function resize() {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    function saveIfDue(now) {
      if (now - lastSave < 6000) return;
      lastSave = now;
      saveWorld();
    }

    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - lastFrame) / 1000);
      lastFrame = now;
      if (!inventoryOpen) {
        updatePlayer(dt);
        updateAnimals(dt, now);
        updateDroppedItems(dt, now);
        updateMining(dt);
        updateTargetOutline(now);
        saveIfDue(now);
      }
      updateMobileHotbar();
      renderer.render(scene, camera);
    }

    function initialize(loadedWorld) {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.setSize(canvas.clientWidth || 960, canvas.clientHeight || 600, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;
      scene = new THREE.Scene();
      scene.background = new THREE.Color("#91d7ff");
      scene.fog = new THREE.Fog("#91d7ff", 23, 58);
      camera = new THREE.PerspectiveCamera(72, canvas.clientWidth / canvas.clientHeight, .08, 70);
      camera.rotation.order = "YXZ";
      scene.add(new THREE.HemisphereLight(0xd7efff, 0x6e5940, 1.7));
      const sun = new THREE.DirectionalLight(0xfff1d4, 2.2);
      sun.position.set(-12, 25, 9);
      scene.add(sun);
      animalGeometries = { body: new THREE.BoxGeometry(1, 1, 1) };
      makeAtlasMaterial();

      if (!loadedWorld) {
        player.x = 20.5;
        player.z = 20.5;
        player.y = groundHeight(player.x, player.z) + .02;
      } else {
        player.x = THREE.MathUtils.clamp(player.x, .35, SIZE - .35);
        player.z = THREE.MathUtils.clamp(player.z, .35, SIZE - .35);
        if (collides(player.x, player.y, player.z)) player.y = groundHeight(player.x, player.z) + .02;
      }
      camera.position.set(player.x, player.y + 1.62, player.z);
      camera.rotation.set(pitch, yaw, 0, "YXZ");
      for (let cx = 0; cx < Math.ceil(SIZE / CHUNK); cx++) {
        for (let cz = 0; cz < Math.ceil(SIZE / CHUNK); cz++) rebuildChunk(cx, cz);
      }
      restoreDroppedItems();
      const outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.015, 1.015, 1.015));
      const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x273039, transparent: true, opacity: .55, depthTest: true });
      targetOutline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
      targetOutline.visible = false;
      scene.add(targetOutline);
      spawnAnimals();

      threeDMode = true;
      document.body.classList.add("three-d");
      instructions.textContent = "3D Minecraft 2 · WASD move · Space jump · Shift dive/sprint · Click to lock mouse/look · Hold left click to mine · Right click to place · E inventory · Matching tools mine faster\nPhone: use the pad, drag the view to look, hold Break to mine, Place to build, Bag for inventory";
      canvas.addEventListener("contextmenu", event => event.preventDefault());
      canvas.addEventListener("click", () => {
        if (!inventoryOpen && window.matchMedia("(pointer: fine)").matches && canvas.requestPointerLock && document.pointerLockElement !== canvas) canvas.requestPointerLock();
      });
      canvas.addEventListener("pointerdown", event => {
        if (inventoryOpen) return;
        if (event.pointerType === "touch") {
          touchLook = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
          canvas.setPointerCapture(event.pointerId);
          event.preventDefault();
          return;
        }
        if (event.button === 2) placeTargetBlock();
        else if (event.button === 0) {
          const target = rayTarget();
          if (target && target.kind === "animal" && inventory[selected].type === "wooden_sword") {
            stopMining();
            attackAnimal(target.animal);
          }
          else startMining();
        }
      });
      canvas.addEventListener("pointermove", event => {
        if (touchLook && touchLook.id === event.pointerId) {
          const dx = event.clientX - touchLook.x;
          const dy = event.clientY - touchLook.y;
          if (Math.abs(dx) + Math.abs(dy) > 2) touchLook.moved = true;
          yaw -= dx * .006;
          pitch = THREE.MathUtils.clamp(pitch - dy * .006, -1.42, 1.42);
          touchLook.x = event.clientX;
          touchLook.y = event.clientY;
        }
      });
      const releaseLook = event => {
        if (touchLook && touchLook.id === event.pointerId) {
          if (!touchLook.moved) {
            currentTarget = rayTarget();
            if (currentTarget && currentTarget.kind === "animal" && inventory[selected].type === "wooden_sword") {
              attackAnimal(currentTarget.animal);
            }
          }
          touchLook = null;
        }
      };
      canvas.addEventListener("pointerup", releaseLook);
      canvas.addEventListener("pointercancel", releaseLook);
      canvas.addEventListener("pointerup", stopMining);
      canvas.addEventListener("pointercancel", stopMining);
      window.addEventListener("pointerup", stopMining);
      window.stopMinecraft3DMining = stopMining;
      document.addEventListener("pointerlockchange", () => {
        canvas.style.cursor = document.pointerLockElement === canvas ? "none" : "crosshair";
      });
      document.addEventListener("mousemove", event => {
        if (document.pointerLockElement !== canvas) return;
        yaw -= event.movementX * .0022;
        pitch = THREE.MathUtils.clamp(pitch - event.movementY * .0022, -1.48, 1.48);
      });
      window.addEventListener("keydown", event => {
        if (event.code === "Space" && !inventoryOpen) event.preventDefault();
      });
      window.addEventListener("keyup", event => { if (event.code === "Space") player.vy = Math.max(player.vy, 0); });

      const breakButton = document.getElementById("break-button");
      breakButton.addEventListener("pointerdown", event => {
        if (!threeDMode) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const target = rayTarget();
        if (target && target.kind === "animal" && inventory[selected].type === "wooden_sword") {
          stopMining();
          attackAnimal(target.animal);
        }
        else startMining();
        mineActive = Boolean(mineTarget);
        breakButton.setPointerCapture(event.pointerId);
      }, true);
      const releaseBreak = event => {
        if (!threeDMode) return;
        event.stopImmediatePropagation();
        stopMining();
      };
      const cancelBreak = event => {
        if (!threeDMode) return;
        event.stopImmediatePropagation();
        stopMining();
      };
      breakButton.addEventListener("pointerup", releaseBreak, true);
      breakButton.addEventListener("pointercancel", cancelBreak, true);
      const placeButton = document.getElementById("place-button");
      placeButton.addEventListener("pointerdown", event => {
        if (!threeDMode) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        placeTargetBlock();
      }, true);
      placeButton.addEventListener("click", event => {
        if (!threeDMode) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);
      const jumpButton = document.getElementById("jump-button");
      jumpButton.addEventListener("pointerdown", event => {
        if (!threeDMode) return;
        event.preventDefault();
        keys.add("Space");
        jumpButton.setPointerCapture(event.pointerId);
      }, true);
      const stopJump = event => { if (threeDMode) keys.delete("Space"); };
      jumpButton.addEventListener("pointerup", stopJump, true);
      jumpButton.addEventListener("pointercancel", stopJump, true);
      window.addEventListener("resize", resize);
      window.addEventListener("pagehide", saveWorld);
      window.addEventListener("beforeunload", saveWorld);
      resize();
      updateMobileHotbar();
      requestAnimationFrame(frame);
    }

    try {
      if (renderer) return true;
      const loadedWorld = loadWorld();
      if (!loadedWorld) generateWorld();
      initialize(loadedWorld);
      return true;
    } catch (error) {
      console.error("3D mode could not start; using the 2D fallback.", error);
      if (renderer) renderer.dispose();
      document.body.classList.remove("three-d");
      return false;
    }
  };
})();
