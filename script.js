const $ = s => document.querySelector(s),
D = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const esc = t => t.replace(/[&<>"]/g, c => ({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;'
}[c]));

const col = v =>
  v >= 75 ? 'var(--bad)' :
  v >= 45 ? 'var(--warn)' :
  'var(--ok)';

const L = n => Math.round(n).toLocaleString() + ' L';

const PALETTE = [
  '#e6194b','#3cb44b','#4363d8','#f58231','#911eb4',
  '#42d4f4','#f032e6','#9a6324','#469990','#800000',
  '#808000','#000075','#b8860b','#1f6fd1','#2f9e6e',
  '#d64545','#ff69b4','#008080','#7b3fbf','#c9a227',
  '#5b8c2a','#b05a8a','#2a6f97','#a4133c','#6d4c41',
  '#00838f','#8e24aa','#ef6c00'
];

// ---- sites: [name, fallback lat, fallback lng, drop day (0=Sun), start fill %, fill rate, capacity L] ----
// fallback lat/lng are only used if the Geocoding API call for that barangay fails or returns a
// result outside Davao City; on load every site is (re)located via google.maps.Geocoder.
const S = [
  ['Panacan',7.1590,125.6445,3,40,6,2000],
  ['Sasa',7.1297,125.6509,1,55,5,1500],
  ['Lanang',7.1150,125.6350,4,30,4,1200],
  ['Cabantian',7.1150,125.6200,2,35,4,1000],
  ['Buhangin',7.1069,125.6137,1,25,4,1500],
  ['Agdao',7.0845,125.6239,2,60,5,1200],
  ['Ecoland',7.0700,125.6110,3,50,5,1200],
  ['Poblacion',7.0819,125.6031,5,35,6,2000],
  ['Maa',7.0455,125.5930,5,45,4,1000],
  ['Mintal',7.1150,125.5750,6,30,3,1000],
  ['Matina',7.0596,125.5784,6,20,3,1000],
  ['Talomo',7.0556,125.5506,2,50,4,1500],
  ['Tugbok',7.0800,125.5100,4,40,3,1000],
  ['Toril',7.0175,125.4998,4,45,3,1500],
  ['Calinan',7.1909,125.4557,1,30,3,1000],
  ['Baguio',7.3000,125.4300,3,25,2,800],
  ['Bunawan',7.2366,125.6439,4,70,4,1200],
  ['Paquibato',7.2500,125.6200,5,20,2,800]
].map(([n,la,ln,d,f,r,c]) => ({
  id:n.toLowerCase(),
  name:n,
  fla:la,
  fln:ln,
  la,
  ln,
  day:d,
  fill:f,
  rate:r,
  cap:c,
  arrivals:[],
  lastArrival:null
}));

// rough Davao City bounding box
const DAVAO_BOUNDS = {
  south:6.95,
  north:7.42,
  west:125.20,
  east:125.80
};

const inDavao = (la,ln) =>
  la >= DAVAO_BOUNDS.south &&
  la <= DAVAO_BOUNDS.north &&
  ln >= DAVAO_BOUNDS.west &&
  ln <= DAVAO_BOUNDS.east;

// warehouse
const wh = {
  id:'wh',
  name:'Warehouse',
  la:7.0900,
  ln:125.5300,
  fill:15000,
  cap:60000,
  lastArrival:null
};

// graph nodes
const NODES = {};

[wh, ...S].forEach(n => {
  NODES[n.id] = {
    la:n.la,
    ln:n.ln
  };
});

[
  ['matina-c',7.0625,125.5750]
].forEach(([id,la,ln]) => {
  NODES[id] = {la,ln};
});

