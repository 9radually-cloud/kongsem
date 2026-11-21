import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const WORLD = { width: 7.2, depth: 4.5, radius: 0.13, gravity: 9.81, goal: new THREE.Vector3(3.03, 0.2, 0) };
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class Machine3D {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#eef2f5');
    this.scene.fog = new THREE.Fog('#eef2f5', 12, 25);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
    this.camera.position.set(7.4, 6.2, 8.2);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.domElement.className = 'machine-three-canvas';
    this.renderer.domElement.setAttribute('aria-label', '3D 구슬 장치 제작판. 드래그하면 카메라가 돌고, 도구를 고른 뒤 빈 곳을 눌러 부품을 놓아요.');
    container.replaceChildren(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.75, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.minDistance = 4.8;
    this.controls.maxDistance = 14;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.addEventListener('change', () => this.render());
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.partGroups = new Map();
    this.parts = [];
    this.selectedId = null;
    this.running = false;
    this.staticColliders = [];
    this.ballMesh = null;
    this._createLights();
    this._createBoard();
    this._createMarkers();
    this._createBall();
    this._resizeObserver = new ResizeObserver(() => this.resize());
    this._resizeObserver.observe(container);
    this.resize();
    this.render();
  }

  _material(color, roughness = 0.72, metalness = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }

  _addBox(parent, size, color, position = [0, 0, 0], options = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), this._material(color, options.roughness ?? 0.72, options.metalness ?? 0));
    mesh.position.set(...position);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    parent.add(mesh);
    return mesh;
  }

  _createLights() {
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#b7c0cd', 2.05));
    const key = new THREE.DirectionalLight('#fff3dc', 3.1);
    key.position.set(-4, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -7;
    key.shadow.camera.right = 7;
    key.shadow.camera.top = 7;
    key.shadow.camera.bottom = -7;
    key.shadow.bias = -0.0002;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight('#e4efdc', 1.1);
    fill.position.set(5, 4, -5);
    this.scene.add(fill);
  }

  _createBoard() {
    const floor = this._addBox(this.scene, [WORLD.width, 0.12, WORLD.depth], '#f8f8f3', [0, -0.09, 0], { roughness: 0.95 });
    floor.userData.noPick = true;
    const gridPoints = [];
    const spacing = 0.3;
    for (let x = -WORLD.width / 2; x <= WORLD.width / 2 + 0.001; x += spacing) {
      gridPoints.push(x, 0.002, -WORLD.depth / 2, x, 0.002, WORLD.depth / 2);
    }
    for (let z = -WORLD.depth / 2; z <= WORLD.depth / 2 + 0.001; z += spacing) {
      gridPoints.push(-WORLD.width / 2, 0.002, z, WORLD.width / 2, 0.002, z);
    }
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPoints, 3));
    const grid = new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: '#cedac8', transparent: true, opacity: 0.78 }));
    grid.userData.noPick = true;
    this.scene.add(grid);
    const rails = [
      this._addBox(this.scene, [WORLD.width, 0.12, 0.06], '#bfd0b4', [0, 0.035, -WORLD.depth / 2 + 0.03]),
      this._addBox(this.scene, [WORLD.width, 0.12, 0.06], '#bfd0b4', [0, 0.035, WORLD.depth / 2 - 0.03]),
      this._addBox(this.scene, [0.06, 0.12, WORLD.depth], '#bfd0b4', [-WORLD.width / 2 + 0.03, 0.035, 0]),
      this._addBox(this.scene, [0.06, 0.12, WORLD.depth], '#bfd0b4', [WORLD.width / 2 - 0.03, 0.035, 0]),
    ];
    rails.forEach((rail) => { rail.castShadow = false; rail.userData.noPick = true; });
    this.staticColliders = [{
      center: new THREE.Vector3(-3.04, 1.19, 0),
      half: new THREE.Vector3(0.42, 0.09, 0.42),
      quaternion: new THREE.Quaternion(),
      type: 'block',
      surface: 'start',
    }];
    const startPad = this._addBox(this.scene, [0.84, 0.18, 0.84], '#e8d8bb', [-3.04, 1.19, 0]);
    startPad.material.color.set('#e8d8bb');
    startPad.userData.noPick = true;
    startPad.castShadow = true;
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(floor.geometry), new THREE.LineBasicMaterial({ color: '#8da17e', transparent: true, opacity: 0.7 }));
    edge.position.copy(floor.position);
    this.scene.add(edge);
  }

  _label(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(255,255,255,.92)';
    context.beginPath();
    context.roundRect(7, 7, 242, 66, 18);
    context.fill();
    context.fillStyle = color;
    context.font = '700 34px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 40);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(1.1, 0.34, 1);
    sprite.userData.noPick = true;
    return sprite;
  }

  _createMarkers() {
    const start = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), this._material('#b44d52', 0.32, 0.05));
    start.position.set(-3.04, 1.48, 0);
    start.castShadow = true;
    start.userData.noPick = true;
    this.scene.add(start);
    const startLabel = this._label('출발', '#9d4249');
    startLabel.position.set(-3.02, 1.9, 0);
    this.scene.add(startLabel);

    const goalBase = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.1, 32), this._material('#dbe9cf'));
    goalBase.position.copy(WORLD.goal);
    goalBase.position.y = 0.055;
    goalBase.userData.noPick = true;
    goalBase.receiveShadow = true;
    this.scene.add(goalBase);
    const goalRing = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.055, 12, 36), this._material('#658959', 0.35));
    goalRing.rotation.x = Math.PI / 2;
    goalRing.position.copy(WORLD.goal);
    goalRing.position.y = 0.13;
    goalRing.userData.noPick = true;
    this.scene.add(goalRing);
    const goalLabel = this._label('도착', '#527448');
    goalLabel.position.set(WORLD.goal.x, 0.72, WORLD.goal.z);
    this.scene.add(goalLabel);
  }

  _createBall() {
    const group = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(WORLD.radius, 28, 20), this._material('#b44d52', 0.3, 0.04));
    ball.castShadow = true;
    group.add(ball);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(WORLD.radius * 0.72, 0.012, 8, 32), this._material('#ffe5c9', 0.45));
    stripe.scale.set(0.52, 1, 1);
    group.add(stripe);
    const seam = new THREE.Mesh(new THREE.TorusGeometry(WORLD.radius * 0.72, 0.01, 8, 32), this._material('#ffe5c9', 0.45));
    seam.rotation.y = Math.PI / 2;
    seam.scale.set(0.52, 1, 1);
    group.add(seam);
    group.userData.noPick = true;
    this.ballMesh = group;
    this.scene.add(group);
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, Math.round(width * 5 / 8));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.render();
  }

  resetCamera() {
    this.camera.position.set(7.4, 6.2, 8.2);
    this.controls.target.set(0, 0.75, 0);
    this.controls.update();
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  _newPartGroup(part) {
    const group = new THREE.Group();
    group.userData.partId = part.id;
    const mesh = (geometry, color, position = [0, 0, 0], materialOptions = {}) => {
      const value = new THREE.Mesh(geometry, this._material(color, materialOptions.roughness ?? 0.66, materialOptions.metalness ?? 0));
      value.position.set(...position);
      value.castShadow = true;
      value.receiveShadow = true;
      value.userData.partId = part.id;
      group.add(value);
      return value;
    };
    const edgeMesh = (target, color = '#485c79', parent = group) => {
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(target.geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }));
      edges.position.copy(target.position);
      edges.scale.copy(target.scale);
      edges.userData.noPick = true;
      parent.add(edges);
    };
    const unitBox = (color, position = [0, 0, 0], options = {}) => {
      const target = mesh(new THREE.BoxGeometry(1, 1, 1), color, position, options);
      this._sizePartMesh(target, part, options.component || 'body');
      edgeMesh(target);
      return target;
    };
    if (part.type === 'ramp') {
      unitBox('#a9c495');
    } else if (part.type === 'block') {
      unitBox('#d7b783');
    } else if (part.type === 'turntable') {
      mesh(new THREE.CylinderGeometry(0.47, 0.5, 0.15, 32), '#b8ca9f', [0, 0.09, 0]);
      const axle = mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.16, 20), '#708d5c', [0, 0.23, 0]);
      axle.castShadow = false;
      const rotor = new THREE.Group();
      rotor.position.y = 0.24;
      rotor.userData.machineRotor = true;
      group.add(rotor);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this._material('#799957', 0.45, 0.04));
      this._sizePartMesh(top, part, 'body');
      top.position.y = 0.08;
      top.castShadow = true;
      top.receiveShadow = true;
      top.userData.partId = part.id;
      rotor.add(top);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.015, 0.045), this._material('#f1e5bd', 0.5));
      stripe.position.y = 0.08;
      stripe.castShadow = false;
      stripe.userData.partId = part.id;
      rotor.add(stripe);
      edgeMesh(top, '#42673f', rotor);
    } else if (part.type === 'lever') {
      const fulcrum = mesh(new THREE.ConeGeometry(0.22, 0.42, 3), '#7e8ca3', [0, -0.22, 0]);
      fulcrum.rotation.y = Math.PI;
      const beamGroup = new THREE.Group();
      beamGroup.userData.machineLever = true;
      group.add(beamGroup);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this._material('#d6a56e', 0.58));
      this._sizePartMesh(beam, part, 'body');
      beam.position.y = 0.04;
      beam.castShadow = true;
      beam.receiveShadow = true;
      beam.userData.partId = part.id;
      beamGroup.add(beam);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(beam.geometry), new THREE.LineBasicMaterial({ color: '#745937', transparent: true, opacity: 0.65 }));
      edges.position.copy(beam.position);
      edges.scale.copy(beam.scale);
      edges.userData.noPick = true;
      beamGroup.add(edges);
      mesh(new THREE.SphereGeometry(0.065, 14, 10), '#7e8ca3', [0, 0.035, 0]);
    }
    return group;
  }

  _sizePartMesh(mesh, part) {
    mesh.scale.set(part.width, part.height, part.depth);
  }

  sync(parts, selectedId, ball) {
    this.parts = parts;
    this.selectedId = selectedId;
    const liveIds = new Set(parts.map((part) => part.id));
    for (const [id, group] of this.partGroups) {
      if (!liveIds.has(id)) {
        this.scene.remove(group);
        group.traverse((child) => {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
          else child.material?.dispose();
        });
        this.partGroups.delete(id);
      }
    }
    parts.forEach((part) => {
      let group = this.partGroups.get(part.id);
      const geometryKey = `${part.type}:${part.width}:${part.height}:${part.depth}`;
      if (!group || group.userData.geometryKey !== geometryKey) {
        if (group) {
          this.scene.remove(group);
          group.traverse((child) => {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
            else child.material?.dispose();
          });
        }
        group = this._newPartGroup(part);
        group.userData.type = part.type;
        group.userData.geometryKey = geometryKey;
        this.scene.add(group);
        this.partGroups.set(part.id, group);
      }
      group.position.set(part.x, part.y, part.z);
      group.rotation.order = 'YXZ';
      group.rotation.set(0, (part.yaw || 0) * Math.PI / 180, part.type === 'lever' ? 0 : part.angle * Math.PI / 180);
      const rotor = group.children.find((child) => child.userData.machineRotor);
      if (rotor) rotor.rotation.y = part.phase || 0;
      const leverBeam = group.children.find((child) => child.userData.machineLever);
      if (leverBeam) leverBeam.rotation.z = (part.angle + (part.phase || 0)) * Math.PI / 180;
      group.traverse((child) => {
        if (child.userData.partId !== part.id || !child.material?.emissive) return;
        child.material.emissive.setHex(part.id === selectedId ? 0x284c34 : 0x000000);
        child.material.emissiveIntensity = part.id === selectedId ? 0.13 : 0;
      });
    });
    this.ballMesh.position.set(ball.x, ball.y, ball.z);
    this.ballMesh.rotation.set(ball.rotationX || 0, ball.spin || 0, ball.rotation || 0);
    this.render();
  }

  _pointerRay(event) {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.ray;
  }

  pointOnPlane(event, height = 0) {
    const ray = this._pointerRay(event);
    const target = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -height);
    if (!ray.intersectPlane(plane, target)) return null;
    return { x: target.x, y: height, z: target.z };
  }

  hitPart(event) {
    this._pointerRay(event);
    const meshes = [...this.partGroups.values()];
    const intersection = this.raycaster.intersectObjects(meshes, true).find((hit) => hit.object.userData.partId && !hit.object.userData.noPick);
    if (!intersection) return null;
    const id = intersection.object.userData.partId;
    return this.parts.find((part) => part.id === id) || null;
  }

  _partQuaternion(part) {
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (part.yaw || 0) * Math.PI / 180, (part.type === 'lever' ? part.angle + (part.phase || 0) : part.angle) * Math.PI / 180, 'YXZ'));
    if (part.type === 'turntable') quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), part.phase || 0));
    return quaternion;
  }

  _colliders(parts) {
    return [
      ...this.staticColliders,
      ...parts.map((part) => ({
        part,
        type: part.type,
        center: new THREE.Vector3(part.x, part.y + (part.type === 'turntable' ? 0.32 : 0), part.z),
        half: new THREE.Vector3(part.width / 2, part.height / 2, part.depth / 2),
        quaternion: this._partQuaternion(part),
      })),
    ];
  }

  _collideSphereBox(ball, collider, dt) {
    const inverse = collider.quaternion.clone().invert();
    const local = new THREE.Vector3(ball.x, ball.y, ball.z).sub(collider.center).applyQuaternion(inverse);
    const closest = new THREE.Vector3(
      clamp(local.x, -collider.half.x, collider.half.x),
      clamp(local.y, -collider.half.y, collider.half.y),
      clamp(local.z, -collider.half.z, collider.half.z),
    );
    let normalLocal = local.clone().sub(closest);
    let distance = normalLocal.length();
    if (distance >= WORLD.radius) return false;
    if (distance < 1e-5) {
      const gaps = [collider.half.x - Math.abs(local.x), collider.half.y - Math.abs(local.y), collider.half.z - Math.abs(local.z)];
      const axis = gaps.indexOf(Math.min(...gaps));
      normalLocal.set(0, 0, 0);
      normalLocal.setComponent(axis, local.getComponent(axis) >= 0 ? 1 : -1);
      distance = -gaps[axis];
    }
    const normal = normalLocal.normalize().applyQuaternion(collider.quaternion).normalize();
    const penetration = WORLD.radius - distance;
    ball.x += normal.x * penetration;
    ball.y += normal.y * penetration;
    ball.z += normal.z * penetration;

    const relativePosition = new THREE.Vector3(ball.x, ball.y, ball.z).sub(collider.center);
    let omega = new THREE.Vector3();
    if (collider.type === 'turntable' && collider.part) omega.set(0, collider.part.speed, 0).applyQuaternion(collider.quaternion);
    if (collider.type === 'lever' && collider.part) omega.set(0, 0, collider.part.leverOmega).applyQuaternion(collider.quaternion);
    const surfaceVelocity = omega.cross(relativePosition);
    const velocity = new THREE.Vector3(ball.vx, ball.vy, ball.vz);
    const relativeVelocity = velocity.sub(surfaceVelocity);
    const normalVelocity = relativeVelocity.dot(normal);
    if (normalVelocity >= 0) return true;
    const restitution = collider.type === 'block' ? 0.28 : collider.type === 'ramp' ? 0.03 : 0.12;
    const ballMass = 0.045;
    let deltaVelocity = -(1 + restitution) * normalVelocity;
    if (collider.type === 'lever' && collider.part) {
      const arm = new THREE.Vector3().subVectors(new THREE.Vector3(ball.x, ball.y, ball.z), collider.center);
      const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(collider.quaternion);
      const torqueArm = arm.clone().cross(normal).dot(axis);
      const inertia = Math.max(0.06, collider.part.width * collider.part.width * 0.18 / 12);
      const impulse = -(1 + restitution) * normalVelocity / (1 / ballMass + torqueArm * torqueArm / inertia);
      deltaVelocity = impulse / ballMass;
      collider.part.leverOmega = clamp(collider.part.leverOmega - impulse * torqueArm / inertia, -5, 5);
    }
    relativeVelocity.addScaledVector(normal, deltaVelocity);
    const normalPart = normal.clone().multiplyScalar(relativeVelocity.dot(normal));
    const tangent = relativeVelocity.sub(normalPart);
    const friction = collider.type === 'ramp' ? 0.035 : 0.11;
    relativeVelocity.addScaledVector(tangent, -Math.min(friction, dt * 1.4));
    const resultVelocity = relativeVelocity.add(surfaceVelocity);
    ball.vx = resultVelocity.x;
    ball.vy = resultVelocity.y;
    ball.vz = resultVelocity.z;
    return true;
  }

  step(ball, parts, dt) {
    parts.forEach((part) => {
      if (part.type === 'turntable') part.phase = (part.phase || 0) + part.speed * dt;
      if (part.type === 'lever') {
        part.phase = clamp((part.phase || 0) + part.leverOmega * dt, -0.72, 0.72);
        part.leverOmega *= Math.exp(-1.15 * dt);
        if (Math.abs(part.leverOmega) < 0.015) part.leverOmega = 0;
      }
    });
    ball.vy -= WORLD.gravity * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.z += ball.vz * dt;
    ball.rotation = (ball.rotation || 0) + Math.hypot(ball.vx, ball.vz) / WORLD.radius * dt;
    ball.rotationX = (ball.rotationX || 0) + ball.vz / WORLD.radius * dt;
    const colliders = this._colliders(parts);
    colliders.forEach((collider) => this._collideSphereBox(ball, collider, dt));

    if (ball.y < WORLD.radius) {
      ball.y = WORLD.radius;
      if (ball.vy < 0) ball.vy = -ball.vy * 0.12;
      const rollingDrag = Math.exp(-0.34 * dt);
      ball.vx *= rollingDrag;
      ball.vz *= rollingDrag;
      if (Math.abs(ball.vy) < 0.18) ball.vy = 0;
    }
    const xLimit = WORLD.width / 2 - WORLD.radius;
    const zLimit = WORLD.depth / 2 - WORLD.radius;
    if (ball.x < -xLimit) { ball.x = -xLimit; ball.vx = Math.abs(ball.vx) * 0.3; }
    if (ball.x > xLimit) { ball.x = xLimit; ball.vx = -Math.abs(ball.vx) * 0.3; }
    if (ball.z < -zLimit) { ball.z = -zLimit; ball.vz = Math.abs(ball.vz) * 0.3; }
    if (ball.z > zLimit) { ball.z = zLimit; ball.vz = -Math.abs(ball.vz) * 0.3; }

    const goalDistance = Math.hypot(ball.x - WORLD.goal.x, ball.y - WORLD.goal.y, ball.z - WORLD.goal.z);
    if (goalDistance < 0.39 && ball.y < 0.55) return 'won';
    if (Math.hypot(ball.vx, ball.vy, ball.vz) < 0.13) return 'settled';
    if (ball.y > WORLD.height) return 'lost';
    return '';
  }

  dispose() {
    this._resizeObserver?.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    for (const group of this.partGroups.values()) {
      group.traverse((child) => {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
        else child.material?.dispose();
      });
    }
    this.partGroups.clear();
  }
}
