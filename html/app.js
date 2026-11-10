/**
 * Visualizador de Body Pose da SkillCorner.
 *
 * Como ler este arquivo:
 * 1. prepara o estado, as cores, a cena 3D e a câmera;
 * 2. desenha o campo: linhas, gols e gramado;
 * 3. cria os marcadores dos jogadores e extrai a pose e a direção do olhar;
 * 4. posiciona a câmera e redesenha cada quadro do lance;
 * 5. monta a biblioteca de chutes e carrega o lance escolhido;
 * 6. controla a reprodução, o redimensionamento e o laço de renderização;
 * 7. inicia a introdução e o visualizador.
 *
 * Os dados vêm de html/data/manifest.json e html/data/clips/, gerados pelo
 * notebook 00. O estádio é construído por html/stadium.js.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildStadium } from "./stadium.js";

// 1. Estado, cores, cena e câmera
// Eixos: o campo é o plano x–z; a altura (y no Three.js) vem de z nos dados de pose.
const $ = (selector) => document.querySelector(selector),
  state = {
    manifest: null,
    clip: null,
    selected: null,
    match: "all",
    index: 0,
    playing: false,
    speed: 1,
    last: performance.now(),
    accumulator: 0,
    gaze: null,
    goalBall: null,
  };
const COLORS = {
    home: 0x3559e8,
    away: 0xe75438,
    unknown: 0x777871,
    shooter: 0xffd000,
    ball: 0x7b4ce2,
  },
  canvas = $("#scene"),
  povCanvas = $("#povScene"),
  scene = new THREE.Scene();
scene.background = new THREE.Color(0xd9ded6);
scene.fog = new THREE.Fog(0xd9ded6, 180, 410);
const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 480),
  povCamera = new THREE.PerspectiveCamera(84, 16 / 9, 0.04, 320),
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  }),
  povRenderer = new THREE.WebGLRenderer({
    canvas: povCanvas,
    antialias: false,
    powerPreference: "high-performance",
  });
// Resolução: cheia quando a imagem está parada e reduzida enquanto a câmera é arrastada.
const BASE_PIXEL_RATIO = Math.min(devicePixelRatio, 1.5),
  MOVING_PIXEL_RATIO = Math.min(devicePixelRatio, 1);
renderer.setPixelRatio(BASE_PIXEL_RATIO);
povRenderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
for (const output of [renderer, povRenderer])
  output.outputColorSpace = THREE.SRGBColorSpace;
// Sem sombras: elas custavam uma passagem extra de renderização e quase não apareciam.
// Só redesenhamos quando algo muda (câmera, quadro ou tamanho).
let needsRender = true,
  needsPovRender = true;
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 6;
controls.maxDistance = 285;
controls.maxPolarAngle = Math.PI / 2.02;
// Enquanto a câmera é arrastada, a resolução cai para 1× e volta ao normal ao soltar.
let qualityTimer = null;
function setMoving(moving) {
  clearTimeout(qualityTimer);
  const apply = () => {
    const ratio = moving ? MOVING_PIXEL_RATIO : BASE_PIXEL_RATIO;
    if (renderer.getPixelRatio() === ratio) return;
    renderer.setPixelRatio(ratio);
    resize();
  };
  // Ao soltar, espera a inércia da câmera acabar antes de voltar à resolução cheia.
  if (moving) apply();
  else qualityTimer = setTimeout(apply, 450);
}
controls.addEventListener("start", () => setMoving(true));
controls.addEventListener("end", () => setMoving(false));
controls.addEventListener("change", () => (needsRender = true));
scene.add(new THREE.HemisphereLight(0xffffff, 0x80917d, 2.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.1);
sun.position.set(-25, 55, 35);
scene.add(sun);
const pitch = new THREE.Group(),
  visionLayer = new THREE.Group(),
  actors = new THREE.Group();
scene.add(pitch, visionLayer, actors);
const fieldPoint = (x, y, z = 0) => new THREE.Vector3(x, z, y),
  posePoint = (flat) => new THREE.Vector3(flat[0], flat[2], flat[1]);
const cameraRig = {
  position: new THREE.Vector3(-7, 46, 61),
  target: new THREE.Vector3(),
  desiredPosition: new THREE.Vector3(-7, 46, 61),
  desiredTarget: new THREE.Vector3(),
  ready: false,
};
camera.position.copy(cameraRig.position);

// 2. Campo: linhas, gols e gramado
/** Linha contínua sobre o campo. */
function line(points, color = 0xf7faf5, parent = pitch, opacity = 0.96) {
  const object = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
  );
  parent.add(object);
  return object;
}
/** Conjunto de segmentos independentes (usado nas redes dos gols). */
function lineSegments(
  points,
  color = 0xffffff,
  parent = pitch,
  opacity = 0.92,
) {
  const object = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: false,
    }),
  );
  parent.add(object);
  return object;
}
/** Retângulo de linhas no plano do campo. */
function rectangle(x1, z1, x2, z2) {
  line([
    fieldPoint(x1, z1, 0.025),
    fieldPoint(x2, z1, 0.025),
    fieldPoint(x2, z2, 0.025),
    fieldPoint(x1, z2, 0.025),
    fieldPoint(x1, z1, 0.025),
  ]);
}
/** Arco de circunferência no plano do campo. */
function arc(cx, cz, r, start, end, segments = 64) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const angle = start + ((end - start) * i) / segments;
    points.push(
      fieldPoint(cx + Math.cos(angle) * r, cz + Math.sin(angle) * r, 0.03),
    );
  }
  line(points);
}
/** Gol (traves, travessão e rede) no lado indicado pelo sinal (-1 ou 1). */
function addGoal(sign) {
  const goalLine = sign * 52.5,
    backLine = sign * 54.7,
    halfWidth = 3.66,
    crossbarHeight = 2.44,
    backHeight = 2.05;
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0xfaf9f3,
    roughness: 0.42,
    metalness: 0.08,
  });
  for (const z of [-halfWidth, halfWidth]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, crossbarHeight, 14),
      frameMaterial,
    );
    post.position.set(goalLine, crossbarHeight / 2, z);
    pitch.add(post);
  }
  const crossbar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, halfWidth * 2, 14),
    frameMaterial,
  );
  crossbar.rotation.x = Math.PI / 2;
  crossbar.position.set(goalLine, crossbarHeight, 0);
  pitch.add(crossbar);
  const net = [];
  for (let z = -halfWidth; z <= halfWidth + 0.01; z += 0.61)
    net.push(
      new THREE.Vector3(backLine, 0.03, z),
      new THREE.Vector3(backLine, backHeight, z),
    );
  for (let y = 0.03; y <= backHeight + 0.01; y += 0.34)
    net.push(
      new THREE.Vector3(backLine, y, -halfWidth),
      new THREE.Vector3(backLine, y, halfWidth),
    );
  for (let z = -halfWidth; z <= halfWidth + 0.01; z += 0.61)
    net.push(
      new THREE.Vector3(goalLine, crossbarHeight, z),
      new THREE.Vector3(backLine, backHeight, z),
    );
  for (let step = 0; step <= 5; step++) {
    const t = step / 5,
      x = THREE.MathUtils.lerp(goalLine, backLine, t),
      y = THREE.MathUtils.lerp(crossbarHeight, backHeight, t);
    net.push(
      new THREE.Vector3(x, y, -halfWidth),
      new THREE.Vector3(x, y, halfWidth),
    );
  }
  for (const z of [-halfWidth, halfWidth]) {
    for (let step = 0; step <= 5; step++) {
      const t = step / 5,
        x = THREE.MathUtils.lerp(goalLine, backLine, t),
        top = THREE.MathUtils.lerp(crossbarHeight, backHeight, t);
      net.push(new THREE.Vector3(x, 0.03, z), new THREE.Vector3(x, top, z));
    }
    for (let level = 0; level <= 6; level++) {
      const fraction = level / 6;
      net.push(
        new THREE.Vector3(goalLine, crossbarHeight * fraction, z),
        new THREE.Vector3(backLine, backHeight * fraction, z),
      );
    }
  }
  lineSegments(net, 0xf7faf5, pitch, 0.92);
}
/** Gramado listrado e todas as marcações do campo (105 × 68 m). */
function buildPitch() {
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(121, 82),
    new THREE.MeshStandardMaterial({ color: 0x347745, roughness: 1 }),
  );
  apron.rotation.x = -Math.PI / 2;
  pitch.add(apron);
  for (let i = 0; i < 14; i++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(105 / 14, 68),
      new THREE.MeshStandardMaterial({
        color: i % 2 ? 0x4fa65e : 0x3f914f,
        roughness: 1,
      }),
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(-52.5 + 105 / 28 + (i * 105) / 14, 0.012, 0);
    pitch.add(stripe);
  }
  rectangle(-52.5, -34, 52.5, 34);
  line([fieldPoint(0, -34, 0.03), fieldPoint(0, 34, 0.03)]);
  arc(0, 0, 9.15, 0, Math.PI * 2);
  const penaltyArcHalfAngle = Math.acos((16.5 - 11) / 9.15);
  for (const goalLine of [-52.5, 52.5]) {
    const sign = Math.sign(goalLine),
      spotX = goalLine - sign * 11;
    rectangle(goalLine, -20.16, goalLine - sign * 16.5, 20.16);
    rectangle(goalLine, -9.16, goalLine - sign * 5.5, 9.16);
    if (sign < 0)
      arc(spotX, 0, 9.15, -penaltyArcHalfAngle, penaltyArcHalfAngle);
    else
      arc(
        spotX,
        0,
        9.15,
        Math.PI - penaltyArcHalfAngle,
        Math.PI + penaltyArcHalfAngle,
      );
    const spot = new THREE.Mesh(
      new THREE.CircleGeometry(0.13, 18),
      new THREE.MeshBasicMaterial({ color: 0xf7faf5 }),
    );
    spot.rotation.x = -Math.PI / 2;
    spot.position.copy(fieldPoint(spotX, 0, 0.035));
    pitch.add(spot);
    addGoal(sign);
  }
  for (const [x, z, start] of [
    [-52.5, -34, 0],
    [-52.5, 34, -Math.PI / 2],
    [52.5, -34, Math.PI / 2],
    [52.5, 34, Math.PI],
  ])
    arc(x, z, 1, start, start + Math.PI / 2, 20);
  const center = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 18),
    new THREE.MeshBasicMaterial({ color: 0xf7faf5 }),
  );
  center.rotation.x = -Math.PI / 2;
  center.position.y = 0.035;
  pitch.add(center);
}

