(function () {
  var el = document.getElementById("race-map");
  if (!el) return;

  var races = JSON.parse(el.dataset.races);
  var accent = getComputedStyle(document.body).getPropertyValue("--accent").trim() || "#ff6a2b";
  var borderColor = getComputedStyle(document.body).getPropertyValue("--border").trim() || "#888";

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
        style: { fill: false, color: borderColor, weight: 1, opacity: 0.6 },
      }).addTo(map);
    });

  var markers = [];
  races.forEach(function (race) {
    var marker = L.circleMarker([race.lat, race.lon], {
      radius: 5,
      color: accent,
      weight: 1.5,
      fillColor: accent,
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
    map.fitBounds(group.getBounds().pad(0.25));
  }
})();
