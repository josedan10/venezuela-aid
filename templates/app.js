// app.js - Venezuela Reporta Google Maps Interactivity and Logic

// 1. Data Store for Interactive Map Points (Caracas coordinates)
const mapPoints = {
    lumiere: {
        title: "Acopio - Lumière",
        verified: false,
        location: "Ubicación compartida en Venezuela Reporta",
        category1: "Centro de acopio",
        category1Icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
        category2: "Recibe donaciones",
        category2Icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`,
        openStatus: "Abierto",
        needs: "agua, higiene, alimentos, medicinas, pañales, ropa",
        schedule: "9am - 5pm, Lunes-Viernes",
        contact: "Maria R.",
        capacity: "Capacidad: Mediana",
        coords: { lat: 10.4910, lng: -66.8835 }
    },
    farmacia: {
        title: "Farmacia La Paz",
        verified: true,
        location: "Av. Miranda con Calle Carabobo, Local 4",
        category1: "Medicinas",
        category1Icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
        category2: "Atención Médica",
        category2Icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
        openStatus: "Abierto",
        needs: "antibióticos, analgésicos, gasas, vendas, alcohol, mascarillas",
        schedule: "8am - 8pm, Lunes-Sábado",
        contact: "Dr. Carlos M.",
        capacity: "Capacidad: Alta",
        coords: { lat: 10.4981, lng: -66.8922 }
    },
    comedor: {
        title: "Comedor Esperanza",
        verified: true,
        location: "Sector La Lucha, Calle Principal frente a la Iglesia",
        category1: "Alimentos",
        category1Icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8M8 12h8"/></svg>`,
        category2: "Cocina Comunitaria",
        category2Icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
        openStatus: "Abierto",
        needs: "arroz, granos, aceite, harina de maíz, verduras, proteínas",
        schedule: "11:30am - 2pm, Lunes-Viernes",
        contact: "Sra. Elena G.",
        capacity: "Capacidad: Alta",
        coords: { lat: 10.4855, lng: -66.8778 }
    },
    cruzroja: {
        title: "Cruz Roja Local",
        verified: true,
        location: "Av. Bolívar, Sede Principal Cruz Roja",
        category1: "Primeros Auxilios",
        category1Icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
        category2: "Punto de Socorro",
        category2Icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`,
        openStatus: "Abierto 24h",
        needs: "insumos quirúrgicos, camillas, sueros, mantas térmicas, analgésicos",
        schedule: "24 Horas, Todos los días",
        contact: "Central Operaciones",
        capacity: "Capacidad: Muy Alta",
        coords: { lat: 10.4782, lng: -66.8899 }
    },
    oeste: {
        title: "Centro Donaciones Oeste",
        verified: true,
        location: "Urbanización El Parque, Galpón B-12",
        category1: "Ropa y Calzado",
        category1Icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
        category2: "Centro de acopio",
        category2Icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
        openStatus: "Abierto",
        needs: "ropa de niños, zapatos deportivos, sábanas, cobijas, toallas",
        schedule: "9am - 4pm, Lunes-Viernes",
        contact: "Juan Carlos P.",
        capacity: "Capacidad: Mediana",
        coords: { lat: 10.4933, lng: -66.9044 }
    },
    norte: {
        title: "Acopio Norte",
        verified: true,
        location: "Av. Intercomunal Norte, Entrada de la Urb. Las Flores",
        category1: "Agua y Alimentos",
        category1Icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8M8 12h8"/></svg>`,
        category2: "Distribución",
        category2Icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
        openStatus: "Abierto",
        needs: "agua potable embotellada, enlatados, leche en polvo, avena",
        schedule: "8am - 3pm, Lunes-Viernes",
        contact: "Sonia L.",
        capacity: "Capacidad: Mediana",
        coords: { lat: 10.5098, lng: -66.8812 }
    },
    refugio: {
        title: "Refugio Libertad",
        verified: true,
        location: "Polideportivo Municipal, Sector Las Acacias",
        category1: "Alojamiento",
        category1Icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
        category2: "Refugio Temporal",
        category2Icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
        openStatus: "Abierto",
        needs: "colchonetas, almohadas, artículos de higiene personal, agua potable",
        schedule: "Ingreso: 6pm - 8pm, Salida: 7am",
        contact: "Prof. Miguel A.",
        capacity: "Capacidad: Limitada",
        coords: { lat: 10.4891, lng: -66.8999 }
    }
};

// 2. DOM Elements
const compassWidget = document.getElementById('compass-widget');
const needle = document.querySelector('.compass-needle');
const searchInput = document.getElementById('map-search');
const moreDetailsSheet = document.getElementById('more-details-sheet');
const sheetGrabHandle = document.querySelector('.sheet-grab-handle');