// 3. Marcadores dos jogadores e pose
const labelTextures = new Map();
/** Textura com o número da camisa, em círculo com a cor do time; guardada em cache. */
function labelTexture(number, color) {
  const key = `${number}-${color}`,
    cached = labelTextures.get(key);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  g.beginPath();
  g.arc(64, 64, 47, 0, Math.PI * 2);
  g.fillStyle = "#fbfaf6";
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = `#${color.toString(16).padStart(6, "0")}`;
  g.stroke();
  g.fillStyle = "#181a18";
  g.font = "700 47px Instrument Sans, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(number ?? "—"), 64, 67);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  labelTextures.set(key, texture);
  return texture;
}
/** Cor do time: 0 = mandante, 1 = visitante, outro valor = desconhecido. */
function teamColor(team) {
  return team === 0 ? COLORS.home : team === 1 ? COLORS.away : COLORS.unknown;
}
/** Ponto 3D de uma articulação, ou null se faltar alguma coordenada. */
function point(flat, index) {
  if (!flat) return null;
  const xyz = flat.slice(index * 3, index * 3 + 3);
  return xyz.every(Number.isFinite) ? posePoint(xyz) : null;
}
/** Origem e direção do olhar, calculadas pelos olhos, nariz e pescoço. */
function gazeFromPose(flat) {
  if (!flat) return null;
  const names = state.manifest.joints,
    index = (name) => names.indexOf(name),
    nose = point(flat, index("nose")),
    neck = point(flat, index("neck")),
    left = point(flat, index("lEye")),
    right = point(flat, index("rEye"));
  if (!nose || !neck || !left || !right) return null;
  const origin = left.clone().add(right).multiplyScalar(0.5),
    lateral = left.clone().sub(right),
    vertical = neck.clone().sub(origin),
    direction = lateral.cross(vertical).normalize(),
    hint = nose.clone().sub(origin);
  if (direction.dot(hint) < 0) direction.multiplyScalar(-1);
  return { origin, direction };
}
/**
 * Objetos 3D de cada jogador, criados uma única vez e atualizados a cada quadro.
 * Reaproveitá-los evita alocar e liberar geometrias e materiais 25 vezes por segundo.
 */
