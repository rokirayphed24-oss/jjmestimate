/* ============================================================
   PHE COST ESTIMATION SYSTEM — app.js
   Vanilla JS, component-based, state-managed
   ============================================================ */

// ── State ────────────────────────────────────────────────────
const STATE = loadState() || {
  user: null,
  currentStep: -1, // -1 = login
  schemeDetails: {},
  incidentDate: '',
  selectedComponents: [],
  pipes: [],
  labour: [],
  carriage: [],
  hardware: [],
};

function saveState() {
  localStorage.setItem('phe_estimation_state', JSON.stringify(STATE));
}

function loadState() {
  try {
    const s = localStorage.getItem('phe_estimation_state');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const icon = type === 'success' ? '✅' : '❌';
  const tc = document.getElementById('toast-container') || createToastContainer();
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function createToastContainer() {
  const d = document.createElement('div');
  d.id = 'toast-container';
  d.className = 'toast-container';
  document.body.appendChild(d);
  return d;
}

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

function numberToWords(n) {
  if (n === 0) return 'Zero';
  const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven',
    'Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const c = (num) => {
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num/10)] + (num%10 ? ' '+a[num%10] : '');
    return a[Math.floor(num/100)]+' Hundred'+(num%100 ? ' '+c(num%100) : '');
  };
  let str = '';
  const intPart = Math.floor(n);
  if (intPart >= 10000000) { str += c(Math.floor(intPart/10000000))+' Crore '; n %= 10000000; }
  if (intPart >= 100000)   { str += c(Math.floor((intPart%10000000)/100000))+' Lakh '; n %= 100000; }
  if (intPart >= 1000)     { str += c(Math.floor((intPart%100000)/1000))+' Thousand '; n %= 1000; }
  str += c(intPart % 1000);
  return str.trim() + ' Rupees Only';
}

function el(tag, cls, html) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html !== undefined) d.innerHTML = html;
  return d;
}

function validate(fields) {
  let valid = true;
  fields.forEach(({ el, msg }) => {
    const errEl = el.parentElement.querySelector('.form-error') ||
                  el.closest('.form-group')?.querySelector('.form-error');
    if (!el.value.trim()) {
      el.classList.add('error');
      if (errEl) { errEl.textContent = msg; errEl.classList.add('visible'); }
      valid = false;
    } else {
      el.classList.remove('error');
      if (errEl) errEl.classList.remove('visible');
    }
  });
  return valid;
}

// ── Step config ───────────────────────────────────────────────
const STEPS = [
  { name: 'Scheme',      icon: '🏛️' },
  { name: 'Incident',    icon: '📅' },
  { name: 'Components',  icon: '🧩' },
  { name: 'Pipes',       icon: '🔧' },
  { name: 'Labour',      icon: '👷' },
  { name: 'Preview',     icon: '🧾' },
];

// ── Component data ────────────────────────────────────────────
const COMPONENTS = [
  { id: 'pipeline',     label: 'Repair & Replacement of Pipelines & Accessories in Distribution Network', icon: '🚰' },
  { id: 'valves',       label: 'Repair & Replacement of Valves & Accessories',                           icon: '⚙️' },
  { id: 'rapid_sand',   label: 'Repair & Replacement of Rapid Sand Filter Media',                        icon: '🏗️' },
  { id: 'submersible',  label: 'Repair & Replacement of Submersible Pump & Accessories',                 icon: '💧' },
  { id: 'centrifugal',  label: 'Repair & Replacement of Centrifugal Pump & Accessories',                 icon: '🔩' },
  { id: 'electrical',   label: 'Repair & Replacement of Electrical Items',                               icon: '⚡' },
  { id: 'ugr',          label: 'Maintenance works of Under Ground Reservoir (UGR)',                      icon: '🏚️' },
  { id: 'esr',          label: 'Maintenance works of Elevated Service Reservoir (ESR)',                  icon: '🏗️' },
  { id: 'civil',        label: 'Civil Works',                                                            icon: '🧱' },
];

// ── Official IS-Standard Pipe & Fittings Rate Schedule ────────
// Source: PHE Dept Phase II Rate Schedule (IS:1536, IS:1239, IS:13592, IS:4984, IS:15801)
// Unit: Rm = Running Meter | PP = Per Piece | PK = Per Kg | P500g = Per 500g

const PIPE_TYPES = ['HDPE', 'UPVC', 'GI', 'CI', 'PPR'];

