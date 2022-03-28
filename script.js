const ticks_input = document.getElementById("ticks");
const bpm_input = document.getElementById("bpm");
const meter_input = document.getElementById("meter");
const hits_input = document.getElementById("hits");
const vector_input = document.getElementById("vector");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function getHits() {
  return hits_input.value.trim().split(/\s+/).map(x => parseInt(x));
}
function getVectors() {
  return vector_input.value.trim().split(/\s+/).map(x => parseInt(x));
}

function nmod(a, b) {
  return ((a % b) + b) % b;
}

function normalize(p) {
  let mag = Math.sqrt(p[0]*p[0] + p[1]*p[1]);
  return [p[0] / mag, p[1] / mag];
}

let looping = false;
async function loop() {
  looping = !looping;
  while (looping) {
    await play();
  }
}

async function play() {
  let ms_per_tick = 60000 / bpm_input.value / ticks_input.value;
  let hits = getHits();
  
  let max_tick = Math.max(...hits);
  
  for (let i = 0; i < Math.ceil(max_tick / state.ticks) * state.ticks; i++) {
    if (hits.includes(i)) {
      // I'd rather not reload every time... but resetting time to 0 has big lag
      let audio = new Audio("hit.wav");
      audio.play();
    }
    draw(i);
    await new Promise(_ => setTimeout(_, ms_per_tick));
  }
  draw();
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function is_mirror(hits, point, ticks) {
  let m = true;
  for (let j = 0; j < hits.length; j++) {
    m &= hits.includes(nmod(2 * point - hits[j], ticks));
  }
  return m;
}

let state;
function update() {
  state = {
    ticks: 0,
    tpb: 0,
    points: [],
    isoscles: [],
    mirror: [],
    right: [],
  };
  let width = canvas.width;
  let height = canvas.height;
  let cx = width/2;
  let cy = height/2;
  let radius = 200;
  let hits = getHits();

  let hit_to_point = (hit, radius) => [
    Math.cos(angle*hit - Math.PI/2)*radius + cx,
    Math.sin(angle*hit - Math.PI/2)*radius + cy,
  ];

  // Tick count
  state.tpb = parseInt(ticks_input.value);
  state.ticks = state.tpb * parseInt(meter_input.value);  
  let angle = Math.PI*2 / state.ticks;

  // Update vector
  let v = hits.map((e, i) => hits[i+1] - e);
  v.pop();
  v.push(hits[0] + state.ticks - hits[hits.length - 1]);
  vector_input.value = v.join(" ");

  for (let i = 0; i < hits.length; i++) {
    // Points
    let hit = hits[i];
    let p = hit_to_point(hit, radius);
    state.points.push([...p, hit]);
    
    // Isoscles triangle
    let prev_hit = hits[nmod(i-1, hits.length)];
    let next_hit = hits[(i+1) % hits.length];
    if (prev_hit > hit) prev_hit -= state.ticks;
    if (next_hit < hit) next_hit += state.ticks;
    if (Math.abs(hit-prev_hit) === Math.abs(hit-next_hit)) {
      state.isoscles.push([
        ...hit_to_point(prev_hit, radius),
      ...hit_to_point(next_hit, radius)
      ]);
    }
    
    // Right angle
    let p1 = hit_to_point(prev_hit, radius);
    let p2 = hit_to_point(next_hit, radius);
    let l1 = [p[0] - p1[0], p[1] - p1[1]];
    let l2 = [p[0] - p2[0], p[1] - p2[1]];
    if (Math.abs(l1[0]*l2[0] + l1[1]*l2[1]) < 0.000001) {
      state.right.push([
        ...p,
        ...normalize(l1).map(x => -x * 20),
        ...normalize(l2).map(x => -x * 20),
      ]);
    }
    
    // Mirror axes
    let pair_average = nmod((hit + next_hit) / 2, state.ticks);
    if (is_mirror(hits, pair_average, state.ticks)
        && !state.mirror.some(x => x.includes(pair_average))) {
      let opposite = state.ticks / 2 + pair_average;
      state.mirror.push([
        ...hit_to_point(pair_average, radius),
        ...hit_to_point(opposite, radius),
        nmod(opposite, state.ticks),
      ])
    } else if (is_mirror(hits, hit, state.ticks)
        && !state.mirror.some(x => x.includes(hit))) {
      let opposite = state.ticks / 2 + hit;
      state.mirror.push([
        ...hit_to_point(hit, radius),
        ...hit_to_point(opposite, radius),
        nmod(opposite, state.ticks),
      ])
    }

  }
}

function draw(color = -1) {
  let width = canvas.width;
  let height = canvas.height;
  let cx = width/2;
  let cy = height/2;
  let radius = 200;
  let tickmark_radius = radius - 10;
  let ticks = parseInt(state.ticks);
  let angle = Math.PI*2 / ticks;
  let hits = getHits();
  
  let hit_to_point = (hit, radius) => [
    Math.cos(angle*hit - Math.PI/2)*radius + cx,
    Math.sin(angle*hit - Math.PI/2)*radius + cy,
  ];
  
  // Clear
  ctx.clearRect(0, 0, width, height);
  
  // Draw circle
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI*2, false);
  ctx.stroke();
  
  // Tick marks
  ctx.strokeStyle = "#888888";
  for (let i = 0; i < ticks; i++) {
    line(...hit_to_point(i, radius), ...hit_to_point(i, i % state.tpb == 0 ? tickmark_radius - 10 : tickmark_radius));
  }
  ctx.strokeStyle = "#000000";
  
  // Right angles
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  state.right.forEach(l => {
    const [x, y, dx1, dy1, dx2, dy2] = l;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx1, y + dy1);
    ctx.lineTo(x + dx1 + dx2, y + dy1 + dy2);
    ctx.lineTo(x + dx2, y + dy2);
    ctx.lineTo(x, y);
    ctx.fill();
  });

  // Mirror axes
  ctx.setLineDash([5, 20]);
  state.mirror.forEach(l => {
    line(...l);
  });
  
  // Isoscles triangles
  ctx.setLineDash([10, 5]);
  state.isoscles.forEach(l => {
    line(...l);
  });
  ctx.setLineDash([]);
  
  // Points
  let fade = Math.floor(ticks / 2);
  for (let i = 0; i < state.points.length; i++) {
    const [px, py, t] = state.points[i];
    const [nx, ny] = state.points[(i + 1) % state.points.length];

    if (color >= t && color - t <= fade) {
      ctx.fillStyle = `rgb(${
        255 - 255*(color - t) / fade
      }, 40, 0)`
    } else {
      ctx.fillStyle = "#000000"
    }
    ctx.fillRect(px - 4, py - 4, 8, 8);
    line(px, py, nx, ny);
  }

  // Clock hand
  if (color >= 0) {
    const [hx, hy] = hit_to_point(color, radius);
    line(hx, hy, cx, cy);
  }
  
}

ticks_input.addEventListener("change", () => { update(); draw() });
meter_input.addEventListener("change", () => { update(); draw() });
hits_input.addEventListener("change", () => { update(); draw() });
vector_input.addEventListener("change", () => {
  let s = 0;
  hits_input.value = getVectors().map(e => {
    let t = s;
    s += e;
    return t;
  }).join(" ");
  update();
  draw();
});

update();
draw();
