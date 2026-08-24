(function () {
  var el = document.getElementById("race-map");
  if (!el) return;

  var races = JSON.parse(el.dataset.races);

  var CATEGORIES = [
    { label: "5k", max: 6, color: "#4fb0ae" },
    { label: "10k", max: 15, color: "#f2b134" },
    { label: "Half Marathon", max: 25, color: "#b5391a" },
    { label: "Marathon", max: 50, color: "#6a4fb0" },
    { label: "Ultra", max: Infinity, color: "#2f6f4f" },
  ];

  function categoryFor(km) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (km <= CATEGORIES[i].max) return CATEGORIES[i];
    }
    return CATEGORIES[CATEGORIES.length - 1];
  }

  var map = L.map(el, {
    zoomControl: true,
    attributionControl: false,
    worldCopyJump: true,
  }).setView([20, 0], 2);

  fetch("/assets/vendor/countries-110m.json")
    .then(function (res) { return res.json(); })
    .then(function (topology) {
      var geojson = topojson.feature(topology, topology.objects.countries);
      L.geoJSON(geojson, {
        style: { fill: false, color: "#ffffff", weight: 1, opacity: 0.5 },
      }).addTo(map);
    });

  var markers = [];
  var usedCategories = {};
  races.forEach(function (race) {
    var cat = categoryFor(race.distance_km || 0);
    usedCategories[cat.label] = cat;
    var marker = L.circleMarker([race.lat, race.lon], {
      radius: 5,
      color: cat.color,
      weight: 1.5,
      fillColor: cat.color,
      fillOpacity: 0.85,
    }).addTo(map);
    var km = race.distance_km ? race.distance_km.toFixed(1) + " km" : "";
    marker.bindTooltip(
      "<strong>" + race.name + "</strong><br>" + race.date + (km ? " &middot; " + km : ""),
      { direction: "top", offset: [0, -6] }
    );
    markers.push(marker);
  });

  if (markers.length) {
    var group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.08));
  }

  var legend = L.control({ position: "bottomleft" });
  legend.onAdd = function () {
    var div = L.DomUtil.create("div", "race-map-legend");
    CATEGORIES.filter(function (c) { return usedCategories[c.label]; }).forEach(function (c) {
      var item = L.DomUtil.create("span", "race-map-legend-item", div);
      item.innerHTML =
        '<span class="race-map-legend-dot" style="background:' + c.color + '"></span>' + c.label;
    });
    return div;
  };
  legend.addTo(map);
})();