// ── Pipe catalogue: { code, description, unit, rate }
// Organised by pipe type. 'pipes' = main pipe (Rm), 'fittings' = accessories (PP)
const PIPE_CATALOGUE = {

  CI: {
    pipes: [
      { code:'PI 2.1.1', desc:'CI Pipe 100 mm dia (IS:1536/2001)',         unit:'Rm', rate:3128 },
      { code:'PI 2.1.2', desc:'CI Pipe 150 mm dia (IS:1536/2001)',         unit:'Rm', rate:5060 },
    ],
    fittings: [
      { code:'PI SPL 2.2.1', desc:'CI Flange 100 mm dia',                  unit:'PP', rate:386  },
      { code:'PI SPL 2.2.2', desc:'CI Flange 150 mm dia',                  unit:'PP', rate:617  },
      { code:'PI SPL 2.3.1', desc:'CI Bend (Flanged) 100 mm dia',          unit:'PP', rate:1564 },
      { code:'PI SPL 2.3.2', desc:'CI Bend (Flanged) 150 mm dia',          unit:'PP', rate:2852 },
      { code:'PI SPL 2.4.1', desc:'CI Tee (Flanged) 100 mm dia',           unit:'PP', rate:2392 },
      { code:'PI SPL 2.4.2', desc:'CI Tee (Flanged) 150 mm dia',           unit:'PP', rate:4324 },
      { code:'PI SPL 2.5.1', desc:'CI Reducer 150x100 mm (Flanged)',        unit:'PP', rate:2300 },
      { code:'PI SPL 0.1.1', desc:'CI Welding Electrodes 2mm dia 350mm lg', unit:'PP', rate:2200 },
    ],
  },

  GI: {
    pipes: [
      { code:'PIP GI 3.1.1', desc:'GI Pipes 50 mm dia (IS-1239 Med Class)',  unit:'Rm', rate:548  },
      { code:'PIP GI 3.1.2', desc:'GI Pipes 65 mm dia (IS-1239 Med Class)',  unit:'Rm', rate:293  },
      { code:'PIP GI 3.1.3', desc:'GI Pipes 80 mm dia (IS-1239 Med Class)',  unit:'Rm', rate:426  },
      { code:'PIP GI 3.1.4', desc:'GI Pipes 100 mm dia (IS-1239 Med Class)', unit:'Rm', rate:717  },
      { code:'PIP GI 3.1.5', desc:'GI Pipes 125 mm dia (IS-1239 Med Class)', unit:'Rm', rate:1708 },
      { code:'PIP GI 3.1.6', desc:'GI Pipes 150 mm dia (IS-1239 Med Class)', unit:'Rm', rate:2116 },
    ],
    fittings: [
      // Sockets
      { code:'PI GI SPL 3.2.1', desc:'GI Socket 50 mm dia',                 unit:'PP', rate:108  },
      { code:'PI GI SPL 3.2.2', desc:'GI Socket 65 mm dia',                 unit:'PP', rate:174  },
      { code:'PI GI SPL 3.2.3', desc:'GI Socket 80 mm dia',                 unit:'PP', rate:261  },
      { code:'PI GI SPL 3.2.4', desc:'GI Socket 100 mm dia',                unit:'PP', rate:423  },
      { code:'PI GI SPL 3.2.5', desc:'GI Socket 125 mm dia',                unit:'PP', rate:1860 },
      { code:'PI GI SPL 3.2.6', desc:'GI Socket 150 mm dia',                unit:'PP', rate:2190 },
      // Union Sockets
      { code:'PI GI SPL 3.3.1', desc:'GI Union Socket 50 mm dia',           unit:'PP', rate:345  },
      { code:'PI GI SPL 3.3.2', desc:'GI Union Socket 65 mm dia',           unit:'PP', rate:541  },
      { code:'PI GI SPL 3.3.3', desc:'GI Union Socket 80 mm dia',           unit:'PP', rate:727  },
      { code:'PI GI SPL 3.3.4', desc:'GI Union Socket 100 mm dia',          unit:'PP', rate:1789 },
      { code:'PI GI SPL 3.3.5', desc:'GI Union Socket 125 mm dia',          unit:'PP', rate:3566 },
      { code:'PI GI SPL 3.3.6', desc:'GI Union Socket 150 mm dia',          unit:'PP', rate:5583 },
      // Threaded Flanges
      { code:'PI GI SPL 3.4.1', desc:'GI Threaded Flange 50 mm dia',        unit:'PP', rate:270  },
      { code:'PI GI SPL 3.4.2', desc:'GI Threaded Flange 65 mm dia',        unit:'PP', rate:370  },
      { code:'PI GI SPL 3.4.3', desc:'GI Threaded Flange 80 mm dia',        unit:'PP', rate:391  },
      { code:'PI GI SPL 3.4.4', desc:'GI Threaded Flange 100 mm dia',       unit:'PP', rate:499  },
      { code:'PI GI SPL 3.4.5', desc:'GI Threaded Flange 125 mm dia',       unit:'PP', rate:675  },
      { code:'PI GI SPL 3.4.6', desc:'GI Threaded Flange 150 mm dia',       unit:'PP', rate:714  },
      // Bends
      { code:'PI GI SPL 3.5.1', desc:'GI Bend 90° 50 mm dia',               unit:'PP', rate:230  },
      { code:'PI GI SPL 3.5.2', desc:'GI Bend 90° 65 mm dia',               unit:'PP', rate:352  },
      { code:'PI GI SPL 3.5.3', desc:'GI Bend 90° 80 mm dia',               unit:'PP', rate:525  },
      { code:'PI GI SPL 3.5.4', desc:'GI Bend 90° 100 mm dia',              unit:'PP', rate:1095 },
      { code:'PI GI SPL 3.5.5', desc:'GI Bend 90° 125 mm dia',              unit:'PP', rate:3100 },
      { code:'PI GI SPL 3.5.6', desc:'GI Bend 90° 150 mm dia',              unit:'PP', rate:3275 },
      // Elbows
      { code:'PI GI SPL 3.6.1', desc:'GI Elbow 90° 50 mm dia',              unit:'PP', rate:145  },
      { code:'PI GI SPL 3.6.2', desc:'GI Elbow 90° 65 mm dia',              unit:'PP', rate:277  },
      { code:'PI GI SPL 3.6.3', desc:'GI Elbow 90° 80 mm dia',              unit:'PP', rate:394  },
      { code:'PI GI SPL 3.6.4', desc:'GI Elbow 90° 100 mm dia',             unit:'PP', rate:670  },
      { code:'PI GI SPL 3.6.5', desc:'GI Elbow 90° 125 mm dia',             unit:'PP', rate:2231 },
      { code:'PI GI SPL 3.6.6', desc:'GI Elbow 90° 150 mm dia',             unit:'PP', rate:2722 },
      // Reducing Sockets
      { code:'PI GI SPL 3.7.1', desc:'GI Reducing Socket 65x50 mm',         unit:'PP', rate:191  },
      { code:'PI GI SPL 3.7.2', desc:'GI Reducing Socket 80x65 mm',         unit:'PP', rate:287  },
      { code:'PI GI SPL 3.7.3', desc:'GI Reducing Socket 100x80 mm',        unit:'PP', rate:465  },
      { code:'PI GI SPL 3.7.4', desc:'GI Reducing Socket 125x100 mm',       unit:'PP', rate:2045 },
      { code:'PI GI SPL 3.7.5', desc:'GI Reducing Socket 150x100 mm',       unit:'PP', rate:2392 },
      { code:'PI GI SPL 3.7.6', desc:'GI Reducing Socket 150x125 mm',       unit:'PP', rate:2272 },
      // Reducing Tees
      { code:'PI GI SPL 3.8.1', desc:'GI Reducing Tee 65x50 mm',            unit:'PP', rate:387  },
      { code:'PI GI SPL 3.8.2', desc:'GI Reducing Tee 80x65 mm',            unit:'PP', rate:566  },
      { code:'PI GI SPL 3.8.3', desc:'GI Reducing Tee 100x80 mm',           unit:'PP', rate:945  },
      { code:'PI GI SPL 3.8.4', desc:'GI Reducing Tee 125x100 mm',          unit:'PP', rate:3270 },
      { code:'PI GI SPL 3.8.5', desc:'GI Reducing Tee 150x100 mm',          unit:'PP', rate:3785 },
      { code:'PI GI SPL 3.8.6', desc:'GI Reducing Tee 150x125 mm',          unit:'PP', rate:3785 },
      // Plugs
      { code:'PI GI SPL 3.9.1', desc:'GI Plug 50 mm dia',                   unit:'PP', rate:138  },
      { code:'PI GI SPL 3.9.2', desc:'GI Plug 65 mm dia',                   unit:'PP', rate:177  },
      { code:'PI GI SPL 3.9.3', desc:'GI Plug 80 mm dia',                   unit:'PP', rate:222  },
      { code:'PI GI SPL 3.9.4', desc:'GI Plug 100 mm dia',                  unit:'PP', rate:396  },
      { code:'PI GI SPL 3.9.5', desc:'GI Plug 125 mm dia',                  unit:'PP', rate:990  },
      { code:'PI GI SPL 3.9.6', desc:'GI Plug 150 mm dia',                  unit:'PP', rate:966  },
      // Cap Plugs
      { code:'PI GI SPL 3.10.1', desc:'GI Cap Plug 50 mm dia',              unit:'PP', rate:201  },
      { code:'PI GI SPL 3.10.2', desc:'GI Cap Plug 65 mm dia',              unit:'PP', rate:255  },
      { code:'PI GI SPL 3.10.3', desc:'GI Cap Plug 80 mm dia',              unit:'PP', rate:416  },
      { code:'PI GI SPL 3.10.4', desc:'GI Cap Plug 100 mm dia',             unit:'PP', rate:857  },
      { code:'PI GI SPL 3.10.5', desc:'GI Cap Plug 125 mm dia',             unit:'PP', rate:2500 },
      { code:'PI GI SPL 3.10.6', desc:'GI Cap Plug 150 mm dia',             unit:'PP', rate:2190 },
      // Nipples 50mm long
      { code:'PI GI SPL 3.11.1', desc:'GI Nipple 50mm long – 50mm dia',     unit:'PP', rate:53   },
      { code:'PI GI SPL 3.11.2', desc:'GI Nipple 50mm long – 65mm dia',     unit:'PP', rate:117  },
      { code:'PI GI SPL 3.11.3', desc:'GI Nipple 50mm long – 80mm dia',     unit:'PP', rate:99   },
      { code:'PI GI SPL 3.11.4', desc:'GI Nipple 50mm long – 100mm dia',    unit:'PP', rate:152  },
      { code:'PI GI SPL 3.11.5', desc:'GI Nipple 50mm long – 125mm dia',    unit:'PP', rate:338  },
      { code:'PI GI SPL 3.11.6', desc:'GI Nipple 50mm long – 150mm dia',    unit:'PP', rate:213  },
      // Nipples 75mm long
      { code:'PI GI SPL 3.12.1', desc:'GI Nipple 75mm long – 50mm dia',     unit:'PP', rate:72   },
      { code:'PI GI SPL 3.12.2', desc:'GI Nipple 75mm long – 65mm dia',     unit:'PP', rate:87   },
      { code:'PI GI SPL 3.12.3', desc:'GI Nipple 75mm long – 80mm dia',     unit:'PP', rate:101  },
      { code:'PI GI SPL 3.12.4', desc:'GI Nipple 75mm long – 100mm dia',    unit:'PP', rate:275  },
      { code:'PI GI SPL 3.12.5', desc:'GI Nipple 75mm long – 125mm dia',    unit:'PP', rate:441  },
      { code:'PI GI SPL 3.12.6', desc:'GI Nipple 75mm long – 150mm dia',    unit:'PP', rate:497  },
      // Nipples 100mm long
      { code:'PI GI SPL 3.13.1', desc:'GI Nipple 100mm long – 50mm dia',    unit:'PP', rate:191  },
      { code:'PI GI SPL 3.13.2', desc:'GI Nipple 100mm long – 65mm dia',    unit:'PP', rate:191  },
      { code:'PI GI SPL 3.13.3', desc:'GI Nipple 100mm long – 80mm dia',    unit:'PP', rate:164  },
      { code:'PI GI SPL 3.13.4', desc:'GI Nipple 100mm long – 100mm dia',   unit:'PP', rate:236  },
      { code:'PI GI SPL 3.13.5', desc:'GI Nipple 100mm long – 125mm dia',   unit:'PP', rate:696  },
      { code:'PI GI SPL 3.13.6', desc:'GI Nipple 100mm long – 150mm dia',   unit:'PP', rate:696  },
      // Nipples 150mm long
      { code:'PI GI SPL 3.14.1', desc:'GI Nipple 150mm long – 50mm dia',    unit:'PP', rate:299  },
      { code:'PI GI SPL 3.14.2', desc:'GI Nipple 150mm long – 65mm dia',    unit:'PP', rate:320  },
      { code:'PI GI SPL 3.14.3', desc:'GI Nipple 150mm long – 80mm dia',    unit:'PP', rate:338  },
      { code:'PI GI SPL 3.14.4', desc:'GI Nipple 150mm long – 100mm dia',   unit:'PP', rate:396  },
      { code:'PI GI SPL 3.14.5', desc:'GI Nipple 150mm long – 125mm dia',   unit:'PP', rate:464  },
      { code:'PI GI SPL 3.14.6', desc:'GI Nipple 150mm long – 150mm dia',   unit:'PP', rate:504  },
      // Nipples 200mm long
      { code:'PI GI SPL 3.15.1', desc:'GI Nipple 200mm long – 50mm dia',    unit:'PP', rate:164  },
      { code:'PI GI SPL 3.15.2', desc:'GI Nipple 200mm long – 65mm dia',    unit:'PP', rate:237  },
      { code:'PI GI SPL 3.15.3', desc:'GI Nipple 200mm long – 80mm dia',    unit:'PP', rate:261  },
      { code:'PI GI SPL 3.15.4', desc:'GI Nipple 200mm long – 100mm dia',   unit:'PP', rate:506  },
      { code:'PI GI SPL 3.15.5', desc:'GI Nipple 200mm long – 125mm dia',   unit:'PP', rate:528  },
      { code:'PI GI SPL 3.15.6', desc:'GI Nipple 200mm long – 150mm dia',   unit:'PP', rate:712  },
      // Misc
      { code:'PI GI SPL 3.16.1', desc:'GI Nuts and Bolts (IS:1364)',         unit:'Per Kg',  rate:120 },
      { code:'PI GI SPL 3.17.1', desc:'Rubber Gasket 8mm thick',             unit:'Per Kg',  rate:150 },
      { code:'PI GI SPL 3.18.1', desc:'Lead Wool 0.2mm thick (IS:782)',       unit:'Per Kg',  rate:212 },
      { code:'PI GI SPL 3.19.1', desc:'Holdite Pipe Jointing Compound',       unit:'Per 500g',rate:260 },
    ],
  },

  UPVC: {
    pipes: [
      { code:'PI UPVC 4.1.1', desc:'UPVC Pipe 63 mm dia-2in (IS:13592 Cl3)',  unit:'Rm', rate:119 },
      { code:'PI UPVC 4.1.2', desc:'UPVC Pipe 75 mm dia-2.5in (IS:13592 Cl3)',unit:'Rm', rate:166 },
      { code:'PI UPVC 4.1.3', desc:'UPVC Pipe 90 mm dia-3in (IS:13592 Cl3)',  unit:'Rm', rate:236 },
      { code:'PI UPVC 4.1.4', desc:'UPVC Pipe 110 mm dia-4in (IS:13592 Cl3)', unit:'Rm', rate:349 },
      { code:'PI UPVC 4.1.6', desc:'UPVC Pipe 140 mm dia (IS:13592 Cl3)',     unit:'Rm', rate:558 },
      { code:'PI UPVC 4.1.7', desc:'UPVC Pipe 160 mm dia (IS:13592 Cl3)',     unit:'Rm', rate:766 },
    ],
    fittings: [
      // Sockets
      { code:'PI UPVC SPL 4.2.1', desc:'UPVC Socket 63 mm dia',              unit:'PP', rate:299 },
      { code:'PI UPVC SPL 4.2.2', desc:'UPVC Socket 75 mm dia',              unit:'PP', rate:320 },
      { code:'PI UPVC SPL 4.2.3', desc:'UPVC Socket 90 mm dia',              unit:'PP', rate:338 },
      { code:'PI UPVC SPL 4.2.4', desc:'UPVC Socket 110 mm dia',             unit:'PP', rate:396 },
      { code:'PI UPVC SPL 4.2.5', desc:'UPVC Socket 140 mm dia',             unit:'PP', rate:464 },
      { code:'PI UPVC SPL 4.2.6', desc:'UPVC Socket 160 mm dia',             unit:'PP', rate:504 },
      // Male Threaded Adapters
      { code:'PI UPVC SPL 4.3.1', desc:'UPVC Male Threaded Adapter 63 mm',   unit:'PP', rate:41  },
      { code:'PI UPVC SPL 4.3.2', desc:'UPVC Male Threaded Adapter 75 mm',   unit:'PP', rate:62  },
      { code:'PI UPVC SPL 4.3.3', desc:'UPVC Male Threaded Adapter 90 mm',   unit:'PP', rate:90  },
      { code:'PI UPVC SPL 4.3.4', desc:'UPVC Male Threaded Adapter 110 mm',  unit:'PP', rate:184 },
      { code:'PI UPVC SPL 4.3.5', desc:'UPVC Male Threaded Adapter 140 mm',  unit:'PP', rate:253 },
      { code:'PI UPVC SPL 4.3.6', desc:'UPVC Male Threaded Adapter 160 mm',  unit:'PP', rate:437 },
      // Female Threaded Adapters
      { code:'PI UPVC SPL 4.4.1', desc:'UPVC Female Threaded Adapter 63 mm', unit:'PP', rate:51  },
      { code:'PI UPVC SPL 4.4.2', desc:'UPVC Female Threaded Adapter 75 mm', unit:'PP', rate:81  },
      { code:'PI UPVC SPL 4.4.3', desc:'UPVC Female Threaded Adapter 90 mm', unit:'PP', rate:124 },
      { code:'PI UPVC SPL 4.4.4', desc:'UPVC Female Threaded Adapter 110 mm',unit:'PP', rate:200 },
      { code:'PI UPVC SPL 4.4.5', desc:'UPVC Female Threaded Adapter 140 mm',unit:'PP', rate:514 },
      { code:'PI UPVC SPL 4.4.6', desc:'UPVC Female Threaded Adapter 160 mm',unit:'PP', rate:422 },
      // Elbows
      { code:'PI UPVC SPL 4.5.1', desc:'UPVC Elbow 63 mm dia',               unit:'PP', rate:77  },
      { code:'PI UPVC SPL 4.5.2', desc:'UPVC Elbow 75 mm dia',               unit:'PP', rate:105 },
      { code:'PI UPVC SPL 4.5.3', desc:'UPVC Elbow 90 mm dia',               unit:'PP', rate:155 },
      { code:'PI UPVC SPL 4.5.4', desc:'UPVC Elbow 110 mm dia',              unit:'PP', rate:290 },
      { code:'PI UPVC SPL 4.5.5', desc:'UPVC Elbow 140 mm dia',              unit:'PP', rate:535 },
      { code:'PI UPVC SPL 4.5.6', desc:'UPVC Elbow 160 mm dia',              unit:'PP', rate:627 },
      // Equal Tees
      { code:'PI UPVC SPL 4.6.1', desc:'UPVC Equal Tee 63 mm dia',           unit:'PP', rate:106  },
      { code:'PI UPVC SPL 4.6.2', desc:'UPVC Equal Tee 75 mm dia',           unit:'PP', rate:152  },
      { code:'PI UPVC SPL 4.6.3', desc:'UPVC Equal Tee 90 mm dia',           unit:'PP', rate:230  },
      { code:'PI UPVC SPL 4.6.4', desc:'UPVC Equal Tee 110 mm dia',          unit:'PP', rate:408  },
      { code:'PI UPVC SPL 4.6.5', desc:'UPVC Equal Tee 140 mm dia',          unit:'PP', rate:726  },
      { code:'PI UPVC SPL 4.6.6', desc:'UPVC Equal Tee 160 mm dia',          unit:'PP', rate:1253 },
      // Reducing Sockets
      { code:'PI UPVC SPL 4.7.1',  desc:'UPVC Reducing Socket 75x63 mm',     unit:'PP', rate:53  },
      { code:'PI UPVC SPL 4.7.2',  desc:'UPVC Reducing Socket 75x50 mm',     unit:'PP', rate:45  },
      { code:'PI UPVC SPL 4.7.3',  desc:'UPVC Reducing Socket 90x75 mm',     unit:'PP', rate:76  },
      { code:'PI UPVC SPL 4.7.4',  desc:'UPVC Reducing Socket 90x63 mm',     unit:'PP', rate:77  },
      { code:'PI UPVC SPL 4.7.5',  desc:'UPVC Reducing Socket 90x32 mm',     unit:'PP', rate:85  },
      { code:'PI UPVC SPL 4.7.6',  desc:'UPVC Reducing Socket 110x90 mm',    unit:'PP', rate:126 },
      { code:'PI UPVC SPL 4.7.7',  desc:'UPVC Reducing Socket 110x75 mm',    unit:'PP', rate:110 },
      { code:'PI UPVC SPL 4.7.8',  desc:'UPVC Reducing Socket 110x63 mm',    unit:'PP', rate:135 },
      { code:'PI UPVC SPL 4.7.9',  desc:'UPVC Reducing Socket 140x110 mm',   unit:'PP', rate:226 },
      { code:'PI UPVC SPL 4.7.10', desc:'UPVC Reducing Socket 140x90 mm',    unit:'PP', rate:179 },
      { code:'PI UPVC SPL 4.7.11', desc:'UPVC Reducing Socket 160x140 mm',   unit:'PP', rate:245 },
      { code:'PI UPVC SPL 4.7.12', desc:'UPVC Reducing Socket 160x110 mm',   unit:'PP', rate:290 },
      { code:'PI UPVC SPL 4.7.13', desc:'UPVC Reducing Socket 160x90 mm',    unit:'PP', rate:194 },
      // End Caps
      { code:'PI UPVC SPL 4.8.1', desc:'UPVC End Cap 63 mm dia',             unit:'PP', rate:34  },
      { code:'PI UPVC SPL 4.8.2', desc:'UPVC End Cap 75 mm dia',             unit:'PP', rate:49  },
      { code:'PI UPVC SPL 4.8.3', desc:'UPVC End Cap 90 mm dia',             unit:'PP', rate:62  },
      { code:'PI UPVC SPL 4.8.4', desc:'UPVC End Cap 110 mm dia',            unit:'PP', rate:87  },
      { code:'PI UPVC SPL 4.8.5', desc:'UPVC End Cap 140 mm dia',            unit:'PP', rate:154 },
      { code:'PI UPVC SPL 4.8.6', desc:'UPVC End Cap 160 mm dia',            unit:'PP', rate:279 },
      // End Caps Threaded
      { code:'PI UPVC SPL 4.9.1', desc:'UPVC End Cap Threaded 63 mm',        unit:'PP', rate:31  },
      { code:'PI UPVC SPL 4.9.2', desc:'UPVC End Cap Threaded 75 mm',        unit:'PP', rate:58  },
      { code:'PI UPVC SPL 4.9.3', desc:'UPVC End Cap Threaded 90 mm',        unit:'PP', rate:72  },
      { code:'PI UPVC SPL 4.9.4', desc:'UPVC End Cap Threaded 110 mm',       unit:'PP', rate:117 },
      { code:'PI UPVC SPL 4.9.5', desc:'UPVC End Cap Threaded 140 mm',       unit:'PP', rate:198 },
      { code:'PI UPVC SPL 4.9.6', desc:'UPVC End Cap Threaded 160 mm',       unit:'PP', rate:280 },
      // Service Saddle Pieces
      { code:'PI UPVC SPL 4.10.1', desc:'UPVC Service Saddle Piece 63 mm',   unit:'PP', rate:124 },
      { code:'PI UPVC SPL 4.10.2', desc:'UPVC Service Saddle Piece 75 mm',   unit:'PP', rate:188 },
      { code:'PI UPVC SPL 4.10.3', desc:'UPVC Service Saddle Piece 90 mm',   unit:'PP', rate:278 },
      { code:'PI UPVC SPL 4.10.4', desc:'UPVC Service Saddle Piece 110 mm',  unit:'PP', rate:314 },
      { code:'PI UPVC SPL 4.10.5', desc:'UPVC Service Saddle Piece 140 mm',  unit:'PP', rate:267 },
      { code:'PI UPVC SPL 4.10.6', desc:'UPVC Service Saddle Piece 160 mm',  unit:'PP', rate:316 },
      // Tailpieces
      { code:'PI UPVC SPL 4.11.1', desc:'UPVC Tailpiece 63 mm dia',          unit:'PP', rate:32  },
      { code:'PI UPVC SPL 4.11.2', desc:'UPVC Tailpiece 75 mm dia',          unit:'PP', rate:45  },
      { code:'PI UPVC SPL 4.11.3', desc:'UPVC Tailpiece 90 mm dia',          unit:'PP', rate:62  },
      { code:'PI UPVC SPL 4.11.4', desc:'UPVC Tailpiece 110 mm dia',         unit:'PP', rate:128 },
      { code:'PI UPVC SPL 4.11.5', desc:'UPVC Tailpiece 140 mm dia',         unit:'PP', rate:171 },
      { code:'PI UPVC SPL 4.11.6', desc:'UPVC Tailpiece 160 mm dia',         unit:'PP', rate:308 },
      // Flanges
      { code:'PI UPVC SPL 4.12.1', desc:'UPVC Flange 63 mm dia',             unit:'PP', rate:58  },
      { code:'PI UPVC SPL 4.12.2', desc:'UPVC Flange 75 mm dia',             unit:'PP', rate:67  },
      { code:'PI UPVC SPL 4.12.3', desc:'UPVC Flange 90 mm dia',             unit:'PP', rate:76  },
      { code:'PI UPVC SPL 4.12.4', desc:'UPVC Flange 110 mm dia',            unit:'PP', rate:121 },
      { code:'PI UPVC SPL 4.12.5', desc:'UPVC Flange 140 mm dia',            unit:'PP', rate:750 },
      { code:'PI UPVC SPL 4.12.6', desc:'UPVC Flange 160 mm dia',            unit:'PP', rate:845 },
      // 90° Bends
      { code:'PI UPVC SPL 4.13.1', desc:'UPVC Bend 90° 63 mm dia',           unit:'PP', rate:64  },
      { code:'PI UPVC SPL 4.13.2', desc:'UPVC Bend 90° 75 mm dia',           unit:'PP', rate:89  },
      { code:'PI UPVC SPL 4.13.3', desc:'UPVC Bend 90° 90 mm dia',           unit:'PP', rate:172 },
      { code:'PI UPVC SPL 4.13.4', desc:'UPVC Bend 90° 110 mm dia',          unit:'PP', rate:271 },
      { code:'PI UPVC SPL 4.13.5', desc:'UPVC Bend 90° 140 mm dia',          unit:'PP', rate:432 },
      { code:'PI UPVC SPL 4.13.6', desc:'UPVC Bend 90° 160 mm dia',          unit:'PP', rate:730 },
      // 45° Bends
      { code:'PI UPVC SPL 4.14.1', desc:'UPVC Bend 45° 63 mm dia',           unit:'PP', rate:65  },
      { code:'PI UPVC SPL 4.14.2', desc:'UPVC Bend 45° 75 mm dia',           unit:'PP', rate:88  },
      { code:'PI UPVC SPL 4.14.3', desc:'UPVC Bend 45° 90 mm dia',           unit:'PP', rate:151 },
      { code:'PI UPVC SPL 4.14.4', desc:'UPVC Bend 45° 110 mm dia',          unit:'PP', rate:233 },
      { code:'PI UPVC SPL 4.14.5', desc:'UPVC Bend 45° 140 mm dia',          unit:'PP', rate:271 },
      { code:'PI UPVC SPL 4.14.6', desc:'UPVC Bend 45° 160 mm dia',          unit:'PP', rate:560 },
      // Reducing Tees
      { code:'PI UPVC SPL 4.15.1',  desc:'UPVC Reducing Tee 75x63 mm',       unit:'PP', rate:158 },
      { code:'PI UPVC SPL 4.15.2',  desc:'UPVC Reducing Tee 90x75 mm',       unit:'PP', rate:181 },
      { code:'PI UPVC SPL 4.15.3',  desc:'UPVC Reducing Tee 90x63 mm',       unit:'PP', rate:203 },
      { code:'PI UPVC SPL 4.15.4',  desc:'UPVC Reducing Tee 110x90 mm',      unit:'PP', rate:406 },
      { code:'PI UPVC SPL 4.15.5',  desc:'UPVC Reducing Tee 110x75 mm',      unit:'PP', rate:268 },
      { code:'PI UPVC SPL 4.15.6',  desc:'UPVC Reducing Tee 110x63 mm',      unit:'PP', rate:293 },
      { code:'PI UPVC SPL 4.15.7',  desc:'UPVC Reducing Tee 140x110 mm',     unit:'PP', rate:630 },
      { code:'PI UPVC SPL 4.15.8',  desc:'UPVC Reducing Tee 160x140 mm',     unit:'PP', rate:695 },
      { code:'PI UPVC SPL 4.15.9',  desc:'UPVC Reducing Tee 160x110 mm',     unit:'PP', rate:702 },
      { code:'PI UPVC SPL 4.15.10', desc:'UPVC Reducing Tee 160x90 mm',      unit:'PP', rate:760 },
      // Reducing Bushes
      { code:'PI UPVC SPL 4.16.1',  desc:'UPVC Reducing Bush 75x63 mm',      unit:'PP', rate:45  },
      { code:'PI UPVC SPL 4.16.2',  desc:'UPVC Reducing Bush 90x75 mm',      unit:'PP', rate:59  },
      { code:'PI UPVC SPL 4.16.3',  desc:'UPVC Reducing Bush 90x63 mm',      unit:'PP', rate:95  },
      { code:'PI UPVC SPL 4.16.4',  desc:'UPVC Reducing Bush 110x90 mm',     unit:'PP', rate:115 },
      { code:'PI UPVC SPL 4.16.5',  desc:'UPVC Reducing Bush 110x75 mm',     unit:'PP', rate:106 },
      { code:'PI UPVC SPL 4.16.6',  desc:'UPVC Reducing Bush 110x63 mm',     unit:'PP', rate:104 },
      { code:'PI UPVC SPL 4.16.7',  desc:'UPVC Reducing Bush 140x90 mm',     unit:'PP', rate:272 },
      { code:'PI UPVC SPL 4.16.8',  desc:'UPVC Reducing Bush 140x110 mm',    unit:'PP', rate:199 },
      { code:'PI UPVC SPL 4.16.9',  desc:'UPVC Reducing Bush 160x140 mm',    unit:'PP', rate:264 },
      { code:'PI UPVC SPL 4.16.10', desc:'UPVC Reducing Bush 160x110 mm',    unit:'PP', rate:264 },
      // Flange Adaptors
      { code:'PI UPVC SPL 4.17.1', desc:'UPVC Flange Adaptor 63 mm dia',     unit:'PP', rate:219 },
      { code:'PI UPVC SPL 4.17.2', desc:'UPVC Flange Adaptor 75 mm dia',     unit:'PP', rate:293 },
      { code:'PI UPVC SPL 4.17.3', desc:'UPVC Flange Adaptor 90 mm dia',     unit:'PP', rate:326 },
      { code:'PI UPVC SPL 4.17.4', desc:'UPVC Flange Adaptor 110 mm dia',    unit:'PP', rate:586 },
      { code:'PI UPVC SPL 4.17.5', desc:'UPVC Flange Adaptor 140 mm dia',    unit:'PP', rate:845 },
      { code:'PI UPVC SPL 4.17.6', desc:'UPVC Flange Adaptor 160 mm dia',    unit:'PP', rate:845 },
      // Misc
      { code:'PI UPVC SPL 4.18.1', desc:'Yellow Teflon Tape PTFE 1" 10m roll',unit:'PP', rate:46   },
      { code:'PI UPVC SPL 4.19.1', desc:'UPVC Solvent Cement 250 ml',         unit:'PP', rate:175  },
      { code:'PI UPVC SPL 4.19.2', desc:'UPVC Solvent Cement 500 ml',         unit:'PP', rate:344  },
      { code:'PI UPVC SPL 4.19.3', desc:'UPVC Solvent Cement 1000 ml',        unit:'PP', rate:610  },
      { code:'PI UPVC SPL 4.19.4', desc:'UPVC Solvent Cement 5 Litre',        unit:'PP', rate:2542 },
      { code:'PI UPVC SPL 4.19.5', desc:'UPVC Solvent Cement 20 Litre',       unit:'PP', rate:8541 },
    ],
  },

  HDPE: {
    pipes: [
      { code:'PI HDPE 5.1.1',  desc:'HDPE Pipe 140 mm dia PN6 (IS:4984/2016)',  unit:'Rm', rate:576.80 },
      { code:'PI HDPE 5.1.2',  desc:'HDPE Pipe 125 mm dia PN6 (IS:4984/2016)',  unit:'Rm', rate:460.60 },
      { code:'PI HDPE 5.1.3',  desc:'HDPE Pipe 110 mm dia PN6 (IS:4984/2016)',  unit:'Rm', rate:360.40 },
      { code:'PI HDPE 5.1.4',  desc:'HDPE Pipe 90 mm dia PN6 (IS:4984/2016)',   unit:'Rm', rate:237.80 },
      { code:'PI HDPE 5.1.5',  desc:'HDPE Pipe 75 mm dia PN6 (IS:4984/2016)',   unit:'Rm', rate:167.40 },
      { code:'PI HDPE 5.1.6',  desc:'HDPE Pipe 63 mm dia PN6 (IS:4984/2016)',   unit:'Rm', rate:117.00 },
      { code:'PI HDPE 5.1.7',  desc:'HDPE Pipe 140 mm dia PN10 (IS:4984/2016)', unit:'Rm', rate:856.60 },
      { code:'PI HDPE 5.1.8',  desc:'HDPE Pipe 125 mm dia PN10 (IS:4984/2016)', unit:'Rm', rate:683.80 },
      { code:'PI HDPE 5.1.9',  desc:'HDPE Pipe 110 mm dia PN10 (IS:4984/2016)', unit:'Rm', rate:530.20 },
      { code:'PI HDPE 5.1.10', desc:'HDPE Pipe 90 mm dia PN10 (IS:4984/2016)',  unit:'Rm', rate:357.60 },
      { code:'PI HDPE 5.1.11', desc:'HDPE Pipe 75 mm dia PN10 (IS:4984/2016)',  unit:'Rm', rate:251.20 },
      { code:'PI HDPE 5.1.12', desc:'HDPE Pipe 63 mm dia PN10 (IS:4984/2016)',  unit:'Rm', rate:177.20 },
    ],
    fittings: [
      // Equal Tees
      { code:'PI HDPE SPL 5.2.1', desc:'HDPE Equal Tee 160 mm dia',             unit:'PP', rate:1230 },
      { code:'PI HDPE SPL 5.2.2', desc:'HDPE Equal Tee 140 mm dia',             unit:'PP', rate:1025 },
      { code:'PI HDPE SPL 5.2.3', desc:'HDPE Equal Tee 125 mm dia',             unit:'PP', rate:710  },
      { code:'PI HDPE SPL 5.2.4', desc:'HDPE Equal Tee 110 mm dia',             unit:'PP', rate:294  },
      { code:'PI HDPE SPL 5.2.5', desc:'HDPE Equal Tee 90 mm dia',              unit:'PP', rate:177  },
      { code:'PI HDPE SPL 5.2.6', desc:'HDPE Equal Tee 75 mm dia',              unit:'PP', rate:120  },
      { code:'PI HDPE SPL 5.2.7', desc:'HDPE Equal Tee 63 mm dia',              unit:'PP', rate:72   },
      // Sockets
      { code:'PI HDPE SPL 5.3.1', desc:'HDPE Socket 160 mm dia',                unit:'PP', rate:226  },
      { code:'PI HDPE SPL 5.3.2', desc:'HDPE Socket 140 mm dia',                unit:'PP', rate:222  },
      { code:'PI HDPE SPL 5.3.3', desc:'HDPE Socket 125 mm dia',                unit:'PP', rate:218  },
      { code:'PI HDPE SPL 5.3.4', desc:'HDPE Socket 110 mm dia',                unit:'PP', rate:116  },
      { code:'PI HDPE SPL 5.3.5', desc:'HDPE Socket 90 mm dia',                 unit:'PP', rate:75   },
      { code:'PI HDPE SPL 5.3.6', desc:'HDPE Socket 75 mm dia',                 unit:'PP', rate:62   },
      { code:'PI HDPE SPL 5.3.7', desc:'HDPE Socket 63 mm dia',                 unit:'PP', rate:48   },
      // Reducers
      { code:'PI HDPE SPL 5.4.1', desc:'HDPE Reducer 160x140 mm',               unit:'PP', rate:651  },
      { code:'PI HDPE SPL 5.4.2', desc:'HDPE Reducer 140x125 mm',               unit:'PP', rate:413  },
      { code:'PI HDPE SPL 5.4.3', desc:'HDPE Reducer 125x110 mm',               unit:'PP', rate:413  },
      { code:'PI HDPE SPL 5.4.4', desc:'HDPE Reducer 110x90 mm',                unit:'PP', rate:266  },
      { code:'PI HDPE SPL 5.4.5', desc:'HDPE Reducer 90x75 mm',                 unit:'PP', rate:175  },
      { code:'PI HDPE SPL 5.4.6', desc:'HDPE Reducer 75x63 mm',                 unit:'PP', rate:139  },
      // Tail Pieces with GI Flange
      { code:'PI HDPE SPL 5.5.1', desc:'HDPE Tail Piece w/ GI Flange 160 mm',   unit:'PP', rate:260  },
      { code:'PI HDPE SPL 5.5.2', desc:'HDPE Tail Piece w/ GI Flange 140 mm',   unit:'PP', rate:211  },
      { code:'PI HDPE SPL 5.5.3', desc:'HDPE Tail Piece w/ GI Flange 125 mm',   unit:'PP', rate:211  },
      { code:'PI HDPE SPL 5.5.4', desc:'HDPE Tail Piece w/ GI Flange 110 mm',   unit:'PP', rate:136  },
      { code:'PI HDPE SPL 5.5.5', desc:'HDPE Tail Piece w/ GI Flange 90 mm',    unit:'PP', rate:93   },
      { code:'PI HDPE SPL 5.5.6', desc:'HDPE Tail Piece w/ GI Flange 75 mm',    unit:'PP', rate:81   },
      { code:'PI HDPE SPL 5.5.7', desc:'HDPE Tail Piece w/ GI Flange 63 mm',    unit:'PP', rate:69   },
      // Electrofusion Coupler Pieces
      { code:'PI HDPE SPL 5.6.1', desc:'HDPE EF Coupler Piece 160 mm dia',      unit:'PP', rate:850  },
      { code:'PI HDPE SPL 5.6.2', desc:'HDPE EF Coupler Piece 140 mm dia',      unit:'PP', rate:690  },
      { code:'PI HDPE SPL 5.6.3', desc:'HDPE EF Coupler Piece 125 mm dia',      unit:'PP', rate:585  },
      { code:'PI HDPE SPL 5.6.4', desc:'HDPE EF Coupler Piece 110 mm dia',      unit:'PP', rate:355  },
      { code:'PI HDPE SPL 5.6.5', desc:'HDPE EF Coupler Piece 90 mm dia',       unit:'PP', rate:280  },
      { code:'PI HDPE SPL 5.6.6', desc:'HDPE EF Coupler Piece 75 mm dia',       unit:'PP', rate:210  },
      { code:'PI HDPE SPL 5.6.7', desc:'HDPE EF Coupler Piece 63 mm dia',       unit:'PP', rate:170  },
      // Electrofusion Elbows
      { code:'PI HDPE SPL 5.7.1', desc:'HDPE EF Elbow Piece 160 mm dia',        unit:'PP', rate:2700 },
      { code:'PI HDPE SPL 5.7.2', desc:'HDPE EF Elbow Piece 140 mm dia',        unit:'PP', rate:1785 },
      { code:'PI HDPE SPL 5.7.3', desc:'HDPE EF Elbow Piece 125 mm dia',        unit:'PP', rate:1540 },
      { code:'PI HDPE SPL 5.7.4', desc:'HDPE EF Elbow Piece 110 mm dia',        unit:'PP', rate:792  },
      { code:'PI HDPE SPL 5.7.5', desc:'HDPE EF Elbow Piece 90 mm dia',         unit:'PP', rate:660  },
      { code:'PI HDPE SPL 5.7.6', desc:'HDPE EF Elbow Piece 75 mm dia',         unit:'PP', rate:380  },
      { code:'PI HDPE SPL 5.7.7', desc:'HDPE EF Elbow Piece 63 mm dia',         unit:'PP', rate:245  },
      // Electrofusion Tee Pieces
      { code:'PI HDPE SPL 5.8.1', desc:'HDPE EF Tee Piece 160 mm dia',          unit:'PP', rate:3090 },
      { code:'PI HDPE SPL 5.8.2', desc:'HDPE EF Tee Piece 140 mm dia',          unit:'PP', rate:2142 },
      { code:'PI HDPE SPL 5.8.3', desc:'HDPE EF Tee Piece 125 mm dia',          unit:'PP', rate:1670 },
      { code:'PI HDPE SPL 5.8.4', desc:'HDPE EF Tee Piece 110 mm dia',          unit:'PP', rate:880  },
      { code:'PI HDPE SPL 5.8.5', desc:'HDPE EF Tee Piece 90 mm dia',           unit:'PP', rate:704  },
      { code:'PI HDPE SPL 5.8.6', desc:'HDPE EF Tee Piece 75 mm dia',           unit:'PP', rate:396  },
      { code:'PI HDPE SPL 5.8.7', desc:'HDPE EF Tee Piece 63 mm dia',           unit:'PP', rate:286  },
      // Electrofusion Reducers
      { code:'PI HDPE SPL 5.9.1', desc:'HDPE EF Reducer 160x140 mm',            unit:'PP', rate:1794 },
      { code:'PI HDPE SPL 5.9.2', desc:'HDPE EF Reducer 140x125 mm',            unit:'PP', rate:1381 },
      { code:'PI HDPE SPL 5.9.3', desc:'HDPE EF Reducer 125x110 mm',            unit:'PP', rate:1200 },
      { code:'PI HDPE SPL 5.9.4', desc:'HDPE EF Reducer 110x90 mm',             unit:'PP', rate:710  },
      { code:'PI HDPE SPL 5.9.5', desc:'HDPE EF Reducer 90x75 mm',              unit:'PP', rate:580  },
      { code:'PI HDPE SPL 5.9.6', desc:'HDPE EF Reducer 75x63 mm',              unit:'PP', rate:420  },
    ],
  },

  PPR: {
    pipes: [
      { code:'PI PPR 6.1.1', desc:'PPR Pipe 20 mm dia OD PN-16 (IS-15801)',    unit:'Rm', rate:97 },
    ],
    fittings: [
      { code:'PI PPR SPL 6.2.1', desc:'PPR Elbow 20 mm dia',                   unit:'PP', rate:19  },
      { code:'PI PPR SPL 6.3.1', desc:'Bronze Ferrule Cock 15mm PN-16',         unit:'PP', rate:499 },
      // Saddle Pieces
      { code:'PI PPR SPL 6.4.1', desc:'Saddle Piece 160 mm dia',                unit:'PP', rate:360 },
      { code:'PI PPR SPL 6.4.2', desc:'Saddle Piece 140 mm dia',                unit:'PP', rate:297 },
      { code:'PI PPR SPL 6.4.3', desc:'Saddle Piece 125 mm dia',                unit:'PP', rate:240 },
      { code:'PI PPR SPL 6.4.4', desc:'Saddle Piece 110 mm dia',                unit:'PP', rate:205 },
      { code:'PI PPR SPL 6.4.5', desc:'Saddle Piece 90 mm dia',                 unit:'PP', rate:146 },
      { code:'PI PPR SPL 6.4.6', desc:'Saddle Piece 75 mm dia',                 unit:'PP', rate:147 },
      { code:'PI PPR SPL 6.4.7', desc:'Saddle Piece 63 mm dia',                 unit:'PP', rate:124 },
      // Integrated Saddle Clamp with Flow Control Valve
      { code:'PI PPR SPL 6.5.1', desc:'Integrated Saddle Clamp w/ FCV 160x15mm',unit:'PP', rate:357 },
      { code:'PI PPR SPL 6.5.2', desc:'Integrated Saddle Clamp w/ FCV 140x15mm',unit:'PP', rate:337 },
      { code:'PI PPR SPL 6.5.3', desc:'Integrated Saddle Clamp w/ FCV 125x15mm',unit:'PP', rate:337 },
      { code:'PI PPR SPL 6.5.4', desc:'Integrated Saddle Clamp w/ FCV 110x15mm',unit:'PP', rate:218 },
      { code:'PI PPR SPL 6.5.5', desc:'Integrated Saddle Clamp w/ FCV 90x15mm', unit:'PP', rate:199 },
      { code:'PI PPR SPL 6.5.6', desc:'Integrated Saddle Clamp w/ FCV 75x15mm', unit:'PP', rate:180 },
      { code:'PI PPR SPL 6.5.7', desc:'Integrated Saddle Clamp w/ FCV 63x15mm', unit:'PP', rate:171 },
      // Bib Cocks
      { code:'PI PPR SPL 6.6.1', desc:'Plastic Bib Cock 15 mm dia (IS:9763)',   unit:'PP', rate:25  },
      { code:'PI PPR SPL 6.6.2', desc:'Plastic Bib Cock 20 mm dia (IS:9763)',   unit:'PP', rate:87  },
      { code:'PI PPR SPL 6.7.1', desc:'Gunmetal Bib Cock 15 mm dia',            unit:'PP', rate:215 },
      { code:'PI PPR SPL 6.7.2', desc:'Gunmetal Bib Cock 20 mm dia',            unit:'PP', rate:240 },
    ],
  },
};