// road network
const EDGES = [
  ['wh','matina-c'],
  ['matina-c','matina'],
  ['matina-c','talomo'],
  ['wh','talomo'],
  ['wh','tugbok'],
  ['tugbok','toril'],
  ['tugbok','calinan'],
  ['calinan','baguio'],
  ['toril','talomo'],
  ['talomo','tugbok'],
  ['matina','ecoland'],
  ['mintal','matina'],
  ['mintal','poblacion'],
  ['mintal','buhangin'],
  ['mintal','tugbok'],
  ['calinan','mintal'],
  ['ecoland','poblacion'],
  ['ecoland','maa'],
  ['ecoland','agdao'],
  ['poblacion','agdao'],
  ['agdao','maa'],
  ['agdao','buhangin'],
  ['buhangin','cabantian'],
  ['buhangin','lanang'],
  ['cabantian','lanang'],
  ['cabantian','panacan'],
  ['lanang','panacan'],
  ['sasa','panacan'],
  ['panacan','bunawan'],
  ['sasa','lanang'],
  ['bunawan','paquibato'],
  ['baguio','paquibato'],
  ['paquibato','calinan']
];

// ---- geocoding ----
function geocodeOne(name) {
  return new Promise(res => {
    const geocoder = new google.maps.Geocoder();

    geocoder.geocode({
      address:`Barangay ${name}, Davao City, Davao del Sur, Philippines`,
      componentRestrictions:{country:'PH'},
      bounds:new google.maps.LatLngBounds(
        {
          lat:DAVAO_BOUNDS.south,
          lng:DAVAO_BOUNDS.west
        },
        {
          lat:DAVAO_BOUNDS.north,
          lng:DAVAO_BOUNDS.east
        }
      )
    }, (results,status) => {
      if (status === 'OK' && results.length) {
        const hit =
          results.find(r => /davao city/i.test(r.formatted_address)) ||
          results[0];

        const loc = hit.geometry.location;

        res({
          la:loc.lat(),
          ln:loc.lng(),
          ok:inDavao(loc.lat(), loc.lng())
        });
      } else {
        res(null);
      }
    });
  });
}

let geoFallbackCount = 0;

async function geocodeSites() {
  for (const s of S) {
    const g = await geocodeOne(s.name);

    if (g && g.ok) {
      s.la = g.la;
      s.ln = g.ln;
    } else {
      geoFallbackCount++;
    }

    NODES[s.id] = {
      la:s.la,
      ln:s.ln
    };
  }

  $('#routestat').textContent = geoFallbackCount
    ? `${geoFallbackCount} of ${S.length} barangays could not be geocoded within Davao City and use fallback coordinates. Loading road routes...`
    : `All ${S.length} barangays geocoded within Davao City. Loading road routes...`;
}

