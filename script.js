const $ = s => document.querySelector(s),
D = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const P = (la, ln) => ({
  x: Math.round((ln - 125.44) / .25 * 600),
  y: Math.round((7.26 - la) / .32 * 420)
});

const esc = t => t.replace(/[&<>"]/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}[c]));

const col = v =>
  v >= 75 ? 'var(--bad)' :
  v >= 45 ? 'var(--warn)' :
  'var(--ok)';

const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// name, lat, lng, drop day (0=Sun), start fill %, fill rate
const S = [
  ['Panacan', 7.1275, 125.648, 3, 40, 6],
  ['Buhangin', 7.1, 125.615, 1, 25, 4],
  ['Lanang', 7.098, 125.635, 2, 60, 5],
  ['Bajada', 7.09, 125.615, 4, 70, 4],
  ['Poblacion', 7.064, 125.608, 5, 35, 6],
  ['Matina', 7.056, 125.572, 6, 20, 3],
  ['Talomo', 7.04, 125.55, 2, 55, 4],
  ['Toril', 6.995, 125.5, 4, 45, 3],
  ['Calinan', 7.19, 125.456, 1, 30, 3]
].map(([n, a, o, d, f, r]) => ({
  id: n.toLowerCase(),
  name: n,
  ...P(a, o),
  day: d,
  fill: f,
  rate: r
}));

const wh = {
  ...P(7.045, 125.545),
  fill: 600,
  cap: 2000
};

const T = [];

let tid = 0,
role = '',
sel = 'panacan',
day = new Date().getDay(),
posts = [],
pending = null,
ticks = 0;

const site = id => S.find(s => s.id === id);

function addTruck() {
  tid++;

  T.push({
    id: tid,
    x: wh.x + tid * 6,
    y: wh.y + 14,
    load: 0,
    cap: 300,
    tg: null,
    st: 'idle'
  });
}

addTruck();
addTruck();

$('#dsel').innerHTML = D.map((d, i) =>
  `<option value="${i}"${i === day ? ' selected' : ''}>
    ${d}${i === new Date().getDay() ? ' (today)' : ''}
  </option>`
).join('');

function start(r) {
  role = r;

  $('#intro').hidden = true;
  $('#app').hidden = false;

  $('#who').textContent = {
    res: 'Resident',
    col: 'Collector',
    adm: 'Admin'
  }[r];

  panel();
}

function home() {
  $('#app').hidden = true;
  $('#intro').hidden = false;
}

function pick(id) {
  sel = id;
  panel();
}

// ------------------------------
// LIVE TRUCK SIMULATION
// ------------------------------

function tick() {
  ticks++;

  if (ticks % 8 === 0) {
    S.forEach(s => {
      if (s.day === day) {
        s.fill = Math.min(
          100,
          +(s.fill + s.rate / 4).toFixed(1)
        );
      }
    });
  }

  T.forEach(t => {

    if (t.st === 'idle') {

      const taken = T
        .filter(o => o !== t && o.tg)
        .map(o => o.tg);

      const c = S
        .filter(s =>
          s.fill >= 25 &&
          !taken.includes(s) &&
          s.fill <= t.cap - t.load
        )
        .sort((a, b) =>
          b.fill / (1 + d2(t, b) / 150) -
          a.fill / (1 + d2(t, a) / 150)
        );

      if (t.load >= t.cap * .85 || (!c.length && t.load > 0)) {
        t.tg = wh;
        t.st = 'wh';
      } else if (c.length) {
        t.tg = c[0];
        t.st = 'site';
      }
    }

    if (!t.tg) return;

    const dx = t.tg.x - t.x;
    const dy = t.tg.y - t.y;
    const d = Math.hypot(dx, dy);

    if (d < 5) {

      if (t.st === 'site') {
        t.load += t.tg.fill;
        t.tg.fill = 0;
      } else if (wh.fill + t.load <= wh.cap) {
        wh.fill += t.load;
        t.load = 0;
      } else {
        return;
      }

      t.tg = null;
      t.st = 'idle';

    } else {
      t.x += dx / d * 4;
      t.y += dy / d * 4;
    }
  });

  drawMap();
  live();
}

setInterval(tick, 400);

// ------------------------------
// MAP
// ------------------------------

function drawMap() {

  let s =
    '<svg viewBox="0 0 600 420" role="img" aria-label="Schematic map of Davao City barangays, trucks and warehouse">' +

    '<rect width="600" height="420" fill="var(--land)"/>' +

    '<path d="M600 40L560 90L535 150L515 190L495 225L440 262L410 285L330 315L250 350L170 385L110 420L600 420Z" fill="var(--sea)"/>' +

    '<text x="500" y="340" font-size="13" fill="var(--mute)" text-anchor="middle">Davao Gulf</text>';

  S.forEach(b => {

    const open = b.day === day;
    const on = b.id === sel;

    s += `
      <g onclick="pick('${b.id}')" style="cursor:pointer">

        <circle
          cx="${b.x}"
          cy="${b.y}"
          r="${on ? 17 : 14}"
          fill="${col(b.fill)}"
          stroke="${on ? 'var(--ai)' : 'var(--card)'}"
          stroke-width="3"
        />
    `;

    if (open) {
      s += `
        <circle
          cx="${b.x}"
          cy="${b.y}"
          r="21"
          fill="none"
          stroke="var(--ai)"
          stroke-width="2"
          stroke-dasharray="4 3"
        />
      `;
    }

    s += `
        <text
          x="${b.x}"
          y="${b.y + 4}"
          text-anchor="middle"
          font-size="11"
          font-weight="700"
          fill="#fff"
        >
          ${Math.round(b.fill)}
        </text>

        <text
          x="${b.x}"
          y="${b.y + 34}"
          text-anchor="middle"
          font-size="11"
          fill="var(--ink)"
        >
          ${b.name}
        </text>

      </g>
    `;
  });

  s += `
    <text
      x="${wh.x - 10}"
      y="${wh.y + 6}"
      font-size="20"
    >
      🏭
    </text>
  `;

  T.forEach(t => {
    s += `
      <text
        x="${t.x - 10}"
        y="${t.y}"
        font-size="20"
      >
        🚛
      </text>

      <text
        x="${t.x + 10}"
        y="${t.y - 12}"
        font-size="10"
        font-weight="700"
        fill="var(--ink)"
      >
        T${t.id}
      </text>
    `;
  });

  $('#map').innerHTML = s + '</svg>';
}

// ------------------------------
// PANELS
// Rebuilt on actions only,
// so typing is never lost
// ------------------------------

function panel() {

  const p = $('#panel');

  if (role === 'res') {

    p.innerHTML = `
      <h2>Your barangay</h2>

      <select
        onchange="pick(this.value)"
        aria-label="Barangay"
      >
        ${S.map(s => `
          <option
            value="${s.id}"
            ${s.id === sel ? 'selected' : ''}
          >
            ${s.name}
          </option>
        `).join('')}
      </select>

      <div id="live"></div>
      <div id="msg"></div>

      <h2>Post feedback</h2>

      <textarea
        id="fbt"
        rows="3"
        placeholder="Bin overflowing, missed pickup, thank you..."
      ></textarea>

      <input
        type="file"
        accept="image/*"
        onchange="pic(this)"
        aria-label="Attach a photo"
        style="margin-top:6px"
      >

      <img
        id="prev"
        hidden
        alt="Photo preview"
        style="max-width:140px;margin-top:6px;border-radius:8px"
      >

      <button
        class="btn w"
        onclick="postFb()"
      >
        Post to this barangay
      </button>

      <h2>Posts here</h2>

      <div id="feed"></div>
    `;

  } else if (role === 'col') {

    p.innerHTML = `
      <div id="live"></div>

      <h2>Site details</h2>

      <div id="feed"></div>
    `;

  } else {

    p.innerHTML = `
      <div id="live"></div>

      <h2>Drop day per barangay</h2>

      ${S.map((s, i) => `
        <div class="sched">

          <span>${s.name}</span>

          <select
            aria-label="Drop day for ${s.name}"
            onchange="S[${i}].day=+this.value;drawMap();live()"
          >
            ${D.map((d, j) => `
              <option
                value="${j}"
                ${j === s.day ? 'selected' : ''}
              >
                ${d}
              </option>
            `).join('')}
          </select>

        </div>
      `).join('')}
    `;
  }

  feed();
  live();
  drawMap();
}

function live() {

  const el = $('#live');

  if (!el) return;

  const s = site(sel);
  const open = s.day === day;

  let h = '';

  const tr =
    `<h2>Trucks (${T.length})</h2>` +

    T.map(t => `
      <div class="row">

        <span>
          T${t.id}:
          ${
            t.st === 'site'
              ? 'to ' + t.tg.name
              : t.st === 'wh'
              ? (
                  wh.fill + t.load > wh.cap
                    ? 'waiting, warehouse full'
                    : 'to warehouse'
                )
              : 'idle'
          }
        </span>

        <span>
          ${Math.round(t.load)}/${t.cap} kg
        </span>

      </div>

      <div class="meter">
        <b
          style="
            width:${t.load / t.cap * 100}%;
            background:${col(t.load / t.cap * 100)}
          "
        ></b>
      </div>
    `).join('');

  const wm = `
    <div class="row">
      <span>Warehouse</span>
      <span>
        ${Math.round(wh.fill)}/${wh.cap} kg
      </span>
    </div>

    <div class="meter">
      <b
        style="
          width:${wh.fill / wh.cap * 100}%;
          background:${col(wh.fill / wh.cap * 100)}
        "
      ></b>
    </div>
  `;

  if (role === 'res') {

    h = `
      <div
        class="card"
        style="margin-top:8px"
      >

        <b>
          ${s.name} drop point
        </b>

        <div class="row">

          <span>
            Drop day: ${D[s.day]}
          </span>

          <span>
            ${Math.round(s.fill)}% full
          </span>

        </div>

        <div class="meter">
          <b
            style="
              width:${s.fill}%;
              background:${col(s.fill)}
            "
          ></b>
        </div>
    `;

    if (open) {

      if (s.fill >= 95) {

        h += `
          <div class="alert bad">
            This site is full. A truck is being sent.
          </div>
        `;

      } else {

        h += `
          <div class="alert ok">
            Open today. You can throw your trash here.
          </div>
        `;
      }

    } else {

      h += `
        <div class="alert warn">
          Not open today.
          ${s.name} throws on ${D[s.day]}s.
        </div>
      `;
    }

    h += `
        <button
          class="btn w"
          ${open && s.fill < 95 ? '' : 'disabled'}
          onclick="throwTrash()"
        >
          I threw my trash here
        </button>

      </div>
    `;

  } else if (role === 'col') {

    h =
      tr +
      wm +
      '<h2>Sites by fill</h2>' +

      [...S]
        .sort((a, b) => b.fill - a.fill)
        .map(b => `
          <div
            class="li"
            onclick="pick('${b.id}')"
          >

            <div
              class="row"
              style="color:var(--ink)"
            >

              <span>
                <b>${b.name}</b>
                (${D[b.day]})
              </span>

              <span>
                ${Math.round(b.fill)}%
              </span>

            </div>

            <div class="meter">
              <b
                style="
                  width:${b.fill}%;
                  background:${col(b.fill)}
                "
              ></b>
            </div>

          </div>
        `).join('');

  } else {

    h = `
      <h2>Fleet</h2>

      <div
        style="
          display:flex;
          gap:8px
        "
      >

        <button
          class="btn"
          onclick="addTruck();panel()"
        >
          Add truck
        </button>

        <button
          class="btn alt"
          onclick="T.length > 1 && T.pop();panel()"
        >
          Remove truck
        </button>

        <button
          class="btn alt"
          onclick="wh.fill=Math.max(0,wh.fill-500);live()"
        >
          Haul 500 kg
        </button>

      </div>
    ` + tr + wm;
  }

  el.innerHTML = h;
}

function feed() {

  const f = $('#feed');

  if (!f) return;

  const l = posts.filter(p => p.id === sel);

  f.innerHTML =
    (
      role === 'col'
        ? `
          <b>${site(sel).name}</b>

          <span class="mute">
            (${Math.round(site(sel).fill)}% full,
            ${D[site(sel).day]})
          </span>
        `
        : ''
    ) +

    (
      l.length

        ? l.map(p => `
            <div class="post">

              ${esc(p.t) || '<i>Photo only</i>'}

              <div class="mute">
                ${p.time}
              </div>

              ${
                p.img
                  ? `
                    <img
                      src="${p.img}"
                      alt="Resident photo"
                    >
                  `
                  : ''
              }

            </div>
          `).join('')

        : `
          <p class="mute">
            No posts yet for this barangay.
          </p>
        `
    );
}

function throwTrash() {

  const s = site(sel);

  if (s.day !== day || s.fill >= 95) return;

  s.fill = Math.min(100, s.fill + 8);

  $('#msg').innerHTML = `
    <div class="alert ok">
      Thanks! Your trash was added to ${s.name}.
    </div>
  `;

  live();
  drawMap();
}

function pic(inp) {

  const f = inp.files[0];

  if (!f) return;

  const r = new FileReader();

  r.onload = () => {

    const i = new Image();

    i.onload = () => {

      const c = document.createElement('canvas');

      const k = Math.min(
        1,
        320 / i.width
      );

      c.width = i.width * k;
      c.height = i.height * k;

      c
        .getContext('2d')
        .drawImage(
          i,
          0,
          0,
          c.width,
          c.height
        );

      pending = c.toDataURL(
        'image/jpeg',
        .7
      );

      $('#prev').src = pending;
      $('#prev').hidden = false;
    };

    i.src = r.result;
  };

  r.readAsDataURL(f);
}

function postFb() {

  const t = $('#fbt')
    .value
    .trim();

  if (!t && !pending) return;

  posts.unshift({
    id: sel,
    t,
    img: pending,
    time:
      D[day] +
      ' ' +
      new Date().toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      )
  });

  pending = null;

  $('#fbt').value = '';

  $('#prev').hidden = true;

  feed();
}

drawMap();