// Card elements
const cardTitle = document.getElementById('card-title');
const cardVerification = document.getElementById('card-verification-status');
const cardLocation = document.querySelector('.location-text');
const tagCategory1 = document.getElementById('tag-category-1');
const tagCategory2 = document.getElementById('tag-category-2');
const cardOpenStatus = document.getElementById('card-open-status');
const cardNeeds = document.getElementById('needs-list');

// Detail sheet elements
const detailSchedule = document.getElementById('detail-schedule');
const detailContact = document.getElementById('detail-contact');
const detailCapacity = document.getElementById('detail-capacity');

// 3. Google Maps Initialization Variables
let map;
let markers = {};
let activePointId = 'lumiere';

// Custom Map Stylings (Gold roads on blue background to match reference images)
const customMapStyle = [
    {
        "featureType": "all",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#1e3a8a" }]
    },
    {
        "featureType": "all",
        "elementType": "labels.text.stroke",
        "stylers": [{ "color": "#ffffff" }, { "weight": 2.5 }]
    },
    {
        "featureType": "administrative",
        "elementType": "labels",
        "stylers": [{ "visibility": "simplified" }]
    },
    {
        "featureType": "landscape",
        "elementType": "geometry",
        "stylers": [{ "color": "#80c4e9" }] // Sky blue land
    },
    {
        "featureType": "poi",
        "elementType": "all",
        "stylers": [{ "visibility": "off" }] // Hide POIs to keep map schematic
    },
    {
        "featureType": "road",
        "elementType": "geometry.fill",
        "stylers": [{ "color": "#ffe4a0" }] // Gold fill roads
    },
    {
        "featureType": "road",
        "elementType": "geometry.stroke",
        "stylers": [{ "color": "#d97706" }, { "weight": 1.2 }] // Gold border roads
    },
    {
        "featureType": "road.highway",
        "elementType": "geometry.fill",
        "stylers": [{ "color": "#f59e0b" }] // Darker gold highway fill
    },
    {
        "featureType": "road.highway",
        "elementType": "geometry.stroke",
        "stylers": [{ "color": "#b45309" }, { "weight": 1.8 }]
    },
    {
        "featureType": "transit",
        "elementType": "all",
        "stylers": [{ "visibility": "off" }]
    },
    {
        "featureType": "water",
        "elementType": "geometry",
        "stylers": [{ "color": "#5bb0df" }] // Slightly darker water
    }
];

// Inline Vector SVG Pin Markers
const markerIcons = {
    // Blue Pin with White Checkmark
    verified: {
        path: "M20 2C11 2 4 9 4 18c0 12 16 20 16 20s16-8 16-20C36 9 29 2 20 2zm0 24c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z",
        fillColor: "#1e3a8a",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        scale: 0.9,
        anchor: { x: 20, y: 38 }
    },
    // Unverified/Lumiere Pin (Gold theme)
    unverified: {
        path: "M20 2C11 2 4 9 4 18c0 12 16 20 16 20s16-8 16-20C36 9 29 2 20 2zm0 24c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z",
        fillColor: "#f59e0b",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        scale: 0.9,
        anchor: { x: 20, y: 38 }
    },
    // Large Pulse Pin for Selected Active Point
    active: {
        path: "M20 2C11 2 4 9 4 18c0 12 16 20 16 20s16-8 16-20C36 9 29 2 20 2zm0 24c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z",
        fillColor: "#10b981", // Pulse Active green
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2.5,
        scale: 1.1, // Larger scale
        anchor: { x: 20, y: 38 }
    }
};

// 4. Initialize Google Map API callback
window.initMap = function() {
    // Map initial center and options
    const mainCoords = mapPoints[activePointId].coords;
    
    map = new google.maps.Map(document.getElementById('map'), {
        center: mainCoords,
        zoom: 14.5,
        styles: customMapStyle,
        disableDefaultUI: true, // Hide zoom, pegman, satellite selectors
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
    });
    
    // Create markers for all points
    for (const [id, data] of Object.entries(mapPoints)) {
        let iconType = data.verified ? markerIcons.verified : markerIcons.unverified;
        
        // Active point gets distinct sizing
        if (id === activePointId) {
            iconType = markerIcons.active;
        }
        
        const marker = new google.maps.Marker({
            position: data.coords,
            map: map,
            title: data.title,
            icon: iconType,
            optimized: false // Prevents pixelation of vectors
        });
        
        // Store marker reference
        markers[id] = marker;
        
        // Add click listener
        marker.addListener('click', () => {
            selectPin(id);
            
            // On mobile, slide down bottom details to peek state
            if (window.innerWidth <= 768) {
                moreDetailsSheet.classList.remove('expanded');
            }
        });
    }
    
    // Setup compass needle micro-rotation based on map movement direction
    map.addListener('center_changed', () => {
        const center = map.getCenter();
        const lat = center.lat();
        const lng = center.lng();
        // Compute temporary swing based on coordinate digits
        const angle = ((lat * 1000) + (lng * 1000)) % 15;
        needle.style.transform = `rotate(${35 + angle}deg)`;
    });

    map.addListener('idle', () => {
        // Return needle back to north after stabilizing
        setTimeout(() => {
            needle.style.transform = 'rotate(35deg)';
        }, 500);
    });
};