// ---- distance helpers ----
function hav(a,b) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dla = (b.la - a.la) * rad;
  const dln = (b.ln - a.ln) * rad;

  const h =
    Math.sin(dla / 2) ** 2 +
    Math.cos(a.la * rad) *
    Math.cos(b.la * rad) *
    Math.sin(dln / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

function mkPath(pts) {
  const cum = [0];

  for (let i = 1; i < pts.length; i++) {
    cum.push(
      cum[i - 1] +
      hav(pts[i - 1], pts[i])
    );
  }

  return {
    pts,
    cum,
    len:cum[cum.length - 1]
  };
}

function posAt(path,d) {
  const {pts,cum} = path;

  if (d >= path.len) {
    return pts[pts.length - 1];
  }

  let lo = 0;
  let hi = cum.length - 1;

  while (lo < hi) {
    const m = (lo + hi) >> 1;

    if (cum[m] < d) {
      lo = m + 1;
    } else {
      hi = m;
    }
  }

  const i = Math.max(1,lo);
  const span = (cum[i] - cum[i - 1]) || 1;
  const f = (d - cum[i - 1]) / span;

  return {
    la:pts[i - 1].la + (pts[i].la - pts[i - 1].la) * f,
    ln:pts[i - 1].ln + (pts[i].ln - pts[i - 1].ln) * f
  };
}

// ---- road routes via Google Directions ----
const ADJ = {};

Object.keys(NODES).forEach(k => {
  ADJ[k] = [];
});

let routesReady = false;
let fallbackCount = 0;

function fetchRoad(a,b) {
  return new Promise(res => {
    const svc = new google.maps.DirectionsService();

    svc.route({
      origin:{
        lat:NODES[a].la,
        lng:NODES[a].ln
      },
      destination:{
        lat:NODES[b].la,
        lng:NODES[b].ln
      },
      travelMode:'DRIVING',
      avoidFerries:true
    }, (r,status) => {
      if (status === 'OK' && r.routes[0]) {
        const steps = r.routes[0].legs.flatMap(l => l.steps);

        const hasFerry = steps.some(
          s => /ferry/i.test(s.instructions || '')
        );

        if (hasFerry) {
          res(null);
          return;
        }

        res(
          steps
            .flatMap(s => s.path)
            .map(p => ({
              la:p.lat(),
              ln:p.lng()
            }))
        );
      } else {
        res(null);
      }
    });
  });
}

async function loadRoutes() {
  const roads = await Promise.all(
    EDGES.map(([a,b]) => fetchRoad(a,b))
  );

  EDGES.forEach(([a,b],i) => {
    const color = PALETTE[i % PALETTE.length];

    let pts = roads[i];

    if (!pts) {
      fallbackCount++;
      pts = [
        NODES[a],
        NODES[b]
      ];
    }

    const p = mkPath(pts);
    const rp = mkPath([...pts].reverse());

    ADJ[a].push({
      to:b,
      path:p
    });

    ADJ[b].push({
      to:a,
      path:rp
    });

    new google.maps.Polyline({
      map:gmap,
      path:pts.map(q => ({
        lat:q.la,
        lng:q.ln
      })),
      strokeColor:color,
      strokeOpacity:.9,
      strokeWeight:5
    });
  });

  routesReady = true;

  $('#routestat').textContent = fallbackCount
    ? `${fallbackCount} of ${EDGES.length} routes could not be fetched from Google Directions and are drawn as straight lines. Check that the Directions API is enabled for this key.`
    : `All ${EDGES.length} routes follow real roads.`;
}

// Dijkstra
function dijkstra(src) {
  const dist = {};
  const prev = {};
  const done = new Set();

  Object.keys(NODES).forEach(k => {
    dist[k] = Infinity;
  });

  dist[src] = 0;

  for (;;) {
    let u = null;

    for (const k in dist) {
      if (
        !done.has(k) &&
        dist[k] < Infinity &&
        (u === null || dist[k] < dist[u])
      ) {
        u = k;
      }
    }

    if (u === null) break;

    done.add(u);

    for (const e of ADJ[u]) {
      const nd =
        dist[u] +
        e.path.len;

      if (nd < dist[e.to]) {
        dist[e.to] = nd;

        prev[e.to] = {
          from:u,
          path:e.path
        };
      }
    }
  }

  return {
    dist,
    prev
  };
}

function pathTo(prev,src,dst) {
  if (src === dst) return null;

  const segs = [];
  let c = dst;

  while (c !== src) {
    const p = prev[c];

    if (!p) return null;

    segs.push(p.path.pts);
    c = p.from;
  }

  const pts = segs
    .reverse()
    .flatMap((s,i) =>
      i === 0 ? s : s.slice(1)
    );

  return mkPath(pts);
}

// ---- state ----
const T = [];

let tid = 0;
let role = '';
let sel = 'panacan';
let day = new Date().getDay();
let posts = [];
let pending = null;
let ticks = 0;

let resName = '';
let resAddr = '';

const site = id =>
  S.find(s => s.id === id);

const vol = s =>
  s.fill * s.cap / 100;

const SPEED = 11;
const DT = 0.4;
const STOP_TICKS = 6;

const stamp = () =>
  new Date().toLocaleTimeString([], {
    hour:'2-digit',
    minute:'2-digit',
    second:'2-digit'
  });

function addTruck() {
  tid++;

  T.push({
    id:tid,
    la:wh.la,
    ln:wh.ln,
    node:'wh',
    target:null,
    route:null,
    d:0,
    st:'idle',
    load:0,
    cap:8000,
    dwell:0,
    lastArrival:null
  });
}

addTruck();
addTruck();

$('#dsel').innerHTML = D.map((d,i) =>
  `<option value="${i}"${i === day ? ' selected' : ''}>${d}${i === new Date().getDay() ? ' (today)' : ''}</option>`
).join('');

// ---- truck logic ----
function arrive(t) {
  const kind = t.st;
  const name =
    t.target === 'wh'
      ? 'Warehouse'
      : site(t.target).name;

  const now = stamp();

  t.node = t.target;
  t.target = null;
  t.route = null;
  t.lastArrival = `${now} at ${name}`;

  if (kind === 'site') {
    const s = site(t.node);

    t.load += vol(s);
    s.fill = 0;

    s.lastArrival = {
      time:now,
      truck:t.id
    };

    s.arrivals.unshift({
      time:now,
      truck:t.id
    });

    s.arrivals = s.arrivals.slice(0,10);

    t.st = 'stop';
    t.dwell = STOP_TICKS;

  } else if (kind === 'wh') {
    wh.lastArrival = {
      time:now,
      truck:t.id
    };

    if (wh.fill + t.load <= wh.cap) {
      wh.fill += t.load;
      t.load = 0;
      t.st = 'stop';
      t.dwell = STOP_TICKS;
    } else {
      t.st = 'wait';
      t.target = 'wh';
    }
  }
}

function assign(t) {
  const {dist,prev} = dijkstra(t.node);

  const taken = T
    .filter(o =>
      o !== t &&
      o.st === 'site'
    )
    .map(o => o.target);

  const c = S
    .filter(s =>
      s.fill >= 25 &&
      !taken.includes(s.id) &&
      vol(s) <= t.cap - t.load &&
      dist[s.id] < Infinity
    )
    .sort((a,b) =>
      b.fill / (1 + dist[b.id] / 3000) -
      a.fill / (1 + dist[a.id] / 3000)
    );

  if (
    t.load >= t.cap * .85 ||
    (!c.length && t.load > 0)
  ) {
    t.target = 'wh';
    t.st = 'wh';

  } else if (c.length) {
    t.target = c[0].id;
    t.st = 'site';

  } else {
    return;
  }

  t.route = pathTo(
    prev,
    t.node,
    t.target
  );

  t.d = 0;

  if (
    !t.route ||
    t.route.len === 0
  ) {
    arrive(t);
  }
}

function tick() {
  if (!routesReady) return;

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
    if (t.st === 'stop') {
      if (--t.dwell <= 0) {
        t.st = 'idle';
        t.dwell = 0;
      }

      return;
    }

    if (t.st === 'wait') {
      if (wh.fill + t.load <= wh.cap) {
        wh.fill += t.load;
        t.load = 0;
        t.st = 'idle';
        t.target = null;
      }

      return;
    }

    if (t.st === 'idle') {
      assign(t);
    }

    if (!t.route) return;

    t.d = Math.min(
      t.route.len,
      t.d + SPEED * DT
    );

    const p = posAt(
      t.route,
      t.d
    );

    t.la = p.la;
    t.ln = p.ln;

    if (t.d >= t.route.len) {
      arrive(t);
    }
  });

  drawMap();
  live();
}

