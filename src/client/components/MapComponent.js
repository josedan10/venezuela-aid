import React, { useEffect, useRef } from 'react';

export default function MapComponent({ needs, collectionCenters, driverLocation, userGeolocation, teamMembers, currentUser, activeTask, onMapClick, mapStyle, onPointClick }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const polylineRef = useRef(null);
  const tileLayerRef = useRef(null);
  const initialZoomDoneRef = useRef(false);
  const prevActiveTaskIdRef = useRef(null);
  const currentMapStyleRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let L;

    const initMap = async () => {
      if (!mapContainerRef.current) return;

      // Dynamic import to prevent Node.js SSR compile errors
      L = (await import('leaflet')).default;

      if (!isMounted) return;

      // Initialize Map instance if it doesn't exist
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapContainerRef.current, {
          zoomControl: false, // Custom zoom control position
        }).setView([10.5186, -66.9503], 12);

        // Add custom zoom control at the bottom right
        L.control.zoom({
          position: 'bottomright'
        }).addTo(mapInstanceRef.current);

        markersGroupRef.current = L.layerGroup().addTo(mapInstanceRef.current);
      }

      const map = mapInstanceRef.current;

      // Update tile layer based on mapStyle prop dynamically (only if style changed)
      if (tileLayerRef.current && currentMapStyleRef.current !== mapStyle) {
        tileLayerRef.current.remove();
        tileLayerRef.current = null;
      }

      if (!tileLayerRef.current) {
        let url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'; // Default light
        let attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

        if (mapStyle === 'dark') {
          url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
        } else if (mapStyle === 'classic') {
          url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
        } else if (mapStyle === 'satellite') {
          url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
          attribution = 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';
        }

        tileLayerRef.current = L.tileLayer(url, {
          attribution,
          maxZoom: 20,
          subdomains: mapStyle === 'satellite' ? [] : 'abcd',
        }).addTo(map);

        currentMapStyleRef.current = mapStyle;
      }

      const markersGroup = markersGroupRef.current;

      // Clear existing layers
      markersGroup.clearLayers();
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }

      // Cleanup previous click listeners to prevent duplicates
      map.off('click');

      // Bind map click listener if onMapClick callback is provided
      if (onMapClick) {
        map.on('click', (e) => {
          onMapClick(e.latlng.lat, e.latlng.lng);
        });
      }

      const bounds = [];

      // Custom premium HTML divIcons with sleek glowing animations
      const redIcon = L.divIcon({
        className: 'custom-marker-red',
        html: `
          <div class="glow-marker red">
            <div class="pulse-ring"></div>
            <div class="marker-core"></div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15],
      });

      const blueIcon = L.divIcon({
        className: 'custom-marker-blue',
        html: `
          <div class="glow-marker blue">
            <div class="pulse-ring"></div>
            <div class="marker-core"></div>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13],
      });

      const centerIcon = L.divIcon({
        className: 'custom-marker-center',
        html: `
          <div class="glow-marker orange">
            <div class="pulse-ring"></div>
            <div class="marker-core">🏠</div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -17],
      });

      const driverIcon = L.divIcon({
        className: 'custom-marker-driver',
        html: `
          <div class="glow-marker green">
            <div class="pulse-ring-fast"></div>
            <div class="marker-core">🚚</div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        popupAnchor: [0, -19],
      });

      const destIcon = L.divIcon({
        className: 'custom-marker-dest',
        html: `
          <div class="glow-marker rose">
            <div class="pulse-ring"></div>
            <div class="marker-core">📍</div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });

      const userGeoIcon = L.divIcon({
        className: 'custom-marker-user-geo',
        html: `
          <div class="glow-marker cyan animate-pulse">
            <div class="pulse-ring"></div>
            <div class="marker-core">👤</div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -17],
      });

      // Render all provided needs
      if (needs && needs.length > 0) {
        needs.forEach((need) => {
          if (need.latitude && need.longitude) {
            const lat = parseFloat(need.latitude);
            const lng = parseFloat(need.longitude);
            const isHigh = need.urgencyScore >= 80;
            const markerIcon = isHigh ? redIcon : blueIcon;

            const marker = L.marker([lat, lng], { icon: markerIcon });

            // Popup detail card in Spanish
            const popupContent = `
              <div class="map-popup-card">
                <h4 class="popup-title">${need.state} - ${need.sector}</h4>
                <p class="popup-desc">${need.description}</p>
                <div class="popup-urgency ${isHigh ? 'urgency-high' : 'urgency-normal'}">
                  ${isHigh ? '🚨 ATENCIÓN INMEDIATA' : `Prioridad: ${need.urgencyScore}`}
                </div>
                <div class="popup-status">
                  <strong>Estado:</strong> ${
                    need.status === 'PENDING'
                      ? 'Abierta/Pendiente'
                      : need.status === 'ALLOCATED'
                      ? 'Asignada / En Ruta'
                      : 'Entregado'
                  }
                </div>
              </div>
            `;

            marker.bindPopup(popupContent);
            marker.on('click', () => {
              if (onPointClick) {
                onPointClick({ type: 'need', data: need });
              }
            });
            marker.addTo(markersGroup);
            bounds.push([lat, lng]);
          }
        });
      }

      // Render collection centers (Centros de Acopio) if present
      if (collectionCenters && collectionCenters.length > 0) {
        collectionCenters.forEach((center) => {
          if (center.latitude && center.longitude) {
            const lat = parseFloat(center.latitude);
            const lng = parseFloat(center.longitude);

            const marker = L.marker([lat, lng], { icon: centerIcon });

            const popupContent = `
              <div class="map-popup-card">
                <h4 class="popup-title">Centro de Acopio: ${center.name}</h4>
                <p class="popup-desc">${center.description}</p>
                <div class="popup-services"><strong>Servicios:</strong> ${center.services}</div>
                ${center.address ? `<div class="popup-address"><strong>Dirección:</strong> ${center.address}</div>` : ''}
              </div>
            `;

            marker.bindPopup(popupContent);
            marker.on('click', () => {
              if (onPointClick) {
                onPointClick({ type: 'center', data: center });
              }
            });
            marker.addTo(markersGroup);
            bounds.push([lat, lng]);
          }
        });
      }

      // Render user current location if present
      if (userGeolocation && userGeolocation.lat && userGeolocation.lng) {
        const uLat = parseFloat(userGeolocation.lat);
        const uLng = parseFloat(userGeolocation.lng);
        const userMarker = L.marker([uLat, uLng], { icon: userGeoIcon });
        userMarker.bindPopup(`
          <div class="map-popup-card">
            <h4 class="popup-title">Mi Ubicación Actual</h4>
            <p class="popup-desc">Ubicación física reportada por tu dispositivo.</p>
            <p class="popup-status">Lat: ${uLat.toFixed(5)}, Lng: ${uLng.toFixed(5)}</p>
          </div>
        `);
        userMarker.addTo(markersGroup);
        bounds.push([uLat, uLng]);
      }

      // Render other team members on the map
      if (teamMembers && teamMembers.length > 0) {
        teamMembers.forEach((member) => {
          // Avoid duplicate marker if it's the current user themselves
          if (currentUser && member.id === currentUser.id) return;

          if (member.shareLocationWithTeam && member.location) {
            const mLat = parseFloat(member.location.latitude);
            const mLng = parseFloat(member.location.longitude);

            const memberIcon = L.divIcon({
              className: 'custom-marker-team-member',
              html: `
                <div class="glow-marker cyan">
                  <div class="pulse-ring"></div>
                  <div class="marker-core">${member.name.substring(0, 2).toUpperCase()}</div>
                </div>
              `,
              iconSize: [34, 34],
              iconAnchor: [17, 17],
              popupAnchor: [0, -17],
            });

            const marker = L.marker([mLat, mLng], { icon: memberIcon });
            marker.bindPopup(`
              <div class="map-popup-card">
                <h4 class="popup-title">Equipo: ${member.name}</h4>
                <p class="popup-desc">Rol(es): ${member.roles}</p>
                <p class="popup-status">Lat: ${mLat.toFixed(5)}, Lng: ${mLng.toFixed(5)}</p>
                <p class="popup-status">Compartiendo ubicación en tiempo real.</p>
              </div>
            `);
            marker.addTo(markersGroup);
            bounds.push([mLat, mLng]);
          }
        });
      }

      // Render driver current location if present
      let driverLatLng = null;
      if (driverLocation && driverLocation.lat && driverLocation.lng) {
        const driverLatVal = parseFloat(driverLocation.lat);
        const driverLngVal = parseFloat(driverLocation.lng);
        driverLatLng = [driverLatVal, driverLngVal];

        const driverMarker = L.marker(driverLatLng, { icon: driverIcon });
        driverMarker.bindPopup(`
          <div class="map-popup-card">
            <h4 class="popup-title">Mi Ubicación (Conductor)</h4>
            <p class="popup-desc">Transmitiendo coordenadas GPS en tiempo real...</p>
            <p class="popup-status">Lat: ${driverLatVal.toFixed(5)}, Lng: ${driverLngVal.toFixed(5)}</p>
          </div>
        `);
        driverMarker.addTo(markersGroup);
        bounds.push(driverLatLng);
      }

      // If there is an activeTask route, draw a polyline to destination
      if (activeTask && driverLatLng) {
        const need = activeTask.need;
        if (need && need.latitude && need.longitude) {
          const destLat = parseFloat(need.latitude);
          const destLng = parseFloat(need.longitude);
          const destLatLng = [destLat, destLng];

          // Draw dotted transit polyline with glowing blue stroke
          polylineRef.current = L.polyline([driverLatLng, destLatLng], {
            color: '#3b82f6', // Brand primary blue
            weight: 5,
            opacity: 0.9,
            dashArray: '10, 10',
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(map);

          // Render active destination marker
          const destMarker = L.marker(destLatLng, { icon: destIcon });
          destMarker.bindPopup(`
            <div class="map-popup-card">
              <h4 class="popup-title">Destino de la Ruta</h4>
              <p class="popup-desc">${need.state} - ${need.sector}</p>
              <p class="popup-desc">${need.description}</p>
              <div class="popup-urgency urgency-high">📍 Punto de Entrega</div>
            </div>
          `);
          destMarker.addTo(markersGroup);
          bounds.push(destLatLng);
        }
      }

      // Perform initial zoom centering only once to allow users to zoom/pan manually without override
      if (!initialZoomDoneRef.current && bounds.length > 0) {
        map.fitBounds(bounds, { padding: [100, 100], maxZoom: 14 });
        initialZoomDoneRef.current = true;
      } else if (!initialZoomDoneRef.current && needs.length === 0 && collectionCenters.length === 0) {
        map.setView([10.5186, -66.9503], 12);
      }

      // Focus on active task route ONCE when task is initiated
      if (activeTask && activeTask.id !== prevActiveTaskIdRef.current && driverLatLng) {
        const need = activeTask.need;
        if (need && need.latitude && need.longitude) {
          const destLatLng = [parseFloat(need.latitude), parseFloat(need.longitude)];
          map.fitBounds([driverLatLng, destLatLng], { padding: [80, 80] });
          prevActiveTaskIdRef.current = activeTask.id;
        }
      } else if (!activeTask) {
        prevActiveTaskIdRef.current = null;
      }
    };

    initMap();

    return () => {
      isMounted = false;
    };
  }, [needs, collectionCenters, driverLocation, userGeolocation, teamMembers, currentUser, activeTask, onMapClick, mapStyle, onPointClick]);

  // Handle lifecycle unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="map-wrapper">
      {onMapClick && (
        <div className="map-instruction-banner">
          🗺️ Haz clic en cualquier lugar del mapa para registrar un nuevo Centro de Acopio.
        </div>
      )}
      <div ref={mapContainerRef} className="leaflet-map-container" />

      <style jsx global>{`
        .map-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          padding: 0;
          margin: 0;
          z-index: 1;
          overflow: hidden;
        }

        .map-instruction-banner {
          position: absolute;
          top: 100px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(249, 115, 22, 0.95);
          border: 1px solid rgba(249, 115, 22, 0.4);
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          padding: 10px 20px;
          border-radius: 30px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          z-index: 999;
          text-align: center;
          pointer-events: none;
          animation: slideDownIn 0.4s ease-out;
        }

        @keyframes slideDownIn {
          from { top: -50px; opacity: 0; }
          to { top: 100px; opacity: 1; }
        }

        .leaflet-map-container {
          width: 100%;
          height: 100%;
          z-index: 1;
          background: #0b0f19;
        }

        /* Glowing Custom Markers */
        .glow-marker {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .marker-core {
          width: 60%;
          height: 60%;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: bold;
          z-index: 2;
          color: #fff;
        }

        .pulse-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          animation: marker-ripple 2s infinite ease-out;
          z-index: 1;
        }

        .pulse-ring-fast {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          animation: marker-ripple 1.2s infinite ease-out;
          z-index: 1;
        }

        /* Red Marker styling */
        .glow-marker.red .marker-core {
          background: #ef4444;
          border-color: #fca5a5;
        }
        .glow-marker.red .pulse-ring {
          background: rgba(239, 68, 68, 0.4);
        }

        /* Blue Marker styling */
        .glow-marker.blue .marker-core {
          background: #3b82f6;
          border-color: #93c5fd;
        }
        .glow-marker.blue .pulse-ring {
          background: rgba(59, 130, 246, 0.4);
        }

        /* Orange Marker styling */
        .glow-marker.orange .marker-core {
          background: #f97316;
          border-color: #fed7aa;
          font-size: 13px;
        }
        .glow-marker.orange .pulse-ring {
          background: rgba(249, 115, 22, 0.4);
        }

        /* Green Marker styling */
        .glow-marker.green .marker-core {
          background: #10b981;
          border-color: #a7f3d0;
          font-size: 15px;
        }
        .glow-marker.green .pulse-ring-fast {
          background: rgba(16, 185, 129, 0.45);
        }

        /* Rose Destination Marker styling */
        .glow-marker.rose .marker-core {
          background: #ec4899;
          border-color: #fbcfe8;
          font-size: 14px;
        }
        .glow-marker.rose .pulse-ring {
          background: rgba(236, 72, 153, 0.4);
        }

        /* Cyan User Geolocation Marker styling */
        .glow-marker.cyan .marker-core {
          background: #06b6d4;
          border-color: #a5f3fc;
          font-size: 11px;
          color: #ffffff;
        }
        .glow-marker.cyan .pulse-ring {
          background: rgba(6, 182, 212, 0.4);
        }

        @keyframes marker-ripple {
          0% {
            transform: scale(0.4);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }

        /* Leaflet Popups Styling */
        .leaflet-popup-content-wrapper {
          background: rgba(15, 23, 42, 0.95) !important;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          color: #f8fafc !important;
          border-radius: 16px !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5) !important;
          padding: 6px !important;
        }

        .leaflet-popup-tip {
          background: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
        }

        .map-popup-card {
          font-family: 'Outfit', sans-serif;
          min-width: 220px;
          max-width: 300px;
        }

        .popup-title {
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 6px;
          color: #f8fafc;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 6px;
        }

        .popup-desc {
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 10px;
          line-height: 1.4;
        }

        .popup-urgency {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 12px;
          margin-bottom: 8px;
        }

        .urgency-high {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .urgency-normal {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .popup-status {
          font-size: 11px;
          color: #cbd5e1;
        }

        .popup-services, .popup-address {
          font-size: 11px;
          color: #cbd5e1;
          margin-bottom: 4px;
        }

        .leaflet-container a.leaflet-popup-close-button {
          color: #94a3b8 !important;
          padding: 8px 8px 0 0 !important;
        }

        .leaflet-container a.leaflet-popup-close-button:hover {
          color: #f8fafc !important;
        }
      `}</style>
    </div>
  );
}
