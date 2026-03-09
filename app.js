const CONFIG = {
  qiitaUser: "shirok",
  qiitaPerPage: 12,

  youtubeChannelId: "UCAh-qiN4BV84ov1ZLfaPCgQ",
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  items: [],
  activeCategory: "all",
  query: "",
};

function formatDateJST(iso) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(d);
  } catch {
    return iso;
  }
}

async function fetchQiitaItems() {
  const url = `https://qiita.com/api/v2/users/${encodeURIComponent(CONFIG.qiitaUser)}/items?page=1&per_page=${CONFIG.qiitaPerPage}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`Qiita fetch failed: ${res.status}`);
  return await res.json();
}

function classifyCategory(item){
  const title = (item.title || "").toLowerCase();
  const tags = (item.tags || []).map(t => (t.name || "").toLowerCase());
  const hay = [title, ...tags].join(" ");

  // Shirokっぽいキーワードで自動分類（必要なら増やせます）
  if (/(oci|exadata|exa(cs)?|adb|autonomous|oracle cloud|oci )/.test(hay)) return "oci";
  if (/(oracle database|database|sql|pl\/sql|odb|autonomous database)/.test(hay)) return "db";
  if (/(iperf|netperf|rtt|latency|throughput|tcp|udp|network|帯域|遅延)/.test(hay)) return "net";
  if (/(wsl|windows|podman|wsl1|wsl2)/.test(hay)) return "wsl";
  if (/(rag|vector|embedding|ai|llm|lakehouse)/.test(hay)) return "ai";
  if (/(bash|script|tool|benchmark|python|automation|ci|cd)/.test(hay)) return "tools";

  return "all";
}

function renderQiita(items) {
  const grid = $("#posts-grid");
  grid.innerHTML = "";

  items.forEach((it) => {
    const el = document.createElement("article");
    el.className = "post";

    const tags = (it.tags || []).slice(0, 6).map(t => `<span class="tag">${escapeHtml(t.name)}</span>`).join("");

    el.innerHTML = `
      <a href="${it.url}" target="_blank" rel="noopener">
        <h3>${escapeHtml(it.title || "(no title)")}</h3>
        <div class="meta">
          <span>📅 ${formatDateJST(it.created_at)}</span>
          <span>👍 ${Number(it.likes_count ?? 0)}</span>
          <span>💬 ${Number(it.comments_count ?? 0)}</span>
        </div>
        <div class="tags">${tags}</div>
      </a>
    `;
    grid.appendChild(el);
  });

  const latest = state.items[0] || items[0];
  if (latest?.created_at) {
    $("#qiita-updated").textContent = formatDateJST(latest.created_at);
  } else {
    $("#qiita-updated").textContent = "—";
  }
}

function applyFilters() {
  const q = state.query;
  const cat = state.activeCategory;

  const filtered = state.items.filter((it) => {
    const inCategory = cat === "all" ? true : it.__cat === cat;
    if (!inCategory) return false;
    if (!q) return true;
    return it.__searchText.includes(q);
  });

  $("#posts-empty").classList.toggle("hidden", filtered.length !== 0);
  renderQiita(filtered);
}

function updateQuickStats(items) {
  const postCount = items.length;
  const likes = items.reduce((sum, it) => sum + Number(it.likes_count ?? 0), 0);
  const tagSet = new Set(items.flatMap((it) => (it.tags || []).map((t) => (t.name || "").toLowerCase())));

  $("#stat-posts").textContent = String(postCount);
  $("#stat-likes").textContent = String(likes);
  $("#stat-tags").textContent = String(tagSet.size);
}

function initFilters() {
  const filterInput = $("#post-filter");
  if (filterInput) {
    filterInput.addEventListener("input", (e) => {
      state.query = (e.target.value || "").trim().toLowerCase();
      applyFilters();
    });
  }

  $$(".cat").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".cat").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeCategory = btn.dataset.cat || "all";
      applyFilters();
    });
  });
}

function uploadsPlaylistIdFromChannelId(channelId) {
  if (!channelId || !channelId.startsWith("UC")) return null;
  return "UU" + channelId.slice(2);
}

function setYouTubeEmbed() {
  const frame = document.querySelector("#yt-frame");

  if (location.protocol === "file:") {
    frame.srcdoc = `
      <style>body{margin:0;display:grid;place-items:center;background:#000;color:#fff;font-family:system-ui}</style>
      <div style="padding:20px;text-align:center;max-width:520px">
        <div style="font-weight:800;margin-bottom:10px">YouTube埋め込みは file:// 直開きだとブロックされることがあります（Error 153）</div>
        <div style="opacity:.85;font-size:13px;line-height:1.7">
          対処：このフォルダで <code>python3 -m http.server 8000</code> を実行して<br/>
          <code>http://localhost:8000</code> から開いてください。<br/>
          もしくはGitHub Pages等にデプロイすると確実です。
        </div>
      </div>
    `;
    return;
  }

  const uploads = uploadsPlaylistIdFromChannelId((CONFIG.youtubeChannelId || "").trim());
  if (!uploads) return;

  const originParam = location.origin.startsWith("http")
    ? `&origin=${encodeURIComponent(location.origin)}`
    : "";

  frame.src = `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(uploads)}${originParam}`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

(async function main() {
  $("#year").textContent = String(new Date().getFullYear());
  setYouTubeEmbed();
  initFilters();

  try {
    const items = await fetchQiitaItems();

    state.items = items.map((it) => {
      const title = (it.title || "").toLowerCase();
      const tags = (it.tags || []).map((t) => (t.name || "").toLowerCase());
      return {
        ...it,
        __cat: classifyCategory(it),
        __searchText: `${title} ${tags.join(" ")}`,
      };
    });

    updateQuickStats(state.items);
    applyFilters();
  } catch (e) {
    console.error(e);
    $("#qiita-updated").textContent = "取得失敗";
    $("#posts-grid").innerHTML = `<div class="card muted">Qiita記事の取得に失敗しました。時間をおいて再読み込みしてください。</div>`;
  }
})();


const ASK_ENDPOINT = "https://ma27s6tvglwhdaarmn6wp3zu6i.apigateway.us-chicago-1.oci.customer-oci.com/rag/ask";

async function askAi(){
  const qEl = document.getElementById("askQuery");
  const statusEl = document.getElementById("askStatus");
  const out = document.getElementById("askAnswer");

  if (!qEl || !statusEl || !out) return;

  const question = (qEl.value || "").trim();
  if (!question) return;

  statusEl.textContent = "Thinking...";
  out.innerHTML = "";

  try {
    const res = await fetch(ASK_ENDPOINT, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ question, top: 5 })
    });

    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = `Error: HTTP ${res.status}`;
      out.innerHTML = `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
      return;
    }

    const cites = (data.citations || []).map(c =>
      `<li><a href="${c.url}" target="_blank" rel="noopener">${escapeHtml(c.title || c.url)}</a></li>`
    ).join("");

    statusEl.textContent = "Done";
    out.innerHTML = `
      <div style="font-weight:700; margin-bottom:8px;">回答</div>
      <div style="white-space:pre-wrap; line-height:1.7;">${escapeHtml(data.answer || "")}</div>
      <div style="margin-top:12px; font-weight:700;">参考元</div>
      <ul>${cites}</ul>
    `;
  } catch (e) {
    statusEl.textContent = "Network error";
    out.innerHTML = `<pre>${escapeHtml(String(e))}</pre>`;
  }
}

const askBtnEl = document.getElementById("askBtn");
const askQueryEl = document.getElementById("askQuery");
if (askBtnEl) askBtnEl.addEventListener("click", askAi);
if (askQueryEl) askQueryEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") askAi();
});