const actorPool = new Map(),
  markerGeometry = new THREE.CircleGeometry(1, 24),
  ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 18, 12),
    new THREE.MeshStandardMaterial({ color: COLORS.ball, roughness: 0.35 }),
  ),
  VISION_STEPS = 32,
  visionGeometry = new THREE.BufferGeometry(),
  visionMesh = new THREE.Mesh(
    visionGeometry,
    new THREE.MeshBasicMaterial({
      color: COLORS.shooter,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  ),
  UP = new THREE.Vector3(0, 1, 0),
  visionRay = new THREE.Vector3();
let frameTick = 0;
ballMesh.visible = false;
actors.add(ballMesh);
// O cone de visão é um leque fixo de 34 vértices: só as posições mudam.
visionGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(new Float32Array((VISION_STEPS + 2) * 3), 3),
);
const visionIndices = [];
for (let step = 0; step < VISION_STEPS; step++)
  visionIndices.push(0, step + 1, step + 2);
visionGeometry.setIndex(visionIndices);
visionMesh.renderOrder = 2;
visionMesh.frustumCulled = false;
visionMesh.visible = false;
visionLayer.add(visionMesh);

/** Cria pontos, ossos, marcador no chão e número de um jogador. */
function createActor() {
  const jointTotal = state.manifest.joints.length,
    boneTotal = state.manifest.bones.length,
    dynamic = (count) =>
      new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    pointsGeometry = new THREE.BufferGeometry(),
    linesGeometry = new THREE.BufferGeometry();
  pointsGeometry.setAttribute("position", dynamic(jointTotal));
  linesGeometry.setAttribute("position", dynamic(boneTotal * 2));
  const points = new THREE.Points(
      pointsGeometry,
      new THREE.PointsMaterial({ size: 0.115, sizeAttenuation: true }),
    ),
    lines = new THREE.LineSegments(
      linesGeometry,
      new THREE.LineBasicMaterial({ transparent: true, opacity: 0.96 }),
    ),
    marker = new THREE.Mesh(
      markerGeometry,
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    ),
    label = new THREE.Sprite(
      new THREE.SpriteMaterial({ transparent: true, depthTest: false }),
    ),
    group = new THREE.Group();
  points.frustumCulled = lines.frustumCulled = false;
  marker.rotation.x = -Math.PI / 2;
  label.scale.set(0.82, 0.82, 1);
  label.renderOrder = 20;
  group.add(points, lines, marker, label);
  actors.add(group);
  return {
    group,
    points,
    lines,
    marker,
    label,
    color: null,
    labelKey: null,
    tick: 0,
  };
}

/** Escreve a pose do jogador nos buffers: só entram articulações e ossos completos. */
function updatePose(actor, flat) {
  const joints = state.manifest.joints.length,
    bones = state.manifest.bones,
    pointBuffer = actor.points.geometry.attributes.position,
    lineBuffer = actor.lines.geometry.attributes.position,
    valid = actor.valid || (actor.valid = new Uint8Array(joints));
  let pointCount = 0,
    lineCount = 0;
  for (let joint = 0; joint < joints; joint++) {
    const x = flat[joint * 3],
      y = flat[joint * 3 + 1],
      z = flat[joint * 3 + 2];
    valid[joint] =
      Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);
    // Coordenadas do dado: x e y no plano do campo, z na altura; no Three.js a altura é y.
    if (valid[joint]) pointBuffer.setXYZ(pointCount++, x, z, y);
  }
  for (const [a, b] of bones) {
    if (!valid[a] || !valid[b]) continue;
    lineBuffer.setXYZ(
      lineCount++,
      flat[a * 3],
      flat[a * 3 + 2],
      flat[a * 3 + 1],
    );
    lineBuffer.setXYZ(
      lineCount++,
      flat[b * 3],
      flat[b * 3 + 2],
      flat[b * 3 + 1],
    );
  }
  pointBuffer.needsUpdate = lineBuffer.needsUpdate = true;
  actor.points.geometry.setDrawRange(0, pointCount);
  actor.lines.geometry.setDrawRange(0, lineCount);
  actor.points.visible = actor.lines.visible = pointCount > 0;
}

