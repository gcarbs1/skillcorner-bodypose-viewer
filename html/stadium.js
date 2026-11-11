/**
 * Static stadium for the viewer.
 *
 * All layers (stands, concourse, roof, lighting, and boards) follow the same
 * rounded-rectangle outline, preventing overlaps and seams. Repeated elements
 * use instancing to keep draw calls low. Visual direction is documented in
 * docs/visual-direction.md.
 */
import * as THREE from "three";

const COLORS = {
  concrete: 0xaeb4b0,
  concreteLight: 0xc8ccc7,
  concreteDark: 0x8e9691,
  graphite: 0x242a27,
  roof: 0x5b635f,
  roofUnderside: 0x343b37,
  ground: 0xc7cdc5,
  blue: 0x2858e6,
  black: 0x111412,
  advertising: 0xf7faf5,
  lamp: 0xfff8df,
};

const ARENA = {
  innerWidth: 132,
  innerDepth: 94,
  innerRadius: 18,
  lower: { rows: 14, tread: 1.6, rise: 0.52, baseY: 0 },
  concourse: { depth: 5, height: 0.85 },
  upper: { rows: 10, tread: 1.65, rise: 0.76 },
  roof: {
    outerWidth: 228,
    outerDepth: 190,
    outerRadius: 66,
    innerWidth: 164,
    innerDepth: 122,
    innerRadius: 30,
    innerUndersideY: 21,
    outerUndersideY: 23,
    thickness: 0.55,
  },
};

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);

/** Default matte material using the specified color. */
function standard(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.88,
    metalness: options.metalness ?? 0.02,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
  });
}

/** Outline points for a rectangle with rounded corners. */
function roundedRectanglePoints(width, depth, radius, cornerSegments = 14) {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const safeRadius = Math.min(radius, halfWidth, halfDepth);
  const points = [new THREE.Vector2(-halfWidth + safeRadius, -halfDepth)];
  const corners = [
    [halfWidth - safeRadius, -halfDepth + safeRadius, -Math.PI / 2, 0],
    [halfWidth - safeRadius, halfDepth - safeRadius, 0, Math.PI / 2],
    [-halfWidth + safeRadius, halfDepth - safeRadius, Math.PI / 2, Math.PI],
    [-halfWidth + safeRadius, -halfDepth + safeRadius, Math.PI, Math.PI * 1.5],
  ];

  points.push(new THREE.Vector2(halfWidth - safeRadius, -halfDepth));
  for (const [centerX, centerZ, start, end] of corners) {
    for (let segment = 1; segment <= cornerSegments; segment += 1) {
      const angle = THREE.MathUtils.lerp(start, end, segment / cornerSegments);
      points.push(
        new THREE.Vector2(
          centerX + Math.cos(angle) * safeRadius,
          centerZ + Math.sin(angle) * safeRadius,
        ),
      );
    }
    if (end === 0)
      points.push(new THREE.Vector2(halfWidth, halfDepth - safeRadius));
    if (end === Math.PI / 2)
      points.push(new THREE.Vector2(-halfWidth + safeRadius, halfDepth));
    if (end === Math.PI)
      points.push(new THREE.Vector2(-halfWidth, -halfDepth + safeRadius));
  }
  return points;
}

/** Ensures clockwise or counterclockwise point order. */
function orientPoints(points, clockwise) {
  const oriented = [...points];
  if (THREE.ShapeUtils.isClockWise(oriented) !== clockwise) oriented.reverse();
  return oriented;
}

