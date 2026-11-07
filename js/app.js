/* StyleKart: product listing, filters, search, sort, quick view, wishlist and bag. */

const $ = (sel) => document.querySelector(sel);
const rupees = (n) => "₹" + n.toLocaleString("en-IN");
const discountOf = (p) => Math.round((1 - p.price / p.mrp) * 100);
const FREE_DELIVERY_ABOVE = 999;
const DELIVERY_FEE = 79;

/* ---------- State (bag and wishlist are saved in localStorage) ---------- */
const state = {
  categories: new Set(),
  brands: new Set(),
  maxPrice: 2500,
  minDiscount: 0,
  minRating: 0,
  query: "",
  sort: "relevance",
};

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be disabled */ }
}
let bag = load("stylekart-bag", []);            // [{ id, size, qty }]
let wishlist = new Set(load("stylekart-wishlist", []));

/* ---------- Product illustrations (inline SVG, no image files needed) ---------- */
function tint(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

const SHAPES = {
  tshirt: '<path d="M70 30 L95 20 Q100 35 120 35 Q140 35 145 20 L170 30 L200 70 L175 85 L165 70 L165 190 L75 190 L75 70 L65 85 L40 70 Z"/>',
  shirt: '<path d="M70 30 L100 18 L120 40 L140 18 L170 30 L200 75 L178 88 L165 72 L165 190 L75 190 L75 72 L62 88 L40 75 Z"/><path d="M120 40 V190" stroke="rgba(0,0,0,.25)" stroke-width="2"/><g fill="rgba(0,0,0,.25)"><circle cx="120" cy="70" r="3"/><circle cx="120" cy="100" r="3"/><circle cx="120" cy="130" r="3"/><circle cx="120" cy="160" r="3"/></g>',
  kurta: '<path d="M78 25 L102 15 Q120 30 138 15 L162 25 L190 80 L172 90 L162 70 L170 215 L70 215 L78 70 L68 90 L50 80 Z"/><path d="M120 22 V80" stroke="rgba(0,0,0,.25)" stroke-width="3"/><path d="M75 190 H165" stroke="rgba(255,255,255,.5)" stroke-width="6"/>',
  hoodie: '<path d="M88 40 Q90 8 120 8 Q150 8 152 40 L175 48 L205 150 L185 158 L165 90 L165 195 L75 195 L75 90 L55 158 L35 150 L65 48 Z"/><path d="M100 40 Q120 60 140 40" stroke="rgba(0,0,0,.3)" stroke-width="3" fill="none"/><rect x="95" y="140" width="50" height="28" rx="6" fill="rgba(0,0,0,.15)"/>',
  dress: '<path d="M100 18 L140 18 L148 60 L132 80 L190 205 L50 205 L108 80 L92 60 Z"/><path d="M100 80 H140" stroke="rgba(0,0,0,.25)" stroke-width="4"/>',
  jeans: '<path d="M80 20 H160 L172 210 H130 L120 80 L110 210 H68 Z"/><path d="M80 38 H160" stroke="rgba(0,0,0,.25)" stroke-width="3"/><path d="M95 45 Q100 62 115 60 M145 45 Q140 62 125 60" stroke="rgba(255,255,255,.4)" stroke-width="2" fill="none"/>',
  sneaker: '<path d="M30 140 Q32 100 60 95 L95 90 Q120 70 140 95 L190 115 Q215 122 212 150 L30 150 Z"/><rect x="28" y="150" width="186" height="14" rx="7" fill="rgba(0,0,0,.75)"/><path d="M100 100 L130 115 M92 110 L122 125" stroke="#fff" stroke-width="4"/>',
  shoe: '<path d="M30 150 Q30 115 60 110 L120 105 Q160 100 190 125 Q215 135 212 160 L30 160 Z"/><rect x="28" y="158" width="186" height="10" rx="5" fill="rgba(0,0,0,.7)"/><rect x="170" y="150" width="20" height="40" rx="4" fill="rgba(0,0,0,.7)"/>',
  watch: '<rect x="98" y="15" width="44" height="210" rx="12" fill="rgba(0,0,0,.65)"/><circle cx="120" cy="120" r="48"/><circle cx="120" cy="120" r="38" fill="#fff"/><path d="M120 120 V92 M120 120 L140 130" stroke="#222" stroke-width="4" stroke-linecap="round"/>',
  bag: '<path d="M90 70 Q90 35 120 35 Q150 35 150 70" stroke="rgba(0,0,0,.6)" stroke-width="8" fill="none"/><rect x="55" y="70" width="130" height="135" rx="14"/><rect x="85" y="110" width="70" height="40" rx="6" fill="rgba(0,0,0,.18)"/>',
  cap: '<path d="M50 140 Q50 70 120 70 Q190 70 190 140 Z"/><path d="M40 140 H215 Q215 158 180 158 H40 Z" fill="rgba(0,0,0,.35)"/><circle cx="120" cy="70" r="7" fill="rgba(0,0,0,.4)"/>',
};

function productArt(p) {
  return `<svg viewBox="0 0 240 240" role="img" aria-label="${p.name}"><g fill="${p.color}" stroke="rgba(0,0,0,.18)" stroke-width="1.5">${SHAPES[p.type]}</g></svg>`;
}
function artBackground(p) {
  const n = parseInt(p.color.slice(1), 16);
  const luminance = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.85 ? "#e9ecf1" : tint(p.color, 0.82); // very light products get a grey backdrop
}

/* ---------- Filtering and sorting ---------- */
function matches(p) {
  const q = state.query.trim().toLowerCase();
  return (!state.categories.size || state.categories.has(p.category))
    && (!state.brands.size || state.brands.has(p.brand))
    && p.price <= state.maxPrice
    && discountOf(p) >= state.minDiscount
    && p.rating >= state.minRating
    && (!q || `${p.name} ${p.brand} ${p.category} ${p.type}`.toLowerCase().includes(q));
}

const SORTERS = {
  relevance: (a, b) => b.rating * Math.log(b.reviews) - a.rating * Math.log(a.reviews),
  new: (a, b) => a.added - b.added,
  priceAsc: (a, b) => a.price - b.price,
  priceDesc: (a, b) => b.price - a.price,
  discount: (a, b) => discountOf(b) - discountOf(a),
  rating: (a, b) => b.rating - a.rating,
};

function visibleProducts() {
  return PRODUCTS.filter(matches).sort(SORTERS[state.sort]);
}

/* ---------- Rendering ---------- */
function renderFilters() {
  const count = (key, value) => PRODUCTS.filter((p) => p[key] === value).length;
  const checkbox = (group, value) => `
    <label class="check"><input type="checkbox" data-group="${group}" value="${value}" ${state[group].has(value) ? "checked" : ""}>
    ${value} <small>(${count(group === "categories" ? "category" : "brand", value)})</small></label>`;
  $("#filterCategories").innerHTML = [...new Set(PRODUCTS.map((p) => p.category))].map((c) => checkbox("categories", c)).join("");
  $("#filterBrands").innerHTML = [...new Set(PRODUCTS.map((p) => p.brand))].sort().map((b) => checkbox("brands", b)).join("");
  $("#filterDiscount").innerHTML = [0, 40, 50, 55].map((d) => `
    <label class="check"><input type="radio" name="discount" value="${d}" ${state.minDiscount === d ? "checked" : ""}>
    ${d ? d + "% and above" : "Any discount"}</label>`).join("");
  $("#filterRating").innerHTML = [0, 4, 4.3].map((r) => `
    <label class="check"><input type="radio" name="rating" value="${r}" ${state.minRating === r ? "checked" : ""}>
    ${r ? r + "★ & above" : "Any rating"}</label>`).join("");
  $("#priceMax").value = state.maxPrice;
  $("#priceLabel").textContent = rupees(state.maxPrice);
}

function renderChips() {
  const chips = [];
  state.categories.forEach((c) => chips.push({ label: c, clear: () => state.categories.delete(c) }));
  state.brands.forEach((b) => chips.push({ label: b, clear: () => state.brands.delete(b) }));
  if (state.maxPrice < 2500) chips.push({ label: "Up to " + rupees(state.maxPrice), clear: () => { state.maxPrice = 2500; } });
  if (state.minDiscount) chips.push({ label: state.minDiscount + "%+ off", clear: () => { state.minDiscount = 0; } });
  if (state.minRating) chips.push({ label: state.minRating + "★+", clear: () => { state.minRating = 0; } });
  if (state.query) chips.push({ label: `"${state.query}"`, clear: () => { state.query = ""; $("#search").value = ""; } });
  const box = $("#activeChips");
  box.innerHTML = chips.map((c, i) => `<button class="chip" data-i="${i}">${c.label} ✕</button>`).join("");
  box.onclick = (e) => {
    const i = e.target.dataset.i;
    if (i !== undefined) { chips[i].clear(); update(); }
  };
}

function renderProducts() {
  const list = visibleProducts();
  $("#grid").innerHTML = list.map((p) => `
    <article class="card" data-id="${p.id}" tabindex="0">
      <div class="card-media">
        <div class="card-art" style="background:${artBackground(p)}">${productArt(p)}</div>
        <span class="rating-pill">${p.rating} <span class="star">★</span> | ${(p.reviews / 1000).toFixed(1)}k</span>
        <button class="wish-btn ${wishlist.has(p.id) ? "on" : ""}" data-wish="${p.id}" aria-label="Add to wishlist">${wishlist.has(p.id) ? "♥" : "♡"}</button>
      </div>
      <div class="card-info">
        <p class="brand">${p.brand}</p>
        <p class="pname">${p.name}</p>
        <p class="price-line"><b>${rupees(p.price)}</b><s>${rupees(p.mrp)}</s><span class="off">(${discountOf(p)}% OFF)</span></p>
      </div>
      <button class="btn ghost quick-add" data-view="${p.id}">Quick view</button>
    </article>`).join("");
  $("#empty").hidden = list.length > 0;
  $("#resultsCount").textContent = `${list.length} item${list.length === 1 ? "" : "s"}`;
  const cats = [...state.categories];
  $("#resultsTitle").textContent = cats.length === 1 ? `${cats[0]} Fashion` : "All Products";
  document.querySelectorAll(".cats a").forEach((a) => a.classList.toggle("active", cats.length === 1 && cats[0] === a.dataset.cat));
}

function renderCounts() {
  const bagQty = bag.reduce((s, i) => s + i.qty, 0);
  $("#bagCount").textContent = bagQty;
  $("#bagCount").classList.toggle("zero", bagQty === 0);
  $("#wishCount").textContent = wishlist.size;
  $("#wishCount").classList.toggle("zero", wishlist.size === 0);
}

function update() {
  renderFilters();
  renderChips();
  renderProducts();
  renderCounts();
}

/* ---------- Toast ---------- */
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 2000);
}