/** Atualiza posição, cor e número de um jogador no quadro atual. */
function updateActor(actor, player, isShooter) {
  const [id, team, x, y, , flat] = player,
    color = teamColor(team),
    hasPose = Array.isArray(flat);
  if (actor.color !== color) {
    actor.color = color;
    actor.points.material.color.setHex(color);
    actor.lines.material.color.setHex(color);
    actor.marker.material.color.setHex(color);
  }
  if (hasPose) updatePose(actor, flat);
  else actor.points.visible = actor.lines.visible = false;
  actor.marker.scale.setScalar(hasPose ? 0.2 : 0.28);
  actor.marker.material.opacity = hasPose ? 0.48 : 0.82;
  actor.marker.position.copy(fieldPoint(x, y, 0.035));
  const profile = state.manifest.players[String(id)] || {},
    labelColor = isShooter ? COLORS.shooter : color,
    labelKey = `${profile.number ?? String(id).slice(-2)}-${labelColor}`;
  if (actor.labelKey !== labelKey) {
    const first = actor.labelKey === null;
    actor.labelKey = labelKey;
    actor.label.material.map = labelTexture(
      profile.number ?? String(id).slice(-2),
      labelColor,
    );
    if (first) actor.label.material.needsUpdate = true;
  }
  actor.label.position.copy(fieldPoint(x, y, hasPose ? 2.45 : 1.15));
  actor.group.visible = true;
}