/** Extruded ring between two rounded outlines. */
function roundedRingGeometry(outer, inner, height) {
  const outerPoints = orientPoints(
    roundedRectanglePoints(outer.width, outer.depth, outer.radius),
    true,
  );
  const innerPoints = orientPoints(
    roundedRectanglePoints(inner.width, inner.depth, inner.radius),
    false,
  );
  const shape = new THREE.Shape();
  shape.setFromPoints(outerPoints);
  shape.closePath();
  const hole = new THREE.Path();
  hole.setFromPoints(innerPoints);
  hole.closePath();
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/** Adds a ring, wall, barrier, or floor to the group. */
function addRing(group, outer, inner, height, y, materials, options = {}) {
  const mesh = new THREE.Mesh(
    roundedRingGeometry(outer, inner, height),
    materials,
  );
  mesh.position.y = y;
  group.add(mesh);
  return mesh;
}

/** Sloped roof geometry with a central opening. */
function slopedRoofGeometry(outer, inner, innerY, outerY, thickness) {
  const outerLoop = roundedRectanglePoints(
    outer.width,
    outer.depth,
    outer.radius,
    24,
  );
  const innerLoop = roundedRectanglePoints(
    inner.width,
    inner.depth,
    inner.radius,
    24,
  );
  const positions = [];
  const groups = [];
  const vertex = (point, y) => [point.x, y, point.y];
  const triangle = (a, b, c) => positions.push(...a, ...b, ...c);
  const region = (materialIndex, draw) => {
    const start = positions.length / 3;
    draw();
    groups.push({ start, count: positions.length / 3 - start, materialIndex });
  };

  region(0, () => {
    for (let index = 0; index < outerLoop.length; index += 1) {
      const next = (index + 1) % outerLoop.length;
      const innerA = vertex(innerLoop[index], innerY + thickness);
      const innerB = vertex(innerLoop[next], innerY + thickness);
      const outerA = vertex(outerLoop[index], outerY + thickness);
      const outerB = vertex(outerLoop[next], outerY + thickness);
      triangle(innerA, innerB, outerB);
      triangle(innerA, outerB, outerA);
    }
  });
  region(1, () => {
    for (let index = 0; index < outerLoop.length; index += 1) {
      const next = (index + 1) % outerLoop.length;
      const innerA = vertex(innerLoop[index], innerY);
      const innerB = vertex(innerLoop[next], innerY);
      const outerA = vertex(outerLoop[index], outerY);
      const outerB = vertex(outerLoop[next], outerY);
      triangle(innerA, outerA, outerB);
      triangle(innerA, outerB, innerB);
    }
  });
  region(2, () => {
    for (let index = 0; index < outerLoop.length; index += 1) {
      const next = (index + 1) % outerLoop.length;
      const innerBottomA = vertex(innerLoop[index], innerY);
      const innerBottomB = vertex(innerLoop[next], innerY);
      const innerTopA = vertex(innerLoop[index], innerY + thickness);
      const innerTopB = vertex(innerLoop[next], innerY + thickness);
      triangle(innerBottomA, innerBottomB, innerTopB);
      triangle(innerBottomA, innerTopB, innerTopA);

      const outerBottomA = vertex(outerLoop[index], outerY);
      const outerBottomB = vertex(outerLoop[next], outerY);
      const outerTopA = vertex(outerLoop[index], outerY + thickness);
      const outerTopB = vertex(outerLoop[next], outerY + thickness);
      triangle(outerBottomA, outerTopB, outerBottomB);
      triangle(outerBottomA, outerTopA, outerTopB);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  for (const group of groups)
    geometry.addGroup(group.start, group.count, group.materialIndex);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Adds the stadium's continuous roof. */
function addSlopedRoof(group, materials) {
  const outer = {
    width: ARENA.roof.outerWidth,
    depth: ARENA.roof.outerDepth,
    radius: ARENA.roof.outerRadius,
  };
  const inner = {
    width: ARENA.roof.innerWidth,
    depth: ARENA.roof.innerDepth,
    radius: ARENA.roof.innerRadius,
  };
  const roof = new THREE.Mesh(
    slopedRoofGeometry(
      outer,
      inner,
      ARENA.roof.innerUndersideY,
      ARENA.roof.outerUndersideY,
      ARENA.roof.thickness,
    ),
    [materials.roof, materials.roofUnderside, materials.graphite],
  );
  group.add(roof);
}

/** Samples evenly spaced points along a closed outline. */
function sampleClosedPolyline(points, spacing) {
  const lengths = [];
  let perimeter = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    const length = points[index].distanceTo(next);
    lengths.push(length);
    perimeter += length;
  }
  const count = Math.max(1, Math.floor(perimeter / spacing));
  const step = perimeter / count;
  const samples = [];
  let segmentIndex = 0;
  let segmentStart = 0;

  for (let sampleIndex = 0; sampleIndex < count; sampleIndex += 1) {
    const distance = sampleIndex * step;
    while (
      distance > segmentStart + lengths[segmentIndex] &&
      segmentIndex < lengths.length - 1
    ) {
      segmentStart += lengths[segmentIndex];
      segmentIndex += 1;
    }
    const start = points[segmentIndex];
    const end = points[(segmentIndex + 1) % points.length];
    const progress =
      lengths[segmentIndex] > 0
        ? (distance - segmentStart) / lengths[segmentIndex]
        : 0;
    samples.push(start.clone().lerp(end, progress));
  }
  return samples;
}

/** Outline normal direction at a point. */
function roundedRectangleNormal(point, width, depth, radius) {
  const coreX = Math.max(0, width / 2 - radius);
  const coreZ = Math.max(0, depth / 2 - radius);
  const nearestX = THREE.MathUtils.clamp(point.x, -coreX, coreX);
  const nearestZ = THREE.MathUtils.clamp(point.y, -coreZ, coreZ);
  const normal = new THREE.Vector2(point.x - nearestX, point.y - nearestZ);
  if (normal.lengthSq() < 1e-6) {
    if (Math.abs(point.x) > Math.abs(point.y))
      normal.set(Math.sign(point.x), 0);
    else normal.set(0, Math.sign(point.y));
  }
  return normal.normalize();
}

/** Outline depth (z) for a given x. */
function boundaryZAtX(width, depth, radius, x) {
  const coreX = width / 2 - radius;
  const coreZ = depth / 2 - radius;
  const cornerX = Math.max(0, Math.abs(x) - coreX);
  return coreZ + Math.sqrt(Math.max(0, radius ** 2 - cornerX ** 2));
}

/** Outline width (x) for a given z. */
function boundaryXAtZ(width, depth, radius, z) {
  const coreX = width / 2 - radius;
  const coreZ = depth / 2 - radius;
  const cornerZ = Math.max(0, Math.abs(z) - coreZ);
  return coreX + Math.sqrt(Math.max(0, radius ** 2 - cornerZ ** 2));
}

/** Classifies the normal as one of the stadium's four sides. */
function classifySide(normal) {
  if (Math.abs(normal.y) >= Math.abs(normal.x))
    return normal.y < 0 ? "north" : "south";
  return normal.x < 0 ? "west" : "east";
}

/** Indicates whether a point falls within an aisle between sections. */
function insideAisle(point, normal) {
  if (Math.abs(Math.abs(normal.x) - Math.abs(normal.y)) < 0.16) return true;
  const longSide = Math.abs(normal.y) >= Math.abs(normal.x);
  const coordinate = longSide ? point.x : point.y;
  const aisleCenters = longSide ? [0, -40, 40] : [0, -27, 27];
  return aisleCenters.some((center) => Math.abs(coordinate - center) < 0.82);
}

/** Seat color: blue on every side. */
function sideColor() {
  return COLORS.blue;
}

/** Adds a stand tier one row at a time. */
function addBowlTier(group, materials, seatRecords, config) {
  for (let row = 0; row < config.rows; row += 1) {
    const innerOffset = config.offset + row * config.tread;
    const outerOffset = innerOffset + config.tread;
    const inner = {
      width: ARENA.innerWidth + innerOffset * 2,
      depth: ARENA.innerDepth + innerOffset * 2,
      radius: ARENA.innerRadius + innerOffset,
    };
    const outer = {
      width: ARENA.innerWidth + outerOffset * 2,
      depth: ARENA.innerDepth + outerOffset * 2,
      radius: ARENA.innerRadius + outerOffset,
    };
    const rowMaterials =
      row % 2 === 0
        ? [materials.concreteLight, materials.concrete]
        : [materials.concrete, materials.concreteDark];
    addRing(
      group,
      outer,
      inner,
      config.rise,
      config.baseY + row * config.rise,
      rowMaterials,
    );

    const centerOffset = innerOffset + config.tread * 0.5;
    const seatWidth = ARENA.innerWidth + centerOffset * 2;
    const seatDepth = ARENA.innerDepth + centerOffset * 2;
    const seatRadius = ARENA.innerRadius + centerOffset;
    const points = roundedRectanglePoints(seatWidth, seatDepth, seatRadius, 18);
    const seatTop = config.baseY + (row + 1) * config.rise;
    for (const point of sampleClosedPolyline(points, 1.08)) {
      const normal = roundedRectangleNormal(
        point,
        seatWidth,
        seatDepth,
        seatRadius,
      );
      if (insideAisle(point, normal)) continue;
      const side = classifySide(normal);
      seatRecords.push({
        x: point.x,
        z: point.y,
        y: seatTop,
        normal,
        color: sideColor(),
      });
    }
  }
}

/** Creates seats as instances of a single geometry. */
function addSeats(group, materials, records) {
  const cushionGeometry = new THREE.BoxGeometry(0.82, 0.16, 0.62);
  const backGeometry = new THREE.BoxGeometry(0.82, 0.64, 0.14);
  const cushions = new THREE.InstancedMesh(
    cushionGeometry,
    materials.seats,
    records.length,
  );
  const backs = new THREE.InstancedMesh(
    backGeometry,
    materials.seats,
    records.length,
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const position = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);

  records.forEach((record, index) => {
    const yaw = Math.atan2(record.normal.x, record.normal.y);
    quaternion.setFromAxisAngle(yAxis, yaw);
    position.set(record.x, record.y + 0.11, record.z);
    matrix.compose(position, quaternion, scale);
    cushions.setMatrixAt(index, matrix);
    cushions.setColorAt(index, new THREE.Color(record.color));

    position.set(
      record.x + record.normal.x * 0.27,
      record.y + 0.43,
      record.z + record.normal.y * 0.27,
    );
    matrix.compose(position, quaternion, scale);
    backs.setMatrixAt(index, matrix);
    backs.setColorAt(index, new THREE.Color(record.color));
  });

  for (const mesh of [cushions, backs]) {
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
}

/** Adds the concourse guardrail. */
function addConcourseRail(group, materials, dimensions, y) {
  const points2D = roundedRectanglePoints(
    dimensions.width,
    dimensions.depth,
    dimensions.radius,
    24,
  );
  const linePoints = points2D.map(
    (point) => new THREE.Vector3(point.x, y + 1.15, point.y),
  );
  const railing = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(linePoints),
    materials.railing,
  );
  group.add(railing);

  const posts = sampleClosedPolyline(points2D, 5.4);
  const geometry = new THREE.CylinderGeometry(0.035, 0.045, 1.15, 6);
  const instanced = new THREE.InstancedMesh(
    geometry,
    materials.graphite,
    posts.length,
  );
  const matrix = new THREE.Matrix4();
  posts.forEach((point, index) => {
    matrix.makeTranslation(point.x, y + 0.575, point.y);
    instanced.setMatrixAt(index, matrix);
  });
  instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  instanced.computeBoundingSphere();
  group.add(instanced);
}

/** Creates a static instanced mesh from matrices. */
function addStaticInstances(group, geometry, material, matrices, options = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  group.add(mesh);
  return mesh;
}

/** Adds framed concourse portals. */
function addPortals(group, materials, concourseOuter, floorY) {
  const portals = [];
  const longZ = concourseOuter.depth / 2 - 0.42;
  for (const zSign of [-1, 1]) {
    for (const x of [-46, 0, 46]) {
      portals.push([[x, floorY, zSign * longZ], zSign < 0 ? Math.PI : 0]);
    }
  }
  const endX = concourseOuter.width / 2 - 0.42;
  for (const xSign of [-1, 1]) {
    for (const z of [-28, 0, 28]) {
      portals.push([
        [xSign * endX, floorY, z],
        xSign < 0 ? Math.PI / 2 : -Math.PI / 2,
      ]);
    }
  }

  const openingMatrices = [];
  const topMatrices = [];
  const sideMatrices = [];
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const base = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  for (const [position, rotationY] of portals) {
    quaternion.setFromAxisAngle(UP, rotationY);
    base.compose(new THREE.Vector3(...position), quaternion, scale);
    local.makeTranslation(0, 1.35, 0);
    openingMatrices.push(world.multiplyMatrices(base, local).clone());
    local.makeTranslation(0, 2.85, 0);
    topMatrices.push(world.multiplyMatrices(base, local).clone());
    for (const x of [-3.72, 3.72]) {
      local.makeTranslation(x, 1.43, 0);
      sideMatrices.push(world.multiplyMatrices(base, local).clone());
    }
  }
  addStaticInstances(
    group,
    new THREE.BoxGeometry(7.1, 2.7, 0.2),
    materials.black,
    openingMatrices,
  );
  addStaticInstances(
    group,
    new THREE.BoxGeometry(7.8, 0.3, 0.28),
    materials.concreteDark,
    topMatrices,
  );
  addStaticInstances(
    group,
    new THREE.BoxGeometry(0.32, 2.85, 0.28),
    materials.concreteDark,
    sideMatrices,
  );
}

/** Adds external roof-support columns. */
function addColumns(group, materials) {
  const columnPath = roundedRectanglePoints(226, 188, 65, 24);
  const positions = sampleClosedPolyline(columnPath, 18);
  const columnHeight = ARENA.roof.outerUndersideY;
  const geometry = new THREE.CylinderGeometry(0.22, 0.36, columnHeight, 10);
  const columns = new THREE.InstancedMesh(
    geometry,
    materials.graphite,
    positions.length,
  );
  const matrix = new THREE.Matrix4();
  positions.forEach((point, index) => {
    matrix.makeTranslation(point.x, columnHeight / 2, point.y);
    columns.setMatrixAt(index, matrix);
  });
  columns.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  columns.computeBoundingSphere();
  group.add(columns);
}

/** Adds the roof ribs. */
function addRoofRibs(group, materials) {
  const beams = [];
  for (const side of [-1, 1]) {
    for (const x of [-66, -44, -22, 0, 22, 44, 66]) {
      const innerZ =
        boundaryZAtX(
          ARENA.roof.innerWidth,
          ARENA.roof.innerDepth,
          ARENA.roof.innerRadius,
          x,
        ) + 0.6;
      const outerZ =
        boundaryZAtX(
          ARENA.roof.outerWidth,
          ARENA.roof.outerDepth,
          ARENA.roof.outerRadius,
          x,
        ) - 0.5;
      beams.push([
        new THREE.Vector3(x, ARENA.roof.innerUndersideY - 0.14, side * innerZ),
        new THREE.Vector3(x, ARENA.roof.outerUndersideY - 0.14, side * outerZ),
      ]);
    }
  }
  for (const side of [-1, 1]) {
    for (const z of [-42, -21, 0, 21, 42]) {
      const innerX =
        boundaryXAtZ(
          ARENA.roof.innerWidth,
          ARENA.roof.innerDepth,
          ARENA.roof.innerRadius,
          z,
        ) + 0.6;
      const outerX =
        boundaryXAtZ(
          ARENA.roof.outerWidth,
          ARENA.roof.outerDepth,
          ARENA.roof.outerRadius,
          z,
        ) - 0.5;
      beams.push([
        new THREE.Vector3(side * innerX, ARENA.roof.innerUndersideY - 0.14, z),
        new THREE.Vector3(side * outerX, ARENA.roof.outerUndersideY - 0.14, z),
      ]);
    }
  }
  const ribs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.22, 0.28, 1),
    materials.graphite,
    beams.length,
  );
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  beams.forEach(([start, end], index) => {
    const direction = end.clone().sub(start);
    const length = direction.length();
    quaternion.setFromUnitVectors(FORWARD, direction.normalize());
    scale.set(1, 1, length);
    matrix.compose(
      start.clone().add(end).multiplyScalar(0.5),
      quaternion,
      scale,
    );
    ribs.setMatrixAt(index, matrix);
  });
  ribs.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  ribs.computeBoundingSphere();
  group.add(ribs);
}

/** Adds floodlight modules beneath the inner roof edge. */
function addIntegratedLighting(group, materials) {
  const horizontalMatrices = [];
  const verticalMatrices = [];
  const supportMatrices = [];
  const mountMatrices = [];
  const housingMatrices = [];
  const lensMatrices = [];
  const local = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  const pushLocal = (matrices, bankMatrix, x, y, z) => {
    local.makeTranslation(x, y, z);
    matrices.push(world.multiplyMatrices(bankMatrix, local).clone());
  };

  for (const zSign of [-1, 1]) {
    for (const xPosition of [-54, -18, 18, 54]) {
      const position = new THREE.Vector3(xPosition, 18.82, zSign * 63.3);
      const target = new THREE.Vector3(xPosition * 0.18, 2.4, zSign * -8);
      const forward = target.clone().sub(position).normalize();
      const right = new THREE.Vector3().crossVectors(UP, forward).normalize();
      const localUp = new THREE.Vector3()
        .crossVectors(forward, right)
        .normalize();
      const bankMatrix = new THREE.Matrix4().makeBasis(right, localUp, forward);
      bankMatrix.setPosition(position);

      for (const y of [-1.08, 1.08])
        pushLocal(horizontalMatrices, bankMatrix, 0, y, 0);
      for (const x of [-2.84, 0, 2.84])
        pushLocal(verticalMatrices, bankMatrix, x, 0, 0);
      for (const x of [-2, 2])
        pushLocal(supportMatrices, bankMatrix, x, 1.65, -0.12);
      pushLocal(mountMatrices, bankMatrix, 0, 2.26, -0.13);

      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 6; column += 1) {
          const x = (column - 2.5) * 0.88;
          const y = (1 - row) * 0.68;
          pushLocal(housingMatrices, bankMatrix, x, y, 0.03);
          pushLocal(lensMatrices, bankMatrix, x, y, 0.205);
        }
      }
    }
  }

  addStaticInstances(
    group,
    new THREE.BoxGeometry(5.8, 0.14, 0.16),
    materials.graphite,
    horizontalMatrices,
  );
  addStaticInstances(
    group,
    new THREE.BoxGeometry(0.14, 2.3, 0.16),
    materials.graphite,
    verticalMatrices,
  );
  addStaticInstances(
    group,
    new THREE.BoxGeometry(0.16, 1.18, 0.2),
    materials.graphite,
    supportMatrices,
  );
  addStaticInstances(
    group,
    new THREE.BoxGeometry(4.5, 0.16, 0.48),
    materials.graphite,
    mountMatrices,
  );
  const housingGeometry = new THREE.CylinderGeometry(0.27, 0.27, 0.3, 12);
  housingGeometry.rotateX(Math.PI / 2);
  addStaticInstances(
    group,
    housingGeometry,
    materials.lampHousing,
    housingMatrices,
  );
  addStaticInstances(
    group,
    new THREE.CircleGeometry(0.22, 16),
    materials.lamp,
    lensMatrices,
  );
}