// ── Derived lookup helpers (for backward compat & dropdowns) ──
const PIPE_DIMS = Object.fromEntries(
  PIPE_TYPES.map(t => [t, PIPE_CATALOGUE[t].pipes.map(p => p.desc)])
);

const PIPE_RATES = Object.fromEntries(
  PIPE_TYPES.map(t => [t, Object.fromEntries(
    PIPE_CATALOGUE[t].pipes.map(p => [p.desc, p.rate])
  )])
);

// All items (pipes + fittings) flat list per type — for the fittings picker
const PIPE_FITTINGS = Object.fromEntries(
  PIPE_TYPES.map(t => [t, PIPE_CATALOGUE[t].fittings])
);

const LABOUR_ITEMS = [
  { name: 'Plumber Grade I',       unit: 'per person per day', rate: 973  },
  { name: 'Plumber Grade II',      unit: 'per person per day', rate: 792  },
  { name: 'Ordinary Labourer',     unit: 'per person per day', rate: 600  },
  { name: 'Mason Grade I',         unit: 'per person per day', rate: 890  },
  { name: 'Skilled Electrician',   unit: 'per person per day', rate: 1050 },
  { name: 'Helper',                unit: 'per person per day', rate: 520  },
];

const CARRIAGE_ITEMS = [
  { name: 'Carriage 0–10 km, 0–11 kg',   unit: 'per trip', rate: 700  },
  { name: 'Carriage 11–20 km, 11–50 kg', unit: 'per trip', rate: 1800 },
  { name: 'Carriage 21–30 km, 51–100 kg',unit: 'per trip', rate: 2800 },
  { name: 'Carriage 31–50 km, >100 kg',  unit: 'per trip', rate: 4200 },
];