/** Atualiza o leque do cone de visão do finalizador. */
function updateVision(gaze, shooter) {
  const direction = gaze && gaze.direction.clone();
  if (direction) direction.y = 0;
  visionMesh.visible = Boolean(direction && direction.lengthSq() >= 0.001);
  if (!visionMesh.visible) return;
  direction.normalize();
  const buffer = visionGeometry.attributes.position,
    halfAngle = (36 * Math.PI) / 180,
    radius = 11.5,
    ox = shooter[2],
    oy = 0.055,
    oz = shooter[3];
  buffer.setXYZ(0, ox, oy, oz);
  for (let step = 0; step <= VISION_STEPS; step++) {
    const angle = -halfAngle + (2 * halfAngle * step) / VISION_STEPS;
    visionRay.copy(direction).applyAxisAngle(UP, angle);
    buffer.setXYZ(
      step + 1,
      ox + visionRay.x * radius,
      oy,
      oz + visionRay.z * radius,
    );
  }
  buffer.needsUpdate = true;
}

// 4. Câmera e quadro do lance
/** Posiciona a câmera atrás do finalizador, voltada para o gol atacado. */
function updateCamera(shooter) {
  if (!shooter) return;
  const goalX =
      state.selected.attacking_side === "left_to_right" ? 52.5 : -52.5,
    origin = fieldPoint(shooter[2], shooter[3], 0),
    goal = fieldPoint(goalX, 0, 0),
    direction = goal.clone().sub(origin);
  direction.y = 0;
  const distanceGoal = direction.length();
  direction.normalize();
  const side = new THREE.Vector3(-direction.z, 0, direction.x),
    distance = Math.min(24, Math.max(14, distanceGoal * 0.29)),
    height = Math.min(19, Math.max(10, distanceGoal * 0.19));
  cameraRig.desiredPosition
    .copy(origin)
    .addScaledVector(direction, -distance)
    .addScaledVector(side, 7.5);
  cameraRig.desiredPosition.y = height;
  cameraRig.desiredTarget
    .copy(origin)
    .addScaledVector(direction, Math.min(20, distanceGoal * 0.48));
  cameraRig.desiredTarget.y = 1.1;
  if (!cameraRig.ready) {
    cameraRig.position.copy(cameraRig.desiredPosition);
    cameraRig.target.copy(cameraRig.desiredTarget);
    camera.position.copy(cameraRig.position);
    camera.lookAt(cameraRig.target);
    controls.target.copy(cameraRig.target);
    controls.update();
    cameraRig.ready = true;
  }
}
/** Em lances de gol, fixa a bola dentro do gol depois que ela entra. */
function goalBallLatch(meta, clip, shotIndex) {
  if (!meta.goal) return null;
  const sign = meta.attacking_side === "left_to_right" ? 1 : -1;
  let entered = false,
    lastInside = null;
  for (let index = shotIndex; index < clip.frames.length; index++) {
    const ball = clip.frames[index][2];
    if (!ball) {
      if (entered && lastInside) return { index, position: lastInside };
      continue;
    }
    const inside =
      sign * ball[0] >= 52.45 &&
      sign * ball[0] <= 54.75 &&
      Math.abs(ball[1]) <= 3.7 &&
      ball[2] >= 0 &&
      ball[2] <= 2.55;
    if (inside) {
      entered = true;
      lastInside = [...ball];
    } else if (entered && lastInside) return { index, position: lastInside };
  }
  return null;
}
/** Redesenha o quadro atual: jogadores, poses, bola, visão e relógio. */
function renderFrame() {
  if (!state.clip?.frames?.length) return;
  const frame = state.clip.frames[state.index],
    shooterId = Number(state.selected.player_id);
  frameTick++;
  state.gaze = null;
  let shooter = null;
  for (const player of frame[3]) {
    const id = Number(player[0]),
      isShooter = id === shooterId;
    let actor = actorPool.get(id);
    if (!actor) actorPool.set(id, (actor = createActor()));
    actor.tick = frameTick;
    updateActor(actor, player, isShooter);
    if (isShooter) {
      shooter = player;
      if (Array.isArray(player[5])) state.gaze = gazeFromPose(player[5]);
    }
  }
  // Jogadores que não aparecem neste quadro ficam escondidos, sem serem destruídos.
  for (const actor of actorPool.values())
    if (actor.tick !== frameTick) actor.group.visible = false;
  const ballData =
    state.goalBall && state.index >= state.goalBall.index
      ? state.goalBall.position
      : frame[2];
  ballMesh.visible = Boolean(ballData);
  if (ballData) ballMesh.position.copy(posePoint(ballData));
  updateVision(state.gaze, shooter);
  if (shooter) updateCamera(shooter);
  $("#povEmpty").hidden = Boolean(state.gaze);
  $("#clock").textContent = frame[1] || "—";
  $("#frameCounter").textContent =
    `${state.index + 1} / ${state.clip.frames.length}`;
  $("#timeline").value = state.index;
  needsRender = needsPovRender = true;
}