/* ---------- Wishlist ---------- */
function toggleWish(id) {
  if (wishlist.has(id)) { wishlist.delete(id); toast("Removed from wishlist"); }
  else { wishlist.add(id); toast("Added to wishlist ♥"); }
  save("stylekart-wishlist", [...wishlist]);
  renderProducts();
  renderCounts();
  if (!$("#drawer").hidden && drawerMode === "wishlist") renderDrawer();
}

/* ---------- Bag ---------- */
function addToBag(id, size) {
  const existing = bag.find((i) => i.id === id && i.size === size);
  if (existing) existing.qty = Math.min(existing.qty + 1, 10);
  else bag.push({ id, size, qty: 1 });
  save("stylekart-bag", bag);
  renderCounts();
  toast("Added to bag 👜");
}

function bagTotals() {
  const items = bag.map((i) => ({ ...i, product: PRODUCTS.find((p) => p.id === i.id) })).filter((i) => i.product);
  const mrp = items.reduce((s, i) => s + i.product.mrp * i.qty, 0);
  const price = items.reduce((s, i) => s + i.product.price * i.qty, 0);
  const delivery = price === 0 || price >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE;
  return { items, mrp, discount: mrp - price, delivery, total: price + delivery };
}

/* ---------- Quick view modal ---------- */
let current = null;
let selectedSize = null;

