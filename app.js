const CONFIG = {
  qiitaUser: "shirok",
  qiitaPerPage: 12,
  youtubeChannelId: "UCAh-qiN4BV84ov1ZLfaPCgQ",
};

const RAG_ENDPOINT = "https://ma27s6tvglwhdaarmn6wp3zu6i.apigateway.us-chicago-1.oci.customer-oci.com/rag/search";
const ASK_ENDPOINT = "https://ma27s6tvglwhdaarmn6wp3zu6i.apigateway.us-chicago-1.oci.customer-oci.com/rag/ask";

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
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  } catch {
    return iso;
  }
}

async function fetchQiitaItems() {
  const url = `https://qiita.com/api/v2/users/${encodeURIComponent(CONFIG.qiitaUser)}/items?page=1&per_page=${CONFIG.qiitaPerPage}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Qiita fetch failed: ${res.status}`);
  return await res.json();
}

function classifyCategory(item) {
  const title = (item.title || "").toLowerCase();
  const tags = (item.tags || []).map((t) => (t.name || "").toLowerCase());
  const hay = [title, ...tags].join(" ");

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
  if (!grid) return;

  grid.innerHTML = "";

  items.forEach((it) => {
    const el = document.createElement("article");
    el.className = "post";

    const tags = (it.tags || [])
      .slice(0, 6)
      .map((t) => `<span class="tag">${escapeHtml(t.name)}</span>`)
      .join("");

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
  const updatedEl = $("#qiita-updated");
  if (updatedEl) {
    if (latest?.created_at) {
      updatedEl.textContent = formatDateJST(latest.created_at);
    } else {
      updatedEl.textContent = "—";
    }
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

  const emptyEl = $("#posts-empty");
  if (emptyEl) emptyEl.classList.toggle("hidden", filtered.length !== 0);

  renderQiita(filtered);
}

function updateQuickStats(items) {
  const postCount = items.length;
  const likes = items.reduce((sum, it) => sum + Number(it.likes_count ?? 0), 0);
  const tagSet = new Set(
    items.flatMap((it) => (it.tags || []).map((t) => (t.name || "").toLowerCase()))
  );

  const postsEl = $("#stat-posts");
  const likesEl = $("#stat-likes");
  const tagsEl = $("#stat-tags");

  if (postsEl) postsEl.textContent = String(postCount);
  if (likesEl) likesEl.textContent = String(likes);
  if (tagsEl) tagsEl.textContent = String(tagSet.size);
}

function initFilters() {
  const filterInput = $("#post-filter");
  if (filterInput) {
    filterInput.addEventListener("input", (e) => {
      state.query = (e.target.value || "").trim().toLowerCase();
      applyFilters();
    });
  }

  $$(".cat").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".cat").forEach((b) => b.classList.remove("active"));
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
  const frame = $("#yt-frame");
  if (!frame) return;

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

async function ragSearch() {
  const qEl = $("#ragQuery");
  const statusEl = $("#ragStatus");
  const out = $("#ragResults");

  if (!qEl || !statusEl || !out) return;

  const q = (qEl.value || "").trim();
  if (!q) return;

  statusEl.textContent = "Searching...";
  out.innerHTML = "";

  try {
    const res = await fetch(RAG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, top: 8 })
    });

    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = `Error: HTTP ${res.status}`;
      out.innerHTML = `<div class="card muted">RAG検索に失敗しました：${escapeHtml(JSON.stringify(data))}</div>`;
      return;
    }

    const results = data.results || [];
    statusEl.textContent = `Hits: ${results.length}`;

    results.forEach((r, i) => {
      const el = document.createElement("article");
      el.className = "post";
      el.innerHTML = `
        <a href="${r.url}" target="_blank" rel="noopener">
          <h3>${escapeHtml(r.title || "(no title)")}</h3>
          <div class="meta">
            <span>📌 関連度 ${escapeHtml(String(r.dist))}</span>
            <span>#${i + 1}</span>
          </div>
          <div class="muted small" style="margin-top:6px; line-height:1.7;">${escapeHtml(r.snippet || "")}</div>
        </a>
      `;
      out.appendChild(el);
    });
  } catch (e) {
    console.error(e);
    statusEl.textContent = "Network error";
    out.innerHTML = `<div class="card muted">Network error: ${escapeHtml(String(e))}</div>`;
  }
}

