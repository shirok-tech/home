const CONFIG = {
  qiitaUser: "shirok",
  qiitaPerPage: 12,

  // A案（最小運用・確実版）：channel_id を使う
  youtubeChannelId: "UCAh-qiN4BV84ov1ZLfaPCgQ",
};

const $ = (sel) => document.querySelector(sel);

function formatDateJST(iso) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(d);
  } catch {
    return iso;
  }
}

function uploadsPlaylistIdFromChannelId(channelId) {
  // UCxxxx -> UUxxxx（アップロード用プレイリスト）
  if (!channelId || !channelId.startsWith("UC")) return null;
  return "UU" + channelId.slice(2);
}

async function fetchQiitaItems() {
  // Qiita API v2：ユーザーの記事一覧を新しい順で取得できます :contentReference[oaicite:2]{index=2}
  const url = `https://qiita.com/api/v2/users/${encodeURIComponent(CONFIG.qiitaUser)}/items?page=1&per_page=${CONFIG.qiitaPerPage}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`Qiita fetch failed: ${res.status}`);
  return await res.json();
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

  // 更新日時表示
  if (items[0]?.created_at) {
    $("#qiita-updated").textContent = formatDateJST(items[0].created_at);
  } else {
    $("#qiita-updated").textContent = "—";
  }

  // 検索フィルタ
  const all = items.map(it => ({
    raw: it,
    text: `${(it.title||"").toLowerCase()} ${(it.tags||[]).map(t=>t.name.toLowerCase()).join(" ")}`
  }));

  $("#post-filter").addEventListener("input", (e) => {
    const q = (e.target.value || "").trim().toLowerCase();
    const filtered = q ? all.filter(x => x.text.includes(q)).map(x => x.raw) : items;

    $("#posts-empty").classList.toggle("hidden", filtered.length !== 0);
    renderQiita(filtered);
  }, { once: true });
}

function uploadsPlaylistIdFromChannelId(channelId) {
  if (!channelId || !channelId.startsWith("UC")) return null;
  return "UU" + channelId.slice(2);
}

function uploadsPlaylistIdFromChannelId(channelId) {
  if (!channelId || !channelId.startsWith("UC")) return null;
  return "UU" + channelId.slice(2);
}

function setYouTubeEmbed() {
  const frame = document.querySelector("#yt-frame");
  const uploads = uploadsPlaylistIdFromChannelId((CONFIG.youtubeChannelId || "").trim());

  if (!uploads) {
    frame.srcdoc = `
      <style>body{margin:0;display:grid;place-items:center;background:#000;color:#fff;font-family:system-ui}</style>
      <div style="padding:20px;text-align:center">
        <div style="font-weight:700;margin-bottom:8px">YouTube 埋め込みの設定が必要です</div>
        <div style="opacity:.8;font-size:13px;line-height:1.6">
          app.js の <code>youtubeChannelId</code> に <code>UC...</code> を入れてください。
        </div>
      </div>
    `;
    return;
  }

  // アップロード動画プレイリストを埋め込み（最小運用の王道）
  frame.src = `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(uploads)}`;
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

  try {
    const items = await fetchQiitaItems();
    renderQiita(items);
  } catch (e) {
    console.error(e);
    $("#qiita-updated").textContent = "取得失敗";
    $("#posts-grid").innerHTML = `<div class="card muted">Qiita記事の取得に失敗しました。時間をおいて再読み込みしてください。</div>`;
  }
})();