function openQuickView(id) {
  current = PRODUCTS.find((p) => p.id === id);
  selectedSize = current.sizes.length === 1 ? current.sizes[0] : null;
  $("#qvArt").innerHTML = productArt(current);
  $("#qvArt").style.background = artBackground(current);
  $("#qvBrand").textContent = current.brand;
  $("#qvName").textContent = current.name;
  $("#qvRating").innerHTML = `${current.rating} <span style="color:var(--green)">★</span> | ${current.reviews.toLocaleString("en-IN")} ratings`;
  $("#qvPrice").innerHTML = `<b>${rupees(current.price)}</b><s>MRP ${rupees(current.mrp)}</s><span class="off">(${discountOf(current)}% OFF)</span>`;
  $("#qvSizes").innerHTML = current.sizes.map((s) => `<button class="size ${s === selectedSize ? "selected" : ""}" data-size="${s}">${s}</button>`).join("");
  $("#qvWish").textContent = wishlist.has(current.id) ? "♥ Wishlisted" : "♡ Wishlist";
  $("#sizeError").hidden = true;
  showLayer("#quickView");
}

$("#qvSizes").addEventListener("click", (e) => {
  if (!e.target.dataset.size) return;
  selectedSize = e.target.dataset.size;
  document.querySelectorAll(".size").forEach((b) => b.classList.toggle("selected", b === e.target));
  $("#sizeError").hidden = true;
});
$("#qvAdd").addEventListener("click", () => {
  if (!selectedSize) { $("#sizeError").hidden = false; return; }
  addToBag(current.id, selectedSize);
  hideLayers();
});
$("#qvWish").addEventListener("click", () => {
  toggleWish(current.id);
  $("#qvWish").textContent = wishlist.has(current.id) ? "♥ Wishlisted" : "♡ Wishlist";
});

