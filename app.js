// ========================================
// CONFIGURATION
// ========================================
const DATA_FILES = {
  phones: "data/phones.json",
  accessories: "data/accessories.json",
  brands: "data/brands.json",
  categories: "data/categories.json",
  deals: "data/deals.json",
  settings: "data/settings.json"
};

const STORAGE_KEYS = {
  theme: "nova-theme",
  wishlist: "nova-wishlist",
  compare: "nova-compare",
  cart: "nova-cart",
  recent: "nova-recent"
};

const COMPARE_LIMIT = 3;

// ========================================
// GLOBAL STATE
// ========================================
const state = {
  phones: [],
  accessories: [],
  brands: [],
  categories: [],
  deals: [],
  settings: {},
  wishlist: loadJSON(STORAGE_KEYS.wishlist, []),
  compare: loadJSON(STORAGE_KEYS.compare, []),
  cart: loadJSON(STORAGE_KEYS.cart, []),
  recent: loadJSON(STORAGE_KEYS.recent, []),
  heroIndex: 0,
  heroTimer: null,
  accFilter: ""
};

// ========================================
// HELPERS
// ========================================
function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    /* private mode / sandboxed iframe */
  }
}

function loadJSON(key, fallback) {
  try {
    const raw = storageGet(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  storageSet(key, JSON.stringify(value));
}

function money(n) {
  if (n == null || n === "") return "";
  return "PKR " + Number(n).toLocaleString("en-PK");
}

function qs(sel, root = document) {
  return root.querySelector(sel);
}

function qsa(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

function params() {
  return new URLSearchParams(location.search);
}

function toast(msg) {
  const el = qs("#toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2200);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function productById(id) {
  return state.phones.find((p) => p.id === id) || state.accessories.find((p) => p.id === id);
}

function isPhone(item) {
  return Boolean(item && item.brand);
}

function discountOf(item) {
  if (!item) return 0;
  if (item.discount) return item.discount;
  if (item.oldPrice && item.price && item.oldPrice > item.price) {
    return Math.round((1 - item.price / item.oldPrice) * 100);
  }
  return 0;
}

function imgOnError(el) {
  el.style.opacity = "0.35";
}

// ========================================
// DATA LOADING
// ========================================
function recountBrands() {
  const counts = {};
  state.phones.forEach((p) => {
    const id = (p.brandId || p.brand || "").toLowerCase();
    counts[id] = (counts[id] || 0) + 1;
  });
  state.brands = (state.brands || []).map((b) => ({
    ...b,
    models: counts[b.id] || 0
  }));
}

function readEmbeddedData(key) {
  const el = document.getElementById("data-" + key);
  if (!el) return null;
  try {
    return JSON.parse(el.textContent);
  } catch (e) {
    return null;
  }
}

async function loadStore() {
  const entries = Object.entries(DATA_FILES);
  const results = await Promise.all(entries.map(async ([key, path]) => {
    try {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) throw new Error("Could not load " + path);
      return [key, await res.json()];
    } catch (err) {
      const embedded = readEmbeddedData(key);
      if (embedded != null) return [key, embedded];
      throw err;
    }
  }));
  results.forEach(([key, value]) => { state[key] = value; });
  recountBrands();
}

// ========================================
// THEME
// ========================================
function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  storageSet(STORAGE_KEYS.theme, next);
  const label = qs("#theme-label");
  if (label) label.textContent = next === "dark" ? "Light" : "Dark";
  const meta = qs('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", next === "dark" ? "#07080d" : "#f3f5f9");
}

function initTheme() {
  const saved = storageGet(STORAGE_KEYS.theme);
  const preferred = saved || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  applyTheme(preferred);
  qs("#theme-toggle").addEventListener("click", () => {
    const now = document.documentElement.getAttribute("data-theme");
    applyTheme(now === "dark" ? "light" : "dark");
  });
  qs("#account-theme").addEventListener("click", () => {
    const now = document.documentElement.getAttribute("data-theme");
    applyTheme(now === "dark" ? "light" : "dark");
  });
}

// ========================================
// PRODUCT RENDERING
// ========================================
function badgeHtml(item) {
  if (item.badge === "NEW" || (item.newArrival && item.badge !== "HOT")) {
    if (item.badge === "NEW" || (item.newArrival && !item.bestSeller)) {
      return `<span class="card-badge new">NEW</span>`;
    }
  }
  if (item.badge === "HOT") return `<span class="card-badge hot">HOT</span>`;
  return "";
}

function cardHtml(item, compact = false) {
  const disc = discountOf(item);
  const spec = isPhone(item)
    ? `${escapeHtml(item.ram || "")}${item.storage && item.storage[0] ? " · " + escapeHtml(item.storage[0]) : ""}`
    : escapeHtml(item.category || "");
  return `
    <article class="product-card" data-id="${escapeHtml(item.id)}">
      <div class="card-media">
        ${badgeHtml(item)}
        <button class="wish-btn ${state.wishlist.includes(item.id) ? "active" : ""}" data-wish="${escapeHtml(item.id)}" aria-label="Wishlist">♥</button>
        <a href="index.html?product=${encodeURIComponent(item.id)}">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" onerror="this.src='images/placeholder.webp'">
        </a>
      </div>
      <h3><a href="index.html?product=${encodeURIComponent(item.id)}">${escapeHtml(item.name)}</a></h3>
      ${compact ? "" : `<p class="specs-line">${spec}</p>`}
      <div class="price-row">
        <span class="now">${money(item.price)}</span>
        ${item.oldPrice ? `<span class="was">${money(item.oldPrice)}</span>` : ""}
        ${disc ? `<span class="discount-pill">${disc}% OFF</span>` : ""}
      </div>
      <div class="card-actions">
        <button class="btn btn-primary" data-add="${escapeHtml(item.id)}">Add</button>
        ${isPhone(item) ? `<button class="btn btn-ghost" data-compare="${escapeHtml(item.id)}">Compare</button>` : ""}
      </div>
    </article>
  `;
}

function stripHtml(item) {
  return `
    <a class="strip-card" href="index.html?product=${encodeURIComponent(item.id)}">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" onerror="this.style.opacity=.35">
      <strong>${escapeHtml(item.name)}</strong>
      <span>From ${money(item.price)}</span>
    </a>
  `;
}

function renderGrid(el, items, compact) {
  if (!el) return;
  if (!items.length) {
    el.innerHTML = "";
    el.insertAdjacentHTML("afterend", "");
    el.innerHTML = `<div class="empty" style="grid-column:1/-1">No matching products.</div>`;
    return;
  }
  el.innerHTML = items.map((item) => cardHtml(item, compact)).join("");
}

// ========================================
// BRAND RENDERING
// ========================================
function brandCard(brand, withCount = false) {
  const invertible = brand.id === "apple" || brand.id === "nothing" ? "invertible" : "";
  return `
    <a class="brand-card" href="index.html?brand=${encodeURIComponent(brand.id)}">
      <img class="${invertible}" src="${escapeHtml(brand.logo)}" alt="${escapeHtml(brand.name)}">
      ${withCount ? `<span>${brand.models} model${brand.models === 1 ? "" : "s"}</span>` : ""}
    </a>
  `;
}

function renderBrands() {
  const row = qs("#brand-row");
  const grid = qs("#brand-grid");
  const main = state.brands.filter((b) => b.id !== "nothing");
  if (row) row.innerHTML = main.map((b) => brandCard(b)).join("");
  if (grid) grid.innerHTML = state.brands.map((b) => brandCard(b, true)).join("");

  const brandSelects = [qs("#filter-brand"), qs("#find-brand")];
  brandSelects.forEach((sel) => {
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">All brands</option>` + state.brands.map((b) =>
      `<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)}</option>`
    ).join("");
    if (current) sel.value = current;
  });
}

// ========================================
// HERO CAROUSEL
// ========================================
function renderHero() {
  const slidesWrap = qs("#hero-slides");
  const dots = qs("#hero-dots");
  const slides = state.settings.hero || [];
  if (!slides.length) return;
  slidesWrap.innerHTML = slides.map((s, i) => {
    const product = productById(s.productId) || {};
    const disc = discountOf(product);
    return `
      <article class="hero-slide ${i === 0 ? "active" : ""}">
        <div class="hero-copy">
          <div class="brand-line">${escapeHtml(s.eyebrow || product.brand || "")}</div>
          <h1>${escapeHtml(s.title)} <em>${escapeHtml(s.subtitle)}</em></h1>
          <p>${escapeHtml(s.text)}</p>
          <div class="hero-price">
            <span class="from">From</span>
            <span class="now">${money(product.price)}</span>
            ${product.oldPrice ? `<span class="was">${money(product.oldPrice)}</span>` : ""}
            ${disc ? `<span class="discount-pill">${disc}% OFF</span>` : ""}
          </div>
          <div class="hero-actions">
            <a class="btn btn-primary" href="index.html?product=${encodeURIComponent(s.productId)}">Shop Now</a>
            <a class="btn btn-ghost" href="index.html?product=${encodeURIComponent(s.productId)}">View Details</a>
          </div>
        </div>
        <div class="hero-visual">
          <img src="${escapeHtml(s.image)}" alt="${escapeHtml(s.eyebrow || product.name || "")}" onerror="this.style.opacity=.4">
        </div>
      </article>
    `;
  }).join("");
  dots.innerHTML = slides.map((_, i) =>
    `<button type="button" class="${i === 0 ? "active" : ""}" data-hero="${i}" aria-label="Slide ${i + 1}"></button>`
  ).join("");
  startHero();
}

function showHero(i) {
  const slides = qsa(".hero-slide");
  if (!slides.length) return;
  state.heroIndex = (i + slides.length) % slides.length;
  slides.forEach((s, idx) => s.classList.toggle("active", idx === state.heroIndex));
  qsa("#hero-dots button").forEach((d, idx) => d.classList.toggle("active", idx === state.heroIndex));
}

function startHero() {
  clearInterval(state.heroTimer);
  state.heroTimer = setInterval(() => showHero(state.heroIndex + 1), 6500);
}

// ========================================
// SEARCH
// ========================================
function searchItems(q) {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const pool = [...state.phones, ...state.accessories];
  return pool.filter((item) => {
    const blob = [item.name, item.brand, item.category, item.description].join(" ").toLowerCase();
    return blob.includes(query);
  }).slice(0, 8);
}

function renderSearchResults(q) {
  const box = qs("#search-results");
  if (!box) return;
  const items = searchItems(q);
  if (!q.trim()) { box.hidden = true; box.innerHTML = ""; return; }
  if (!items.length) {
    box.hidden = false;
    box.innerHTML = `<div class="search-hit">No matches for “${escapeHtml(q)}”</div>`;
    return;
  }
  box.hidden = false;
  box.innerHTML = items.map((item) => `
    <a href="index.html?product=${encodeURIComponent(item.id)}">
      <img src="${escapeHtml(item.image)}" alt="">
      <span><strong>${escapeHtml(item.name)}</strong><br><small>${money(item.price)}</small></span>
    </a>
  `).join("");
}

// ========================================
// FILTERING
// ========================================
function applyShopFilters() {
  const p = params();
  const brand = (qs("#filter-brand")?.value || p.get("brand") || "").toLowerCase();
  const stock = qs("#filter-stock")?.value || "";
  const max = Number(qs("#filter-price")?.value || 0);
  const sort = qs("#filter-sort")?.value || "featured";
  const search = (p.get("search") || "").toLowerCase();

  let list = state.phones.slice();
  if (brand) list = list.filter((x) => (x.brandId || x.brand || "").toLowerCase() === brand);
  if (stock) list = list.filter((x) => x.availability === stock);
  if (max) list = list.filter((x) => x.price <= max);
  if (search) {
    list = list.filter((x) => (x.name + " " + x.brand).toLowerCase().includes(search));
  }

  if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
  else if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
  else if (sort === "discount") list.sort((a, b) => discountOf(b) - discountOf(a));
  else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
  else list.sort((a, b) => Number(b.featured) - Number(a.featured));

  const brandObj = state.brands.find((b) => b.id === brand);
  const title = qs("#shop-title");
  const sub = qs("#shop-subtitle");
  if (title) title.textContent = brandObj ? brandObj.name : (search ? `Search: ${search}` : "Smartphones");
  if (sub) sub.textContent = `${list.length} model${list.length === 1 ? "" : "s"}`;
  qs("#shop-meta").textContent = list.length ? "Showing live catalog from phones.json" : "";
  renderGrid(qs("#shop-grid"), list);
}

// ========================================
// WISHLIST
// ========================================
function toggleWishlist(id) {
  const i = state.wishlist.indexOf(id);
  if (i >= 0) state.wishlist.splice(i, 1);
  else state.wishlist.push(id);
  saveJSON(STORAGE_KEYS.wishlist, state.wishlist);
  updateCounts();
  toast(i >= 0 ? "Removed from wishlist" : "Saved to wishlist");
  if (params().get("view") === "wishlist") renderWishlist();
}

function renderWishlist() {
  const items = state.wishlist.map(productById).filter(Boolean);
  const grid = qs("#wishlist-grid");
  if (!items.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">Your wishlist is empty.</div>`;
    return;
  }
  renderGrid(grid, items);
}

// ========================================
// COMPARE
// ========================================
function toggleCompare(id) {
  const item = productById(id);
  if (!item || !isPhone(item)) return;
  const i = state.compare.indexOf(id);
  if (i >= 0) state.compare.splice(i, 1);
  else {
    if (state.compare.length >= COMPARE_LIMIT) {
      toast("You can compare up to 3 phones");
      return;
    }
    state.compare.push(id);
  }
  saveJSON(STORAGE_KEYS.compare, state.compare);
  updateCounts();
  toast(i >= 0 ? "Removed from compare" : "Added to compare");
  if (params().get("view") === "compare") renderCompare();
}

function renderCompare() {
  const wrap = qs("#compare-table");
  const items = state.compare.map(productById).filter(Boolean);
  if (!items.length) {
    wrap.innerHTML = `<div class="empty">Add phones with the Compare button to see them here.</div>`;
    return;
  }
  const rows = [
    ["", items.map((p) => `<img src="${escapeHtml(p.image)}" alt=""><div><strong>${escapeHtml(p.name)}</strong><div>${money(p.price)}</div><button class="btn btn-ghost" data-compare="${p.id}">Remove</button></div>`)],
    ["Brand", items.map((p) => escapeHtml(p.brand))],
    ["Price", items.map((p) => money(p.price))],
    ["RAM", items.map((p) => escapeHtml(p.ram || "—"))],
    ["Storage", items.map((p) => escapeHtml((p.storage || []).join(", ") || "—"))],
    ["Display", items.map((p) => escapeHtml(p.specifications?.display || "—"))],
    ["Processor", items.map((p) => escapeHtml(p.specifications?.processor || "—"))],
    ["Rear camera", items.map((p) => escapeHtml(p.specifications?.rearCamera || "—"))],
    ["Battery", items.map((p) => escapeHtml(p.specifications?.battery || "—"))],
    ["OS", items.map((p) => escapeHtml(p.specifications?.os || "—"))]
  ];
  wrap.innerHTML = `<div class="compare-wrap"><table class="compare-table">${rows.map((r, idx) => {
    if (idx === 0) {
      return `<thead><tr><th></th>${r[1].map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>`;
    }
    return `<tr><th>${r[0]}</th>${r[1].map((c) => `<td>${c}</td>`).join("")}</tr>`;
  }).join("")}</tbody></table></div>`;
}

// ========================================
// CART / ORDER
// ========================================
function addToCart(id) {
  const item = productById(id);
  if (!item) return;
  const existing = state.cart.find((c) => c.id === id);
  if (existing) existing.qty += 1;
  else state.cart.push({ id, qty: 1, name: item.name, price: item.price, image: item.image });
  saveJSON(STORAGE_KEYS.cart, state.cart);
  updateCounts();
  toast("Added to cart");
  renderCartBodies();
}

function changeQty(id, delta) {
  const row = state.cart.find((c) => c.id === id);
  if (!row) return;
  row.qty += delta;
  if (row.qty <= 0) state.cart = state.cart.filter((c) => c.id !== id);
  saveJSON(STORAGE_KEYS.cart, state.cart);
  updateCounts();
  renderCartBodies();
}

function cartTotal() {
  return state.cart.reduce((sum, c) => sum + c.price * c.qty, 0);
}

function cartHtml() {
  if (!state.cart.length) return `<div class="empty">Your cart is empty.</div>`;
  return `
    <div class="cart-list">
      ${state.cart.map((c) => `
        <div class="cart-item">
          <img src="${escapeHtml(c.image)}" alt="">
          <div>
            <strong>${escapeHtml(c.name)}</strong>
            <div class="muted">${money(c.price)}</div>
            <div class="qty">
              <button data-qty="${escapeHtml(c.id)}" data-delta="-1">−</button>
              <span>${c.qty}</span>
              <button data-qty="${escapeHtml(c.id)}" data-delta="1">+</button>
            </div>
          </div>
          <strong>${money(c.price * c.qty)}</strong>
        </div>
      `).join("")}
    </div>
    <div class="cart-summary">
      <p><strong>Total: ${money(cartTotal())}</strong></p>
      <p class="checkout-note">Orders are sent on WhatsApp. No online payment is collected on this website.</p>
      <button class="btn btn-wa checkout-wa" type="button">Order on WhatsApp</button>
      <a class="btn btn-ghost" href="index.html?view=cart">Open full cart</a>
    </div>
  `;
}

function renderCartBodies() {
  const drawer = qs("#cart-drawer-body");
  const page = qs("#cart-page");
  const html = cartHtml();
  if (drawer) drawer.innerHTML = html;
  if (page) page.innerHTML = `<div class="cart-page">${html}</div>`;
}

function updateCounts() {
  const wc = qs("#wishlist-count");
  const cc = qs("#cart-count");
  if (wc) {
    wc.hidden = state.wishlist.length === 0;
    wc.textContent = state.wishlist.length;
  }
  if (cc) {
    const n = state.cart.reduce((s, c) => s + c.qty, 0);
    cc.hidden = n === 0;
    cc.textContent = n;
  }
}

// ========================================
// WHATSAPP
// ========================================
function whatsappNumber() {
  return String(state.settings.whatsapp || "").replace(/[^\d]/g, "");
}

function orderMessage() {
  if (!state.cart.length) return "Hello Nova Mobile, I want to ask about a phone.";
  const lines = state.cart.map((c) => `• ${c.name} × ${c.qty} — ${money(c.price * c.qty)}`);
  return `Hello Nova Mobile, I want to order:%0A%0A${lines.join("%0A")}%0A%0ATotal: ${money(cartTotal())}`;
}

function openWhatsApp(message) {
  const num = whatsappNumber();
  const text = message || orderMessage();
  if (!num) {
    const readable = decodeURIComponent(text.replace(/%0A/g, "\n"));
    window.prompt("Add your WhatsApp number in data/settings.json. Message copied below:", readable);
    return;
  }
  window.open(`https://wa.me/${num}?text=${text}`, "_blank", "noopener");
}

// ========================================
// PRODUCT DETAILS
// ========================================
function remember(id) {
  state.recent = [id, ...state.recent.filter((x) => x !== id)].slice(0, 8);
  saveJSON(STORAGE_KEYS.recent, state.recent);
}

function renderProduct(id) {
  const item = productById(id);
  const root = qs("#product-detail");
  if (!item) {
    root.innerHTML = `<div class="empty">Product not found.</div>`;
    return;
  }
  remember(id);
  const disc = discountOf(item);
  const specs = item.specifications || {};
  root.innerHTML = `
    <article class="pdp">
      <div class="pdp-media">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" onerror="this.src='images/placeholder.webp'">
      </div>
      <div>
        <p class="eyebrow">${escapeHtml(item.brand || item.category || "")}</p>
        <h1>${escapeHtml(item.name)}</h1>
        <p class="lead">${escapeHtml(item.description || "")}</p>
        <div class="hero-price">
          <span class="now">${money(item.price)}</span>
          ${item.oldPrice ? `<span class="was">${money(item.oldPrice)}</span>` : ""}
          ${disc ? `<span class="discount-pill">${disc}% OFF</span>` : ""}
        </div>
        <p class="muted">${escapeHtml(item.availability || "")} · ${escapeHtml(item.condition || "")}</p>
        ${item.storage ? `<div><span class="muted">Storage</span><div class="option-row">${item.storage.map((s, i) => `<button class="chip ${i === 0 ? "active" : ""}" type="button">${escapeHtml(s)}</button>`).join("")}</div></div>` : ""}
        ${item.colors && item.colors.length ? `<div><span class="muted">Colors</span><div class="option-row">${item.colors.map((s, i) => `<button class="chip ${i === 0 ? "active" : ""}" type="button">${escapeHtml(s)}</button>`).join("")}</div></div>` : ""}
        <div class="hero-actions">
          <button class="btn btn-primary" data-add="${escapeHtml(item.id)}">Add to cart</button>
          <button class="btn btn-ghost" data-wish="${escapeHtml(item.id)}">Wishlist</button>
          ${isPhone(item) ? `<button class="btn btn-ghost" data-compare="${escapeHtml(item.id)}">Compare</button>` : ""}
          <button class="btn btn-wa" data-ask="${escapeHtml(item.id)}">Ask on WhatsApp</button>
        </div>
        ${Object.keys(specs).length ? `
          <table class="spec-table">
            ${Object.entries(specs).map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join("")}
          </table>` : ""}
      </div>
    </article>
  `;
}

// ========================================
// DEALS / ACCESSORIES / FIND
// ========================================
function renderHomeCollections() {
  const featured = state.phones.filter((p) => p.featured);
  qs("#home-strip").innerHTML = featured.slice(0, 8).map(stripHtml).join("");
  renderTrending("featured");
  const dealIds = state.deals.map((d) => d.productId);
  const deals = dealIds.map(productById).filter(Boolean);
  renderGrid(qs("#home-deals"), deals.slice(0, 5));
  renderGrid(qs("#home-accessories"), state.accessories.filter((a) => a.featured).slice(0, 5), true);
}

function renderTrending(key) {
  qsa("#trending-tabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === key));
  const list = state.phones.filter((p) => p[key]);
  renderGrid(qs("#trending-grid"), (list.length ? list : state.phones).slice(0, 5));
}

function renderDealsPage() {
  const items = state.deals.map((d) => productById(d.productId)).filter(Boolean);
  renderGrid(qs("#deals-grid"), items);
}

function renderAccessories() {
  const cats = ["", ...new Set(state.accessories.map((a) => a.category))];
  qs("#acc-chips").innerHTML = cats.map((c) =>
    `<button class="chip ${state.accFilter === c ? "active" : ""}" data-acc="${escapeHtml(c)}">${c || "All"}</button>`
  ).join("");
  const list = state.accFilter
    ? state.accessories.filter((a) => a.category === state.accFilter)
    : state.accessories;
  renderGrid(qs("#acc-grid"), list, true);
}

function renderFind(list) {
  renderGrid(qs("#find-grid"), list);
}

function runFind(form) {
  const data = new FormData(form);
  const budget = Number(data.get("budget") || 0);
  const brand = String(data.get("brand") || "").toLowerCase();
  const use = data.get("use");
  let list = state.phones.slice();
  if (budget) list = list.filter((p) => p.price <= budget);
  if (brand) list = list.filter((p) => (p.brandId || "").toLowerCase() === brand);
  if (use === "camera") list = list.filter((p) => /mp/i.test(p.specifications?.rearCamera || ""));
  if (use === "battery") list = list.filter((p) => /5000|5500|5100|4610/i.test(p.specifications?.battery || ""));
  if (use === "flagship") list = list.filter((p) => p.price >= 100000);
  if (use === "value") list = list.filter((p) => p.price <= 90000).sort((a, b) => discountOf(b) - discountOf(a));
  renderFind(list);
}

function renderTrust() {
  const items = state.settings.trust || [];
  qs("#trust-bar").innerHTML = items.map((t) => `
    <div class="trust-item"><strong>${escapeHtml(t.title)}</strong><span>${escapeHtml(t.text)}</span></div>
  `).join("");
}

function renderFooter() {
  const s = state.settings;
  qs("#year").textContent = new Date().getFullYear();
  if (s.tagline) qs("#footer-tagline").textContent = s.tagline;
  qs("#footer-address").textContent = s.address || "";
  qs("#footer-phone").textContent = s.phone || s.whatsapp || "";
  qs("#footer-hours").textContent = s.openingHours || "";
  const socials = Object.entries(s.social || {}).filter(([, url]) => url);
  qs("#footer-socials").innerHTML = socials.map(([name, url]) =>
    `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>`
  ).join("");
}

// ========================================
// MOBILE NAVIGATION / DRAWERS
// ========================================
function openDrawer(id) {
  const el = qs("#" + id);
  if (!el) return;
  el.hidden = false;
  el.classList.add("is-open");
}

function closeDrawer(id) {
  const el = qs("#" + id);
  if (!el) return;
  el.hidden = true;
  el.classList.remove("is-open");
}

function closeAllDrawers() {
  qsa(".drawer").forEach((d) => {
    d.hidden = true;
    d.classList.remove("is-open");
  });
}

function setActiveNav(view) {
  qsa("[data-nav]").forEach((el) => {
    const nav = el.getAttribute("data-nav");
    const on = nav === view || (view === "phones" && nav === "shop") || (view === "home" && nav === "home");
    el.classList.toggle("active", on);
  });
}

// ========================================
// ROUTING
// ========================================
function currentView() {
  const p = params();
  if (p.get("product")) return "product";
  const view = p.get("view");
  if (view) return view;
  if (p.get("brand") || p.get("search")) return "shop";
  return "home";
}

function showView(name) {
  qsa(".view").forEach((v) => { v.hidden = v.id !== "view-" + name; });
  setActiveNav(name === "product" ? "shop" : name);
  window.scrollTo(0, 0);
}

function route() {
  const p = params();
  const view = currentView();
  showView(view);

  if (view === "home") renderHomeCollections();
  if (view === "shop") {
    if (p.get("brand") && qs("#filter-brand")) qs("#filter-brand").value = p.get("brand");
    applyShopFilters();
  }
  if (view === "accessories") renderAccessories();
  if (view === "brands") renderBrands();
  if (view === "deals") renderDealsPage();
  if (view === "compare") renderCompare();
  if (view === "wishlist") renderWishlist();
  if (view === "cart") renderCartBodies();
  if (view === "find") renderFind(state.phones.slice(0, 8));
  if (view === "product") renderProduct(p.get("product"));

  if (p.get("search") && qs("#search-input")) {
    qs("#search-input").value = p.get("search");
  }
}

// ========================================
// INITIALIZATION
// ========================================
function bindUi() {
  qs("#hero-prev").addEventListener("click", () => { showHero(state.heroIndex - 1); startHero(); });
  qs("#hero-next").addEventListener("click", () => { showHero(state.heroIndex + 1); startHero(); });
  qs("#hero-dots").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-hero]");
    if (!btn) return;
    showHero(Number(btn.dataset.hero));
    startHero();
  });

  qs("#search-input").addEventListener("input", (e) => renderSearchResults(e.target.value));
  qs("#header-search").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = qs("#search-input").value.trim();
    if (!q) return;
    closeAllDrawers();
    history.pushState({}, "", "index.html?search=" + encodeURIComponent(q));
    route();
  });
  qs("#mobile-search").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = qs("#mobile-search-input").value.trim();
    if (!q) return;
    closeAllDrawers();
    history.pushState({}, "", "index.html?search=" + encodeURIComponent(q));
    route();
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#header-search")) qs("#search-results").hidden = true;
  });

  qs("#trending-tabs").addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) renderTrending(tab.dataset.tab);
  });

  ["filter-brand", "filter-stock", "filter-price", "filter-sort"].forEach((id) => {
    qs("#" + id).addEventListener("change", applyShopFilters);
    qs("#" + id).addEventListener("input", applyShopFilters);
  });
  qs("#clear-filters").addEventListener("click", () => {
    qs("#filter-brand").value = "";
    qs("#filter-stock").value = "";
    qs("#filter-price").value = "";
    qs("#filter-sort").value = "featured";
    history.replaceState({}, "", "index.html?view=shop");
    applyShopFilters();
  });

  qs("#find-form").addEventListener("submit", (e) => {
    e.preventDefault();
    runFind(e.target);
  });

  qs("#menu-btn").addEventListener("click", () => openDrawer("mobile-menu"));
  qs("#cart-btn").addEventListener("click", () => {
    renderCartBodies();
    openDrawer("cart-drawer");
  });
  qs("#account-btn").addEventListener("click", () => openDrawer("account-drawer"));
  qsa("[data-close]").forEach((btn) => btn.addEventListener("click", () => closeDrawer(btn.dataset.close)));
  qsa(".drawer").forEach((d) => d.addEventListener("click", (e) => {
    if (e.target === d) d.hidden = true;
  }));

  document.addEventListener("error", (e) => {
    const t = e.target;
    if (t && t.tagName === "IMG" && !t.dataset.fallback) {
      t.dataset.fallback = "1";
      t.src = "images/placeholder.webp";
    }
  }, true);

  qs("#wa-float").addEventListener("click", () => openWhatsApp("Hello Nova Mobile, I have a question."));

  document.body.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    const link = e.target.closest("a[href]");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#")) return;
    if (!href.startsWith("index.html") && href !== "./" && href !== "/") return;
    e.preventDefault();
    closeAllDrawers();
    history.pushState({}, "", href);
    route();
  });

  window.addEventListener("popstate", () => route());

  document.body.addEventListener("click", (e) => {
    const wish = e.target.closest("[data-wish]");
    const add = e.target.closest("[data-add]");
    const cmp = e.target.closest("[data-compare]");
    const qty = e.target.closest("[data-qty]");
    const ask = e.target.closest("[data-ask]");
    const acc = e.target.closest("[data-acc]");
    const checkout = e.target.closest(".checkout-wa");
    const chip = e.target.closest(".option-row .chip");

    if (wish) { e.preventDefault(); toggleWishlist(wish.dataset.wish); wish.classList.toggle("active"); }
    if (add) { e.preventDefault(); addToCart(add.dataset.add); }
    if (cmp) { e.preventDefault(); toggleCompare(cmp.dataset.compare); }
    if (qty) { e.preventDefault(); changeQty(qty.dataset.qty, Number(qty.dataset.delta)); }
    if (ask) {
      const item = productById(ask.dataset.ask);
      openWhatsApp(`Hello Nova Mobile, I want to ask about ${item ? item.name : "a product"}.`);
    }
    if (acc) {
      state.accFilter = acc.dataset.acc;
      renderAccessories();
    }
    if (checkout) openWhatsApp();
    if (chip) {
      qsa(".chip", chip.parentElement).forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
    }
  });
}

async function init() {
  initTheme();
  try {
    await loadStore();
  } catch (err) {
    console.error(err);
    document.querySelector("main").insertAdjacentHTML("afterbegin",
      `<div class="empty">Could not load store data. Serve this folder over HTTP (for example: python3 -m http.server) instead of opening the file directly.</div>`);
    return;
  }
  renderBrands();
  renderHero();
  renderTrust();
  renderFooter();
  updateCounts();
  bindUi();
  route();
}

document.addEventListener("DOMContentLoaded", init);
