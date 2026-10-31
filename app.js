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

const SEARCH_QUERY = `query GetSearchTitles($searchTitlesFilter: TitleFilter!, $country: Country!, $language: Language!, $first: Int!) { popularTitles(country: $country, filter: $searchTitlesFilter, first: $first, sortBy: POPULAR) { edges { node { id objectId objectType title originalReleaseYear offers { monetizationType package { packageId shortName clearName } standardWebURL } } } } }`;

let selectedServices = new Set(JSON.parse(localStorage.getItem("streamfinder_services") || "[]"));

function init() {
  document.getElementById("tab-search").onclick = function() { showView("search"); };
  document.getElementById("tab-services").onclick = function() { showView("services"); };
  document.getElementById("search-btn").onclick = doSearch;
  document.getElementById("query").onkeydown = function(e) { if (e.key === "Enter") doSearch(); };
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
  var html = "";
  for (var i = 0; i < SERVICES.length; i++) {
    var s = SERVICES[i];
    var checked = selectedServices.has(s.id) ? " checked" : "";
    html += '<label class="service-item"><input type="checkbox" data-id="' + s.id + '"' + checked + ' /><span>' + s.name + '</span></label>';
  }
  el.innerHTML = html;
}

function renderLoginLinks() {
  const el = document.getElementById("login-links");
  var html = "";
  for (var i = 0; i < SERVICES.length; i++) {
    var s = SERVICES[i];
    html += '<a href="' + s.url + '" target="_blank" rel="noopener">' + s.name + '</a>';
  }
  el.innerHTML = html;
}

function saveServices() {
  const checks = document.querySelectorAll("#service-list input:checked");
  selectedServices = new Set(Array.from(checks).map(function(c) { return c.dataset.id; }));
  localStorage.setItem("streamfinder_services", JSON.stringify(Array.from(selectedServices)));
  alert("Saved. Your selections will be used for future searches.");
}

function showFallback(q) {
  const resultsEl = document.getElementById("results");
  var html = '<div class="card"><h3>' + q + '</h3><p style="color:#94a3b8;font-size:0.9rem">Availability check is blocked by the service. Use these direct search links for the services you selected:</p>';
  var hasAny = false;
  for (var i = 0; i < SERVICES.length; i++) {
    var s = SERVICES[i];
    if (selectedServices.has(s.id) || selectedServices.size === 0) {
      hasAny = true;
      var searchLink = s.searchUrl + encodeURIComponent(q);
      html += '<div class="offer"><div><strong>' + s.name + '</strong></div><div class="offer-actions"><button onclick="copyQuery(\'' + q.replace(/'/g, "") + '\')">Copy title</button><a href="' + searchLink + '" target="_blank" rel="noopener">Open</a></div></div>';
    }
  }
  if (!hasAny) {
    html += '<p>Select services in the My Services tab first.</p>';
  }
  html += '</div>';
  resultsEl.innerHTML = html;
}

async function doSearch() {
  const q = document.getElementById("query").value.trim();
  if (!q) return;
  const resultsEl = document.getElementById("results");
  resultsEl.innerHTML = "<p>Searching...</p>";
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: SEARCH_QUERY,
        variables: { searchTitlesFilter: { searchQuery: q }, country: "US", language: "en", first: 8 }
      })
    });
    if (!res.ok) throw new Error("API blocked");
    const data = await res.json();
    const edges = (data && data.data && data.data.popularTitles && data.data.popularTitles.edges) || [];
    if (edges.length) {
      renderResults(edges);
    } else {
      showFallback(q);
    }
  } catch (err) {
    showFallback(q);
  }
}

function renderResults(edges) {
  const resultsEl = document.getElementById("results");
  if (!edges.length) {
    resultsEl.innerHTML = "<p>No results found.</p>";
    return;
  }
  var html = "";
  for (var i = 0; i < edges.length; i++) {
    var node = edges[i].node;
    var offers = node.offers || [];
    var myOffers = [];
    for (var j = 0; j < offers.length; j++) {
      var o = offers[j];
      if (selectedServices.has(o.package && o.package.packageId) && o.monetizationType === "FLATRATE") {
        myOffers.push(o);
      }
    }
    html += '<div class="card"><h3>' + (node.title || "") + (node.originalReleaseYear ? " (" + node.originalReleaseYear + ")" : "") + '</h3>';
    html += '<div style="font-size:0.85rem;color:#94a3b8;margin-bottom:0.5rem">' + (node.objectType || "") + '</div>';
    if (myOffers.length) {
      for (var k = 0; k < myOffers.length; k++) {
        var o = myOffers[k];
        var svc = null;
        for (var m = 0; m < SERVICES.length; m++) {
          if (SERVICES[m].id === (o.package && o.package.packageId)) svc = SERVICES[m];
        }
        var openUrl = o.standardWebURL || (svc ? svc.searchUrl + encodeURIComponent(node.title) : "#");
        html += '<div class="offer"><div><strong>' + ((o.package && (o.package.clearName || o.package.shortName)) || "") + '</strong><div style="font-size:0.8rem;color:#94a3b8">Included with subscription</div></div>';
        html += '<div class="offer-actions"><button onclick="copyQuery(\'' + (node.title || "").replace(/'/g, "") + '\')">Copy title</button>';
        html += '<a href="' + openUrl + '" target="_blank" rel="noopener">Open</a></div></div>';
      }
    } else {
      html += '<div class="offer"><span style="color:#94a3b8">Not found on your selected services (or data lag).</span></div>';
    }
    html += '</div>';
  }
  resultsEl.innerHTML = html;
}

function copyQuery(text) {
  navigator.clipboard.writeText(text).then(function() {
    alert("Copied: " + text + "\nPaste it in the service search.");
  }).catch(function() {
    prompt("Copy this title:", text);
  });
}

window.copyQuery = copyQuery;
init();