/* ---------- Drawer (bag and wishlist) ---------- */
let drawerMode = "bag";

function renderDrawer() {
  const body = $("#drawerBody"), foot = $("#drawerFoot");
  if (drawerMode === "wishlist") {
    $("#drawerTitle").textContent = `Wishlist (${wishlist.size})`;
    const items = PRODUCTS.filter((p) => wishlist.has(p.id));
    body.innerHTML = items.length ? items.map((p) => `
      <div class="line-item">
        <div class="mini" style="background:${artBackground(p)}">${productArt(p)}</div>
        <div><p class="brand">${p.brand}</p><p class="pname">${p.name}</p>
          <p class="price-line"><b>${rupees(p.price)}</b><s>${rupees(p.mrp)}</s></p>
          <button class="btn ghost" style="margin-top:8px;padding:6px 12px" data-view="${p.id}">Move to bag</button></div>
        <button class="remove" data-unwish="${p.id}" aria-label="Remove">✕</button>
      </div>`).join("") : '<p class="drawer-empty">Your wishlist is empty.<br>Tap ♡ on any product to save it.</p>';
    foot.innerHTML = "";
    return;
  }
  const t = bagTotals();
  $("#drawerTitle").textContent = `Shopping Bag (${t.items.reduce((s, i) => s + i.qty, 0)})`;
  body.innerHTML = t.items.length ? t.items.map((i, idx) => `
    <div class="line-item">
      <div class="mini" style="background:${artBackground(i.product)}">${productArt(i.product)}</div>
      <div><p class="brand">${i.product.brand}</p><p class="pname">${i.product.name}</p>
        <p class="muted">Size: ${i.size}</p>
        <p class="price-line"><b>${rupees(i.product.price * i.qty)}</b><s>${rupees(i.product.mrp * i.qty)}</s></p>
        <div class="qty"><button data-dec="${idx}" aria-label="Decrease">−</button><span>${i.qty}</span><button data-inc="${idx}" aria-label="Increase">+</button></div></div>
      <button class="remove" data-remove="${idx}" aria-label="Remove">✕</button>
    </div>`).join("") : '<p class="drawer-empty">Your bag is empty.<br>Add some items to get started.</p>';
  foot.innerHTML = t.items.length ? `
    <div class="summary">
      <div><span>Total MRP</span><span>${rupees(t.mrp)}</span></div>
      <div><span>Discount on MRP</span><span class="green">−${rupees(t.discount)}</span></div>
      <div><span>Delivery fee</span><span>${t.delivery ? rupees(t.delivery) : '<span class="green">FREE</span>'}</span></div>
      ${t.delivery ? `<div class="muted"><span>Add ${rupees(FREE_DELIVERY_ABOVE - (t.total - t.delivery))} more for free delivery</span></div>` : ""}
      <div class="total"><span>Total amount</span><span>${rupees(t.total)}</span></div>
    </div>
    <button class="btn primary" id="placeOrder">Place order</button>` : "";
}