const HARDWARE_ITEMS = [
  { name: 'Teflon Tape (1 inch wide)',                unit: 'per pc',          rate: 46   },
  { name: 'Electro Fusion Pipe Machine (HDPE)',        unit: 'per day',         rate: 1000 },
  { name: 'PVC Rubber Lubricants 250g',                unit: 'per pc',          rate: 153  },
  { name: 'Heavy Duty Pipe Wrench 300mm',              unit: 'per pc',          rate: 642  },
  { name: 'Pipe Cutter Set',                           unit: 'per pc',          rate: 480  },
  { name: 'G.I. Socket 15mm',                          unit: 'per pc',          rate: 35   },
  { name: 'G.I. Elbow 15mm',                           unit: 'per pc',          rate: 42   },
  { name: 'G.I. Tee 25mm',                             unit: 'per pc',          rate: 65   },
  { name: 'HDPE Electrofusion Coupler 90mm',           unit: 'per pc',          rate: 285  },
  { name: 'HDPE Electrofusion Elbow 90mm',             unit: 'per pc',          rate: 320  },
  { name: 'Gate Valve 50mm',                           unit: 'per pc',          rate: 1850 },
  { name: 'Sluice Valve 80mm',                         unit: 'per pc',          rate: 3200 },
  { name: 'Pressure Gauge',                            unit: 'per pc',          rate: 780  },
  { name: 'M-Seal Quick Fix',                          unit: 'per pack',        rate: 120  },
  { name: 'Fevicol SH 1 kg',                          unit: 'per kg',          rate: 195  },
];

