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

  function formatTime(totalSeconds) {
    var total = Math.round(totalSeconds);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return h > 0 ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s);
  }

  // Rings that cross the antimeridian aren't split in raw lon/lat data, so
  // Leaflet draws a stray line straight across the map connecting -180 to
  // 180. Drop any ring with a sudden longitude jump rather than rendering it.
  function ringCrossesAntimeridian(ring) {
    for (var i = 1; i < ring.length; i++) {
      if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) return true;
    }
    return false;
  }

  function fixAntimeridian(geojson) {
    geojson.features = geojson.features
      .map(function (feature) {
        var geom = feature.geometry;
        if (!geom) return feature;
        if (geom.type === "Polygon") {
          geom.coordinates = geom.coordinates.filter(function (ring) {
            return !ringCrossesAntimeridian(ring);
          });
        } else if (geom.type === "MultiPolygon") {
          geom.coordinates = geom.coordinates
            .map(function (poly) {
              return poly.filter(function (ring) {
                return !ringCrossesAntimeridian(ring);
              });
            })
            .filter(function (poly) {
              return poly.length > 0;
            });
        }
        return feature;
      })
      .filter(function (feature) {
        var geom = feature.geometry;
        return geom && geom.coordinates && geom.coordinates.length > 0;
      });
    return geojson;
  }

  var map = L.map(el, {
    zoomControl: true,
    attributionControl: false,
    worldCopyJump: true,
  }).setView([20, 0], 2);

  fetch("/assets/vendor/countries-110m.json")
    .then(function (res) { return res.json(); })
    .then(function (topology) {
      var geojson = fixAntimeridian(topojson.feature(topology, topology.objects.countries));
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
    var displayKm = race.official_distance_km || race.distance_km;
    var km = displayKm ? displayKm.toFixed(1) + " km" : "";
    var time = race.official_time_s || race.duration_s;
    var timeStr = time ? formatTime(time) : "";
    var meta = [race.date, km, timeStr].filter(Boolean).join(" &middot; ");
    marker.bindTooltip("<strong>" + race.name + "</strong><br>" + meta, {
      direction: "top",
      offset: [0, -6],
    });
    markers.push(marker);
  });

  if (markers.length) {
    var group = L.featureGroup(markers);
    var initialBounds = group.getBounds().pad(0.08);
    map.fitBounds(initialBounds);

    var ResetControl = L.Control.extend({
      options: { position: "topleft" },
      onAdd: function () {
        var container = L.DomUtil.create("div", "leaflet-bar race-map-reset");
        var link = L.DomUtil.create("a", "", container);
        link.href = "#";
        link.title = "Reset zoom";
        link.innerHTML = "&#8634;";
        L.DomEvent.on(link, "click", function (e) {
          L.DomEvent.preventDefault(e);
          map.fitBounds(initialBounds);
        });
        return container;
      },
    });
    map.addControl(new ResetControl());
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