$("#drawerBody").addEventListener("click", (e) => {
  const d = e.target.dataset;
  if (d.inc !== undefined) bag[d.inc].qty = Math.min(bag[d.inc].qty + 1, 10);
  else if (d.dec !== undefined) { bag[d.dec].qty -= 1; if (bag[d.dec].qty === 0) bag.splice(d.dec, 1); }
  else if (d.remove !== undefined) { bag.splice(d.remove, 1); toast("Item removed"); }
  else if (d.unwish !== undefined) { toggleWish(+d.unwish); return; }
  else if (d.view !== undefined) { hideLayers(); openQuickView(+d.view); return; }
  else return;
  save("stylekart-bag", bag);
  renderCounts();
  renderDrawer();
});
$("#drawerFoot").addEventListener("click", (e) => {
  if (e.target.id !== "placeOrder") return;
  const total = bagTotals().total;
  bag = [];
  save("stylekart-bag", bag);
  renderCounts();
  $("#drawerBody").innerHTML = `<p class="drawer-empty">🎉 <b>Order placed!</b><br>Total paid: ${rupees(total)}<br><small>This is a demo, so no payment was taken.</small></p>`;
  $("#drawerFoot").innerHTML = "";
});

/* ---------- Layers (modal, drawer, mobile filters) ---------- */
function showLayer(sel) {
  hideLayers();
  $("#overlay").hidden = false;
  $(sel).hidden = false;
  document.body.style.overflow = "hidden";
}
function hideLayers() {
  ["#overlay", "#quickView", "#drawer"].forEach((s) => { $(s).hidden = true; });
  $("#filters").classList.remove("open");
  document.body.style.overflow = "";
}
$("#overlay").addEventListener("click", hideLayers);
$("#closeQuickView").addEventListener("click", hideLayers);
$("#closeDrawer").addEventListener("click", hideLayers);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideLayers(); });
$("#openBag").addEventListener("click", () => { drawerMode = "bag"; renderDrawer(); showLayer("#drawer"); });
$("#openWishlist").addEventListener("click", () => { drawerMode = "wishlist"; renderDrawer(); showLayer("#drawer"); });
$("#openFilters").addEventListener("click", () => { $("#overlay").hidden = false; $("#filters").classList.add("open"); });
$("#closeFilters").addEventListener("click", hideLayers);

/* ---------- Events ---------- */
$("#grid").addEventListener("click", (e) => {
  const wish = e.target.closest("[data-wish]");
  if (wish) { e.stopPropagation(); toggleWish(+wish.dataset.wish); return; }
  const card = e.target.closest(".card");
  if (card) openQuickView(+card.dataset.id);
});
$("#grid").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.classList.contains("card")) openQuickView(+e.target.dataset.id);
});

$("#filters").addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.group) {
    const set = state[t.dataset.group];
    t.checked ? set.add(t.value) : set.delete(t.value);
  } else if (t.name === "discount") state.minDiscount = +t.value;
  else if (t.name === "rating") state.minRating = +t.value;
  update();
});
$("#priceMax").addEventListener("input", (e) => {
  state.maxPrice = +e.target.value;
  $("#priceLabel").textContent = rupees(state.maxPrice);
  renderChips();
  renderProducts();
});

function clearFilters() {
  Object.assign(state, { maxPrice: 2500, minDiscount: 0, minRating: 0, query: "" });
  state.categories.clear();
  state.brands.clear();
  $("#search").value = "";
  update();
}
$("#clearFilters").addEventListener("click", clearFilters);
$("#emptyReset").addEventListener("click", clearFilters);

let searchTimer;
$("#search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.query = e.target.value; renderChips(); renderProducts(); }, 200);
});
$("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderProducts(); });

document.querySelectorAll("[data-cat]").forEach((a) => a.addEventListener("click", (e) => {
  e.preventDefault();
  state.categories.clear();
  if (a.dataset.cat !== "All") state.categories.add(a.dataset.cat);
  update();
  $("#shop").scrollIntoView({ behavior: "smooth" });
}));
$("#shopNow").addEventListener("click", () => $("#shop").scrollIntoView({ behavior: "smooth" }));

update();