// ── Render Engine ─────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  if (STATE.currentStep === -1) {
    app.appendChild(renderLogin());
  } else {
    app.appendChild(renderShell());
  }

  createToastContainer();
}

// ── LOGIN ─────────────────────────────────────────────────────
function renderLogin() {
  const screen = el('div', 'login-screen');
  screen.innerHTML = `
    <div class="login-bg-deco"></div>
    <div class="login-card">
      <div class="login-logo">
        <div class="login-logo-icon">💧</div>
        <div>
          <div class="login-logo-text">PHE Department</div>
          <div class="login-logo-sub">Govt. Water Supply System</div>
        </div>
      </div>
      <h1 class="login-title">Cost Estimation<br>Portal</h1>
      <p class="login-subtitle">Secure multi-role access for authorised officials</p>

      <div class="form-group">
        <label class="form-label">Role <span class="required">*</span></label>
        <select class="form-control" id="login-role">
          <option value="">— Select Role —</option>
          <option value="SO">SO (Sectional Officer)</option>
          <option value="SDO">SDO (Sub-Divisional Officer)</option>
          <option value="EE">EE (Executive Engineer)</option>
          <option value="SE">SE (Superintending Engineer)</option>
          <option value="HQ">HQ (Head Quarter)</option>
        </select>
        <div class="form-error">Please select your role</div>
      </div>

      <div class="form-group">
        <label class="form-label">Username <span class="required">*</span></label>
        <div class="input-with-icon">
          <span class="input-icon">👤</span>
          <input type="text" id="login-user" class="form-control" placeholder="Enter your username"/>
        </div>
        <div class="form-error">Username is required</div>
      </div>

      <div class="form-group">
        <label class="form-label">Password <span class="required">*</span></label>
        <div class="input-with-icon">
          <span class="input-icon">🔒</span>
          <input type="password" id="login-pass" class="form-control" placeholder="Enter your password"/>
          <button class="password-toggle" id="toggle-pass" type="button" title="Show/hide password">👁️</button>
        </div>
        <div class="form-error">Password is required</div>
      </div>

      <div class="login-divider">Secure Login</div>

      <button class="btn btn-primary btn-lg btn-full" id="login-btn">
        <span>Sign In</span> <span>→</span>
      </button>

      <p style="margin-top:1.25rem;font-size:0.75rem;color:var(--text-muted);text-align:center;">
        Demo: any username/password | All roles accepted
      </p>
    </div>
  `;

  // Toggle password
  screen.querySelector('#toggle-pass').addEventListener('click', () => {
    const inp = screen.querySelector('#login-pass');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // Login action
  screen.querySelector('#login-btn').addEventListener('click', () => {
    const role = screen.querySelector('#login-role');
    const user = screen.querySelector('#login-user');
    const pass = screen.querySelector('#login-pass');
    const ok = validate([
      { el: role, msg: 'Please select your role' },
      { el: user, msg: 'Username is required' },
      { el: pass, msg: 'Password is required' },
    ]);
    if (!ok) return;

    const btn = screen.querySelector('#login-btn');
    btn.innerHTML = '<span class="spinner"></span> Signing in…';
    btn.disabled = true;

    setTimeout(() => {
      STATE.user = { role: role.value, username: user.value };
      STATE.currentStep = 0;
      saveState();
      render();
      showToast(`Welcome, ${user.value} (${role.value})!`);
    }, 900);
  });

  return screen;
}

// ── SHELL (header + stepper + content + footer) ───────────────
function renderShell() {
  const shell = el('div', 'app-shell');

  // Header
  shell.appendChild(renderHeader());

  // Stepper
  shell.appendChild(renderStepper());

  // Content
  const content = el('div', 'content-area page-enter');
  content.appendChild(renderStep(STATE.currentStep));
  shell.appendChild(content);

  // Footer nav
  shell.appendChild(renderNavFooter());

  return shell;
}

function renderHeader() {
  const h = el('header', 'app-header');
  h.innerHTML = `
    <div class="header-brand">
      <div class="header-logo">💧</div>
      <div>
        <div class="header-brand-text">PHE Cost Estimation</div>
        <div class="header-brand-sub">Public Health Engineering Dept.</div>
      </div>
    </div>
    <div class="header-user">
      <div class="header-user-badge">
        <span class="badge-role">${STATE.user?.role}</span>
        <span>${STATE.user?.username}</span>
      </div>
      <button class="btn btn-ghost btn-sm" id="logout-btn">Logout</button>
    </div>
  `;
  h.querySelector('#logout-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to logout? Unsaved data will be lost.')) {
      localStorage.removeItem('phe_estimation_state');
      STATE.user = null; STATE.currentStep = -1;
      render();
    }
  });
  return h;
}

function renderStepper() {
  const w = el('div', 'stepper-wrapper');
  const s = el('div', 'stepper');

  STEPS.forEach((step, i) => {
    const done   = i < STATE.currentStep;
    const active = i === STATE.currentStep;

    const item = el('div', `step-item${active?' active':''}${done?' done':''}`);
    item.innerHTML = `
      <div class="step-circle ${active?'active':''} ${done?'done':''}">
        ${done ? '✓' : (i+1)}
      </div>
      <div class="step-info">
        <div class="step-num">Step ${i+1}</div>
        <div class="step-name">${step.name}</div>
      </div>
    `;
    s.appendChild(item);

    if (i < STEPS.length - 1) {
      const line = el('div', `step-line${done?' done':''}`);
      s.appendChild(line);
    }
  });

  w.appendChild(s);
  return w;
}

