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



// GitHub Pages の検索UIを /rag/search に接続
<script>
const RAG_ENDPOINT = "https://ma27s6tvglwhdaarmn6wp3zu6i.apigateway.us-chicago-1.oci.customer-oci.com/rag/search";

async function ragSearch(){
  const qEl = document.getElementById("ragQuery");
  const statusEl = document.getElementById("ragStatus");
  const out = document.getElementById("ragResults");

  const q = (qEl.value || "").trim();
  if(!q) return;

  statusEl.textContent = "Searching...";
  out.innerHTML = "";

  try{
    const res = await fetch(RAG_ENDPOINT, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ q, top: 8 })
    });

    if(!res.ok){
      const text = await res.text();
      statusEl.textContent = `Error: HTTP ${res.status}`;
      out.innerHTML = `<pre style="white-space:pre-wrap; padding:12px; border:1px solid #f99; border-radius:10px;">${text}</pre>`;
      return;
    }

    const data = await res.json();
    const results = data.results || [];

    statusEl.textContent = `Hits: ${results.length}`;
    for(const r of results){
      const card = document.createElement("div");
      card.style.cssText = "margin:12px 0; padding:12px; border:1px solid #ddd; border-radius:12px;";
      card.innerHTML = `
        <div style="font-weight:700; margin-bottom:4px;">${escapeHtml(r.title || "")}</div>
        <div style="font-size:12px; opacity:.7; margin-bottom:6px;">dist: ${r.dist}</div>
        <div style="margin:6px 0;">${escapeHtml(r.snippet || "")}</div>
        <a href="${r.url}" target="_blank" rel="noopener">Open</a>
      `;
      out.appendChild(card);
    }
  }catch(e){
    statusEl.textContent = "Network error";
    out.innerHTML = `<pre style="white-space:pre-wrap; padding:12px; border:1px solid #f99; border-radius:10px;">${String(e)}</pre>`;
  }
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

document.getElementById("ragBtn").addEventListener("click", ragSearch);
document.getElementById("ragQuery").addEventListener("keydown", (e)=>{
  if(e.key === "Enter") ragSearch();
});
</script></script>