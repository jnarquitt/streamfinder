// Major services with JustWatch package IDs and open URLs
const SERVICES = [
  { id: "nfx", name: "Netflix", url: "https://www.netflix.com", searchUrl: "https://www.netflix.com/search?q=" },
  { id: "dnp", name: "Disney+", url: "https://www.disneyplus.com", searchUrl: "https://www.disneyplus.com/search?q=" },
  { id: "amp", name: "Prime Video", url: "https://www.amazon.com/gp/video", searchUrl: "https://www.amazon.com/s?k=" },
  { id: "hbm", name: "Max", url: "https://play.max.com", searchUrl: "https://play.max.com/search?q=" },
  { id: "hlu", name: "Hulu", url: "https://www.hulu.com", searchUrl: "https://www.hulu.com/search?q=" },
  { id: "atp", name: "Apple TV+", url: "https://tv.apple.com", searchUrl: "https://tv.apple.com/search?term=" },
  { id: "pct", name: "Peacock", url: "https://www.peacocktv.com", searchUrl: "https://www.peacocktv.com/search?q=" },
  { id: "pmp", name: "Paramount+", url: "https://www.paramountplus.com", searchUrl: "https://www.paramountplus.com/search/?query=" },
  { id: "yot", name: "YouTube TV", url: "https://tv.youtube.com", searchUrl: "https://tv.youtube.com/search?q=" },
  { id: "xfn", name: "Xfinity Stream", url: "https://www.xfinity.com/stream", searchUrl: "https://www.xfinity.com/stream" }
];

const GRAPHQL_URL = "https://apis.justwatch.com/graphql";

const SEARCH_QUERY = `
query GetSearchTitles($searchTitlesFilter: TitleFilter!, $country: Country!, $language: Language!, $first: Int!) {
  popularTitles(country: $country, filter: $searchTitlesFilter, first: $first, sortBy: POPULAR) {
    edges {
      node {
        id
        objectId
        objectType
        title
        originalReleaseYear
        offers {
          monetizationType
          package { packageId shortName clearName }
          standardWebURL
        }
      }
    }
  }
}`;

let selectedServices = new Set(JSON.parse(localStorage.getItem("streamfinder_services") || "[]"));

function init() {
  document.getElementById("tab-search").onclick = () => showView("search");
  document.getElementById("tab-services").onclick = () => showView("services");
  document.getElementById("search-btn").onclick = doSearch;
  document.getElementById("query").onkeydown = (e) => { if (e.key === "Enter") doSearch(); };
  document.getElementById("save-services").onclick = saveServices;

  renderServiceList();
  renderLoginLinks();
  showView("search");
}

function showView(name) {
  document.getElementById("view-search").hidden = name !== "search";
  document.getElementById("view-services").hidden = name !== "services";
  document.getElementById("tab-search").classList.toggle("active", name === "search");
  document.getElementById("tab-services").classList.toggle("active", name === "services");
}

function renderServiceList() {
  const el = document.getElementById("service-list");
  el.innerHTML = SERVICES.map(s => `
    <label class="service-item">
      <input type="checkbox" data-id="${s.id}" ${selectedServices.has(s.id) ? "checked" : ""} />
      <span>${s.name}</span>
    </label>
  `).join("");
}

function renderLoginLinks() {
  const el = document.getElementById("login-links");
  el.innerHTML = SERVICES.map(s => `
    <a href="${s.url}" target="_blank" rel="noopener">${s.name}</a>
  `).join("");
}

function saveServices() {
  const checks = document.querySelectorAll("#service-list input:checked");
  selectedServices = new Set([...checks].map(c => c.dataset.id));
  localStorage.setItem("streamfinder_services", JSON.stringify([...selectedServices]));
  alert("Saved. Your selections will be used for future searches.");
}

async function doSearch() {
  const q = document.getElementById("query").value.trim();
  if (!q) return;
  const resultsEl = document.getElementById("results");
  resultsEl.innerHTML = "<p>Searching…</p>";

  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: SEARCH_QUERY,
        variables: {
          searchTitlesFilter: { searchQuery: q },
          country: "US",
          language: "en",
          first: 8
        }
      })
    });
    const data = await res.json();
    const edges = data?.data?.popularTitles?.edges || [];
    renderResults(edges, q);
  } catch (err) {
    resultsEl.innerHTML = `<p>Error searching. Try again later.</p>`;
    console.error(err);
  }
}

function renderResults(edges, originalQuery) {
  const resultsEl = document.getElementById("results");
  if (!edges.length) {
    resultsEl.innerHTML = "<p>No results found.</p>";
    return;
  }

  resultsEl.innerHTML = edges.map(edge => {
    const node = edge.node;
    const myOffers = (node.offers || []).filter(o => 
      selectedServices.has(o.package?.packageId) && o.monetizationType === "FLATRATE"
    );

    let offersHtml = "";
    if (myOffers.length) {
      offersHtml = myOffers.map(o => {
        const svc = SERVICES.find(s => s.id === o.package.packageId);
        const openUrl = o.standardWebURL || (svc ? svc.searchUrl + encodeURIComponent(node.title) : "#");
        return `
          <div class="offer">
            <div>
              <strong>${o.package.clearName || o.package.shortName}</strong>
              <div style="font-size:0.8rem;color:#94a3b8">Included with subscription</div>
            </div>
            <div class="offer-actions">
              <button onclick="copyQuery('${escapeHtml(node.title)}')">Copy title</button>
              <a href="${openUrl}" target="_blank" rel="noopener">Open</a>
            </div>
          </div>`;
      }).join("");
    } else {
      offersHtml = `<div class="offer"><span style="color:#94a3b8">Not found on your selected services (or data lag).</span></div>`;
    }

    return `
      <div class="card">
        <h3>${escapeHtml(node.title)} ${node.originalReleaseYear ? `(${node.originalReleaseYear})` : ""}</h3>
        <div style="font-size:0.85rem;color:#94a3b8;margin-bottom:0.5rem">${node.objectType}</div>
        ${offersHtml}
      </div>`;
  }).join("");
}

function copyQuery(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert("Copied: " + text + "\nPaste it in the service's search.");
  }).catch(() => {
    prompt("Copy this title:", text);
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, '&#39;');
}

window.copyQuery = copyQuery;

init();