setInterval(
  tick,
  DT * 1000
);

// ---- map ----
let gmap = null;
let truckMarkers = [];
let truckRoutes = [];

const CENTER0 = {
  lat:7.10,
  lng:125.53
};

const ZOOM0 = 11;

function pinEl(
  fillPct,
  openToday,
  label,
  selected
) {
  const d = document.createElement('div');

  d.innerHTML = `
    <div
      class="pin${openToday ? ' open' : ''}"
      style="
        background:${col(fillPct)};
        ${selected ? 'outline:2px solid var(--ai);outline-offset:1px' : ''}
      "
    >
      <span>${Math.round(fillPct)}</span>
    </div>

    <div
      class="pin-label"
      style="margin-top:2px;text-align:center"
    >
      ${label}
    </div>
  `;

  return d;
}

async function initMap() {
  if (gmap) return;

  $('#map').innerHTML = `
    <div id="leaf"></div>

    <div class="zb">
      <button
        class="btn alt"
        onclick="gmap.setCenter(CENTER0);gmap.setZoom(ZOOM0)"
      >
        Reset
      </button>
    </div>
  `;

  const {Map} =
    await google.maps.importLibrary('maps');

  const {AdvancedMarkerElement} =
    await google.maps.importLibrary('marker');

  gmap = new Map($('#leaf'), {
    center:CENTER0,
    zoom:ZOOM0,
    mapId:'DEMO_MAP_ID',
    streetViewControl:false,
    mapTypeControl:false,
    fullscreenControl:false
  });

  $('#routestat').textContent =
    'Locating barangays with the Geocoding API...';

  await geocodeSites();

  S.forEach(b => {
    b.el = pinEl(
      b.fill,
      b.day === day,
      b.name,
      b.id === sel
    );

    b.el.style.cursor = 'pointer';

    b.el.addEventListener(
      'click',
      () => pick(b.id)
    );

    b.gm = new AdvancedMarkerElement({
      map:gmap,
      position:{
        lat:b.la,
        lng:b.ln
      },
      content:b.el
    });
  });

  const whEl =
    document.createElement('div');

  whEl.className = 'wh-ic';
  whEl.textContent = '🏭';

  new AdvancedMarkerElement({
    map:gmap,
    position:{
      lat:wh.la,
      lng:wh.ln
    },
    content:whEl
  });

  drawMap();
  loadRoutes();
}

