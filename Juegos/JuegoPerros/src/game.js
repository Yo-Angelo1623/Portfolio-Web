import * as THREE from 'three';

const TOOL_LABELS = {
  food: 'Comida',
  water: 'Agua',
  bottle: 'Botella',
  branch: 'Rama',
  stone: 'Piedra invisible',
};

const CONTACT_DAMAGE = 6;
const CONTACT_DAMAGE_COOLDOWN = 1.4;
const PLAYER_BASE_HEIGHT = 1.7;
const MAX_STAMINA = 100;
const MAP_BOUNDS = { minX: -58, maxX: 58, minZ: -88, maxZ: 88 };
const GRAPPLE_TRIGGER_DISTANCE = 1.45;
const GRAPPLE_SEQUENCE_PRESSES = 5;
const GRAPPLE_SEQUENCE_WINDOW = 1000;
const GRAPPLE_PLAYER_COST = 6;
const DOG_NAV_SPACING = 3;
const DOG_SPHERE = new THREE.SphereGeometry(1, 12, 8);
const DOG_EAR = new THREE.ConeGeometry(0.14, 0.42, 7);
const DOG_STATE_COLORS = {
  alert: new THREE.Color('#b56c37'),
  territorial: new THREE.Color('#7b2d2d'),
  chase: new THREE.Color('#a04435'),
  attack: new THREE.Color('#c43e35'),
  exhausted: new THREE.Color('#6c7774'),
};