// 5. Biblioteca de chutes e carregamento do lance
/** Abas de partidas. */
function renderMatches() {
  const tabs = [
    { id: "all", label: "Todos" },
    ...state.manifest.matches.map((match) => ({
      id: String(match.id),
      label: `${match.home.split(" ")[0]} × ${match.away.split(" ")[0]}`,
    })),
  ];
  $("#matchTabs").innerHTML = tabs
    .map(
      (tab) =>
        `<button class="match-tab ${state.match === tab.id ? "active" : ""}" data-match="${tab.id}">${tab.label}</button>`,
    )
    .join("");
  document.querySelectorAll("[data-match]").forEach(
    (button) =>
      (button.onclick = () => {
        state.match = button.dataset.match;
        renderMatches();
        renderEvents();
      }),
  );
}
/** Lista de chutes da partida selecionada. */
function renderEvents() {
  const clips = state.manifest.clips.filter(
    (clip) => state.match === "all" || String(clip.match_id) === state.match,
  );
  $("#clipCount").textContent = `${clips.length} chutes`;
  $("#events").innerHTML =
    clips
      .map(
        (clip) =>
          `<button class="event ${clip.id === state.selected?.id ? "active" : ""}" data-clip="${clip.id}"><span class="event-time">${clip.time}<small>${clip.period === 1 ? "1º tempo" : "2º tempo"}</small></span><span class="event-main"><strong>${clip.player}</strong><span>${clip.team}${clip.header ? " · cabeceio" : ""}</span></span><span class="tag ${clip.goal ? "goal" : ""}">${clip.goal ? "gol" : "chute"}</span></button>`,
      )
      .join("") || '<div class="empty">Nenhum chute nesta partida.</div>';
  document
    .querySelectorAll("[data-clip]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          loadClip(
            state.manifest.clips.find(
              (clip) => clip.id === button.dataset.clip,
            ),
          )),
    );
}
/** Baixa o lance escolhido e prepara a linha do tempo. */
async function loadClip(clip) {
  state.playing = false;
  updatePlay();
  state.selected = clip;
  state.index = 0;
  state.accumulator = 0;
  state.goalBall = null;
  cameraRig.ready = false;
  $("#loading").hidden = false;
  renderEvents();
  try {
    const response = await fetch(clip.file);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.clip = await response.json();
    const shotIndex = state.clip.frames.reduce(
      (best, frame, index) =>
        Math.abs(frame[0] - state.clip.shot_frame) <
        Math.abs(state.clip.frames[best][0] - state.clip.shot_frame)
          ? index
          : best,
      0,
    );
    state.shotIndex = shotIndex;
    state.goalBall = goalBallLatch(clip, state.clip, shotIndex);
    $("#timeline").max = Math.max(0, state.clip.frames.length - 1);
    $("#shotMarker").style.left =
      `${(shotIndex / Math.max(1, state.clip.frames.length - 1)) * 100}%`;
    const match = state.manifest.matches.find(
      (item) => item.id === clip.match_id,
    );
    $("#eventMeta").textContent =
      `${clip.goal ? "Gol" : "Chute"} · ${clip.time} · ${clip.period === 1 ? "1º tempo" : "2º tempo"}`;
    $("#eventName").textContent = clip.player;
    $("#fixture").textContent =
      `${match.home} ${match.home_score} — ${match.away_score} ${match.away} · ${clip.team}`;
    $("#teamKey").innerHTML =
      `<span><i style="background:#3559e8"></i>${match.home}</span><span><i style="background:#e75438"></i>${match.away}</span><span><i style="background:#ffd000"></i>finalizador</span>`;
    renderFrame();
  } catch (error) {
    console.error(error);
    $("#eventName").textContent = "Não foi possível carregar este lance";
  } finally {
    $("#loading").hidden = true;
  }
}