function drawMap() {
  if (
    !gmap ||
    !google.maps.marker
  ) return;

  const {AdvancedMarkerElement} =
    google.maps.marker;

  S.forEach(b => {
    if (b.el) {
      b.el.innerHTML = `
        <div
          class="pin${b.day === day ? ' open' : ''}"
          style="
            background:${col(b.fill)};
            ${b.id === sel ? 'outline:2px solid var(--ai);outline-offset:1px' : ''}
          "
        >
          <span>${Math.round(b.fill)}</span>
        </div>

        <div
          class="pin-label"
          style="margin-top:2px;text-align:center"
        >
          ${b.name}
        </div>
      `;
    }
  });

  while (truckMarkers.length > T.length) {
    truckMarkers.pop().map = null;
    truckRoutes.pop().setMap(null);
  }

  T.forEach((t,i) => {
    if (!truckMarkers[i]) {
      const el =
        document.createElement('div');

      el.innerHTML = `
        <div class="truck-ic">🚛</div>
        <div class="truck-label">T${t.id}</div>
      `;

      truckMarkers[i] =
        new AdvancedMarkerElement({
          map:gmap,
          position:{
            lat:t.la,
            lng:t.ln
          },
          content:el
        });

      truckRoutes[i] =
        new google.maps.Polyline({
          map:gmap,
          path:[],
          strokeColor:'#111',
          strokeOpacity:.9,
          strokeWeight:3,
          icons:[
            {
              icon:{
                path:'M 0,-1 0,1',
                strokeOpacity:1,
                scale:3
              },
              offset:'0',
              repeat:'12px'
            }
          ]
        });
    }

    truckMarkers[i].position = {
      lat:t.la,
      lng:t.ln
    };

    let rem = [];

    if (t.route) {
      const {pts,cum} = t.route;

      rem = [
        {
          lat:t.la,
          lng:t.ln
        },
        ...pts
          .filter((_,k) => cum[k] > t.d)
          .map(p => ({
            lat:p.la,
            lng:p.ln
          }))
      ];
    }

    truckRoutes[i].setPath(rem);
  });
}

// ---- panels ----
function start(r) {
  role = r;

  $('#intro').hidden = true;
  $('#workerlogin').hidden = true;
  $('#app').hidden = false;

  initMap();

  $('#who').textContent = {
    res:'Resident',
    col:'Driver',
    adm:'LGU'
  }[r];

  panel();
}

function home() {
  $('#app').hidden = true;
  $('#support').hidden = true;
  $('#workerlogin').hidden = true;
  $('#intro').hidden = false;
}

function showWorkerLogin() {
  $('#intro').hidden = true;
  $('#workerlogin').hidden = false;
  $('#loginmsg').innerHTML = '';
}

