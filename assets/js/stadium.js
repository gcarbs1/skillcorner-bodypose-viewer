import * as THREE from 'three';

const COLORS = {
  concrete: 0xb7bbb5,
  concreteDark: 0x929891,
  concourse: 0xc9ccc6,
  graphite: 0x303633,
  ground: 0xc7cdc5,
  screen: 0x121614,
  seats: [0x3559e8, 0xe75438],
  ads: [0x121412],
};

function standard(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.88,
    metalness: options.metalness ?? 0.02,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
  });
}

function box(group, geometry, material, position, rotationY = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addLongStand(group, materials, side) {
  const direction = Math.sign(side);
  const lowerRow = new THREE.BoxGeometry(118, 0.68, 2.35);
  const upperRow = new THREE.BoxGeometry(108, 0.72, 2.5);

  for (let row = 0; row < 9; row += 1) {
    box(
      group,
      lowerRow,
      row % 2 ? materials.concrete : materials.concreteDark,
      [0, 0.26 + row * 0.72, direction * (43.2 + row * 2.12)],
    );
  }

  box(group, new THREE.BoxGeometry(122, 0.65, 5.2), materials.concourse, [0, 6.75, direction * 63.2]);
  box(group, new THREE.BoxGeometry(122, 1.15, 0.45), materials.graphite, [0, 6.65, direction * 60.7]);

  for (let row = 0; row < 6; row += 1) {
    box(
      group,
      upperRow,
      row % 2 ? materials.concreteDark : materials.concrete,
      [0, 7.15 + row * 0.82, direction * (65.8 + row * 2.18)],
    );
  }

  const canopy = box(
    group,
    new THREE.BoxGeometry(116, 0.45, 10),
    materials.roof,
    [0, 14.35, direction * 68.5],
  );
  canopy.rotation.x = direction * -0.08;

  for (const x of [-50, -25, 0, 25, 50]) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 13.6, 10), materials.graphite);
    column.position.set(x, 7.2, direction * 73);
    column.castShadow = true;
    group.add(column);
  }
}

function addEndStand(group, materials, side) {
  const direction = Math.sign(side);
  const rowGeometry = new THREE.BoxGeometry(2.35, 0.68, 82);

  for (let row = 0; row < 9; row += 1) {
    box(
      group,
      rowGeometry,
      row % 2 ? materials.concreteDark : materials.concrete,
      [direction * (62.7 + row * 2.12), 0.26 + row * 0.72, 0],
    );
  }

  box(group, new THREE.BoxGeometry(5.2, 0.65, 86), materials.concourse, [direction * 82.7, 6.75, 0]);
  box(group, new THREE.BoxGeometry(0.45, 1.15, 86), materials.graphite, [direction * 80.1, 6.65, 0]);
}

function addCornerDecks(group, materials) {
  const deck = new THREE.BoxGeometry(18, 0.65, 5.4);
  const retaining = new THREE.BoxGeometry(17, 3.8, 0.6);

  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const angle = x * z > 0 ? Math.PI / 4 : -Math.PI / 4;
      box(group, deck, materials.concourse, [x * 66.5, 5.45, z * 48.8], angle);
      box(group, retaining, materials.concreteDark, [x * 64.4, 2.5, z * 47.1], angle);
      box(group, retaining, materials.concrete, [x * 68.7, 4.15, z * 50.8], angle);
      box(group, new THREE.BoxGeometry(7.5, 0.55, 4), materials.graphite, [x * 61.2, 0.32, z * 43], angle);
    }
  }
}

