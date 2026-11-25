/* Moté's hand-built turntable. The soft sculpture is an indexed 3D mesh,
   rendered to a transparent canvas so it needs no downloads or GPU features. */
(() => {
  "use strict";

  const canvas = document.getElementById("mote-model");
  if (!canvas) return;

  const button = document.getElementById("mote-motion");
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    const mark = new URL("favicon.svg", document.currentScript?.src || document.baseURI);
    canvas.style.background = `center / contain no-repeat url("${mark.href}")`;
    canvas.removeAttribute("tabindex");
    if (button) button.hidden = true;
    return;
  }

  const tau = 2 * Math.PI;
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  const mix = (a, b, t) => a + (b - a) * t;
  function smooth(start, end, value) {
    const t = clamp((value - start) / (end - start), 0, 1);
    return t * t * (3 - 2 * t);
  }
  const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  function unit(a) {
    const length = Math.hypot(...a) || 1;
    return a.map(value => value / length);
  }

  // Width, thickness, and the curling tip are independent. This keeps the
  // pillow-like profile and the pinched, off-center tail of the sewn original.
  function body(lon, t) {
    const fullness = Math.sqrt(Math.max(0, 4 * t * (1 - t)));
    const taper = (1 - 0.48 * t) * (1 - 0.27 * smooth(0.53, 0.96, t));
    const sideSeam = Math.abs(Math.sin(lon)) ** 7;
    const gathers = sideSeam * (0.012 * Math.sin(t * 38 + lon) + 0.008 * Math.sin(t * 62 - lon));
    const wave = 1 + fullness * (0.019 * Math.sin(3 * lon + t * 3) + gathers);
    const curl = smooth(0.42, 1, t);
    const x = -0.18 + 0.92 * curl + 0.88 * fullness * taper * Math.sin(lon) * wave;
    const y = 0.81 - 1.79 * t + 0.20 * smooth(0.71, 0.99, t)
      + 0.055 * fullness * Math.sin(lon) * (0.72 - t);
    const z = -0.025 * curl + 0.52 * fullness * (1 - 0.64 * t) * Math.cos(lon) * wave;
    return [x, y, z];
  }

  function bodySurface(lon, t, offset) {
    const p = body(lon, t);
    const du = minus(body(lon + 0.001, t), body(lon - 0.001, t));
    const dv = minus(body(lon, t + 0.001), body(lon, t - 0.001));
    const normal = unit(cross(dv, du));
    return p.map((value, i) => value + normal[i] * offset);
  }

  const positions = [], normals = [], materials = [], triangles = [];
  function vertex(point, normal, material) {
    const id = materials.length;
    positions.push(...point);
    normals.push(...normal);
    materials.push(material);
    return id;
  }

  function skin(rings, sides, pointAt, material) {
    const first = materials.length;
    for (let j = 0; j <= rings; j++) {
      const v = j / rings;
      const innerV = clamp(v, 0.0005, 0.9995);
      for (let i = 0; i < sides; i++) {
        const u = i / sides;
        const dv = minus(pointAt(u, innerV + 0.0003), pointAt(u, innerV - 0.0003));
        const du = minus(pointAt(u + 0.0003, innerV), pointAt(u - 0.0003, innerV));
        vertex(pointAt(u, v), unit(cross(dv, du)), material);
        if (j === rings) continue;
        const a = first + j * sides + i;
        const b = first + j * sides + (i + 1) % sides;
        triangles.push(a, a + sides, b, b, a + sides, b + sides);
      }
    }
  }

  // A tube follows a path with an elliptical cross-section. Its raised
  // threads, eyelids, wraps and fins all have their own visible silhouettes.
  function tube(path, radiusAt, rings, sides, material, axis = [0, 0, 1]) {
    const frames = new Map();
    function pointAt(u, v) {
      if (!frames.has(v)) {
        const tangent = unit(minus(path(Math.min(1, v + 0.0003)), path(Math.max(0, v - 0.0003))));
        const a = unit(cross(tangent, axis));
        frames.set(v, [path(v), radiusAt(v), a, cross(a, tangent)]);
      }
      const [p, r, a, b] = frames.get(v);
      const ca = Math.cos(tau * u) * r[0], sb = Math.sin(tau * u) * r[1];
      return p.map((value, i) => value + a[i] * ca + b[i] * sb);
    }
    skin(rings, sides, pointAt, material);
  }
  const round = (r) => () => [r, r];

  skin(38, 60, (u, v) => body(u * tau, v), 0);

  // Two small stuffed fins, set into opposite side seams.
  for (const side of [-1, 1]) {
    const left = side < 0;
    const fin = t => [
      mix(left ? -0.66 : 0.31, left ? -1.00 : 0.78, t),
      mix(left ? 0.035 : 0.065, left ? -0.13 : 0.15, t) + 0.065 * Math.sin(Math.PI * t),
      mix(left ? 0.03 : 0.015, left ? 0.11 : -0.025, t),
    ];
    const finSize = t => {
      const s = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.64);
      return [0.155 * s, 0.103 * s];
    };
    tube(fin, finSize, 15, 22, 0);
  }

  // A doubled seam dips in and out of the pale fabric along the silhouette.
  for (const side of [-1, 1]) {
    const seam = t => bodySurface(side * (Math.PI / 2 + 0.10), mix(0.025, 0.964, t), 0.004);
    tube(seam, round(0.009), 34, 5, 3);
    for (let j = 1; j < 11; j++) {
      const v = 0.08 + j * 0.072;
      const tack = s => bodySurface(side * (Math.PI / 2 + mix(0.066, 0.135, s)), v + 0.008 * s, 0.005);
      tube(tack, round(0.0055), 2, 5, 3);
    }
  }

  // Each sleeping eyelid dips into a different little smile-shaped arc.
  for (const side of [-1, 1]) {
    const left = side < 0;
    const eye = s => {
      const lon = mix(left ? -1.00 : 0.14, left ? -0.18 : 0.94, s);
      const dip = 1 - (2 * s - 1) ** 2;
      const v = (left ? 0.293 : 0.282) + 0.061 * dip + (left ? 0.012 : -0.014) * s;
      return [lon, v];
    };
    const lid = s => bodySurface(...eye(s), 0.0105);
    const endTaper = s => {
      const r = 0.007 + 0.012 * Math.sin(Math.PI * s) ** 0.40;
      return [r, r];
    };
    tube(lid, endTaper, 24, 8, 2);
    for (let j = 0; j < 8; j++) {
      const s = 0.08 + j * 0.12;
      const [lon, v] = eye(s);
      const lash = t => bodySurface(
        lon + (side * 0.019 + (s - 0.5) * 0.095) * t,
        v + (0.014 + (left ? 1 - s : s) * 0.019 + 0.004 * Math.sin(5 * j)) * t,
        0.012 - 0.007 * t
      );
      tube(lash, t => [0.0098 - 0.005 * t, 0.0098 - 0.005 * t], 4, 5, 2);
    }
  }

  // The collar of the halo is irregular, with wrapped joins and one shard.
  function haloAt(a) {
    return [
      -0.195 + 0.475 * Math.cos(a) * (1 + 0.022 * Math.sin(3 * a)),
      1.072 + 0.100 * Math.cos(a) - 0.119 * Math.sin(a) + 0.014 * Math.cos(3 * a),
      -0.015 + 0.385 * Math.sin(a),
    ];
  }
  function haloRadius(a) {
    return 0.044 + 0.005 * Math.sin(5 * a + 0.4) + 0.0025 * Math.sin(12 * a);
  }
  tube(t => haloAt(t * tau), t => [haloRadius(t * tau), haloRadius(t * tau)], 94, 14, 1, [0, 1, 0]);
  for (const angle of [0.29, 0.43, 2.50, 2.65, 2.80, 3.92, 4.06, 5.24, 5.37]) {
    const wrap = s => {
      const a = angle + 0.066 * (s - 0.5);
      const p = haloAt(a), r = haloRadius(a) + 0.0036;
      return [
        p[0] + r * Math.cos(tau * s) * Math.cos(a),
        p[1] + r * Math.sin(tau * s),
        p[2] + r * Math.cos(tau * s) * Math.sin(a),
      ];
    };
    tube(wrap, round(0.008), 15, 5, 3, [1, 0.15, 0.1]);
  }

  function crystal(center, width, height, material) {
    const top = [center[0] - width * 0.13, center[1] + height * 0.50, center[2]];
    const tip = [center[0] + width * 0.14, center[1] - height * 0.50, center[2]];
    const facets = 7;
    const belt = Array.from({ length: facets }, (_, i) => {
      const angle = i / facets * tau;
      return [center[0] + width * Math.cos(angle), center[1] + height * 0.14, center[2] + width * 0.68 * Math.sin(angle)];
    });
    for (let i = 0; i < facets; i++) {
      const a = belt[i], b = belt[(i + 1) % facets];
      for (const face of [[top, b, a], [tip, a, b]]) {
        const normal = unit(cross(minus(face[1], face[0]), minus(face[2], face[0])));
        triangles.push(...face.map(p => vertex(p, normal, material)));
      }
    }
  }
  const charm = haloAt(2.68);
  crystal([charm[0] - 0.021, charm[1] - 0.057, charm[2] + 0.02], 0.062, 0.155, 4);

  const model = {
    points: new Float32Array(positions),
    normals: new Float32Array(normals),
    faces: new Uint16Array(triangles),
    materials: new Uint8Array(materials),
    projected: new Float32Array(materials.length * 6),
  };
  let pixels, depth, grain;
  let width = 0, height = 0;
  let yaw = -0.13, pitch = 0.15;
  let visible = true, dragging = null, previousFrame = 0, holdUntil = 0, animationId = 0;
  let dirty = true;
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let paused = preference.matches;
  let chosenMotion = false;

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;
    const resolution = Math.min(2, Math.max(1.65, window.devicePixelRatio || 1), 490 / Math.max(bounds.width, bounds.height));
    const w = Math.max(1, Math.round(bounds.width * resolution));
    const h = Math.max(1, Math.round(bounds.height * resolution));
    if (w === width && h === height) return;
    canvas.width = width = w;
    canvas.height = height = h;
    pixels = context.createImageData(w, h);
    depth = new Float32Array(w * h);
    grain = new Int8Array(w * h);
    let seed = 7125;
    for (let i = 0; i < grain.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      grain[i] = ((seed >>> 29) - 3) * 0.72;
    }
    dirty = true;
    wake();
  }

  function project() {
    const { points, normals, materials, projected } = model;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const scale = Math.min(width / 2.44, height / 2.46);
    for (let i = 0; i < materials.length; i++) {
      const j = i * 3, k = i * 6;
      const x = points[j], y = points[j + 1] - 0.13, z = points[j + 2];
      const rollX = cy * x + sy * z, rollZ = cy * z - sy * x;
      const viewY = cp * y - sp * rollZ, viewZ = sp * y + cp * rollZ;
      const perspective = 5.2 / (5.2 - viewZ);
      projected[k] = width * 0.5 + rollX * scale * perspective;
      projected[k + 1] = height * 0.53 - viewY * scale * perspective;
      projected[k + 2] = viewZ;

      const localX = normals[j], localY = normals[j + 1], localZ = normals[j + 2];
      const nx = cy * localX + sy * localZ, rotatedZ = cy * localZ - sy * localX;
      const ny = cp * localY - sp * rotatedZ, nz = sp * localY + cp * rotatedZ;
      const diffuse = clamp(0.47 + 0.56 * (-0.50 * nx + 0.67 * ny + 0.55 * nz), 0, 1);
      const specular = Math.max(0, -0.32 * nx + 0.44 * ny + 0.837 * nz) ** 24;
      const rim = (1 - Math.max(0, nz)) ** 2;
      let r, g, b;
      switch (materials[i]) {
        case 1: {
          const reflection = 2 * nz * ny;
          const sky = smooth(-0.08, 0.32, reflection);
          const ribbon = Math.exp(-(((reflection - 0.55) / 0.23) ** 2));
          const under = Math.exp(-(((reflection + 0.52) / 0.13) ** 2));
          const silver = 91 + 95 * sky + 57 * ribbon + 94 * under + 35 * rim + 44 * specular;
          r = silver + 14 * (1 - sky);
          g = silver + 4 + 14 * sky;
          b = silver + 21 + 10 * Math.max(0, nx);
          break;
        }
        case 2:
          r = 26 + 23 * diffuse + 13 * specular;
          g = 23 + 21 * diffuse + 13 * specular;
          b = 35 + 27 * diffuse + 17 * specular;
          break;
        case 3:
          r = 148 + 78 * diffuse + 18 * specular;
          g = 148 + 78 * diffuse + 20 * specular;
          b = 168 + 63 * diffuse + 22 * specular;
          break;
        case 4: {
          const flash = (1 + Math.sin(4.3 * nx + 3.8 * ny + nz)) * 0.5;
          r = 124 + 80 * diffuse + 50 * flash + 36 * specular;
          g = 107 + 88 * diffuse + 33 * (1 - flash) + 52 * specular;
          b = 189 + 54 * diffuse + 28 * specular;
          break;
        }
        default: {
          const green = clamp(-0.75 * nx + 0.28 * ny + 0.08, 0, 1);
          const blush = clamp(nx * 0.77 - ny * 0.41, 0, 1);
          const bounce = clamp(-nx * 0.71 - ny * 0.6 - 0.10, 0, 1) ** 3;
          r = 120 + 118 * diffuse + 26 * specular + 23 * rim + 20 * blush - 8 * green + 8 * bounce;
          g = 116 + 122 * diffuse + 27 * specular + 21 * rim + 18 * green - 7 * blush + 38 * bounce;
          b = 151 + 82 * diffuse + 27 * specular + 31 * rim + 16 * blush + 36 * bounce;
          break;
        }
      }
      projected[k + 3] = r;
      projected[k + 4] = g;
      projected[k + 5] = b;
    }
  }

  function render() {
    if (!pixels) return;
    project();
    const frame = pixels.data, p = model.projected, f = model.faces;
    frame.fill(0);
    depth.fill(-Infinity);
    for (let i = 0; i < f.length; i += 3) {
      const a = f[i] * 6, b = f[i + 1] * 6, c = f[i + 2] * 6;
      const ax = p[a], ay = p[a + 1], bx = p[b], by = p[b + 1], cx = p[c], cy = p[c + 1];
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (area > -0.001) continue;
      const left = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - 0.5));
      const right = Math.min(width - 1, Math.floor(Math.max(ax, bx, cx) - 0.5));
      const top = Math.max(0, Math.ceil(Math.min(ay, by, cy) - 0.5));
      const bottom = Math.min(height - 1, Math.floor(Math.max(ay, by, cy) - 0.5));
      const dxA = (by - cy) / area, dyA = (cx - bx) / area;
      const dxB = (cy - ay) / area, dyB = (ax - cx) / area;
      const px = left + 0.5, py = top + 0.5;
      let startA = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
      let startB = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
      const az = p[a + 2] - p[c + 2], bz = p[b + 2] - p[c + 2], cz = p[c + 2];
      const ar = p[a + 3] - p[c + 3], br = p[b + 3] - p[c + 3], cr = p[c + 3];
      const ag = p[a + 4] - p[c + 4], bg = p[b + 4] - p[c + 4], cg = p[c + 4];
      const ab = p[a + 5] - p[c + 5], bb = p[b + 5] - p[c + 5], cb = p[c + 5];
      const textile = model.materials[f[i]] === 0;
      for (let y = top; y <= bottom; y++) {
        let s = startA, t = startB;
        for (let x = left, index = y * width + left; x <= right; x++, index++, s += dxA, t += dxB) {
          if (s < -0.00005 || t < -0.00005 || s + t > 1.00005) continue;
          const z = cz + s * az + t * bz;
          if (z <= depth[index]) continue;
          depth[index] = z;
          const noise = textile ? grain[index] : 0;
          const k = index * 4;
          frame[k] = cr + s * ar + t * br + noise;
          frame[k + 1] = cg + s * ag + t * bg + noise;
          frame[k + 2] = cb + s * ab + t * bb + noise;
          frame[k + 3] = 255;
        }
        startA += dyA;
        startB += dyB;
      }
    }
    context.putImageData(pixels, 0, 0);
  }

  function wake() {
    if (!animationId && visible && !document.hidden) animationId = requestAnimationFrame(tick);
  }
  function tick(time) {
    animationId = 0;
    if (!visible || document.hidden) return;
    const auto = !paused && !dragging && time > holdUntil;
    if (dirty || (auto && time - previousFrame >= 1000 / 25)) {
      if (auto && previousFrame > 0) {
        const seconds = Math.min(0.065, (time - previousFrame) / 1000);
        yaw = (yaw + seconds * (0.145 + 0.14 * (1 - Math.cos(yaw)))) % tau;
      }
      render();
      previousFrame = time;
      dirty = false;
    }
    if (!paused && !dragging) wake();
  }
  function updateButton() {
    if (!button) return;
    const label = paused ? "Resume rotation" : "Pause rotation";
    button.setAttribute("aria-pressed", String(paused));
    button.setAttribute("aria-label", label);
    button.title = label;
  }
  function toggle() {
    chosenMotion = true;
    paused = !paused;
    previousFrame = 0;
    updateButton();
    wake();
  }
  function turn() {
    dirty = true;
    holdUntil = performance.now() + 1400;
    wake();
  }

  canvas.style.touchAction = "pan-y";
  canvas.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight Home Space");
  canvas.addEventListener("pointerdown", e => {
    if (!e.isPrimary || e.button !== 0) return;
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw, pitch };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", e => {
    if (!dragging || dragging.id !== e.pointerId) return;
    yaw = dragging.yaw + (e.clientX - dragging.x) * 0.015;
    pitch = clamp(dragging.pitch + (e.clientY - dragging.y) * 0.0035, -0.21, 0.47);
    turn();
  });
  function release(e) {
    if (!dragging || dragging.id !== e.pointerId) return;
    dragging = null;
    canvas.style.cursor = "grab";
    turn();
  }
  canvas.style.cursor = "grab";
  canvas.addEventListener("lostpointercapture", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") yaw -= Math.PI / 12;
    else if (e.key === "ArrowRight") yaw += Math.PI / 12;
    else if (e.key === "Home") { yaw = -0.13; pitch = 0.15; }
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (!e.repeat) toggle();
      return;
    } else return;
    e.preventDefault();
    turn();
  });
  button?.addEventListener("click", toggle);
  preference.addEventListener?.("change", e => {
    if (chosenMotion) return;
    paused = e.matches;
    previousFrame = 0;
    updateButton();
    wake();
  });
  document.addEventListener("visibilitychange", () => { previousFrame = 0; wake(); });
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener("resize", resize);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      previousFrame = 0;
      wake();
    }).observe(canvas);
  }
  updateButton();
  resize();
})();