export class Game {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f4b76a');
    this.scene.fog = new THREE.Fog('#f4b76a', 100, 230);

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 320);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.keys = {};
    this.pointerLocked = false;
    this.started = false;
    this.menuOpen = true;
    this.ended = false;
    this.fogEnabled = true;

    this.player = {
      position: new THREE.Vector3(0, PLAYER_BASE_HEIGHT, 80),
      velocity: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      speed: 4.8,
      gaitPhase: 0,
      sprinting: false,
      sprintExhausted: false,
      health: 100,
      maxHealth: 100,
      stamina: MAX_STAMINA,
      perch: null,
      perchTransition: null,
      grappledBy: null,
      grapple: null,
      escapeCooldown: 0,
    };

    this.selectedTool = 'food';
    this.projectiles = [];
    this.throwCooldown = 0;
    this.foodTrail = null;
    this.invisibleStoneCooldown = 0;
    this.stonePulse = null;
    this.environmentEffects = [];
    this.impactVisuals = [];
    this.obstacles = [];
    this.perches = [];
    this.pickups = [];
    this.pickupMessage = '';
    this.pickupMessageTimer = 0;
    this.routeWaypoints = [
      { position: new THREE.Vector3(0, 0, 34), label: 'Cruza la avenida' },
      { position: new THREE.Vector3(40, 0, -28), label: 'Rodea la manzana' },
      { position: new THREE.Vector3(0, 0, -82), label: 'Punto de encuentro' },
    ];
    this.routeIndex = 0;
    this.routeComplete = false;
    this.routeMarkers = [];
    this.contactCooldown = 0;
    this.inventory = {
      food: 5,
      water: 3,
      bottle: 3,
      branch: 2,
      stone: Infinity,
    };

    this.buildEnvironment();
    this.createStreetDetails();
    this.createPickups();
    this.buildNavigationGrid();
    this.createDogs();
    this.bindUI();
    this.bindEvents();
    this.updateHealthUI();
    this.updateStaminaUI();
    this.updateToolUI();
    this.updateCamera();
    this.animate();
  }

  buildEnvironment() {
    this.scene.add(new THREE.HemisphereLight('#ffe1ae', '#4a2a1c', 1.2));

    const sun = new THREE.DirectionalLight('#ffb55a', 1.55);
    sun.position.set(-25, 55, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(768, 768);
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 95;
    sun.shadow.camera.bottom = -95;
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 180),
      new THREE.MeshStandardMaterial({ color: '#7f6b55', roughness: 0.98, metalness: 0.05 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const road = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.08, 180),
      new THREE.MeshStandardMaterial({ color: '#2b2725', roughness: 0.98, metalness: 0.08 })
    );
    road.position.set(0, 0.04, 0);
    road.receiveShadow = true;
    this.scene.add(road);

    const sidewalkLeft = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.2, 180),
      new THREE.MeshStandardMaterial({ color: '#9a8f7d', roughness: 0.9 })
    );
    sidewalkLeft.position.set(-7.2, 0.1, 0);
    sidewalkLeft.receiveShadow = true;
    this.scene.add(sidewalkLeft);

    const sidewalkRight = sidewalkLeft.clone();
    sidewalkRight.position.x = 7.2;
    this.scene.add(sidewalkRight);

    const crossingRoad = new THREE.Mesh(
      new THREE.BoxGeometry(120, 0.08, 10),
      new THREE.MeshStandardMaterial({ color: '#302c2a', roughness: 0.98 })
    );
    const crosswalk = new THREE.Mesh(
      new THREE.BoxGeometry(120, 0.18, 2.5),
      new THREE.MeshStandardMaterial({ color: '#958b7e', roughness: 0.9 })
    );
    [-32, 32].forEach((z) => {
      const roadSection = crossingRoad.clone();
      roadSection.position.set(0, 0.04, z);
      this.scene.add(roadSection);
      [-1, 1].forEach((side) => {
        const sidewalkSection = crosswalk.clone();
        sidewalkSection.position.set(0, 0.12, z + side * 6.25);
        this.scene.add(sidewalkSection);
      });
    });

    const buildingMaterial = new THREE.MeshStandardMaterial({
      color: '#c98d59',
      roughness: 0.96,
      metalness: 0.04,
    });

    const buildings = [];
    [-62, 0, 62].forEach((blockZ, row) => {
      [-1, 1].forEach((side, column) => {
        const centerX = side * 31;
        const centerZ = blockZ;
        buildings.push(
          { x: centerX, z: centerZ - 10, w: 10 + row % 2 * 2, h: 7 + column * 2, d: 12 },
          { x: side * 46, z: centerZ + 10, w: 9, h: 8 + row, d: 11 },
          { x: side * 22, z: centerZ + 12, w: 8, h: 6 + column * 2, d: 8 },
        );
      });
    });

    buildings.forEach((box) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(box.w, box.h, box.d), buildingMaterial);
      mesh.position.set(box.x, box.h / 2, box.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.obstacles.push({
        minX: box.x - box.w / 2,
        maxX: box.x + box.w / 2,
        minZ: box.z - box.d / 2,
        maxZ: box.z + box.d / 2,
        minY: 0,
        maxY: box.h,
      });
    });

    this.routeMarkers = this.routeWaypoints.map((waypoint) => {
      const marker = new THREE.Group();
      marker.position.copy(waypoint.position);
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.28, 3.2, 12),
        new THREE.MeshBasicMaterial({ color: '#8df59b', transparent: true, opacity: 0.52 })
      );
      beacon.position.y = 1.6;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.05, 0.08, 8, 28),
        new THREE.MeshBasicMaterial({ color: '#b7ff9b' })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.12;
      marker.add(beacon, ring);
      marker.userData.beaconMaterial = beacon.material;
      marker.userData.ringMaterial = ring.material;
      this.scene.add(marker);
      return marker;
    });
    this.updateRouteMarkers();

    this.city = { buildings };
  }

  createStreetDetails() {
    const poleMaterial = new THREE.MeshStandardMaterial({ color: '#383335', roughness: 0.82 });
    const lampMaterial = new THREE.MeshStandardMaterial({
      color: '#f4c477',
      emissive: '#e58d3f',
      emissiveIntensity: 0.8,
      roughness: 0.45,
    });
    const benchMaterial = new THREE.MeshStandardMaterial({ color: '#745038', roughness: 0.9 });
    const metalMaterial = new THREE.MeshStandardMaterial({ color: '#3d4140', roughness: 0.75 });
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#59402f', roughness: 1 });
    const foliageMaterial = new THREE.MeshStandardMaterial({ color: '#596344', roughness: 1 });
    const bagMaterial = new THREE.MeshStandardMaterial({ color: '#343535', roughness: 1 });
    const carColors = ['#56616a', '#8a4e3d', '#616c50'];

    for (const x of [-8, 8]) {
      for (const z of [-80, -58, -18, 18, 58, 80]) {
        const lamp = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.8, 7), poleMaterial);
        pole.position.y = 2.4;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.09, 0.09), poleMaterial);
        arm.position.set(x < 0 ? 0.32 : -0.32, 4.72, 0);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), lampMaterial);
        bulb.position.set(x < 0 ? 0.62 : -0.62, 4.62, 0);
        lamp.add(pole, arm, bulb);
        lamp.position.set(x, 0, z);
        this.scene.add(lamp);
        this.obstacles.push({
          minX: x - 0.18,
          maxX: x + 0.18,
          minZ: z - 0.18,
          maxZ: z + 0.18,
          minY: 0,
          maxY: 4.8,
        });
      }
    }

    const addBench = (x, z) => {
      const bench = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.55), benchMaterial);
      seat.position.y = 1.32;
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 0.12), benchMaterial);
      back.position.set(0, 1.68, -0.22);
      const legs = [-0.72, 0.72].map((legX) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.28, 0.42), metalMaterial);
        leg.position.set(legX, 0.64, 0);
        return leg;
      });
      bench.add(seat, back, ...legs);
      bench.position.set(x, 0, z);
      this.scene.add(bench);
      this.obstacles.push({
        minX: x - 1.02,
        maxX: x + 1.02,
        minZ: z - 0.34,
        maxZ: z + 0.34,
        minY: 0,
        maxY: 1.4,
      });
      this.perches.push({
        name: 'Banco',
        x,
        z,
        height: 1.4,
        approachX: x + (x < 0 ? -1.35 : 1.35),
        approachZ: z,
      });
    };

    addBench(-10, -60);
    addBench(10, 0);
    addBench(-10, 60);

    const addTree = (x, z) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 3.1, 7), trunkMaterial);
      trunk.position.y = 1.55;
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1.7, 9, 7), foliageMaterial);
      crown.position.y = 3.65;
      crown.scale.set(1, 1.05, 0.95);
      tree.add(trunk, crown);
      tree.position.set(x, 0, z);
      this.scene.add(tree);
      this.obstacles.push({
        minX: x - 0.5,
        maxX: x + 0.5,
        minZ: z - 0.5,
        maxZ: z + 0.5,
        minY: 0,
        maxY: 3.1,
      });
      this.perches.push({
        name: 'Árbol',
        x,
        z,
        height: 2.5,
        approachX: x + (x < 0 ? -1.45 : 1.45),
        approachZ: z,
      });
    };

    addTree(10, -60);
    addTree(-10, 0);
    addTree(10, 60);

    const addCar = (x, z, color) => {
      const car = new THREE.Group();
      const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.18 });
      const windowMaterial = new THREE.MeshStandardMaterial({ color: '#303c42', roughness: 0.35, metalness: 0.12 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.72, 4.2), bodyMaterial);
      body.position.y = 0.72;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.78, 2.15), windowMaterial);
      cabin.position.set(0, 1.4, -0.1);
      const wheels = [];
      for (const wheelX of [-1.04, 1.04]) {
        for (const wheelZ of [-1.28, 1.28]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.18, 8), poleMaterial);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wheelX, 0.42, wheelZ);
          wheels.push(wheel);
        }
      }
      car.add(body, cabin, ...wheels);
      car.position.set(x, 0, z);
      this.scene.add(car);
      this.obstacles.push({
        minX: x - 1.18,
        maxX: x + 1.18,
        minZ: z - 2.25,
        maxZ: z + 2.25,
        minY: 0,
        maxY: 1.9,
      });
    };

    addCar(-13, -78, carColors[0]);
    addCar(13, -18, carColors[1]);
    addCar(-13, 45, carColors[2]);

    for (const [x, z] of [[9.5, -48], [-9.5, -12], [9.5, 12], [-9.5, 48], [9.5, 76]]) {
      const bag = new THREE.Mesh(new THREE.SphereGeometry(0.52, 8, 6), bagMaterial);
      bag.scale.set(0.85, 0.7, 0.8);
      bag.position.set(x, 0.38, z);
      bag.castShadow = false;
      this.scene.add(bag);
      this.obstacles.push({
        minX: x - 0.45,
        maxX: x + 0.45,
        minZ: z - 0.42,
        maxZ: z + 0.42,
        minY: 0,
        maxY: 0.76,
      });
    }
  }

  createPickups() {
    const bottleMaterial = new THREE.MeshStandardMaterial({
      color: '#79c9e6',
      emissive: '#23546a',
      emissiveIntensity: 0.2,
      roughness: 0.28,
      metalness: 0.08,
    });
    const capMaterial = new THREE.MeshStandardMaterial({ color: '#e7d8a1', roughness: 0.7 });
    const branchMaterial = new THREE.MeshStandardMaterial({ color: '#795238', roughness: 1 });
    const bottleBody = new THREE.CylinderGeometry(0.12, 0.16, 0.5, 7);
    const bottleNeck = new THREE.CylinderGeometry(0.07, 0.1, 0.14, 7);
    const capGeometry = new THREE.CylinderGeometry(0.075, 0.075, 0.07, 7);
    const branchGeometry = new THREE.CylinderGeometry(0.035, 0.06, 0.78, 5);
    const placements = [
      { type: 'bottle', x: -4.5, z: 58 },
      { type: 'branch', x: 4.5, z: 40 },
      { type: 'bottle', x: -4.5, z: 4 },
      { type: 'branch', x: 4.5, z: -22 },
      { type: 'bottle', x: -4.5, z: -58 },
      { type: 'branch', x: 4.5, z: -80 },
    ];

    this.pickups = placements.map(({ type, x, z }) => {
      const item = new THREE.Group();
      if (type === 'bottle') {
        const body = new THREE.Mesh(bottleBody, bottleMaterial);
        const neck = new THREE.Mesh(bottleNeck, bottleMaterial);
        const cap = new THREE.Mesh(capGeometry, capMaterial);
        body.position.y = 0.25;
        neck.position.y = 0.56;
        cap.position.y = 0.66;
        item.add(body, neck, cap);
      } else {
        const branch = new THREE.Mesh(branchGeometry, branchMaterial);
        branch.rotation.z = Math.PI / 2;
        branch.position.y = 0.08;
        item.add(branch);
      }
      item.position.set(x, 0, z);
      this.scene.add(item);
      return { type, x, z, mesh: item, active: true, offset: Math.random() * Math.PI * 2 };
    });
  }

  createDogs() {
    this.dogs = [
      this.makeDog({ x: -14, z: 72, color: '#765039', scale: 1, breed: 'Pastor alemán' }),
      this.makeDog({ x: 14, z: 48, color: '#a6683d', scale: 0.86, breed: 'Terrier' }),
      this.makeDog({ x: -14, z: 8, color: '#9b8068', scale: 1.12, breed: 'Mastín' }),
      this.makeDog({ x: 14, z: -12, color: '#a77c50', scale: 0.94, breed: 'Labrador' }),
      this.makeDog({ x: -14, z: -52, color: '#bdb6ad', scale: 0.98, breed: 'Husky' }),
      this.makeDog({ x: 14, z: -76, color: '#9e6d55', scale: 0.88, breed: 'Bulldog' }),
    ];

    this.dogs.forEach((dog) => this.scene.add(dog));
  }

  makeDog({ x, z, color, scale = 1, breed = 'Perro' }) {
    const dog = new THREE.Group();
    dog.position.set(x, 0, z);
    dog.scale.setScalar(scale);

    const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0.08 });
    const headMaterial = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0.08 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: '#382b26', roughness: 1 });
    const lightMaterial = new THREE.MeshStandardMaterial({ color: '#d8c5a9', roughness: 1 });
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: '#171311' });
    const legMaterial = new THREE.MeshStandardMaterial({ color: '#49362b', roughness: 1 });
    const legs = [];
    const headParts = [];
    const parts = {
      body: (position, size, material = bodyMaterial, rotation = 0) => (
        this.addDogPart(dog, position, size, material, rotation)
      ),
      head: (position, size, material = headMaterial, rotation = 0) => {
        const head = this.addDogPart(dog, position, size, material, rotation);
        headParts.push(head);
        return head;
      },
      accent: (position, size, material = darkMaterial, rotation = 0) => (
        this.addDogPart(dog, position, size, material, rotation)
      ),
      leg: (position, size) => {
        const limb = new THREE.Group();
        limb.position.set(position[0], position[1] + size[1] * 0.42, position[2]);
        limb.userData.baseY = limb.position.y;
        const upper = this.addDogPart(
          limb,
          [0, -size[1] * 0.42, 0],
          [size[0], size[1], size[2]],
          legMaterial
        );
        const paw = this.addDogPart(
          limb,
          [0, -size[1] * 0.88, 0.045],
          [size[0] * 0.92, size[1] * 0.26, size[2] * 1.15],
          darkMaterial
        );
        paw.castShadow = false;
        dog.add(limb);
        legs.push(limb);
        return upper;
      },
      ear: (x, y, z, size, rotation = 0) => {
        const ear = new THREE.Mesh(DOG_EAR, darkMaterial);
        ear.position.set(x, y, z);
        ear.scale.set(size, size, size);
        ear.rotation.z = rotation;
        ear.castShadow = false;
        dog.add(ear);
        return ear;
      },
    };

    let tail;
    if (breed === 'Pastor alemán') {
      parts.body([0, 0.58, -0.05], [0.55, 0.45, 0.92]);
      parts.body([0, 0.62, 0.48], [0.42, 0.48, 0.38], bodyMaterial, -0.12);
      parts.head([0, 0.98, 0.66], [0.37, 0.36, 0.42]);
      parts.head([0, 0.83, 0.99], [0.23, 0.19, 0.38], lightMaterial);
      parts.ear(-0.23, 1.3, 0.62, 0.78, -0.12);
      parts.ear(0.23, 1.3, 0.62, 0.78, 0.12);
      parts.accent([0, 0.54, -0.25], [0.51, 0.22, 0.38], darkMaterial, -0.18);
      tail = parts.body([0, 0.48, -0.91], [0.16, 0.16, 0.58], darkMaterial, -0.42);
      [[-0.35, 0.28, -0.55], [0.35, 0.28, -0.55], [-0.34, 0.28, 0.58], [0.34, 0.28, 0.58]]
        .forEach((position) => parts.leg(position, [0.16, 0.36, 0.19]));
    } else if (breed === 'Terrier') {
      parts.body([0, 0.49, 0], [0.58, 0.48, 0.72]);
      parts.head([0, 0.85, 0.55], [0.43, 0.4, 0.42]);
      parts.head([0, 0.71, 0.88], [0.25, 0.2, 0.34], lightMaterial);
      parts.ear(-0.34, 0.98, 0.48, 0.72, -0.72);
      parts.ear(0.34, 0.98, 0.48, 0.72, 0.72);
      parts.accent([0, 0.58, -0.62], [0.2, 0.2, 0.27], bodyMaterial, -0.7);
      tail = parts.body([0, 0.63, -0.55], [0.13, 0.13, 0.35], darkMaterial, 0.9);
      [[-0.37, 0.2, -0.42], [0.37, 0.2, -0.42], [-0.37, 0.2, 0.4], [0.37, 0.2, 0.4]]
        .forEach((position) => parts.leg(position, [0.15, 0.25, 0.16]));
    } else if (breed === 'Mastín') {
      parts.body([0, 0.63, -0.02], [0.75, 0.59, 0.86]);
      parts.body([0, 0.67, 0.48], [0.58, 0.56, 0.45]);
      parts.head([0, 1.02, 0.66], [0.52, 0.46, 0.44]);
      parts.head([0, 0.84, 1.02], [0.4, 0.29, 0.4], lightMaterial);
      parts.accent([0, 0.73, 1.25], [0.19, 0.12, 0.11], darkMaterial);
      parts.ear(-0.48, 1.05, 0.54, 0.58, -0.92);
      parts.ear(0.48, 1.05, 0.54, 0.58, 0.92);
      tail = parts.body([0, 0.55, -0.85], [0.2, 0.18, 0.42], darkMaterial, -0.28);
      [[-0.5, 0.31, -0.53], [0.5, 0.31, -0.53], [-0.5, 0.31, 0.57], [0.5, 0.31, 0.57]]
        .forEach((position) => parts.leg(position, [0.23, 0.38, 0.25]));
    } else if (breed === 'Labrador') {
      parts.body([0, 0.55, -0.02], [0.59, 0.49, 0.9]);
      parts.body([0, 0.58, 0.47], [0.44, 0.45, 0.4]);
      parts.head([0, 0.94, 0.7], [0.39, 0.36, 0.4]);
      parts.head([0, 0.79, 1.02], [0.27, 0.2, 0.42], lightMaterial);
      parts.ear(-0.34, 0.98, 0.55, 0.7, -0.8);
      parts.ear(0.34, 0.98, 0.55, 0.7, 0.8);
      tail = parts.body([0, 0.61, -0.91], [0.17, 0.17, 0.62], bodyMaterial, -0.08);
      [[-0.37, 0.27, -0.58], [0.37, 0.27, -0.58], [-0.37, 0.27, 0.58], [0.37, 0.27, 0.58]]
        .forEach((position) => parts.leg(position, [0.17, 0.36, 0.2]));
    } else if (breed === 'Husky') {
      parts.body([0, 0.58, -0.02], [0.57, 0.48, 0.88]);
      parts.accent([0, 0.65, 0.14], [0.49, 0.31, 0.62], lightMaterial);
      parts.head([0, 0.98, 0.68], [0.38, 0.37, 0.4]);
      parts.head([0, 0.82, 0.99], [0.23, 0.19, 0.39], lightMaterial);
      parts.accent([0, 1.01, 0.99], [0.23, 0.2, 0.22], darkMaterial);
      parts.ear(-0.24, 1.32, 0.61, 0.76, -0.08);
      parts.ear(0.24, 1.32, 0.61, 0.76, 0.08);
      tail = parts.body([0, 0.84, -0.73], [0.23, 0.22, 0.56], lightMaterial, 0.72);
      [[-0.34, 0.28, -0.56], [0.34, 0.28, -0.56], [-0.34, 0.28, 0.57], [0.34, 0.28, 0.57]]
        .forEach((position) => parts.leg(position, [0.17, 0.37, 0.2]));
    } else {
      parts.body([0, 0.43, -0.03], [0.68, 0.43, 0.76]);
      parts.body([0, 0.72, 0.43], [0.55, 0.49, 0.48]);
      parts.head([0, 0.9, 0.68], [0.49, 0.39, 0.43]);
      parts.head([0, 0.75, 1.01], [0.38, 0.24, 0.3], lightMaterial);
      parts.accent([0, 0.79, 1.2], [0.17, 0.12, 0.1], darkMaterial);
      parts.ear(-0.46, 1.09, 0.56, 0.48, -0.92);
      parts.ear(0.46, 1.09, 0.56, 0.48, 0.92);
      tail = parts.body([0, 0.56, -0.75], [0.16, 0.16, 0.34], bodyMaterial, 0.9);
      [[-0.42, 0.19, -0.45], [0.42, 0.19, -0.45], [-0.42, 0.19, 0.48], [0.42, 0.19, 0.48]]
        .forEach((position) => parts.leg(position, [0.19, 0.24, 0.19]));
    }

    const nose = new THREE.Mesh(DOG_SPHERE, darkMaterial);
    nose.position.set(0, breed === 'Mastín' ? 0.88 : 0.8, breed === 'Terrier' ? 1.11 : 1.32);
    nose.scale.set(0.1, 0.075, 0.09);
    dog.add(nose);
    [-1, 1].forEach((side) => {
      const eye = new THREE.Mesh(DOG_SPHERE, eyeMaterial);
      eye.position.set(side * (breed === 'Mastín' ? 0.32 : 0.24), 1.02, 0.96);
      eye.scale.set(0.055, 0.055, 0.055);
      dog.add(eye);
    });

    dog.userData.baseY = dog.position.y;
    dog.userData.offset = Math.random() * Math.PI * 2;
    dog.userData.home = new THREE.Vector3(x, 0, z);
    dog.userData.reaction = 0;
    dog.userData.state = 'calm';
    dog.userData.baseColor = new THREE.Color(color);
    dog.userData.breed = breed;
    dog.userData.enduranceMax = breed === 'Mastín' ? 120 : (breed === 'Terrier' ? 88 : 100);
    dog.userData.endurance = dog.userData.enduranceMax;
    dog.userData.chaseSpeed = {
      'Pastor alemán': 7.7,
      Terrier: 8.2,
      'Mastín': 6.6,
      Labrador: 7.1,
      Husky: 8.5,
      Bulldog: 6.2,
    }[breed] || 7;
    dog.userData.bodyMaterial = bodyMaterial;
    dog.userData.headMaterial = headMaterial;
    dog.userData.legs = legs;
    dog.userData.headParts = headParts;
    headParts.forEach((head) => {
      head.userData.baseRotationX = head.rotation.x;
    });
    dog.userData.tail = tail;
    dog.userData.moveSpeed = 0;
    dog.userData.gaitPhase = Math.random() * Math.PI * 2;
    dog.userData.alertTimer = 0;
    dog.userData.pathTimer = 0;
    dog.userData.pathTarget = -1;
    dog.userData.path = [];
    return dog;
  }

  buildNavigationGrid() {
    const minX = -57;
    const minZ = -87;
    const columns = 39;
    const rows = 59;
    const walkable = new Uint8Array(columns * rows);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = minX + column * DOG_NAV_SPACING;
        const z = minZ + row * DOG_NAV_SPACING;
        const blocked = this.obstacles.some((obstacle) => {
          const closestX = THREE.MathUtils.clamp(x, obstacle.minX, obstacle.maxX);
          const closestZ = THREE.MathUtils.clamp(z, obstacle.minZ, obstacle.maxZ);
          const dx = x - closestX;
          const dz = z - closestZ;
          return dx * dx + dz * dz < 0.95 * 0.95;
        });
        walkable[row * columns + column] = blocked ? 0 : 1;
      }
    }

    this.navigationGrid = { minX, minZ, columns, rows, walkable };
  }

  nearestNavigationNode(position) {
    const grid = this.navigationGrid;
    const centerColumn = THREE.MathUtils.clamp(
      Math.round((position.x - grid.minX) / DOG_NAV_SPACING),
      0,
      grid.columns - 1
    );
    const centerRow = THREE.MathUtils.clamp(
      Math.round((position.z - grid.minZ) / DOG_NAV_SPACING),
      0,
      grid.rows - 1
    );

    for (let radius = 0; radius < Math.max(grid.columns, grid.rows); radius += 1) {
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
        for (let columnOffset = -radius; columnOffset <= radius; columnOffset += 1) {
          if (Math.max(Math.abs(rowOffset), Math.abs(columnOffset)) !== radius) continue;
          const column = centerColumn + columnOffset;
          const row = centerRow + rowOffset;
          if (column < 0 || column >= grid.columns || row < 0 || row >= grid.rows) continue;
          const node = row * grid.columns + column;
          if (grid.walkable[node]) return node;
        }
      }
    }
    return -1;
  }

  findDogPath(startPosition, targetPosition) {
    const grid = this.navigationGrid;
    const start = this.nearestNavigationNode(startPosition);
    const goal = this.nearestNavigationNode(targetPosition);
    if (start < 0 || goal < 0 || start === goal) return [];

    const parent = new Int32Array(grid.walkable.length);
    parent.fill(-2);
    const queue = new Int32Array(grid.walkable.length);
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    parent[start] = -1;
    const directions = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [1, -1], [-1, 1], [1, 1],
    ];

    while (head < tail && parent[goal] === -2) {
      const current = queue[head++];
      const column = current % grid.columns;
      const row = Math.floor(current / grid.columns);
      for (const [dx, dz] of directions) {
        const nextColumn = column + dx;
        const nextRow = row + dz;
        if (nextColumn < 0 || nextColumn >= grid.columns || nextRow < 0 || nextRow >= grid.rows) continue;
        const next = nextRow * grid.columns + nextColumn;
        if (!grid.walkable[next] || parent[next] !== -2) continue;
        if (dx !== 0 && dz !== 0) {
          const horizontal = row * grid.columns + nextColumn;
          const vertical = nextRow * grid.columns + column;
          if (!grid.walkable[horizontal] || !grid.walkable[vertical]) continue;
        }
        parent[next] = current;
        queue[tail++] = next;
      }
    }

    if (parent[goal] === -2) return [];
    const path = [];
    for (let node = goal; node !== start; node = parent[node]) {
      const column = node % grid.columns;
      const row = Math.floor(node / grid.columns);
      path.push(new THREE.Vector3(
        grid.minX + column * DOG_NAV_SPACING,
        0,
        grid.minZ + row * DOG_NAV_SPACING
      ));
    }
    path.reverse();
    return path;
  }

  moveDog(dog, direction, desiredSpeed, delta) {
    const targetSpeed = direction.lengthSq() > 0.0001 ? desiredSpeed : 0;
    const acceleration = targetSpeed > dog.userData.moveSpeed ? 5.5 : 8;
    dog.userData.moveSpeed += (targetSpeed - dog.userData.moveSpeed) * (1 - Math.exp(-acceleration * delta));

    if (dog.userData.moveSpeed < 0.04 || direction.lengthSq() < 0.0001) {
      dog.userData.moveSpeed = targetSpeed < 0.04 ? 0 : dog.userData.moveSpeed;
      return;
    }

    const heading = direction.clone().setY(0).normalize();
    const candidate = dog.position.clone().addScaledVector(heading, dog.userData.moveSpeed * delta);
    const oldX = dog.position.x;
    const oldZ = dog.position.z;
    this.resolveCircleAgainstObstacles(candidate, 0.72 * dog.scale.x);
    candidate.x = THREE.MathUtils.clamp(candidate.x, MAP_BOUNDS.minX, MAP_BOUNDS.maxX);
    candidate.z = THREE.MathUtils.clamp(candidate.z, MAP_BOUNDS.minZ, MAP_BOUNDS.maxZ);
    dog.position.x = candidate.x;
    dog.position.z = candidate.z;

    const movedX = candidate.x - oldX;
    const movedZ = candidate.z - oldZ;
    if (movedX * movedX + movedZ * movedZ > 0.00001) {
      const targetYaw = Math.atan2(movedX, movedZ);
      const angleDiff = THREE.MathUtils.euclideanModulo(targetYaw - dog.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      dog.rotation.y += angleDiff * (1 - Math.exp(-8 * delta));
    }
  }

  hasLineOfSight(start, end) {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    for (const obstacle of this.obstacles) {
      if (dx === 0 && (start.x < obstacle.minX || start.x > obstacle.maxX)) continue;
      if (dz === 0 && (start.z < obstacle.minZ || start.z > obstacle.maxZ)) continue;

      let entryX = -Infinity;
      let exitX = Infinity;
      let entryZ = -Infinity;
      let exitZ = Infinity;
      if (dx !== 0) {
        entryX = (obstacle.minX - start.x) / dx;
        exitX = (obstacle.maxX - start.x) / dx;
        if (entryX > exitX) [entryX, exitX] = [exitX, entryX];
      }
      if (dz !== 0) {
        entryZ = (obstacle.minZ - start.z) / dz;
        exitZ = (obstacle.maxZ - start.z) / dz;
        if (entryZ > exitZ) [entryZ, exitZ] = [exitZ, entryZ];
      }

      const entry = Math.max(entryX, entryZ, 0);
      const exit = Math.min(exitX, exitZ, 1);
      if (entry <= exit && entry < 0.98 && exit > 0.02) return false;
    }
    return true;
  }
  addDogPart(dog, position, size, material, rotation = 0) {
    const part = new THREE.Mesh(DOG_SPHERE, material);
    part.position.set(...position);
    part.scale.set(...size);
    part.rotation.z = rotation;
    part.castShadow = false;
    dog.add(part);
    return part;
  }

  bindUI() {
    this.hud = {
      root: document.getElementById('hud'),
      damageFlash: document.getElementById('damageFlash'),
      damageNotice: document.getElementById('damageNotice'),
      menuOverlay: document.getElementById('menuOverlay'),
      endOverlay: document.getElementById('endOverlay'),
      endTitle: document.getElementById('endTitle'),
      endMessage: document.getElementById('endMessage'),
      healthValue: document.getElementById('healthValue'),
      healthFill: document.getElementById('healthFill'),
      staminaValue: document.getElementById('staminaValue'),
      staminaFill: document.getElementById('staminaFill'),
      perchStatus: document.getElementById('perchStatus'),
      grapplePanel: document.getElementById('grapplePanel'),
      grappleTitle: document.getElementById('grappleTitle'),
      grappleInstructions: document.getElementById('grappleInstructions'),
      grappleDogFill: document.getElementById('grappleDogFill'),
      grappleProgress: document.getElementById('grappleProgress'),
      currentTool: document.getElementById('currentTool'),
      toolDetail: document.getElementById('toolDetail'),
      objectiveStatus: document.getElementById('objectiveStatus'),
      startButton: document.getElementById('startButton'),
      resumeButton: document.getElementById('resumeButton'),
      optionsButton: document.getElementById('optionsButton'),
      menuButton: document.getElementById('menuButton'),
      resetButton: document.getElementById('resetButton'),
      endRestartButton: document.getElementById('endRestartButton'),
      endMenuButton: document.getElementById('endMenuButton'),
      toolButtons: [...document.querySelectorAll('.tool-btn')],
    };

    this.hud.startButton.addEventListener('click', () => this.startGame());
    this.hud.resumeButton.addEventListener('click', () => this.resumeGame());
    this.hud.optionsButton.addEventListener('click', () => this.toggleDusk());
    this.hud.menuButton.addEventListener('click', () => this.showMenu());
    this.hud.resetButton.addEventListener('click', () => this.resetGame());
    this.hud.endRestartButton.addEventListener('click', () => this.resetGame());
    this.hud.endMenuButton.addEventListener('click', () => this.showMenu());

    this.hud.toolButtons.forEach((button) => {
      button.addEventListener('click', () => this.setTool(button.dataset.tool));
    });
    this.hud.damageFlash.addEventListener('animationend', () => {
      this.hud.damageFlash.classList.remove('active');
    });
    this.hud.damageNotice.addEventListener('animationend', () => {
      this.hud.damageNotice.classList.remove('active');
    });
  }

  bindEvents() {
    document.addEventListener('keydown', (event) => {
      this.keys[event.code] = true;

      if (event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat && this.started && !this.menuOpen && this.player.grappledBy) {
          this.registerEscapeEffort();
        }
        return;
      }

      if (event.code === 'KeyQ') {
        event.preventDefault();
      }

      if (event.code === 'KeyE') {
        event.preventDefault();
        if (!event.repeat && this.started && !this.menuOpen && !this.player.grappledBy) {
          this.togglePerch();
        }
      }

      if (event.code === 'Escape') {
        if (this.started) {
          this.showMenu();
        }
      }

      const boundTools = {
        Digit1: 'food',
        Digit2: 'water',
        Digit3: 'bottle',
        Digit4: 'branch',
        Digit5: 'stone',
        Numpad1: 'food',
        Numpad2: 'water',
        Numpad3: 'bottle',
        Numpad4: 'branch',
        Numpad5: 'stone',
      };

      if (boundTools[event.code]) {
        event.preventDefault();
        this.setTool(boundTools[event.code]);
      }
    });

    document.addEventListener('keyup', (event) => {
      this.keys[event.code] = false;
    });

    document.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || event.target !== this.renderer.domElement || this.menuOpen || !this.started) {
        return;
      }

      this.throwCurrentTool();
    });

    document.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });

    document.addEventListener('mousemove', (event) => {
      if (!this.pointerLocked || this.menuOpen) {
        return;
      }

      this.player.yaw -= event.movementX * 0.0024;
      this.player.pitch -= event.movementY * 0.0017;
      this.player.pitch = THREE.MathUtils.clamp(this.player.pitch, -1.35, 1.35);
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.renderer.domElement;

      if (!this.pointerLocked && this.started && !this.menuOpen) {
        this.showMenu();
      }
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.renderer.domElement.addEventListener('click', () => {
      if (this.started && !this.menuOpen) {
        this.renderer.domElement.requestPointerLock();
      }
    });
  }

  startGame() {
    if (this.ended) {
      this.resetGame();
      return;
    }
    this.started = true;
    this.menuOpen = false;
    this.hud.root.classList.remove('hidden');
    this.hud.menuOverlay.classList.remove('visible');
    this.renderer.domElement.requestPointerLock();
  }

  resumeGame() {
    if (this.ended) {
      this.resetGame();
      return;
    }
    if (!this.started) {
      this.startGame();
      return;
    }

    this.menuOpen = false;
    this.hud.menuOverlay.classList.remove('visible');
    this.renderer.domElement.requestPointerLock();
  }

  showMenu() {
    this.menuOpen = true;
    this.keys = {};
    this.hud.endOverlay.classList.remove('visible');
    this.hud.menuOverlay.classList.add('visible');
    document.exitPointerLock();
  }

  finishGame(outcome) {
    if (this.ended) return;
    this.ended = true;
    this.menuOpen = true;
    this.keys = {};
    this.hud.menuOverlay.classList.remove('visible');
    this.hud.endOverlay.classList.add('visible');
    if (outcome === 'victory') {
      this.hud.endTitle.textContent = '¡Llegaste a salvo!';
      this.hud.endMessage.textContent = 'Completaste la ruta de evacuación y alcanzaste el punto de encuentro.';
    } else {
      this.hud.endTitle.textContent = 'La ruta se interrumpió';
      this.hud.endMessage.textContent = 'Te quedaste sin vida antes de llegar al punto de encuentro.';
    }
    document.exitPointerLock();
  }

  toggleDusk() {
    this.fogEnabled = !this.fogEnabled;
    if (this.fogEnabled) {
      this.scene.background = new THREE.Color('#f4b76a');
      this.scene.fog = new THREE.Fog('#f4b76a', 100, 230);
    } else {
      this.scene.background = new THREE.Color('#1e1a1d');
      this.scene.fog = new THREE.Fog('#1e1a1d', 75, 190);
    }
  }

  setTool(toolName) {
    if (!Object.hasOwn(this.inventory, toolName)) {
      return;
    }
    this.selectedTool = toolName;
    this.updateToolUI();
  }

  updateToolUI() {
    this.hud.toolButtons.forEach((button) => {
      const active = button.dataset.tool === this.selectedTool;
      button.classList.toggle('active', active);
    });

    const label = TOOL_LABELS[this.selectedTool] || 'Comida';
    const count = this.inventory[this.selectedTool] ?? 0;
    this.hud.currentTool.textContent = label;
    this.hud.toolDetail.textContent = count === Infinity ? 'x∞' : `x${count}`;
  }

  canUseSelectedTool() {
    const count = this.inventory[this.selectedTool] ?? 0;
    if (count <= 0) {
      return false;
    }
    if (count !== Infinity) {
      this.inventory[this.selectedTool] = count - 1;
    }
    this.updateToolUI();
    return true;
  }

  updateHealthUI() {
    const ratio = this.player.health / this.player.maxHealth;
    this.hud.healthFill.style.width = `${ratio * 100}%`;
    this.hud.healthFill.dataset.healthState = ratio > 0.5 ? 'normal' : (ratio > 0.25 ? 'warning' : 'critical');
    this.hud.healthFill.parentElement.setAttribute('aria-valuenow', `${Math.round(this.player.health)}`);
    this.hud.healthValue.textContent = `${Math.round(this.player.health)} / ${this.player.maxHealth}`;
  }

  updateStaminaUI() {
    const stamina = Math.round(this.player.stamina);
    if (this.lastStaminaUiValue !== stamina) {
      this.lastStaminaUiValue = stamina;
      this.hud.staminaValue.textContent = `${stamina}%`;
      this.hud.staminaFill.style.width = `${stamina}%`;
      this.hud.staminaFill.parentElement.setAttribute('aria-valuenow', `${stamina}`);
      this.hud.staminaFill.dataset.staminaState = stamina <= 25 ? 'low' : 'normal';
    }

    if (this.pickupMessageTimer > 0) {
      this.hud.perchStatus.textContent = this.pickupMessage;
      return;
    }
    if (this.player.grappledBy) {
      this.hud.perchStatus.textContent = 'Forcejeando · pulsa Espacio';
      return;
    }
    if (this.player.perch) {
      this.hud.perchStatus.textContent = `${this.player.perch.name} · E para bajar`;
      return;
    }
    if (this.keys.KeyQ && this.player.stamina <= 0) {
      this.hud.perchStatus.textContent = 'Sin resistencia · Q para correr';
      return;
    }
    if (this.keys.KeyQ && this.player.sprintExhausted) {
      this.hud.perchStatus.textContent = 'Recupera resistencia para correr';
      return;
    }
    const nearbyPerch = this.perches.some((perch) => (
      Math.hypot(this.player.position.x - perch.x, this.player.position.z - perch.z) <= 2.2
    ));
    this.hud.perchStatus.textContent = nearbyPerch
      ? 'E para subir · Q para correr'
      : 'Q para correr · E junto a un banco o árbol';
  }

  updateGrappleUI() {
    const grapple = this.player.grapple;
    const dog = this.player.grappledBy;
    this.hud.grapplePanel.classList.toggle('hidden', !grapple || !dog);
    if (!grapple || !dog) return;

    const resistanceRatio = dog.userData.endurance / dog.userData.enduranceMax;
    this.hud.grappleDogFill.style.width = `${resistanceRatio * 100}%`;
    this.hud.grappleDogFill.parentElement.setAttribute('aria-valuenow', `${Math.round(resistanceRatio * 100)}`);
    this.hud.grappleTitle.textContent = `¡${dog.userData.breed} te alcanzó!`;
    this.hud.grappleInstructions.textContent = this.player.stamina < GRAPPLE_PLAYER_COST
      ? 'Sin resistencia: espera a recuperarte y vuelve a pulsar Espacio.'
      : 'Pulsa Espacio 5 veces en 1 segundo para zafarte.';
    this.hud.grappleProgress.textContent = `Pulsaciones: ${grapple.pressTimes.length} / ${GRAPPLE_SEQUENCE_PRESSES} · Perro: ${Math.round(resistanceRatio * 100)}%`;
  }

  startGrapple(dog) {
    if (this.player.grappledBy || this.player.perch || this.player.perchTransition) return;
    this.player.grappledBy = dog;
    this.player.grapple = { pressTimes: [] };
    dog.userData.endurance = dog.userData.enduranceMax;
    this.contactCooldown = 0;
    this.updateStaminaUI();
    this.updateGrappleUI();
  }

  applyContactDamage() {
    this.player.health = Math.max(0, this.player.health - CONTACT_DAMAGE);
    this.updateHealthUI();
    this.showDamageNotice(CONTACT_DAMAGE);
    this.hud.damageFlash.classList.remove('active');
    void this.hud.damageFlash.offsetWidth;
    this.hud.damageFlash.classList.add('active');
    this.contactCooldown = CONTACT_DAMAGE_COOLDOWN;
    if (this.player.health === 0) {
      this.finishGame('defeat');
    }
  }

  registerEscapeEffort() {
    const dog = this.player.grappledBy;
    const grapple = this.player.grapple;
    if (!dog || !grapple) return;

    const now = performance.now();
    grapple.pressTimes = grapple.pressTimes.filter((time) => now - time <= GRAPPLE_SEQUENCE_WINDOW);
    if (this.player.stamina < GRAPPLE_PLAYER_COST) {
      this.updateGrappleUI();
      return;
    }

    this.player.stamina = Math.max(0, this.player.stamina - GRAPPLE_PLAYER_COST);
    const dogEffortCost = dog.userData.enduranceMax / GRAPPLE_SEQUENCE_PRESSES;
    dog.userData.endurance = Math.max(0, dog.userData.endurance - dogEffortCost);
    grapple.pressTimes.push(now);
    if (grapple.pressTimes.length >= GRAPPLE_SEQUENCE_PRESSES) {
      dog.userData.endurance = 0;
    }
    this.updateStaminaUI();
    this.updateGrappleUI();

    if (grapple.pressTimes.length >= GRAPPLE_SEQUENCE_PRESSES && dog.userData.endurance === 0) {
      this.releaseFromGrapple();
    }
  }

  releaseFromGrapple() {
    const dog = this.player.grappledBy;
    if (!dog) return;
    const awayFromPlayer = dog.position.clone().sub(this.player.position).setY(0).normalize();
    dog.position.addScaledVector(awayFromPlayer, 2.2);
    dog.userData.reaction = 1.7;
    dog.userData.endurance = Math.max(0, dog.userData.endurance);
    this.player.grappledBy = null;
    this.player.grapple = null;
    this.player.escapeCooldown = 2;
    this.hud.grapplePanel.classList.add('hidden');
    this.updateStaminaUI();
  }

  togglePerch() {
    if (this.player.perchTransition || this.player.grappledBy) return;

    if (this.player.perch) {
      const currentPerch = this.player.perch;
      this.player.perch = null;
      this.player.perchTransition = {
        from: this.player.position.clone(),
        to: new THREE.Vector3(currentPerch.approachX, PLAYER_BASE_HEIGHT, currentPerch.approachZ),
        elapsed: 0,
        duration: 0.4,
      };
      this.updateStaminaUI();
      return;
    }

    const nearestPerch = this.perches
      .map((perch) => ({
        perch,
        distance: Math.hypot(this.player.position.x - perch.x, this.player.position.z - perch.z),
      }))
      .filter(({ distance }) => distance <= 2.2)
      .sort((a, b) => a.distance - b.distance)[0];

    if (!nearestPerch || this.player.stamina <= 0) return;

    this.player.perch = nearestPerch.perch;
    this.player.perchTransition = {
      from: this.player.position.clone(),
      to: new THREE.Vector3(
        nearestPerch.perch.x,
        PLAYER_BASE_HEIGHT + nearestPerch.perch.height,
        nearestPerch.perch.z
      ),
      elapsed: 0,
      duration: 0.4 + nearestPerch.perch.height * 0.08,
    };
    this.updateStaminaUI();
  }

  showDamageNotice(amount) {
    this.hud.damageNotice.textContent = `-${amount} vida`;
    this.hud.damageNotice.classList.remove('active');
    void this.hud.damageNotice.offsetWidth;
    this.hud.damageNotice.classList.add('active');
  }

  resetGame() {
    this.player.position.set(0, PLAYER_BASE_HEIGHT, 80);
    this.player.velocity.set(0, 0, 0);
    this.player.yaw = 0;
    this.player.pitch = 0;
    this.player.gaitPhase = 0;
    this.player.sprinting = false;
    this.player.sprintExhausted = false;
    this.player.health = this.player.maxHealth;
    this.player.stamina = MAX_STAMINA;
    this.player.perch = null;
    this.player.perchTransition = null;
    this.player.grappledBy = null;
    this.player.grapple = null;
    this.player.escapeCooldown = 0;
    this.ended = false;
    this.pickupMessage = '';
    this.pickupMessageTimer = 0;
    this.hud.damageFlash.classList.remove('active');
    this.hud.damageNotice.classList.remove('active');
    this.hud.damageNotice.textContent = '';
    this.selectedTool = 'food';
    this.projectiles = [];
    this.foodTrail = null;
    this.environmentEffects = [];
    this.clearImpactVisuals();
    this.routeIndex = 0;
    this.routeComplete = false;
    this.contactCooldown = 0;
    this.inventory = {
      food: 5,
      water: 3,
      bottle: 3,
      branch: 2,
      stone: Infinity,
    };
    this.pickups.forEach((pickup) => {
      pickup.active = true;
      pickup.mesh.visible = true;
    });
    this.updateToolUI();
    this.updateHealthUI();
    this.updateStaminaUI();
    this.hud.grapplePanel.classList.add('hidden');
    this.hud.endOverlay.classList.remove('visible');
    this.updateObjectiveUI();

    this.dogs.forEach((dog) => {
      dog.position.copy(dog.userData.home);
      dog.rotation.y = 0;
      dog.userData.reaction = 0;
      dog.userData.endurance = dog.userData.enduranceMax;
      dog.userData.state = 'calm';
      dog.userData.alertTimer = 0;
      dog.userData.moveSpeed = 0;
      dog.userData.pathTimer = 0;
      dog.userData.path = [];
      dog.userData.pathTarget = -1;
      dog.userData.bodyMaterial.color.copy(dog.userData.baseColor);
      dog.userData.headMaterial.color.copy(dog.userData.baseColor);
    });

    this.menuOpen = false;
    this.hud.menuOverlay.classList.remove('visible');
    this.hud.root.classList.remove('hidden');
    this.started = true;
    this.renderer.domElement.requestPointerLock();
  }

  throwCurrentTool() {
    if (this.throwCooldown > 0 || this.player.grappledBy || this.player.perchTransition) {
      return;
    }

    if (!this.canUseSelectedTool()) {
      return;
    }

    if (this.selectedTool === 'stone') {
      this.useInvisibleStone();
      return;
    }

    const projectileData = {
      food: { color: '#d9b36b', strength: 10.5, radius: 0.14, impactRadius: 2.5, effectRadius: 4.4, ttl: 2.5 },
      water: { color: '#7ec9f8', strength: 11.2, radius: 0.11, impactRadius: 2.8, effectRadius: 3.2, ttl: 2.2 },
      bottle: { color: '#7ec9f8', strength: 12.5, radius: 0.12, impactRadius: 2.4, effectRadius: 3.6, ttl: 2.1 },
      branch: { color: '#865c3a', strength: 9.2, radius: 0.18, impactRadius: 2.2, effectRadius: 3.0, ttl: 2.0 },
    };

    const config = projectileData[this.selectedTool] || projectileData.food;
    const projectile = new THREE.Mesh(
      new THREE.SphereGeometry(config.radius, 10, 10),
      new THREE.MeshStandardMaterial({ color: config.color, emissive: config.color, emissiveIntensity: 0.12 })
    );

    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);

    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    projectile.position.copy(origin);
    projectile.castShadow = true;
    this.scene.add(projectile);

    this.projectiles.push({
      mesh: projectile,
      velocity: direction.multiplyScalar(config.strength),
      ttl: config.ttl,
      type: this.selectedTool,
      impactRadius: config.impactRadius,
      effectRadius: config.effectRadius,
    });

    this.throwCooldown = 0.28;
  }

  useInvisibleStone() {
    if (this.invisibleStoneCooldown > 0) {
      return;
    }

    this.invisibleStoneCooldown = 1.1;
    const pulseOrigin = new THREE.Vector3(this.player.position.x, 0, this.player.position.z);
    this.stonePulse = { position: pulseOrigin.clone(), ttl: 0.35 };
    this.createImpactVisual('stone', new THREE.Vector3(this.player.position.x, 0, this.player.position.z), 5.8, 0.65);

    this.dogs.forEach((dog) => {
      const distance = Math.hypot(
        dog.position.x - this.player.position.x,
        dog.position.z - this.player.position.z
      );
      if (distance < 5.8) {
        const awayFromPlayer = dog.position.clone().sub(this.player.position).setY(0).normalize();
        dog.position.addScaledVector(awayFromPlayer, 1.7);
        dog.userData.reaction = Math.min(1.7, dog.userData.reaction + 0.9);
      }
    });
  }

  updatePlayer(delta) {
    this.player.escapeCooldown = Math.max(0, this.player.escapeCooldown - delta);

    if (this.player.perchTransition) {
      this.player.velocity.set(0, 0, 0);
      this.player.sprinting = false;
      const transition = this.player.perchTransition;
      transition.elapsed += delta;
      const progress = Math.min(1, transition.elapsed / transition.duration);
      const easedProgress = progress * progress * (3 - 2 * progress);
      this.player.position.lerpVectors(transition.from, transition.to, easedProgress);
      if (progress === 1) {
        this.player.position.copy(transition.to);
        this.player.perchTransition = null;
      }
      this.updateCamera();
      return;
    }

    if (this.player.grappledBy) {
      this.player.velocity.set(0, 0, 0);
      this.player.sprinting = false;
      const dog = this.player.grappledBy;
      this.player.stamina = Math.min(MAX_STAMINA, this.player.stamina + delta * 10);
      dog.userData.endurance = Math.max(0, dog.userData.endurance - delta * 1.5);
      if (this.contactCooldown <= 0) {
        this.applyContactDamage();
      }
      if (dog.userData.endurance === 0) {
        this.releaseFromGrapple();
      }
      this.updateStaminaUI();
      this.updateGrappleUI();
      this.updateCamera();
      return;
    }

    if (this.player.perch) {
      this.player.velocity.set(0, 0, 0);
      this.player.sprinting = false;
      this.player.stamina = Math.max(0, this.player.stamina - delta * 12);
      this.player.position.set(
        this.player.perch.x,
        PLAYER_BASE_HEIGHT + this.player.perch.height,
        this.player.perch.z
      );
      if (this.player.stamina === 0) {
        this.togglePerch();
      }
      this.updateStaminaUI();
      this.updateCamera();
      return;
    }

    this.player.position.y = PLAYER_BASE_HEIGHT;

    const moveDirection = new THREE.Vector3();
    const forward = new THREE.Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();

    if (this.keys.ArrowUp || this.keys.KeyW) moveDirection.sub(forward);
    if (this.keys.ArrowDown || this.keys.KeyS) moveDirection.add(forward);
    if (this.keys.ArrowRight || this.keys.KeyD) moveDirection.add(right);
    if (this.keys.ArrowLeft || this.keys.KeyA) moveDirection.sub(right);

    const moving = moveDirection.lengthSq() > 0;
    if (moving) {
      moveDirection.normalize();
    }

    const sprinting = moving && this.keys.KeyQ && this.player.stamina > 0 && !this.player.sprintExhausted;
    const targetSpeed = this.player.speed * (sprinting ? 1.65 : 1);
    const targetVelocity = moveDirection.multiplyScalar(targetSpeed);
    const acceleration = moving ? (sprinting ? 12 : 10) : 14;
    this.player.velocity.x += (targetVelocity.x - this.player.velocity.x) * (1 - Math.exp(-acceleration * delta));
    this.player.velocity.z += (targetVelocity.z - this.player.velocity.z) * (1 - Math.exp(-acceleration * delta));

    const nextX = this.player.position.clone();
    nextX.x += this.player.velocity.x * delta;
    this.resolvePlayerPosition(nextX);
    if (Math.abs(nextX.x - this.player.position.x - this.player.velocity.x * delta) > 0.02) {
      this.player.velocity.x = 0;
    }
    this.player.position.x = nextX.x;

    const nextZ = this.player.position.clone();
    nextZ.z += this.player.velocity.z * delta;
    this.resolvePlayerPosition(nextZ);
    if (Math.abs(nextZ.z - this.player.position.z - this.player.velocity.z * delta) > 0.02) {
      this.player.velocity.z = 0;
    }
    this.player.position.z = nextZ.z;

    this.player.stamina = sprinting
      ? Math.max(0, this.player.stamina - delta * 22)
      : Math.min(MAX_STAMINA, this.player.stamina + delta * (moving ? 14 : 19));
    if (this.player.stamina === 0) {
      this.player.sprintExhausted = true;
    } else if (this.player.stamina >= 20) {
      this.player.sprintExhausted = false;
    }
    this.player.sprinting = sprinting;
    this.player.gaitPhase += Math.hypot(this.player.velocity.x, this.player.velocity.z) * delta * 2.2;
    this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, MAP_BOUNDS.minX, MAP_BOUNDS.maxX);
    this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, MAP_BOUNDS.minZ, MAP_BOUNDS.maxZ);

    this.updateStaminaUI();
    this.updateCamera();
  }

  resolveCircleAgainstObstacles(position, radius) {
    for (let pass = 0; pass < 2; pass += 1) {
      this.obstacles.forEach((obstacle) => {
        const closestX = THREE.MathUtils.clamp(position.x, obstacle.minX, obstacle.maxX);
        const closestZ = THREE.MathUtils.clamp(position.z, obstacle.minZ, obstacle.maxZ);
        let dx = position.x - closestX;
        let dz = position.z - closestZ;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq >= radius * radius) return;

        if (distanceSq < 0.000001) {
          const xDepth = Math.min(position.x - obstacle.minX, obstacle.maxX - position.x);
          const zDepth = Math.min(position.z - obstacle.minZ, obstacle.maxZ - position.z);
          if (xDepth < zDepth) {
            position.x = position.x - obstacle.minX < obstacle.maxX - position.x
              ? obstacle.minX - radius
              : obstacle.maxX + radius;
          } else {
            position.z = position.z - obstacle.minZ < obstacle.maxZ - position.z
              ? obstacle.minZ - radius
              : obstacle.maxZ + radius;
          }
          return;
        }

        const distance = Math.hypot(dx, dz) || 1;
        const overlap = radius - distance;
        position.x += (dx / distance) * overlap;
        position.z += (dz / distance) * overlap;
      });
    }
  }

  resolvePlayerPosition(position) {
    this.resolveCircleAgainstObstacles(position, 0.42);
    this.dogs.forEach((dog) => {
      const dx = position.x - dog.position.x;
      const dz = position.z - dog.position.z;
      const minimumDistance = 0.42 + 0.72 * dog.scale.x;
      const distance = Math.hypot(dx, dz);
      if (distance < minimumDistance) {
        const direction = distance > 0.0001 ? new THREE.Vector2(dx, dz).normalize() : new THREE.Vector2(1, 0);
        position.x = dog.position.x + direction.x * minimumDistance;
        position.z = dog.position.z + direction.y * minimumDistance;
      }
    });
    this.resolveCircleAgainstObstacles(position, 0.42);
  }

  isProjectileBlocked(position, radius) {
    return this.obstacles.some((obstacle) => (
      position.y + radius >= obstacle.minY
      && position.y - radius <= obstacle.maxY
      && position.x + radius >= obstacle.minX
      && position.x - radius <= obstacle.maxX
      && position.z + radius >= obstacle.minZ
      && position.z - radius <= obstacle.maxZ
    ));
  }

  resolveDogCollisions(delta) {
    this.contactCooldown = Math.max(0, this.contactCooldown - delta);
    this.dogs.forEach((dog, index) => {
      if (this.ended) return;
      if (this.player.grappledBy) return;
      const dogRadius = 0.72 * dog.scale.x;
      this.resolveCircleAgainstObstacles(dog.position, dogRadius);

      for (let otherIndex = index + 1; otherIndex < this.dogs.length; otherIndex += 1) {
        const otherDog = this.dogs[otherIndex];
        const dx = dog.position.x - otherDog.position.x;
        const dz = dog.position.z - otherDog.position.z;
        const minimumDistance = dogRadius + 0.72 * otherDog.scale.x;
        const distance = Math.hypot(dx, dz);
        if (distance < minimumDistance) {
          const directionX = distance > 0.0001 ? dx / distance : 1;
          const directionZ = distance > 0.0001 ? dz / distance : 0;
          const separation = (minimumDistance - distance) / 2;
          dog.position.x += directionX * separation;
          dog.position.z += directionZ * separation;
          otherDog.position.x -= directionX * separation;
          otherDog.position.z -= directionZ * separation;
        }
      }

      const dx = dog.position.x - this.player.position.x;
      const dz = dog.position.z - this.player.position.z;
      const minimumDistance = dogRadius + 0.42;
      const distance = Math.hypot(dx, dz);
      const playerElevation = this.player.position.y - PLAYER_BASE_HEIGHT;
      const dogCanReachPlayer = playerElevation < 1.5 * dog.scale.y;
      if (this.player.escapeCooldown > 0 || dog.userData.endurance <= 0) return;
      if (distance < minimumDistance && dogCanReachPlayer) {
        if (this.player.perch) {
          if (this.contactCooldown <= 0) this.applyContactDamage();
          return;
        }
        this.startGrapple(dog);
        return;
      }

      if (distance < GRAPPLE_TRIGGER_DISTANCE && dogCanReachPlayer
        && !this.player.perch && !this.player.perchTransition) {
        this.startGrapple(dog);
      }

      if (distance < minimumDistance && dogCanReachPlayer && this.player.perchTransition) {
        const directionX = distance > 0.0001 ? dx / distance : 1;
        const directionZ = distance > 0.0001 ? dz / distance : 0;
        const overlap = minimumDistance - distance;
        dog.position.x += directionX * overlap;
        dog.position.z += directionZ * overlap;
        this.resolveCircleAgainstObstacles(dog.position, dogRadius);
        const remaining = minimumDistance - Math.hypot(
          dog.position.x - this.player.position.x,
          dog.position.z - this.player.position.z
        );
        if (remaining > 0) {
          this.player.position.x -= directionX * remaining;
          this.player.position.z -= directionZ * remaining;
          this.resolveCircleAgainstObstacles(this.player.position, 0.42);
          this.player.position.x = THREE.MathUtils.clamp(this.player.position.x, MAP_BOUNDS.minX, MAP_BOUNDS.maxX);
          this.player.position.z = THREE.MathUtils.clamp(this.player.position.z, MAP_BOUNDS.minZ, MAP_BOUNDS.maxZ);
          this.updateCamera();
        }
        if (this.contactCooldown <= 0) this.applyContactDamage();
      }
    });
  }

  updateObjectiveUI() {
    while (this.routeIndex < this.routeWaypoints.length) {
      const waypoint = this.routeWaypoints[this.routeIndex].position;
      const distance = Math.hypot(
        this.player.position.x - waypoint.x,
        this.player.position.z - waypoint.z
      );
      if (distance >= 2.6) break;
      this.routeIndex += 1;
    }

    this.routeComplete = this.routeIndex >= this.routeWaypoints.length;
    this.updateRouteMarkers();
    if (this.routeComplete) {
      this.hud.objectiveStatus.textContent = 'Ruta completa · Punto de encuentro';
      this.finishGame('victory');
      return;
    }

    const waypoint = this.routeWaypoints[this.routeIndex];
    const distance = Math.hypot(
      this.player.position.x - waypoint.position.x,
      this.player.position.z - waypoint.position.z
    );
    this.hud.objectiveStatus.textContent = `Tramo ${this.routeIndex + 1}/${this.routeWaypoints.length} · ${waypoint.label} · ${Math.round(distance)} m`;
  }

  updateRouteMarkers() {
    this.routeMarkers.forEach((marker, index) => {
      const active = index === this.routeIndex;
      if (marker.userData.active === active) return;
      marker.userData.active = active;
      marker.scale.setScalar(active ? 1 : 0.76);
      marker.userData.beaconMaterial.opacity = active ? 0.58 : 0.18;
      marker.userData.beaconMaterial.color.set(active ? '#8df59b' : '#d5b77d');
      marker.userData.ringMaterial.color.set(active ? '#b7ff9b' : '#b59b70');
    });
  }

  updateProjectiles(delta) {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = this.projectiles[i];
      projectile.velocity.y -= 9.8 * delta;
      const movement = projectile.velocity.clone().multiplyScalar(delta);
      const steps = Math.max(1, Math.ceil(movement.length() / 0.16));
      projectile.ttl -= delta;

      let collided = false;
      for (let step = 0; step < steps && !collided; step += 1) {
        projectile.mesh.position.addScaledVector(movement, 1 / steps);
        const position = projectile.mesh.position;
        const hitDog = this.dogs.find((dog) => (
          position.y < 1.5 * dog.scale.y
          && position.y > 0.05
          && Math.hypot(position.x - dog.position.x, position.z - dog.position.z) < 0.78 * dog.scale.x
        ));
        if (hitDog || position.y <= projectile.mesh.geometry.parameters.radius || this.isProjectileBlocked(position, projectile.mesh.geometry.parameters.radius)) {
          const impactPosition = position.clone();
          impactPosition.y = 0;
          if (projectile.type === 'food') {
            this.foodTrail = { position: impactPosition, ttl: 5 };
            this.createImpactVisual('food', impactPosition, 2.2, 0.75);
          } else {
            this.addEnvironmentEffect(projectile.type, impactPosition, projectile.effectRadius);
          }
          if (hitDog && projectile.type !== 'food') {
            const away = hitDog.position.clone().sub(impactPosition).setY(0).normalize();
            hitDog.position.addScaledVector(away, 0.8);
            hitDog.userData.reaction = Math.min(1.7, hitDog.userData.reaction + (projectile.type === 'bottle' ? 1 : 0.85));
          }
          collided = true;
        }
      }

      if (projectile.ttl <= 0 && !collided) {
        const impactPosition = projectile.mesh.position.clone();
        impactPosition.y = 0;
        if (projectile.type === 'food') {
          this.foodTrail = { position: impactPosition, ttl: 5 };
          this.createImpactVisual('food', impactPosition, 2.2, 0.75);
        } else {
          this.addEnvironmentEffect(projectile.type, impactPosition, projectile.effectRadius);
        }
        collided = true;
      }

      if (collided) {
        this.scene.remove(projectile.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  addEnvironmentEffect(type, position, radius) {
    this.environmentEffects.push({ type, position: position.clone(), radius, ttl: 1.1 });
    this.createImpactVisual(type, position, Math.min(radius, 3.8), 0.8);
  }

  createImpactVisual(type, position, radius, duration) {
    const colors = {
      food: '#f3c969',
      water: '#59c9f4',
      bottle: '#a7e6ff',
      branch: '#d5965c',
      stone: '#b7ff9b',
    };
    const color = colors[type] || colors.branch;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.045, 6, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(position.x, 0.08, position.z);
    ring.scale.setScalar(0.25);
    this.scene.add(ring);

    const particleCount = type === 'stone' ? 10 : (type === 'water' || type === 'bottle' ? 6 : 4);
    const particleGeometry = new THREE.SphereGeometry(0.075, 8, 6);
    const particleMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const particles = [];
    for (let index = 0; index < particleCount; index += 1) {
      const angle = (index / particleCount) * Math.PI * 2;
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      particle.position.set(position.x, 0.12, position.z);
      this.scene.add(particle);
      particles.push({
        mesh: particle,
        velocity: new THREE.Vector3(Math.cos(angle) * 1.4, 1 + (index % 3) * 0.2, Math.sin(angle) * 1.4),
      });
    }

    this.impactVisuals.push({
      ring,
      particles,
      particleGeometry,
      particleMaterial,
      radius,
      duration,
      ttl: duration,
    });
  }

  updateImpactVisuals(delta) {
    for (let index = this.impactVisuals.length - 1; index >= 0; index -= 1) {
      const effect = this.impactVisuals[index];
      effect.ttl -= delta;
      const progress = 1 - Math.max(0, effect.ttl) / effect.duration;
      effect.ring.scale.setScalar(0.25 + progress * effect.radius);
      effect.ring.material.opacity = 0.8 * (1 - progress);
      effect.particles.forEach((particle) => {
        particle.velocity.y -= 2.4 * delta;
        particle.mesh.position.addScaledVector(particle.velocity, delta);
        particle.mesh.scale.setScalar(Math.max(0.05, 1 - progress));
        particle.mesh.position.y = Math.max(0.08, particle.mesh.position.y);
        effect.particleMaterial.opacity = 0.9 * (1 - progress);
      });

      if (effect.ttl <= 0) {
        this.scene.remove(effect.ring);
        effect.particles.forEach(({ mesh }) => this.scene.remove(mesh));
        effect.ring.geometry.dispose();
        effect.ring.material.dispose();
        effect.particleGeometry.dispose();
        effect.particleMaterial.dispose();
        this.impactVisuals.splice(index, 1);
      }
    }
  }

  clearImpactVisuals() {
    this.impactVisuals.forEach((effect) => {
      this.scene.remove(effect.ring);
      effect.particles.forEach(({ mesh }) => this.scene.remove(mesh));
      effect.ring.geometry.dispose();
      effect.ring.material.dispose();
      effect.particleGeometry.dispose();
      effect.particleMaterial.dispose();
    });
    this.impactVisuals = [];
  }

  updateEffects(delta) {
    for (let i = this.environmentEffects.length - 1; i >= 0; i -= 1) {
      const effect = this.environmentEffects[i];
      effect.ttl -= delta;

      this.dogs.forEach((dog) => {
        const distance = dog.position.distanceTo(effect.position);
        if (distance <= effect.radius) {
          const pushDirection = dog.position.clone().sub(effect.position).setY(0).normalize();
          const force = effect.type === 'water' ? 0.85 : 1.1;
          dog.position.addScaledVector(pushDirection, delta * force * 2.2);
          dog.userData.reaction = Math.min(1.7, dog.userData.reaction + delta * 0.9);
        }
      });

      if (effect.ttl <= 0) {
        this.environmentEffects.splice(i, 1);
      }
    }
  }

  updateDogs(delta) {
    this.throwCooldown = Math.max(0, this.throwCooldown - delta);
    this.invisibleStoneCooldown = Math.max(0, this.invisibleStoneCooldown - delta);
    if (this.foodTrail) {
      this.foodTrail.ttl -= delta;
      if (this.foodTrail.ttl <= 0) {
        this.foodTrail = null;
      }
    }

    if (this.stonePulse) {
      this.stonePulse.ttl -= delta;
      if (this.stonePulse.ttl <= 0) {
        this.stonePulse = null;
      }
    }

    this.updateEffects(delta);
    this.updateImpactVisuals(delta);
    this.updatePickups(delta);

    const playerGrounded = !this.player.perch && !this.player.perchTransition;
    this.dogs.forEach((dog) => {
      const t = performance.now() * 0.001 + dog.userData.offset;
      const playerDistance = Math.hypot(
        dog.position.x - this.player.position.x,
        dog.position.z - this.player.position.z
      );
      const detectionRange = this.player.sprinting ? 24 : 18;
      const canSeePlayer = playerDistance < detectionRange
        && this.hasLineOfSight(dog.position, this.player.position);
      const detectedPlayer = playerGrounded
        && playerDistance < detectionRange
        && (canSeePlayer || (this.player.sprinting && playerDistance < 13));

      if (detectedPlayer) {
        dog.userData.alertTimer = Math.min(1.2, dog.userData.alertTimer + delta);
        dog.userData.reaction = Math.min(1.7, dog.userData.reaction + delta * 0.9);
      } else {
        dog.userData.alertTimer = Math.max(0, dog.userData.alertTimer - delta * 1.4);
        dog.userData.reaction = Math.max(0, dog.userData.reaction - delta * 0.45);
      }

      if (this.foodTrail && Math.hypot(
        dog.position.x - this.foodTrail.position.x,
        dog.position.z - this.foodTrail.position.z
      ) < 7) {
        dog.userData.reaction = Math.min(1.3, dog.userData.reaction + delta * 0.5);
      }

      const nearStonePulse = this.stonePulse && Math.hypot(
        dog.position.x - this.stonePulse.position.x,
        dog.position.z - this.stonePulse.position.z
      ) < 5.2;
      if (nearStonePulse) {
        dog.userData.reaction = Math.min(1.7, dog.userData.reaction + delta * 2.1);
      }

      let state = 'calm';
      if (dog === this.player.grappledBy) {
        state = 'territorial';
      } else if (dog.userData.endurance <= 0) {
        state = 'exhausted';
      } else if (playerGrounded && playerDistance < 4.2) {
        state = 'attack';
      } else if (detectedPlayer && dog.userData.alertTimer >= 0.65) {
        state = 'chase';
      } else if (detectedPlayer || dog.userData.reaction > 0.22) {
        state = 'alert';
      }

      dog.userData.state = state;
      const pursuing = state === 'chase' || state === 'attack';
      if (dog !== this.player.grappledBy) {
        dog.userData.endurance = pursuing
          ? Math.max(0, dog.userData.endurance - delta * 5.5)
          : Math.min(dog.userData.enduranceMax, dog.userData.endurance + delta * 12);
      }

      const direction = new THREE.Vector3();
      let desiredSpeed = 0;
      if (nearStonePulse) {
        direction.copy(dog.position).sub(this.stonePulse.position).setY(0);
        desiredSpeed = 4;
      } else if (state === 'calm') {
        direction.set(Math.sin(t * 0.42), 0, Math.cos(t * 0.37 + dog.userData.offset));
        desiredSpeed = 0.35;
      } else if (state === 'alert' || state === 'territorial') {
        const targetYaw = Math.atan2(
          this.player.position.x - dog.position.x,
          this.player.position.z - dog.position.z
        );
        const angleDiff = THREE.MathUtils.euclideanModulo(targetYaw - dog.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
        dog.rotation.y += angleDiff * (1 - Math.exp(-5 * delta));
      } else if (pursuing) {
        const goalNode = this.nearestNavigationNode(this.player.position);
        dog.userData.pathTimer = Math.max(0, dog.userData.pathTimer - delta);
        if (dog.userData.pathTimer === 0 || goalNode !== dog.userData.pathTarget) {
          dog.userData.path = this.findDogPath(dog.position, this.player.position);
          dog.userData.pathTarget = goalNode;
          dog.userData.pathTimer = 0.6;
        }
        while (dog.userData.path.length > 0
          && dog.position.distanceTo(dog.userData.path[0]) < 0.8) {
          dog.userData.path.shift();
        }
        const waypoint = dog.userData.path[0] || this.player.position;
        direction.copy(waypoint).sub(dog.position).setY(0);
        desiredSpeed = dog.userData.chaseSpeed * (state === 'attack' ? 1.12 : 1);
      } else if (state === 'exhausted') {
        direction.copy(dog.position).sub(this.player.position).setY(0);
        desiredSpeed = 1.25;
      }

      if (this.foodTrail && !pursuing && !nearStonePulse
        && Math.hypot(dog.position.x - this.foodTrail.position.x, dog.position.z - this.foodTrail.position.z) < 7) {
        direction.copy(this.foodTrail.position).sub(dog.position).setY(0);
        desiredSpeed = 1.5;
      }

      this.moveDog(dog, direction, desiredSpeed, delta);
      dog.userData.gaitPhase += delta * (4 + dog.userData.moveSpeed * 3);
      const moving = dog.userData.moveSpeed > 0.15;
      dog.position.y = dog.userData.baseY + (
        moving
          ? Math.abs(Math.sin(dog.userData.gaitPhase * 2)) * 0.05
          : Math.sin(t * 1.5) * 0.012
      );

      const moodColor = state === 'calm' ? dog.userData.baseColor : DOG_STATE_COLORS[state];
      const colorBlend = 1 - Math.exp(-7 * delta);
      dog.userData.bodyMaterial.color.lerp(moodColor, colorBlend);
      dog.userData.headMaterial.color.lerp(moodColor, colorBlend);

      const stride = moving ? Math.min(0.42, dog.userData.moveSpeed * 0.055) : 0.025;
      dog.userData.legs.forEach((leg, legIndex) => {
        const phase = dog.userData.gaitPhase + (legIndex % 2) * Math.PI;
        leg.rotation.x = Math.sin(phase) * stride;
        leg.position.y = leg.userData.baseY + (moving ? Math.max(0, Math.sin(phase)) * 0.015 : 0);
      });
      dog.userData.headParts.forEach((head) => {
        const alertTilt = state === 'alert' ? -0.08 : (state === 'attack' ? 0.12 : 0);
        head.rotation.x = head.userData.baseRotationX + alertTilt
          + (moving ? Math.sin(dog.userData.gaitPhase * 2) * 0.035 : 0);
      });
      dog.userData.tail.rotation.x = Math.sin(t * (state === 'calm' ? 3.2 : 1.2))
        * (state === 'calm' ? 0.2 : 0.06);
    });

    this.resolveDogCollisions(delta);
    this.updateGrappleUI();
    this.updateStaminaUI();
    this.updateObjectiveUI();
    this.routeMarkers.forEach((marker) => {
      marker.rotation.y += delta * (marker.userData.active ? 0.45 : 0.18);
    });
  }

  updateCamera() {
    this.camera.position.copy(this.player.position);
    const horizontalSpeed = Math.hypot(this.player.velocity.x, this.player.velocity.z);
    const bobAmount = Math.min(1, horizontalSpeed / this.player.speed);
    this.camera.position.y += Math.abs(Math.sin(this.player.gaitPhase * 2)) * 0.045 * bobAmount;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch;
    const targetFov = this.player.sprinting ? 78 : 72;
    if (Math.abs(targetFov - this.camera.fov) > 0.05) {
      this.camera.fov += (targetFov - this.camera.fov) * 0.1;
      this.camera.updateProjectionMatrix();
    } else if (this.camera.fov !== targetFov) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
  }

  updatePickups(delta) {
    this.pickupMessageTimer = Math.max(0, this.pickupMessageTimer - delta);
    this.pickups.forEach((pickup) => {
      if (!pickup.active) return;
      pickup.mesh.rotation.y += delta * 0.55;
      pickup.mesh.position.y = Math.sin(performance.now() * 0.002 + pickup.offset) * 0.06;
      if (this.player.perch) return;

      const distance = Math.hypot(
        this.player.position.x - pickup.x,
        this.player.position.z - pickup.z
      );
      if (distance > 1.05) return;

      pickup.active = false;
      pickup.mesh.visible = false;
      this.inventory[pickup.type] += 1;
      this.pickupMessage = pickup.type === 'bottle' ? 'Botella recogida' : 'Rama recogida';
      this.pickupMessageTimer = 1.8;
      this.updateToolUI();
      this.updateStaminaUI();
    });
  }

  animate() {
    const delta = Math.min(this.clock.getDelta(), 0.05);

    if (this.started && !this.menuOpen && !this.ended) {
      this.updatePlayer(delta);
      this.updateProjectiles(delta);
      this.updateDogs(delta);
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }
}