function renderNavFooter() {
  const f = el('div', 'nav-footer');
  const step = STATE.currentStep;
  const total = STEPS.length;

  f.innerHTML = `
    <div class="flex gap-2">
      <button class="btn btn-ghost" id="nav-prev" ${step === 0 ? 'disabled' : ''}>← Previous</button>
    </div>
    <div class="nav-footer-progress">Step <span>${step+1}</span> of ${total}</div>
    <div class="flex gap-2">
      ${step === total - 1
        ? `<button class="btn btn-accent btn-lg" id="nav-submit">🎉 Submit Estimate</button>`
        : `<button class="btn btn-primary" id="nav-next">Next →</button>`
      }
    </div>
  `;

  f.querySelector('#nav-prev')?.addEventListener('click', () => {
    if (step > 0) { STATE.currentStep--; saveState(); render(); window.scrollTo(0,0); }
  });

  f.querySelector('#nav-next')?.addEventListener('click', () => {
    if (validateStep(step)) {
      STATE.currentStep++; saveState(); render(); window.scrollTo(0,0);
    }
  });

  f.querySelector('#nav-submit')?.addEventListener('click', () => {
    showToast('Estimate submitted successfully! Generating PDF…', 'success');
    setTimeout(() => window.print(), 800);
  });

  return f;
}

// ── Step validators ───────────────────────────────────────────
function validateStep(step) {
  switch(step) {
    case 0: return validateScheme();
    case 1: return validateIncident();
    default: return true;
  }
}

function validateScheme() {
  const required = ['zone','circle','district','division','scheme_name','imis_id'];
  let ok = true;
  required.forEach(id => {
    const el = document.getElementById(`s-${id}`);
    if (!el) return;
    const errEl = el.closest('.form-group')?.querySelector('.form-error');
    if (!el.value.trim()) {
      el.classList.add('error');
      if (errEl) { errEl.textContent = 'This field is required'; errEl.classList.add('visible'); }
      ok = false;
    } else {
      el.classList.remove('error');
      if (errEl) errEl.classList.remove('visible');
    }
  });
  if (!ok) showToast('Please fill all required fields', 'error');
  return ok;
}

function validateIncident() {
  const d = document.getElementById('incident-date');
  if (!d.value) {
    d.classList.add('error');
    showToast('Please select the incident date', 'error');
    return false;
  }
  return true;
}

// ── STEP RENDERERS ────────────────────────────────────────────
function renderStep(step) {
  const renderers = [
    renderStepScheme,
    renderStepIncident,
    renderStepComponents,
    renderStepPipes,
    renderStepLabour,
    renderStepPreview,
  ];
  return renderers[step]?.() || el('div','','Unknown step');
}

// ── Step 0: Scheme Details ────────────────────────────────────
function renderStepScheme() {
  const wrap = el('div');
  const sd = STATE.schemeDetails;

  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">🏛️ Scheme Details</h1>
      <p class="page-subtitle">Enter administrative & scheme information for the cost estimate</p>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">📍</div> Administrative Location</div>
      </div>
      <div class="grid-3">
        <div class="form-group">
          <label class="form-label">Zone <span class="required">*</span></label>
          <select id="s-zone" class="form-control">
            <option value="">Select Zone</option>
            ${['North Zone','South Zone','East Zone','West Zone','Central Zone'].map(z=>`<option ${sd.zone===z?'selected':''} value="${z}">${z}</option>`).join('')}
          </select>
          <div class="form-error"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Circle <span class="required">*</span></label>
          <input type="text" id="s-circle" class="form-control" placeholder="e.g. Dima Hasao Circle" value="${sd.circle||''}"/>
          <div class="form-error"></div>
        </div>
        <div class="form-group">
          <label class="form-label">District <span class="required">*</span></label>
          <input type="text" id="s-district" class="form-control" placeholder="e.g. Dima Hasao" value="${sd.district||''}"/>
          <div class="form-error"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Division <span class="required">*</span></label>
          <input type="text" id="s-division" class="form-control" placeholder="e.g. Umrangso Division" value="${sd.division||''}"/>
          <div class="form-error"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Subdivision</label>
          <input type="text" id="s-subdivision" class="form-control" placeholder="e.g. Diyungbra MAC Area" value="${sd.subdivision||''}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Block</label>
          <input type="text" id="s-block" class="form-control" placeholder="e.g. Umrangso Block" value="${sd.block||''}"/>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">📋</div> Scheme Information</div>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Gram Panchayat</label>
          <input type="text" id="s-panchayat" class="form-control" placeholder="Enter panchayat name" value="${sd.panchayat||''}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Scheme Name <span class="required">*</span></label>
          <input type="text" id="s-scheme_name" class="form-control" placeholder="e.g. Baraima PWSS" value="${sd.scheme_name||''}"/>
          <div class="form-error"></div>
        </div>
        <div class="form-group">
          <label class="form-label">IMIS ID <span class="required">*</span></label>
          <input type="text" id="s-imis_id" class="form-control" placeholder="e.g. AS-123456" value="${sd.imis_id||''}"/>
          <div class="form-error"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Number of FHTC</label>
          <input type="number" id="s-fhtc" class="form-control" placeholder="e.g. 250" min="0" value="${sd.fhtc||''}"/>
        </div>
      </div>
    </div>
  `;

  // Auto-save on change
  wrap.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', () => {
      const key = el.id.replace('s-', '');
      STATE.schemeDetails[key] = el.value;
      saveState();
    });
  });

  return wrap;
}

// ── Step 1: Incident Date ─────────────────────────────────────
function renderStepIncident() {
  const wrap = el('div');
  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">📅 Incident Reporting</h1>
      <p class="page-subtitle">Log the incident date for this repair/replacement work</p>
    </div>

    <div class="card" style="max-width:480px">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">📋</div> Incident Information</div>
      </div>

      <div class="form-group">
        <label class="form-label">Date of Incident Reporting <span class="required">*</span></label>
        <input type="date" id="incident-date" class="form-control" value="${STATE.incidentDate||''}"/>
        <div class="form-error">Please select the incident date</div>
      </div>

      <div class="form-group">
        <label class="form-label">Nature of Complaint</label>
        <select class="form-control" id="incident-nature">
          <option value="">Select nature</option>
          <option ${STATE.incidentNature==='Pipeline Burst'?'selected':''}>Pipeline Burst</option>
          <option ${STATE.incidentNature==='Leakage'?'selected':''}>Leakage</option>
          <option ${STATE.incidentNature==='No Water Supply'?'selected':''}>No Water Supply</option>
          <option ${STATE.incidentNature==='Pump Failure'?'selected':''}>Pump Failure</option>
          <option ${STATE.incidentNature==='Contamination'?'selected':''}>Contamination</option>
          <option ${STATE.incidentNature==='Routine Maintenance'?'selected':''}>Routine Maintenance</option>
          <option ${STATE.incidentNature==='Annual Maintenance'?'selected':''}>Annual Maintenance</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Brief Description</label>
        <textarea class="form-control" id="incident-desc" rows="3" placeholder="Describe the issue briefly…" style="resize:vertical">${STATE.incidentDesc||''}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Priority Level</label>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          ${['Urgent','High','Normal','Low'].map(p=>`
            <label style="cursor:pointer;display:flex;align-items:center;gap:0.3rem;font-size:0.82rem">
              <input type="radio" name="priority" value="${p}" ${STATE.incidentPriority===p?'checked':''} style="accent-color:var(--blue)"/>
              ${p}
            </label>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  wrap.querySelector('#incident-date').addEventListener('change', e => {
    STATE.incidentDate = e.target.value; saveState();
  });
  wrap.querySelector('#incident-nature').addEventListener('change', e => {
    STATE.incidentNature = e.target.value; saveState();
  });
  wrap.querySelector('#incident-desc').addEventListener('input', e => {
    STATE.incidentDesc = e.target.value; saveState();
  });
  wrap.querySelectorAll('[name="priority"]').forEach(r => {
    r.addEventListener('change', e => { STATE.incidentPriority = e.target.value; saveState(); });
  });

  return wrap;
}