// 6. Reprodução, redimensionamento e laço de renderização
/** Atualiza o ícone do botão e alterna entre câmera automática e livre. */
function updatePlay() {
  if (state.playing) {
    cameraRig.position.copy(camera.position);
    cameraRig.target.copy(controls.target);
    controls.enabled = false;
  } else {
    controls.enabled = true;
    controls.target.copy(cameraRig.target);
    controls.update();
  }
  needsRender = true;
  const icon = $("#playIcon");
  icon.setAttribute(
    "d",
    state.playing ? "M7 5h4v14H7zm6 0h4v14h-4z" : "M8 5.5v13l11-6.5z",
  );
  $("#play").setAttribute(
    "aria-label",
    state.playing ? "Pausar" : "Reproduzir",
  );
}
$("#play").onclick = () => {
  state.playing = !state.playing;
  updatePlay();
};
$("#timeline").oninput = (event) => {
  state.playing = false;
  updatePlay();
  state.index = Number(event.target.value);
  renderFrame();
};
$("#speed").onclick = () => {
  const speeds = [0.5, 1, 2],
    next = (speeds.indexOf(state.speed) + 1) % speeds.length;
  state.speed = speeds[next];
  $("#speed").textContent = `${state.speed}×`;
};
window.addEventListener("keydown", (event) => {
  if (event.target.matches("button,input")) return;
  if (event.code === "Space") {
    event.preventDefault();
    state.playing = !state.playing;
    updatePlay();
  }
  if (event.code === "ArrowRight" && state.clip) {
    state.index = Math.min(state.clip.frames.length - 1, state.index + 1);
    renderFrame();
  }
  if (event.code === "ArrowLeft" && state.clip) {
    state.index = Math.max(0, state.index - 1);
    renderFrame();
  }
});
/** Ajusta os dois renderizadores e câmeras ao tamanho dos painéis. */
function resize() {
  const box = $("#viewer").getBoundingClientRect();
  renderer.setSize(box.width, box.height, false);
  camera.aspect = box.width / Math.max(1, box.height);
  camera.updateProjectionMatrix();
  const pov = $("#pov").getBoundingClientRect();
  povRenderer.setSize(pov.width, pov.height, false);
  povCamera.aspect = pov.width / Math.max(1, pov.height);
  povCamera.updateProjectionMatrix();
  needsRender = needsPovRender = true;
}
let rendering = false,
  animationFrame = null;