async function askAi() {
  const qEl = document.getElementById("askQuery");
  const statusEl = document.getElementById("askStatus");
  const out = document.getElementById("askAnswer");

  if (!qEl || !statusEl || !out) return;

  const question = (qEl.value || "").trim();
  if (!question) return;

  statusEl.textContent = "Thinking...";
  out.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px;">
      <div style="width:12px; height:12px; border-radius:999px; background:var(--accent); box-shadow:0 0 12px var(--accent);"></div>
      <div class="muted small">AIが回答を生成しています…</div>
    </div>
  `;

  try {
    const res = await fetch(ASK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, top: 5 })
    });

    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = `Error: HTTP ${res.status}`;
      out.innerHTML = `
        <div style="font-weight:700; margin-bottom:8px; color:#ffb4b4;">エラー</div>
        <pre style="white-space:pre-wrap; line-height:1.6;">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
      `;
      return;
    }

    const answer = escapeHtml(data.answer || "");
    const citations = data.citations || [];
    const matches = data.matches || [];

    const citesHtml = citations.length
      ? citations.map((c, i) => `
          <li style="margin:6px 0;">
            <a href="${c.url}" target="_blank" rel="noopener" style="text-decoration:none;">
              ${escapeHtml(c.title || `参考元 ${i + 1}`)}
            </a>
          </li>
        `).join("")
      : `<li class="muted small">参考元なし</li>`;

    const matchesHtml = matches.length
      ? matches.map((m, i) => `
          <div style="padding:10px 12px; border:1px solid rgba(255,255,255,.08); border-radius:12px; margin-top:8px;">
            <div style="font-weight:700; margin-bottom:4px;">${i + 1}. ${escapeHtml(m.title || "(no title)")}</div>
            <div class="muted small" style="margin-bottom:6px;">dist: ${escapeHtml(String(m.dist))}</div>
            <div style="font-size:13px; line-height:1.7;">${escapeHtml(m.snippet || "")}</div>
            <div style="margin-top:8px;">
              <a href="${m.url}" target="_blank" rel="noopener">元コンテンツを開く</a>
            </div>
          </div>
        `).join("")
      : `<div class="muted small">根拠チャンクなし</div>`;

    out.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
        <div>
          <div style="font-weight:800; font-size:18px;">AI回答</div>
          <div class="muted small">質問: ${escapeHtml(question)}</div>
        </div>
        <span class="chip">Ask AI</span>
      </div>

      <div style="padding:14px 16px; border:1px solid rgba(255,255,255,.08); border-radius:14px; background:rgba(255,255,255,.02);">
        <div style="white-space:pre-wrap; line-height:1.9; font-size:15px;">${answer}</div>
      </div>

      <div style="margin-top:16px;">
        <div style="font-weight:700; margin-bottom:8px;">参考元</div>
        <ul style="margin:0; padding-left:18px; line-height:1.8;">
          ${citesHtml}
        </ul>
      </div>

      <details style="margin-top:16px;">
        <summary style="cursor:pointer; font-weight:700;">検索根拠を表示</summary>
        <div style="margin-top:10px;">
          ${matchesHtml}
        </div>
      </details>
    `;

    statusEl.textContent = "Done";
  } catch (e) {
    console.error(e);
    statusEl.textContent = "Network error";
    out.innerHTML = `
      <div style="font-weight:700; margin-bottom:8px; color:#ffb4b4;">ネットワークエラー</div>
      <pre style="white-space:pre-wrap; line-height:1.6;">${escapeHtml(String(e))}</pre>
    `;
  }
}


(async function main() {
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  setYouTubeEmbed();
  initFilters();

  const ragBtnEl = $("#ragBtn");
  const ragQueryEl = $("#ragQuery");
  if (ragBtnEl) ragBtnEl.addEventListener("click", ragSearch);
  if (ragQueryEl) {
    ragQueryEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") ragSearch();
    });
  }

  const askBtnEl = $("#askBtn");
  const askQueryEl = $("#askQuery");
  if (askBtnEl) askBtnEl.addEventListener("click", askAi);
  if (askQueryEl) {
    askQueryEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") askAi();
    });
  }

  try {
    const items = await fetchQiitaItems();

    state.items = items.map((it) => {
      const title = (it.title || "").toLowerCase();
      const tags = (it.tags || []).map((t) => (t.name || "").toLowerCase());
      return {
        ...it,
        __cat: classifyCategory(it),
        __searchText: `${title} ${tags.join(" ")}`
      };
    });

    updateQuickStats(state.items);
    applyFilters();
  } catch (e) {
    console.error(e);
    const updatedEl = $("#qiita-updated");
    const gridEl = $("#posts-grid");
    if (updatedEl) updatedEl.textContent = "取得失敗";
    if (gridEl) {
      gridEl.innerHTML = `<div class="card muted">Qiita記事の取得に失敗しました。時間をおいて再読み込みしてください。</div>`;
    }
  }
})();