function addSeats(group, materials) {
  const positions = [];
  const seatGeometry = new THREE.BoxGeometry(0.9, 0.18, 0.7);
  const backGeometry = new THREE.BoxGeometry(0.9, 0.62, 0.16);
  const seatMaterial = standard(0xffffff, { roughness: 0.78 });

  for (const side of [-1, 1]) {
    for (let row = 0; row < 9; row += 1) {
      for (let x = -54; x <= 54; x += 2.25) {
        if (Math.abs(x) < 3.1 || Math.abs(Math.abs(x) - 27) < 2) continue;
        positions.push({
          position: [x, 0.76 + row * 0.72, side * (42.6 + row * 2.12)],
          back: [x, 1.08 + row * 0.72, side * (42.92 + row * 2.12)],
          rotation: side > 0 ? Math.PI : 0,
          color: COLORS.seats[side < 0 ? 0 : 1],
        });
      }
    }
  }

  for (const side of [-1, 1]) {
    for (let row = 0; row < 9; row += 1) {
      for (let z = -36; z <= 36; z += 2.25) {
        if (Math.abs(z) < 3.1 || Math.abs(Math.abs(z) - 21) < 2) continue;
        positions.push({
          position: [side * (62.1 + row * 2.12), 0.76 + row * 0.72, z],
          back: [side * (62.42 + row * 2.12), 1.08 + row * 0.72, z],
          rotation: side > 0 ? -Math.PI / 2 : Math.PI / 2,
          color: COLORS.seats[side < 0 ? 0 : 1],
        });
      }
    }
  }

  const seats = new THREE.InstancedMesh(seatGeometry, seatMaterial, positions.length);
  const backs = new THREE.InstancedMesh(backGeometry, seatMaterial, positions.length);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  positions.forEach((seat, index) => {
    rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), seat.rotation);
    matrix.compose(new THREE.Vector3(...seat.position), rotation, scale);
    seats.setMatrixAt(index, matrix);
    seats.setColorAt(index, new THREE.Color(seat.color));
    matrix.compose(new THREE.Vector3(...seat.back), rotation, scale);
    backs.setMatrixAt(index, matrix);
    backs.setColorAt(index, new THREE.Color(seat.color));
  });
  seats.instanceMatrix.needsUpdate = true;
  backs.instanceMatrix.needsUpdate = true;
  if (seats.instanceColor) seats.instanceColor.needsUpdate = true;
  if (backs.instanceColor) backs.instanceColor.needsUpdate = true;
  group.add(seats, backs);
}

function addRailings(group, materials) {
  const points = [];
  const longZ = 60.45;
  const endX = 79.85;
  for (const side of [-1, 1]) {
    for (const height of [7.25, 7.85]) {
      points.push(new THREE.Vector3(-60, height, side * longZ), new THREE.Vector3(60, height, side * longZ));
      points.push(new THREE.Vector3(side * endX, height, -42), new THREE.Vector3(side * endX, height, 42));
    }
    for (let x = -60; x <= 60; x += 6) {
      points.push(new THREE.Vector3(x, 6.72, side * longZ), new THREE.Vector3(x, 7.9, side * longZ));
    }
    for (let z = -42; z <= 42; z += 6) {
      points.push(new THREE.Vector3(side * endX, 6.72, z), new THREE.Vector3(side * endX, 7.9, z));
    }
  }
  const rails = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: materials.graphite.color, transparent: true, opacity: 0.72 }),
  );
  group.add(rails);
}

function addPitchFurniture(group, materials) {
  const adGeometry = new THREE.BoxGeometry(8.2, 0.9, 0.28);
  const endAdGeometry = new THREE.BoxGeometry(0.28, 0.9, 7.4);

  for (const side of [-1, 1]) {
    for (let index = -6; index <= 6; index += 1) {
      if (index === 0) continue;
      const material = materials.ads[(index + 8) % materials.ads.length];
      box(group, adGeometry, material, [index * 8.55, 0.48, side * 36.3]);
    }
    for (let index = -4; index <= 4; index += 1) {
      if (index === 0) continue;
      const material = materials.ads[(index + 6) % materials.ads.length];
      box(group, endAdGeometry, material, [side * 55.8, 0.48, index * 7.75]);
    }
  }

  for (const side of [-1, 1]) {
    const tunnel = box(group, new THREE.BoxGeometry(8, 3.4, 4.5), materials.graphite, [0, 1.55, side * 43.2]);
    tunnel.material = materials.tunnel;
    box(group, new THREE.BoxGeometry(9.2, 0.28, 5), materials.roof, [0, 3.35, side * 43.2]);
  }

  for (const x of [-48, 48]) {
    for (const z of [-38.7, 38.7]) {
      box(group, new THREE.BoxGeometry(4, 1.2, 1.3), materials.graphite, [x, 0.62, z]);
    }
  }
}