const povTarget = new THREE.Vector3();
/** Laço de renderização: avança os quadros, move a câmera e desenha as duas visões. */
function animate(now) {
  if (!rendering) return;
  animationFrame = requestAnimationFrame(animate);
  const delta = Math.min(0.1, (now - state.last) / 1000);
  state.last = now;
  if (state.playing && state.clip) {
    state.accumulator += delta * state.speed;
    const frameDuration = 1 / state.clip.fps;
    while (state.accumulator >= frameDuration) {
      state.accumulator -= frameDuration;
      state.index = (state.index + 1) % state.clip.frames.length;
      renderFrame();
    }
  }
  if (state.playing) {
    const blend = 1 - Math.exp(-delta * 5.5);
    cameraRig.position.lerp(cameraRig.desiredPosition, blend);
    cameraRig.target.lerp(cameraRig.desiredTarget, blend);
    camera.position.copy(cameraRig.position);
    camera.lookAt(cameraRig.target);
    needsRender = true;
  } else if (controls.update()) needsRender = true;
  // Parado e sem mexer na câmera, nada é redesenhado: a GPU fica livre.
  if (needsRender) {
    renderer.render(scene, camera);
    needsRender = false;
  }
  // A visão do finalizador só muda quando o quadro muda, não quando a câmera livre se move.
  if (needsPovRender) {
    needsPovRender = false;
    if (state.gaze) {
      povCamera.position
        .copy(state.gaze.origin)
        .addScaledVector(state.gaze.direction, 0.06);
      povCamera.up.set(0, 1, 0);
      povTarget
        .copy(state.gaze.origin)
        .addScaledVector(state.gaze.direction, 15);
      povCamera.lookAt(povTarget);
      visionLayer.visible = false;
      povRenderer.render(scene, povCamera);
      visionLayer.visible = true;
    } else {
      povRenderer.setClearColor(0xd9ded6, 1);
      povRenderer.clear();
    }
  }
}

// 7. Inicialização
/** Carrega o manifesto e abre o primeiro lance. */
async function init() {
  try {
    const response = await fetch("html/data/manifest.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.manifest = await response.json();
    renderMatches();
    renderEvents();
    await loadClip(state.manifest.clips[0]);
  } catch (error) {
    console.error(error);
    $("#loading").textContent =
      "Rode o notebook de coleta e sirva esta pasta por HTTP";
    $("#eventName").textContent = "Os dados ainda não foram gerados";
  }
}
/** Liga ou desliga o laço de renderização (só roda com o visualizador na tela). */
function setRendering(active) {
  if (active === rendering) return;
  rendering = active;
  if (active) {
    needsRender = needsPovRender = true;
    state.last = performance.now();
    animationFrame = requestAnimationFrame(animate);
  } else if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}
let viewerStarted = false;
/** Monta estádio e campo e começa a renderizar quando o visualizador aparece na tela. */
function startViewer() {
  if (viewerStarted) return;
  viewerStarted = true;
  buildStadium(scene);
  buildPitch();
  // O estádio nunca se move: fixa as matrizes para o Three.js não recalculá-las a cada quadro.
  const arena = scene.getObjectByName("arena");
  arena.traverse((object) => {
    object.matrixAutoUpdate = false;
    object.updateMatrix();
  });
  arena.updateMatrixWorld(true);
  arena.matrixWorldAutoUpdate = false;
  window.addEventListener("resize", resize);
  resize();
  init().finally(() => {
    document.documentElement.classList.add("ambient-ready");
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) =>
          setRendering(entries.some((entry) => entry.isIntersecting)),
        { rootMargin: "120px 0px" },
      );
      observer.observe($("#viewer"));
    } else setRendering(true);
  });
}
/** Toca a animação de introdução (se permitido) e então inicia o visualizador. */
async function startExperience() {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (!reducedMotion) {
    if (document.fonts) {
      try {
        await document.fonts.load('600 144px "Instrument Sans"');
        await document.fonts.ready;
      } catch (error) {
        console.warn("Falha ao pré-carregar a fonte", error);
      }
    }
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    document.documentElement.classList.add("intro-ready");
    await new Promise((resolve) => {
      const line = $(".hero-line.line-two");
      let settled = false;
      const finish = (event) => {
        if (
          event &&
          (event.target !== line || event.animationName !== "titleIn")
        )
          return;
        if (settled) return;
        settled = true;
        clearTimeout(fallback);
        line.removeEventListener("animationend", finish);
        resolve();
      };
      const fallback = setTimeout(finish, 1200);
      line.addEventListener("animationend", finish);
    });
    document.documentElement.classList.add("intro-complete");
  }
  const schedule =
    window.requestIdleCallback ?? ((callback) => setTimeout(callback, 50));
  schedule(startViewer, { timeout: 500 });
}
startExperience();