/** Adds advertising boards around the pitch with openings behind the goals. */
function addAdvertising(group, materials) {
  const longPositions = [];
  for (const side of [-1, 1]) {
    for (let index = -6; index <= 6; index += 1)
      longPositions.push([index * 8.25, side * 36.35]);
  }
  const longBoards = new THREE.InstancedMesh(
    new THREE.BoxGeometry(7.9, 0.92, 0.28),
    materials.advertising,
    longPositions.length,
  );
  const matrix = new THREE.Matrix4();
  longPositions.forEach(([x, z], index) => {
    matrix.makeTranslation(x, 0.46, z);
    longBoards.setMatrixAt(index, matrix);
  });
  longBoards.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  longBoards.computeBoundingSphere();
  group.add(longBoards);

  const endPositions = [];
  for (const side of [-1, 1]) {
    for (const z of [-28, -20, -12, 12, 20, 28])
      endPositions.push([side * 55.85, z]);
  }
  const endBoards = new THREE.InstancedMesh(
    new THREE.BoxGeometry(7.5, 0.92, 0.28),
    materials.advertising,
    endPositions.length,
  );
  const rotation = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  endPositions.forEach(([x, z], index) => {
    matrix.makeTranslation(x, 0.46, z).multiply(rotation);
    endBoards.setMatrixAt(index, matrix);
  });
  endBoards.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  endBoards.computeBoundingSphere();
  group.add(endBoards);
}