function addFloodlights(group, scene, materials) {
  const corners = [
    [-70, -51],
    [-70, 51],
    [70, -51],
    [70, 51],
  ];
  const frameHorizontal = new THREE.BoxGeometry(9.6, 0.22, 0.3);
  const frameVertical = new THREE.BoxGeometry(0.22, 4.4, 0.3);
  const housingGeometry = new THREE.CylinderGeometry(0.38, 0.34, 0.3, 14);
  const lensGeometry = new THREE.CircleGeometry(0.27, 18);
  const headForward = new THREE.Vector3(0, 0, 1);
  const fieldTarget = new THREE.Vector3(0, 5, 0);
  const lensMaterial = standard(0xfff7d6, {
    emissive: 0xfff0b5,
    emissiveIntensity: 1.8,
    roughness: 0.35,
  });
  const housingRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const instanceScale = new THREE.Vector3(1, 1, 1);

  for (const [x, z] of corners) {
    const tower = new THREE.Group();
    tower.position.set(x, 0, z);
    const leanX = -Math.sign(x) * 0.75;
    const leanZ = -Math.sign(z) * 0.75;
    for (const [offsetX, offsetZ] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 20, 8), materials.graphite);
      column.position.set(offsetX + leanX * 0.25, 10, offsetZ + leanZ * 0.25);
      column.rotation.z = leanX * 0.006;
      column.rotation.x = -leanZ * 0.006;
      tower.add(column);
    }
    const bracePoints = [];
    for (const height of [4, 8, 12, 16]) {
      bracePoints.push(
        new THREE.Vector3(-0.55, height - 1.6, -0.55), new THREE.Vector3(0.55, height + 1.6, -0.55),
        new THREE.Vector3(0.55, height - 1.6, -0.55), new THREE.Vector3(-0.55, height + 1.6, -0.55),
        new THREE.Vector3(-0.55, height - 1.6, 0.55), new THREE.Vector3(0.55, height + 1.6, 0.55),
        new THREE.Vector3(0.55, height - 1.6, 0.55), new THREE.Vector3(-0.55, height + 1.6, 0.55),
      );
    }
    tower.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(bracePoints),
      new THREE.LineBasicMaterial({ color: materials.graphite.color }),
    ));

    const head = new THREE.Group();
    head.position.set(leanX, 20.3, leanZ);
    const headWorldPosition = new THREE.Vector3(x + leanX, 20.3, z + leanZ);
    const headDirection = fieldTarget.clone().sub(headWorldPosition).normalize();
    head.quaternion.setFromUnitVectors(headForward, headDirection);

    for (const y of [-2.1, 2.1]) {
      const rail = new THREE.Mesh(frameHorizontal, materials.graphite);
      rail.position.set(0, y, -0.06);
      head.add(rail);
    }
    for (const xPosition of [-4.7, 0, 4.7]) {
      const rail = new THREE.Mesh(frameVertical, materials.graphite);
      rail.position.set(xPosition, 0, -0.06);
      head.add(rail);
    }

    const yoke = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.7), materials.graphite);
    yoke.position.set(0, -2.48, -0.28);
    head.add(yoke);

    const lampCount = 32;
    const housings = new THREE.InstancedMesh(housingGeometry, materials.graphite, lampCount);
    const lenses = new THREE.InstancedMesh(lensGeometry, lensMaterial, lampCount);
    const housingMatrix = new THREE.Matrix4();
    const lensMatrix = new THREE.Matrix4();
    let lampIndex = 0;
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const lampPosition = new THREE.Vector3(-3.85 + column * 1.1, -1.5 + row, 0.08);
        housingMatrix.compose(lampPosition, housingRotation, instanceScale);
        lensMatrix.compose(
          new THREE.Vector3(lampPosition.x, lampPosition.y, 0.25),
          new THREE.Quaternion(),
          instanceScale,
        );
        housings.setMatrixAt(lampIndex, housingMatrix);
        lenses.setMatrixAt(lampIndex, lensMatrix);
        lampIndex += 1;
      }
    }
    housings.instanceMatrix.needsUpdate = true;
    lenses.instanceMatrix.needsUpdate = true;
    head.add(housings, lenses);
    tower.add(head);
    group.add(tower);

    const light = new THREE.SpotLight(0xfff7df, 130, 175, Math.PI / 4.2, 0.82, 1.5);
    light.position.copy(headWorldPosition);
    light.target.position.copy(fieldTarget);
    scene.add(light, light.target);
  }
}

export function buildStadium(scene) {
  const group = new THREE.Group();
  group.name = 'stadium-environment';
  const materials = {
    concrete: standard(COLORS.concrete),
    concreteDark: standard(COLORS.concreteDark),
    concourse: standard(COLORS.concourse),
    graphite: standard(COLORS.graphite, { roughness: 0.7, metalness: 0.18 }),
    ground: standard(COLORS.ground),
    roof: standard(0x565e59, { roughness: 0.62, metalness: 0.25 }),
    tunnel: standard(COLORS.screen, { roughness: 1 }),
    ads: COLORS.ads.map(color => standard(color, { roughness: 0.72 })),
  };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(190, 154), materials.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.09;
  ground.receiveShadow = true;
  group.add(ground);

  addLongStand(group, materials, -1);
  addLongStand(group, materials, 1);
  addEndStand(group, materials, -1);
  addEndStand(group, materials, 1);
  addCornerDecks(group, materials);
  addSeats(group, materials);
  addRailings(group, materials);
  addPitchFurniture(group, materials);
  addFloodlights(group, scene, materials);

  scene.add(group);
  return group;
}