// 5. Select Marker Pin Logic
function selectPin(pinId) {
    const data = mapPoints[pinId];
    if (!data) return;
    
    const prevActiveId = activePointId;
    activePointId = pinId;
    
    // Restore previous active marker style
    if (prevActiveId && markers[prevActiveId]) {
        const prevData = mapPoints[prevActiveId];
        markers[prevActiveId].setIcon(prevData.verified ? markerIcons.verified : markerIcons.unverified);
    }
    
    // Set clicked marker to active style
    if (markers[pinId]) {
        markers[pinId].setIcon(markerIcons.active);
    }
    
    // Smoothly pan map to new coordinates
    if (map) {
        map.panTo(data.coords);
    }
    
    // Update Details Card Elements
    cardTitle.innerText = data.title;
    cardLocation.innerText = data.location;
    cardNeeds.innerText = data.needs;
    
    // Update verification tag
    if (data.verified) {
        cardVerification.innerText = "VERIFICADO";
        cardVerification.className = "status-tag verified-badge";
    } else {
        cardVerification.innerText = "SIN VERIFICAR";
        cardVerification.className = "status-tag unverified";
    }
    
    // Update categories
    tagCategory1.innerHTML = `${data.category1Icon} <span class="badge-text">${data.category1}</span>`;
    tagCategory2.innerHTML = `${data.category2Icon} <span class="badge-text">${data.category2}</span>`;
    
    // Update open status
    cardOpenStatus.querySelector('.badge-text').innerText = data.openStatus;
    
    // Update Details Sheet Elements
    detailSchedule.innerText = data.schedule;
    detailContact.innerText = data.contact;
    detailCapacity.innerText = data.capacity;
    
    // Visual update card glow animation trigger
    const detailCard = document.getElementById('detail-card');
    detailCard.style.animation = 'none';
    void detailCard.offsetWidth; // trigger reflow
    detailCard.style.animation = 'fadeInScale 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
}

// 6. Mobile Bottom Sheet Slide Up Drawer Interaction
function toggleMobileDrawer() {
    if (window.innerWidth <= 768) {
        moreDetailsSheet.classList.toggle('expanded');
    }
}

sheetGrabHandle.addEventListener('click', toggleMobileDrawer);
document.querySelector('.sheet-title').addEventListener('click', toggleMobileDrawer);

// Swipe gesture handlers
let touchStartY = 0;
let touchEndY = 0;

moreDetailsSheet.addEventListener('touchstart', (e) => {
    touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

moreDetailsSheet.addEventListener('touchend', (e) => {
    touchEndY = e.changedTouches[0].screenY;
    handleSwipeGesture();
}, { passive: true });

function handleSwipeGesture() {
    // Swipe Up
    if (touchStartY - touchEndY > 50) {
        moreDetailsSheet.classList.add('expanded');
    }
    // Swipe Down
    if (touchEndY - touchStartY > 50) {
        moreDetailsSheet.classList.remove('expanded');
    }
}

// 7. Search Bar Simulator
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value.toLowerCase().trim();
        if (!query) return;
        
        let foundKey = null;
        for (const [key, value] of Object.entries(mapPoints)) {
            if (value.title.toLowerCase().includes(query) || 
                value.needs.toLowerCase().includes(query) || 
                value.category1.toLowerCase().includes(query) || 
                value.category2.toLowerCase().includes(query)) {
                foundKey = key;
                break;
            }
        }
        
        if (foundKey) {
            selectPin(foundKey);
            searchInput.blur();
        } else {
            // Flash input box border indicating no matches
            searchInput.style.borderColor = '#ef4444';
            searchInput.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.1)';
            setTimeout(() => {
                searchInput.style.borderColor = '';
                searchInput.style.boxShadow = '';
            }, 1000);
        }
    }
});

// Re-center active pin on window resize
window.addEventListener('resize', () => {
    if (map && activePointId && mapPoints[activePointId]) {
        map.setCenter(mapPoints[activePointId].coords);
    }
});

// Add Point Floating Action Click Feedback
document.querySelectorAll('.btn-add-point, .btn-add-point-float').forEach(btn => {
    btn.addEventListener('click', () => {
        alert("¡Función de simulación!: Formulario para añadir un nuevo punto de acopio y ayuda en Venezuela Reporta.");
    });
});