// ── Step 2: Components ────────────────────────────────────────
function renderStepComponents() {
  const wrap = el('div');
  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">🧩 Select Components</h1>
      <p class="page-subtitle">Choose all relevant work components for this estimation</p>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🔘</div> Work Components</div>
        <span class="badge badge-blue" id="sel-count">${STATE.selectedComponents.length} selected</span>
      </div>
      <div class="components-grid" id="comp-grid"></div>
    </div>
  `;

  const grid = wrap.querySelector('#comp-grid');
  const cntBadge = wrap.querySelector('#sel-count');

  COMPONENTS.forEach(comp => {
    const tile = el('div', `component-tile${STATE.selectedComponents.includes(comp.id)?' selected':''}`);
    tile.innerHTML = `
      <div class="component-tile-check">✓</div>
      <div class="component-tile-icon">${comp.icon}</div>
      <div class="component-tile-label">${comp.label}</div>
    `;
    tile.addEventListener('click', () => {
      const idx = STATE.selectedComponents.indexOf(comp.id);
      if (idx === -1) STATE.selectedComponents.push(comp.id);
      else STATE.selectedComponents.splice(idx, 1);
      tile.classList.toggle('selected', STATE.selectedComponents.includes(comp.id));
      cntBadge.textContent = STATE.selectedComponents.length + ' selected';
      saveState();
    });
    grid.appendChild(tile);
  });

  return wrap;
}

// ── Step 3: Pipes & Fittings ──────────────────────────────────
function renderStepPipes() {
  const wrap = el('div');
  if (!STATE.pipes)    STATE.pipes    = [];
  if (!STATE.fittings) STATE.fittings = [];

  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">🔧 Pipes & Fittings</h1>
      <p class="page-subtitle">Official IS-standard rates (Phase II). Add pipes (Rm) and fittings/accessories (Per Piece).</p>
    </div>
    <div class="tab-nav">
      <button class="tab-btn active" data-tab="pipes-tab">🚰 Pipes (Running Meter)</button>
      <button class="tab-btn" data-tab="fittings-tab">🔩 Fittings / Accessories</button>
      <button class="tab-btn" data-tab="summary-tab">📊 Summary</button>
    </div>
    <div id="pipes-tab" class="tab-panel active">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><div class="card-icon">🚰</div> Pipe Entries</div>
          <span class="badge badge-blue" id="pipe-count">${STATE.pipes.length} entries</span>
        </div>
        <div id="pipe-rows"></div>
        <button class="add-row-btn" id="add-pipe-row">＋ Add Pipe Entry</button>
      </div>
    </div>
    <div id="fittings-tab" class="tab-panel">
      <div class="card">
        <div class="card-header">
          <div class="card-title"><div class="card-icon">🔩</div> Fittings & Accessories</div>
          <span class="badge badge-blue" id="fitting-count">${STATE.fittings.length} entries</span>
        </div>
        <div id="fitting-rows"></div>
        <button class="add-row-btn" id="add-fitting-row">＋ Add Fitting Entry</button>
      </div>
    </div>
    <div id="summary-tab" class="tab-panel">
      <div class="card">
        <div class="card-header"><div class="card-title"><div class="card-icon">🚰</div> Pipes Summary</div></div>
        <div class="table-wrapper" id="pipe-summary-table"></div>
      </div>
      <div class="card" style="margin-top:1rem">
        <div class="card-header"><div class="card-title"><div class="card-icon">🔩</div> Fittings Summary</div></div>
        <div class="table-wrapper" id="fitting-summary-table"></div>
      </div>
    </div>
  `;

  // Tab switching
  wrap.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      wrap.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      wrap.querySelector(`#${btn.dataset.tab}`).classList.add('active');
      if (btn.dataset.tab === 'summary-tab') { renderPipeSummary(); renderFittingSummary(); }
    });
  });

  // ── Pipe summary
  const renderPipeSummary = () => {
    const el2 = wrap.querySelector('#pipe-summary-table');
    if (!STATE.pipes.length) { el2.innerHTML = '<p style="padding:1rem;color:var(--text-muted);font-size:0.82rem">No pipe entries yet.</p>'; return; }
    const total = STATE.pipes.reduce((a,p)=>a+(p.cost||0),0);
    el2.innerHTML = `<table>
      <thead><tr><th>#</th><th>Code</th><th>Type</th><th>Description</th><th>Length (m)</th><th>Rate/m</th><th>Amount</th></tr></thead>
      <tbody>${STATE.pipes.map((p,i)=>`<tr>
        <td>${i+1}</td>
        <td style="font-size:0.7rem;color:var(--text-muted)">${p.code||'—'}</td>
        <td><span class="badge badge-blue">${p.type||'—'}</span></td>
        <td style="font-size:0.8rem">${p.dim||'—'}</td>
        <td class="table-number">${p.length||0}</td>
        <td class="table-number">${fmt(p.rate)}</td>
        <td class="table-number" style="color:var(--accent);font-weight:600">${fmt(p.cost)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="6" style="text-align:right;font-weight:700">Sub-Total (Pipes)</td><td style="color:var(--accent);font-weight:700">${fmt(total)}</td></tr></tfoot>
    </table>`;
  };

  // ── Fittings summary
  const renderFittingSummary = () => {
    const el2 = wrap.querySelector('#fitting-summary-table');
    if (!STATE.fittings.length) { el2.innerHTML = '<p style="padding:1rem;color:var(--text-muted);font-size:0.82rem">No fitting entries yet.</p>'; return; }
    const total = STATE.fittings.reduce((a,f)=>a+(f.cost||0),0);
    el2.innerHTML = `<table>
      <thead><tr><th>#</th><th>Code</th><th>Type</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
      <tbody>${STATE.fittings.map((f,i)=>`<tr>
        <td>${i+1}</td>
        <td style="font-size:0.7rem;color:var(--text-muted)">${f.code||'—'}</td>
        <td><span class="badge badge-green">${f.type||'—'}</span></td>
        <td style="font-size:0.8rem">${f.desc||'—'}</td>
        <td class="table-number">${f.qty||0}</td>
        <td class="table-number">${fmt(f.rate)}</td>
        <td class="table-number" style="color:var(--accent);font-weight:600">${fmt(f.cost)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="6" style="text-align:right;font-weight:700">Sub-Total (Fittings)</td><td style="color:var(--accent);font-weight:700">${fmt(total)}</td></tr></tfoot>
    </table>`;
  };

  // ── Pipe rows
  const renderPipeRows = () => {
    const container = wrap.querySelector('#pipe-rows');
    container.innerHTML = '';
    wrap.querySelector('#pipe-count').textContent = STATE.pipes.length + ' entries';
    STATE.pipes.forEach((pipe, i) => {
      const pipeList = pipe.type ? (PIPE_CATALOGUE[pipe.type]?.pipes || []) : [];
      const row = el('div', 'item-row');
      row.style.gridTemplateColumns = '140px 1fr 100px auto auto';
      row.innerHTML = `
        <div class="form-group" style="margin:0">
          <label class="form-label">Pipe Type</label>
          <select class="form-control pipe-type-sel" data-i="${i}">
            <option value="">Select</option>
            ${PIPE_TYPES.map(t=>`<option ${pipe.type===t?'selected':''} value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Description / Size</label>
          <select class="form-control pipe-dim-sel" data-i="${i}">
            <option value="">— Select pipe —</option>
            ${pipeList.map(p=>`<option ${pipe.dim===p.desc?'selected':''} value="${p.desc}" data-rate="${p.rate}" data-code="${p.code}">${p.desc}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Length (m)</label>
          <input type="number" class="form-control pipe-len" data-i="${i}" placeholder="0" min="0" value="${pipe.length||''}"/>
        </div>
        <div>
          <label class="form-label">Amount</label>
          <div class="item-row-calculated">${fmt(pipe.cost)}</div>
        </div>
        <div>
          <label class="form-label">&nbsp;</label>
          <button class="btn btn-danger btn-sm btn-icon pipe-del" data-i="${i}">🗑</button>
        </div>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.pipe-type-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = +sel.dataset.i;
        STATE.pipes[i].type = sel.value; STATE.pipes[i].dim = ''; STATE.pipes[i].rate = 0; STATE.pipes[i].cost = 0; STATE.pipes[i].code = '';
        saveState(); renderPipeRows();
      });
    });
    container.querySelectorAll('.pipe-dim-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = +sel.dataset.i;
        const opt = sel.options[sel.selectedIndex];
        STATE.pipes[i].dim  = sel.value;
        STATE.pipes[i].rate = +opt.dataset.rate || 0;
        STATE.pipes[i].code = opt.dataset.code  || '';
        STATE.pipes[i].cost = STATE.pipes[i].rate * (STATE.pipes[i].length||0);
        saveState(); renderPipeRows();
      });
    });
    container.querySelectorAll('.pipe-len').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = +inp.dataset.i;
        STATE.pipes[i].length = +inp.value;
        STATE.pipes[i].cost   = (STATE.pipes[i].rate||0) * +inp.value;
        inp.closest('.item-row').querySelector('.item-row-calculated').textContent = fmt(STATE.pipes[i].cost);
        saveState();
      });
    });
    container.querySelectorAll('.pipe-del').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.pipes.splice(+btn.dataset.i, 1);
        saveState(); renderPipeRows();
      });
    });
  };

  // ── Fitting rows
  const renderFittingRows = () => {
    const container = wrap.querySelector('#fitting-rows');
    container.innerHTML = '';
    wrap.querySelector('#fitting-count').textContent = STATE.fittings.length + ' entries';
    STATE.fittings.forEach((fit, i) => {
      const fittingList = fit.type ? (PIPE_CATALOGUE[fit.type]?.fittings || []) : [];
      const row = el('div', 'item-row');
      row.style.gridTemplateColumns = '140px 1fr 100px auto auto';
      row.innerHTML = `
        <div class="form-group" style="margin:0">
          <label class="form-label">Pipe Type</label>
          <select class="form-control fit-type-sel" data-i="${i}">
            <option value="">Select</option>
            ${PIPE_TYPES.map(t=>`<option ${fit.type===t?'selected':''} value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Fitting / Accessory</label>
          <select class="form-control fit-desc-sel" data-i="${i}">
            <option value="">— Select fitting —</option>
            ${fittingList.map(f=>`<option ${fit.desc===f.desc?'selected':''} value="${f.desc}" data-rate="${f.rate}" data-code="${f.code}" data-unit="${f.unit}">${f.desc}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Qty / Nos.</label>
          <input type="number" class="form-control fit-qty" data-i="${i}" placeholder="0" min="0" value="${fit.qty||''}"/>
        </div>
        <div>
          <label class="form-label">Amount</label>
          <div class="item-row-calculated">${fmt(fit.cost)}</div>
        </div>
        <div>
          <label class="form-label">&nbsp;</label>
          <button class="btn btn-danger btn-sm btn-icon fit-del" data-i="${i}">🗑</button>
        </div>
      `;
      container.appendChild(row);
    });

    container.querySelectorAll('.fit-type-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = +sel.dataset.i;
        STATE.fittings[i].type = sel.value; STATE.fittings[i].desc = ''; STATE.fittings[i].rate = 0; STATE.fittings[i].cost = 0; STATE.fittings[i].code = '';
        saveState(); renderFittingRows();
      });
    });
    container.querySelectorAll('.fit-desc-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const i = +sel.dataset.i;
        const opt = sel.options[sel.selectedIndex];
        STATE.fittings[i].desc = sel.value;
        STATE.fittings[i].rate = +opt.dataset.rate || 0;
        STATE.fittings[i].code = opt.dataset.code  || '';
        STATE.fittings[i].unit = opt.dataset.unit  || 'PP';
        STATE.fittings[i].cost = STATE.fittings[i].rate * (STATE.fittings[i].qty||0);
        saveState(); renderFittingRows();
      });
    });
    container.querySelectorAll('.fit-qty').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = +inp.dataset.i;
        STATE.fittings[i].qty  = +inp.value;
        STATE.fittings[i].cost = (STATE.fittings[i].rate||0) * +inp.value;
        inp.closest('.item-row').querySelector('.item-row-calculated').textContent = fmt(STATE.fittings[i].cost);
        saveState();
      });
    });
    container.querySelectorAll('.fit-del').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.fittings.splice(+btn.dataset.i, 1);
        saveState(); renderFittingRows();
      });
    });
  };

  wrap.querySelector('#add-pipe-row').addEventListener('click', () => {
    STATE.pipes.push({ type:'', dim:'', length:0, rate:0, cost:0, code:'' });
    saveState(); renderPipeRows();
  });

  wrap.querySelector('#add-fitting-row').addEventListener('click', () => {
    STATE.fittings.push({ type:'', desc:'', qty:0, rate:0, cost:0, code:'', unit:'PP' });
    saveState(); renderFittingRows();
  });

  renderPipeRows();
  renderFittingRows();
  return wrap;
}

// ── Step 4: Labour ────────────────────────────────────────────
function renderStepLabour() {
  const wrap = el('div');
  if (!STATE.labour)   STATE.labour   = [];
  if (!STATE.carriage) STATE.carriage = [];
  if (!STATE.hardware) STATE.hardware = [];

  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">👷 Labour, Carriage & Hardware</h1>
      <p class="page-subtitle">Add manpower, transport and material costs</p>
    </div>

    <div class="tab-nav">
      <button class="tab-btn active" data-tab="labour">👷 Labour</button>
      <button class="tab-btn" data-tab="carriage">🚛 Carriage</button>
      <button class="tab-btn" data-tab="hardware">🔩 Hardware Items</button>
    </div>

    <div id="tab-labour"  class="tab-panel active"></div>
    <div id="tab-carriage" class="tab-panel"></div>
    <div id="tab-hardware" class="tab-panel"></div>
  `;

  // Tab switching
  wrap.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      wrap.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      wrap.querySelector(`#tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  const renderSectionRows = (key, items, container) => {
    container.innerHTML = '';
    const card = el('div', 'card');
    card.innerHTML = `
      <div class="card-header">
        <div class="card-title"><div class="card-icon">📋</div> Items</div>
      </div>
      <div id="${key}-rows"></div>
      <button class="add-row-btn" id="add-${key}-row">＋ Add Entry</button>
      <div class="table-wrapper" style="margin-top:1rem" id="${key}-summary"></div>
    `;
    container.appendChild(card);

    const renderRows = () => {
      const rowsEl = card.querySelector(`#${key}-rows`);
      rowsEl.innerHTML = '';
      STATE[key].forEach((item, i) => {
        const presets = items;
        const row = el('div', 'item-row');
        row.innerHTML = `
          <div class="form-group" style="margin:0">
            <label class="form-label">Description</label>
            <select class="form-control item-name" data-i="${i}">
              <option value="">— Select —</option>
              ${presets.map(p=>`<option ${item.name===p.name?'selected':''} value="${p.name}" data-rate="${p.rate}" data-unit="${p.unit}">${p.name}</option>`).join('')}
              <option value="__custom__" ${item.name==='__custom__'?'selected':''}>Custom…</option>
            </select>
          </div>
          ${item.name==='__custom__' ? `<div class="form-group" style="margin:0">
            <label class="form-label">Custom Name</label>
            <input type="text" class="form-control item-custom-name" data-i="${i}" value="${item.customName||''}" placeholder="Item name"/>
          </div>` : ''}
          <div class="form-group" style="margin:0">
            <label class="form-label">Rate (₹)</label>
            <input type="number" class="form-control item-rate" data-i="${i}" min="0" value="${item.rate||''}" placeholder="0"/>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Qty / Nos.</label>
            <input type="number" class="form-control item-qty" data-i="${i}" min="0" value="${item.qty||''}" placeholder="0"/>
          </div>
          <div>
            <label class="form-label">Amount</label>
            <div class="item-row-calculated">${fmt((item.rate||0)*(item.qty||0))}</div>
          </div>
          <div>
            <label class="form-label">&nbsp;</label>
            <button class="btn btn-danger btn-sm btn-icon item-del" data-i="${i}">🗑</button>
          </div>
        `;
        rowsEl.appendChild(row);
      });

      rowsEl.querySelectorAll('.item-name').forEach(sel => {
        sel.addEventListener('change', () => {
          const i = +sel.dataset.i;
          const opt = sel.options[sel.selectedIndex];
          STATE[key][i].name = sel.value;
          if (sel.value !== '__custom__') {
            STATE[key][i].rate = +opt.dataset.rate || 0;
            STATE[key][i].unit = opt.dataset.unit || '';
          }
          saveState(); renderRows(); renderSummary();
        });
      });

      rowsEl.querySelectorAll('.item-custom-name').forEach(inp => {
        inp.addEventListener('input', () => {
          STATE[key][+inp.dataset.i].customName = inp.value; saveState();
        });
      });

      rowsEl.querySelectorAll('.item-rate').forEach(inp => {
        inp.addEventListener('input', () => {
          const i = +inp.dataset.i;
          STATE[key][i].rate = +inp.value;
          STATE[key][i].cost = (STATE[key][i].rate||0) * (STATE[key][i].qty||0);
          inp.closest('.item-row').querySelector('.item-row-calculated').textContent = fmt(STATE[key][i].cost);
          saveState(); renderSummary();
        });
      });

      rowsEl.querySelectorAll('.item-qty').forEach(inp => {
        inp.addEventListener('input', () => {
          const i = +inp.dataset.i;
          STATE[key][i].qty = +inp.value;
          STATE[key][i].cost = (STATE[key][i].rate||0) * (STATE[key][i].qty||0);
          inp.closest('.item-row').querySelector('.item-row-calculated').textContent = fmt(STATE[key][i].cost);
          saveState(); renderSummary();
        });
      });

      rowsEl.querySelectorAll('.item-del').forEach(btn => {
        btn.addEventListener('click', () => {
          STATE[key].splice(+btn.dataset.i, 1);
          saveState(); renderRows(); renderSummary();
        });
      });
    };

    const renderSummary = () => {
      const sumEl = card.querySelector(`#${key}-summary`);
      if (!STATE[key].length) { sumEl.innerHTML = ''; return; }
      const total = STATE[key].reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
      sumEl.innerHTML = `<table>
        <thead><tr><th>#</th><th>Description</th><th>Rate</th><th>Qty</th><th>Amount</th></tr></thead>
        <tbody>
          ${STATE[key].map((it,i)=>`<tr>
            <td>${i+1}</td>
            <td>${it.name==='__custom__'?(it.customName||'Custom'):(it.name||'—')}</td>
            <td class="table-number">${fmt(it.rate)}</td>
            <td class="table-number">${it.qty||0}</td>
            <td class="table-number" style="color:var(--accent);font-weight:600">${fmt((it.rate||0)*(it.qty||0))}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr><td colspan="4" style="text-align:right">Sub-Total</td><td style="color:var(--accent)">${fmt(total)}</td></tr></tfoot>
      </table>`;
    };

    card.querySelector(`#add-${key}-row`).addEventListener('click', () => {
      STATE[key].push({ name:'', rate:0, qty:0, cost:0 });
      saveState(); renderRows(); renderSummary();
    });

    renderRows();
    renderSummary();
  };

  renderSectionRows('labour', LABOUR_ITEMS, wrap.querySelector('#tab-labour'));
  renderSectionRows('carriage', CARRIAGE_ITEMS, wrap.querySelector('#tab-carriage'));
  renderSectionRows('hardware', HARDWARE_ITEMS, wrap.querySelector('#tab-hardware'));

  return wrap;
}

// ── Step 5: Preview / Indent ──────────────────────────────────
function renderStepPreview() {
  const sd = STATE.schemeDetails;

  const pipesTotal    = (STATE.pipes||[]).reduce((a,p)=>a+(p.cost||0),0);
  const fittingsTotal = (STATE.fittings||[]).reduce((a,f)=>a+(f.cost||0),0);
  const labourTotal   = (STATE.labour||[]).reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
  const carriageTotal = (STATE.carriage||[]).reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
  const hardwareTotal = (STATE.hardware||[]).reduce((a,it)=>a+(it.rate||0)*(it.qty||0),0);
  const grandTotal    = pipesTotal + fittingsTotal + labourTotal + carriageTotal + hardwareTotal;

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">🧾 Cost Estimate Preview</h1>
      <p class="page-subtitle">Review the complete estimation before final submission</p>
    </div>

    <div class="print-toolbar">
      <button class="btn btn-ghost btn-sm" id="edit-btn">✏️ Edit Any Section</button>
      <button class="btn btn-success btn-sm" id="save-btn">💾 Save Draft</button>
      <button class="btn btn-primary btn-sm" id="print-btn">🖨️ Print</button>
    </div>

    <!-- Header Info -->
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">📄</div> Minor Repair & Replacement — Cost Estimate</div>
        <span class="badge badge-blue">${STATE.user?.role}</span>
      </div>
      <div class="summary-grid">
        ${[
          ['Scheme Name',   sd.scheme_name || '—'],
          ['IMIS ID',       sd.imis_id     || '—'],
          ['Zone',          sd.zone        || '—'],
          ['Circle',        sd.circle      || '—'],
          ['District',      sd.district    || '—'],
          ['Division',      sd.division    || '—'],
          ['Subdivision',   sd.subdivision || '—'],
          ['Block',         sd.block       || '—'],
          ['Gram Panchayat',sd.panchayat   || '—'],
          ['No. of FHTC',   sd.fhtc        || '—'],
          ['Incident Date', STATE.incidentDate || '—'],
          ['Priority',      STATE.incidentPriority || '—'],
        ].map(([k,v])=>`<div class="summary-item"><div class="summary-item-key">${k}</div><div class="summary-item-val">${v}</div></div>`).join('')}
      </div>
    </div>

    <!-- Components -->
    ${STATE.selectedComponents.length ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🧩</div> Selected Components</div>
        <span class="badge badge-green">${STATE.selectedComponents.length} components</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem">
        ${STATE.selectedComponents.map(id => {
          const c = COMPONENTS.find(x=>x.id===id);
          return c ? `<span class="badge badge-blue">${c.icon} ${c.label}</span>` : '';
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Pipes Table -->
    ${STATE.pipes?.length ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🚰</div> (A) Pipe Works</div>
        <span class="badge badge-amber">${fmt(pipesTotal)}</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Sl.</th><th>Pipe Type</th><th>Dimension</th><th>Length (m)</th><th>Base Rate/m</th><th>Amount</th></tr></thead>
          <tbody>
            ${STATE.pipes.map((p,i)=>`<tr>
              <td>${i+1}</td>
              <td><span class="badge badge-blue">${p.type||'—'}</span></td>
              <td>${p.dim||'—'}</td>
              <td class="table-number">${p.length||0}</td>
              <td class="table-number">${fmt(p.rate)}</td>
              <td class="table-number" style="color:var(--accent);font-weight:600">${fmt(p.cost)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr><td colspan="5" style="text-align:right;font-weight:700">TOTAL (A)</td><td style="color:var(--accent);font-weight:700">${fmt(pipesTotal)}</td></tr></tfoot>
        </table>
      </div>
    </div>` : ''}

    <!-- Fittings Table -->
    ${STATE.fittings?.length ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🔩</div> (A2) Pipe Fittings & Accessories</div>
        <span class="badge badge-amber">${fmt(fittingsTotal)}</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Sl.</th><th>Item Code</th><th>Type</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>
            ${STATE.fittings.map((f,i)=>`<tr>
              <td>${i+1}</td>
              <td style="font-size:0.7rem;color:var(--text-muted)">${f.code||'—'}</td>
              <td><span class="badge badge-green">${f.type||'—'}</span></td>
              <td style="font-size:0.8rem">${f.desc||'—'}</td>
              <td class="table-number">${f.qty||0}</td>
              <td class="table-number">${fmt(f.rate)}</td>
              <td class="table-number" style="color:var(--accent);font-weight:600">${fmt(f.cost)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr><td colspan="6" style="text-align:right;font-weight:700">TOTAL (A2)</td><td style="color:var(--accent);font-weight:700">${fmt(fittingsTotal)}</td></tr></tfoot>
        </table>
      </div>
    </div>` : ''}

    <!-- Labour Table -->
    ${STATE.labour?.length ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">👷</div> (B) Labour Charges</div>
        <span class="badge badge-amber">${fmt(labourTotal)}</span>
      </div>
      ${renderItemsTable(STATE.labour, 'TOTAL (B)', labourTotal)}
    </div>` : ''}

    <!-- Carriage Table -->
    ${STATE.carriage?.length ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🚛</div> (C) Carriage Charges</div>
        <span class="badge badge-amber">${fmt(carriageTotal)}</span>
      </div>
      ${renderItemsTable(STATE.carriage, 'TOTAL (C)', carriageTotal)}
    </div>` : ''}

    <!-- Hardware Table -->
    ${STATE.hardware?.length ? `
    <div class="card">
      <div class="card-header">
        <div class="card-title"><div class="card-icon">🔩</div> (D) Hardware & Accessories</div>
        <span class="badge badge-amber">${fmt(hardwareTotal)}</span>
      </div>
      ${renderItemsTable(STATE.hardware, 'TOTAL (D)', hardwareTotal)}
    </div>` : ''}

    <!-- Grand Total -->
    <div class="cost-total-box">
      <div class="cost-total-label">Total Cost Estimate for Repair / Replacement</div>
      <div class="cost-total-amount">${fmt(grandTotal)}</div>
      <div class="cost-total-words">(${numberToWords(Math.round(grandTotal))})</div>
      <div style="display:flex;justify-content:center;gap:1.5rem;margin-top:1rem;flex-wrap:wrap;font-size:0.78rem;color:var(--text-muted)">
        <span>Pipes: <strong style="color:var(--text-primary)">${fmt(pipesTotal)}</strong></span>
        <span>Fittings: <strong style="color:var(--text-primary)">${fmt(fittingsTotal)}</strong></span>
        <span>Labour: <strong style="color:var(--text-primary)">${fmt(labourTotal)}</strong></span>
        <span>Carriage: <strong style="color:var(--text-primary)">${fmt(carriageTotal)}</strong></span>
        <span>Hardware: <strong style="color:var(--text-primary)">${fmt(hardwareTotal)}</strong></span>
      </div>
    </div>

    <!-- Signature Block -->
    <div class="card" style="margin-top:1.25rem">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2rem;text-align:center;font-size:0.8rem;color:var(--text-muted)">
        <div>
          <div style="border-top:1px dashed var(--border);padding-top:0.5rem;margin-top:2rem">Prepared By</div>
          <div style="color:var(--text-secondary);font-weight:600;margin-top:0.25rem">${STATE.user?.username} (${STATE.user?.role})</div>
        </div>
        <div>
          <div style="border-top:1px dashed var(--border);padding-top:0.5rem;margin-top:2rem">Checked By</div>
          <div style="color:var(--text-secondary);font-weight:600;margin-top:0.25rem">SDO</div>
        </div>
        <div>
          <div style="border-top:1px dashed var(--border);padding-top:0.5rem;margin-top:2rem">Approved By</div>
          <div style="color:var(--text-secondary);font-weight:600;margin-top:0.25rem">EE</div>
        </div>
      </div>
    </div>
  `;

  wrap.querySelector('#edit-btn')?.addEventListener('click', () => {
    STATE.currentStep = 0; saveState(); render(); window.scrollTo(0,0);
  });
  wrap.querySelector('#save-btn')?.addEventListener('click', () => {
    saveState(); showToast('Draft saved successfully!');
  });
  wrap.querySelector('#print-btn')?.addEventListener('click', () => {
    window.print();
  });

  return wrap;
}

function renderItemsTable(items, footerLabel, total) {
  return `<div class="table-wrapper">
    <table>
      <thead><tr><th>Sl.</th><th>Description</th><th>Rate (₹)</th><th>Qty</th><th>Amount</th></tr></thead>
      <tbody>
        ${items.map((it,i)=>`<tr>
          <td>${i+1}</td>
          <td>${it.name==='__custom__'?(it.customName||'Custom'):(it.name||'—')}</td>
          <td class="table-number">${fmt(it.rate)}</td>
          <td class="table-number">${it.qty||0}</td>
          <td class="table-number" style="color:var(--accent);font-weight:600">${fmt((it.rate||0)*(it.qty||0))}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr><td colspan="4" style="text-align:right;font-weight:700">${footerLabel}</td><td style="color:var(--accent);font-weight:700">${fmt(total)}</td></tr></tfoot>
    </table>
  </div>`;
}

// ── Bootstrap ─────────────────────────────────────────────────
// If session exists, restore step. If not, go to login.
if (STATE.user && STATE.currentStep >= 0) {
  // session restored
} else {
  STATE.currentStep = -1;
  STATE.user = null;
}

render();
