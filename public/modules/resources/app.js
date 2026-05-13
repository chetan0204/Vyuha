// 🌍 Initialize Map
var map = L.map('map').setView([20.5937, 78.9629], 5);

// 🗺️ Tile Layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

let userLat = 20.5937;
let userLon = 78.9629;
let markers = [];

// 📍 Get User Location
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
        userLat = position.coords.latitude;
        userLon = position.coords.longitude;

        map.setView([userLat, userLon], 10);

        L.marker([userLat, userLon])
            .addTo(map)
            .bindPopup("📍 You are here")
            .openPopup();
    });
}

// 📏 Distance Function (Haversine)
function getDistance(lat1, lon1, lat2, lon2) {
    let R = 6371;
    let dLat = (lat2 - lat1) * Math.PI/180;
    let dLon = (lon2 - lon1) * Math.PI/180;

    let a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1*Math.PI/180) *
        Math.cos(lat2*Math.PI/180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

// 📦 Load Data
fetch('data.json')
.then(response => {
    if (!response.ok) throw new Error("Error loading data");
    return response.json();
})
.then(data => {

    function render(filters) {

        // Clear markers
        markers.forEach(m => map.removeLayer(m));
        markers = [];

        let list = document.getElementById("resourceList");
        list.innerHTML = "";

        data.forEach(resource => {

            if (!filters.includes(resource.type)) return;

            let dist = getDistance(userLat, userLon, resource.lat, resource.lon).toFixed(2);

            // Marker
            let marker = L.marker([resource.lat, resource.lon]).addTo(map);

            marker.bindPopup(`
                <b>${resource.name}</b><br>
                Type: ${resource.type}<br>
                Distance: ${dist} km<br>
                ${resource.verified ? "✔ Verified<br>" : ""}
                <button onclick="navigate(${resource.lat}, ${resource.lon})">
                    Navigate
                </button>
            `);

            markers.push(marker);

            // List
            let li = document.createElement("li");
            li.innerText = `${resource.name} (${dist} km)`;
            list.appendChild(li);
        });
    }

    // Filters
    let checkboxes = document.querySelectorAll("input[type=checkbox]");

    function getFilters() {
        return Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
    }

    checkboxes.forEach(cb => {
        cb.addEventListener("change", () => render(getFilters()));
    });

    render(getFilters());

    // 🔄 Real-time simulation
    setInterval(() => {
        data.forEach(d => d.available = Math.random() > 0.3);
        render(getFilters());
    }, 5000);
})
.catch(error => console.error(error));

// 🧭 Google Maps Navigation
function navigate(lat, lon) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`);
}