/** Builds the complete stadium and adds it to the scene. */
export function buildStadium(scene) {
  const group = new THREE.Group();
  group.name = "arena";
  const materials = {
    concrete: standard(COLORS.concrete, { roughness: 0.94, metalness: 0 }),
    concreteLight: standard(COLORS.concreteLight, {
      roughness: 0.95,
      metalness: 0,
    }),
    concreteDark: standard(COLORS.concreteDark, {
      roughness: 0.92,
      metalness: 0.01,
    }),
    graphite: standard(COLORS.graphite, { roughness: 0.62, metalness: 0.28 }),
    roof: standard(COLORS.roof, { roughness: 0.58, metalness: 0.32 }),
    roofUnderside: standard(COLORS.roofUnderside, {
      roughness: 0.68,
      metalness: 0.22,
    }),
    seats: standard(0xffffff, { roughness: 0.72, metalness: 0.01 }),
    black: standard(COLORS.black, { roughness: 0.9, metalness: 0.02 }),
    advertising: standard(COLORS.advertising, {
      roughness: 0.82,
      metalness: 0.01,
    }),
    lampHousing: standard(0x191d1b, { roughness: 0.48, metalness: 0.42 }),
    lamp: standard(COLORS.lamp, {
      roughness: 0.26,
      metalness: 0.02,
      emissive: 0xffeabd,
      emissiveIntensity: 4,
    }),
    railing: new THREE.LineBasicMaterial({
      color: COLORS.graphite,
      transparent: true,
      opacity: 0.76,
    }),
  };

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 220),
    standard(COLORS.ground, { roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  group.add(ground);

  const seatRecords = [];
  addBowlTier(group, materials, seatRecords, {
    ...ARENA.lower,
    offset: 0,
  });

  const lowerOffset = ARENA.lower.rows * ARENA.lower.tread;
  const lowerTop = ARENA.lower.rows * ARENA.lower.rise;
  const lowerOuter = {
    width: ARENA.innerWidth + lowerOffset * 2,
    depth: ARENA.innerDepth + lowerOffset * 2,
    radius: ARENA.innerRadius + lowerOffset,
  };
  const concourseOffset = lowerOffset + ARENA.concourse.depth;
  const concourseOuter = {
    width: ARENA.innerWidth + concourseOffset * 2,
    depth: ARENA.innerDepth + concourseOffset * 2,
    radius: ARENA.innerRadius + concourseOffset,
  };
  addRing(group, concourseOuter, lowerOuter, ARENA.concourse.height, lowerTop, [
    materials.concreteLight,
    materials.concreteDark,
  ]);
  const upperBase = lowerTop + ARENA.concourse.height;
  addConcourseRail(group, materials, lowerOuter, lowerTop);
  addPortals(group, materials, concourseOuter, upperBase + 0.02);

  addBowlTier(group, materials, seatRecords, {
    ...ARENA.upper,
    offset: concourseOffset,
    baseY: upperBase,
  });
  addSeats(group, materials, seatRecords);

  const upperOffset = concourseOffset + ARENA.upper.rows * ARENA.upper.tread;
  const upperOuter = {
    width: ARENA.innerWidth + upperOffset * 2,
    depth: ARENA.innerDepth + upperOffset * 2,
    radius: ARENA.innerRadius + upperOffset,
  };
  const upperTop = upperBase + ARENA.upper.rows * ARENA.upper.rise;
  addRing(
    group,
    {
      width: upperOuter.width + 2,
      depth: upperOuter.depth + 2,
      radius: upperOuter.radius + 1,
    },
    upperOuter,
    upperTop - 8,
    8,
    [materials.concreteDark, materials.concreteDark],
  );

  addColumns(group, materials);
  addSlopedRoof(group, materials);
  addRing(
    group,
    {
      width: ARENA.roof.innerWidth + 3.2,
      depth: ARENA.roof.innerDepth + 3.2,
      radius: ARENA.roof.innerRadius + 1.6,
    },
    {
      width: ARENA.roof.innerWidth,
      depth: ARENA.roof.innerDepth,
      radius: ARENA.roof.innerRadius,
    },
    0.9,
    ARENA.roof.innerUndersideY - 0.9,
    [materials.graphite, materials.roofUnderside],
  );
  addRoofRibs(group, materials);
  addIntegratedLighting(group, materials);
  addAdvertising(group, materials);

  scene.add(group);
  return group;
}
