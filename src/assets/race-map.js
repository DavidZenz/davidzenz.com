(function () {
  var el = document.getElementById("race-map");
  if (!el) return;

  var races = JSON.parse(el.dataset.races);
  var map = L.map(el).setView([20, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(map);

  var markers = [];
  races.forEach(function (race) {
    var marker = L.marker([race.lat, race.lon]).addTo(map);
    var km = race.distance ? (race.distance / 1000).toFixed(1) + " km" : "";
    marker.bindPopup(
      "<strong>" + race.name + "</strong><br>" + race.date + (km ? " &middot; " + km : "")
    );
    markers.push(marker);
  });

  if (markers.length) {
    var group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.2));
  }
})();