function workerLogin() {
  const id =
    $('#empid').value.trim();

  const pw =
    $('#emppw').value.trim();

  if (!id || !pw) {
    $('#loginmsg').innerHTML =
      '<div class="alert warn">Enter your Employee ID and Password.</div>';

    return;
  }

  const asDriver =
    $('#roleToggle').checked;

  $('#empid').value = '';
  $('#emppw').value = '';

  start(
    asDriver
      ? 'col'
      : 'adm'
  );
}

function pick(id) {
  sel = id;
  panel();
}

function panel() {
  const p = $('#panel');

  if (role === 'res') {
    p.innerHTML = `
      <h2>Your profile</h2>

      <input
        id="rname"
        placeholder="Your name"
        value="${esc(resName)}"
      >

      <input
        id="raddr"
        placeholder="Your address"
        style="margin-top:6px"
        value="${esc(resAddr)}"
      >

      <button
        class="btn alt w"
        onclick="saveProfile()"
      >
        Save
      </button>

      <div id="pmsg"></div>

      <h2>Your barangay</h2>

      <select
        onchange="pick(this.value)"
        aria-label="Barangay"
      >
        ${S.map(s => `
          <option
            value="${s.id}"
            ${s.id === sel ? ' selected' : ''}
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
        style="
          max-width:140px;
          margin-top:6px;
          border-radius:8px
        "
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

      ${S.map((s,i) => `
        <div
          style="
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:6px;
            align-items:center;
            margin:4px 0
          "
        >
          <span>${s.name}</span>

          <select
            aria-label="Drop day for ${s.name}"
            onchange="
              S[${i}].day=+this.value;
              drawMap();
              live()
            "
          >
            ${D.map((d,j) => `
              <option
                value="${j}"
                ${j === s.day ? ' selected' : ''}
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

function truckStatus(t) {
  if (t.st === 'site') {
    return 'to ' + site(t.target).name;
  }

  if (t.st === 'wh') {
    return 'to warehouse';
  }

  if (t.st === 'wait') {
    return 'waiting, warehouse full';
  }

  if (t.st === 'stop') {
    return 'stopped at ' +
      (
        t.node === 'wh'
          ? 'warehouse'
          : site(t.node).name
      );
  }

  return 'idle';
}

const lastTxt = a =>
  a
    ? `${a.time} (T${a.truck})`
    : 'none yet';

function live() {
  const el = $('#live');

  if (!el) return;

  const s = site(sel);
  const open =
    s.day === day;

  let h = '';

  const tr =
    `<h2>Trucks (${T.length})</h2>` +
    T.map(t => `
      <div class="row">
        <span>
          T${t.id}: ${truckStatus(t)}
        </span>

        <span>
          ${L(t.load)} / ${L(t.cap)}
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

      <div
        class="mute"
        style="margin-bottom:6px"
      >
        Last arrived:
        ${t.lastArrival || 'none yet'}
      </div>
    `).join('');

  const wm = `
    <div class="row">
      <span>Warehouse</span>

      <span>
        ${L(wh.fill)} / ${L(wh.cap)}
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

    <div class="mute">
      Last truck arrival:
      ${lastTxt(wh.lastArrival)}
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
            Drop day:
            ${D[s.day]}
          </span>

          <span>
            ${Math.round(s.fill)}%
            (${L(vol(s))} of ${L(s.cap)})
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

        <div class="mute">
          Last truck arrival:
          ${lastTxt(s.lastArrival)}
        </div>
    `;

    h += open
      ? (
          s.fill >= 95
            ? '<div class="alert bad">This site is full. A truck is being sent.</div>'
            : '<div class="alert ok">Open today. You can throw your trash here.</div>'
        )
      : `
        <div class="alert warn">
          Not open today.
          ${s.name} throws on ${D[s.day]}s.
        </div>
      `;

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
        .sort((a,b) => b.fill - a.fill)
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
                (${L(vol(b))})
              </span>
            </div>

            <div class="mute">
              Last arrival:
              ${lastTxt(b.lastArrival)}
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
          gap:8px;
          flex-wrap:wrap
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
          onclick="T.length>1&&T.pop();panel()"
        >
          Remove truck
        </button>

        <button
          class="btn alt"
          onclick="
            wh.fill=Math.max(0,wh.fill-10000);
            live()
          "
        >
          Haul 10,000 L
        </button>
      </div>
    ` + tr + wm;
  }

  el.innerHTML = h;
}

function feed() {
  const f = $('#feed');

  if (!f) return;

  const l = posts.filter(
    p => p.id === sel
  );

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

function saveProfile() {
  resName =
    $('#rname').value.trim();

  resAddr =
    $('#raddr').value.trim();

  $('#pmsg').innerHTML =
    '<div class="alert ok">Profile saved.</div>';
}

function throwTrash() {
  const s = site(sel);

  if (
    s.day !== day ||
    s.fill >= 95
  ) return;

  s.fill = Math.min(
    100,
    s.fill + 60 / s.cap * 100
  );

  $('#msg').innerHTML = `
    <div class="alert ok">
      Thanks! About 60 L was added to ${s.name}.
    </div>
  `;

  live();
  drawMap();
}

function pic(inp) {
  const f = inp.files[0];

  if (!f) return;

  const r =
    new FileReader();

  r.onload = () => {
    const i = new Image();

    i.onload = () => {
      const c =
        document.createElement('canvas');

      const k =
        Math.min(
          1,
          320 / i.width
        );

      c.width =
        i.width * k;

      c.height =
        i.height * k;

      c
        .getContext('2d')
        .drawImage(
          i,
          0,
          0,
          c.width,
          c.height
        );

      pending =
        c.toDataURL(
          'image/jpeg',
          .7
        );

      $('#prev').src =
        pending;

      $('#prev').hidden =
        false;
    };

    i.src = r.result;
  };

  r.readAsDataURL(f);
}

function postFb() {
  const t =
    $('#fbt').value.trim();

  if (!t && !pending) {
    return;
  }

  posts.unshift({
    id:sel,
    t,
    img:pending,
    time:
      D[day] +
      ' ' +
      new Date().toLocaleTimeString(
        [],
        {
          hour:'2-digit',
          minute:'2-digit'
        }
      )
  });

  pending = null;

  $('#fbt').value = '';
  $('#prev').hidden = true;

  feed();
}

// ---- customer service ----
let tickets = [];
let tkid = 0;

function openSupport() {
  $('#app').hidden = true;
  $('#support').hidden = false;

  renderTickets();
}

function closeSupport() {
  $('#support').hidden = true;
  $('#app').hidden = false;
}

function submitTicket() {
  const m =
    $('#sm').value.trim();

  if (!m) {
    $('#smsg').innerHTML =
      '<div class="alert warn">Please describe the problem first.</div>';

    return;
  }

  tickets.unshift({
    id:++tkid,
    cat:$('#sc').value,
    name:
      $('#sn').value.trim() ||
      'Anonymous',
    msg:m,
    status:'Open',
    time:new Date().toLocaleString()
  });

  $('#sm').value = '';
  $('#sn').value = '';

  $('#smsg').innerHTML = `
    <div class="alert ok">
      Thanks! Your report (#${tkid}) was submitted.
    </div>
  `;

  renderTickets();
}

function setStatus(id,s) {
  const t =
    tickets.find(
      x => x.id === id
    );

  if (t) {
    t.status = s;
  }

  renderTickets();
}

function renderTickets() {
  const el =
    $('#tickets');

  if (!tickets.length) {
    el.innerHTML =
      '<p class="mute">No reports yet.</p>';

    return;
  }

  el.innerHTML =
    tickets.map(t => `
      <div class="post">
        <b>
          #${t.id}
          ${esc(t.cat)}
        </b>

        <span class="mute">
          ${esc(t.status)}
        </span>

        <div>
          ${esc(t.msg)}
        </div>

        <div class="mute">
          ${esc(t.name)} · ${t.time}
        </div>

        ${
          role === 'adm' &&
          t.status !== 'Resolved'
            ? `
              <button
                class="btn alt"
                style="margin-top:4px"
                onclick="setStatus(${t.id},'Resolved')"
              >
                Mark resolved
              </button>
            `
            : ''
        }
      </div>
    `).join('');
}