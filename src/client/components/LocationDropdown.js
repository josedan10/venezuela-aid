import React, { useState, useEffect } from 'react';

// Predefined list of Venezuelan States, Sectors and mock coordinates
const VENEZUELA_LOCATIONS = {
  'Distrito Capital': [
    { name: 'Catia', lat: 10.5186, lng: -66.9503 },
    { name: 'El Valle', lat: 10.4578, lng: -66.9069 },
    { name: 'Caricuao', lat: 10.4312, lng: -66.9744 },
    { name: 'La Candelaria', lat: 10.5058, lng: -66.9031 },
    { name: '23 de Enero', lat: 10.5142, lng: -66.9328 },
    { name: 'San Bernardino', lat: 10.5161, lng: -66.8997 }
  ],
  'Miranda': [
    { name: 'Chacao', lat: 10.4906, lng: -66.8525 },
    { name: 'Baruta', lat: 10.4344, lng: -66.8778 },
    { name: 'El Hatillo', lat: 10.4283, lng: -66.8242 },
    { name: 'Petare', lat: 10.4800, lng: -66.8000 },
    { name: 'Los Teques', lat: 10.3475, lng: -67.0436 },
    { name: 'Guarenas', lat: 10.4631, lng: -66.6169 }
  ],
  'Zulia': [
    { name: 'Maracaibo', lat: 10.6427, lng: -71.6125 },
    { name: 'San Francisco', lat: 10.5750, lng: -71.6444 },
    { name: 'Cabimas', lat: 10.3953, lng: -71.4392 },
    { name: 'Ciudad Ojeda', lat: 10.2228, lng: -71.3094 }
  ],
  'Lara': [
    { name: 'Barquisimeto', lat: 10.0678, lng: -69.3475 },
    { name: 'Cabudare', lat: 10.0333, lng: -69.2667 },
    { name: 'Carora', lat: 10.1758, lng: -70.0764 }
  ],
  'Carabobo': [
    { name: 'Valencia', lat: 10.1622, lng: -68.0078 },
    { name: 'Naguanagua', lat: 10.2522, lng: -68.0122 },
    { name: 'San Diego', lat: 10.2567, lng: -67.9392 },
    { name: 'Puerto Cabello', lat: 10.4731, lng: -68.0125 }
  ],
  'Aragua': [
    { name: 'Maracay', lat: 10.2442, lng: -67.5919 },
    { name: 'Turmero', lat: 10.2247, lng: -67.4725 },
    { name: 'La Victoria', lat: 10.2242, lng: -67.3325 }
  ],
  'Táchira': [
    { name: 'San Cristóbal', lat: 7.7669, lng: -72.2250 },
    { name: 'Táriba', lat: 7.8203, lng: -72.2222 },
    { name: 'Rubio', lat: 7.7025, lng: -72.3556 }
  ]
};

export default function LocationDropdown({ onChange, error = null }) {
  const [selectedState, setSelectedState] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [sectors, setSectors] = useState([]);

  // When selected state changes, update sectors list and reset selected sector
  const handleStateChange = (e) => {
    const stateName = e.target.value;
    setSelectedState(stateName);
    setSelectedSector('');
    if (stateName && VENEZUELA_LOCATIONS[stateName]) {
      setSectors(VENEZUELA_LOCATIONS[stateName]);
    } else {
      setSectors([]);
    }
  };

  // When selected sector changes, emit changes to the parent
  const handleSectorChange = (e) => {
    const sectorName = e.target.value;
    setSelectedSector(sectorName);

    if (selectedState && sectorName) {
      const sectorObj = VENEZUELA_LOCATIONS[selectedState].find(s => s.name === sectorName);
      onChange({
        state: selectedState,
        sector: sectorName,
        latitude: sectorObj ? sectorObj.lat : null,
        longitude: sectorObj ? sectorObj.lng : null
      });
    } else {
      onChange({
        state: selectedState,
        sector: '',
        latitude: null,
        longitude: null
      });
    }
  };

  return (
    <div className="location-dropdown-container">
      <div className="input-group">
        <label htmlFor="state-select">Estado *</label>
        <select
          id="state-select"
          value={selectedState}
          onChange={handleStateChange}
          className={error && !selectedState ? 'input-error' : ''}
        >
          <option value="">Seleccione Estado</option>
          {Object.keys(VENEZUELA_LOCATIONS).map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>

      <div className="input-group">
        <label htmlFor="sector-select">Sector / Municipio *</label>
        <select
          id="sector-select"
          value={selectedSector}
          onChange={handleSectorChange}
          disabled={!selectedState}
          className={error && !selectedSector ? 'input-error' : ''}
        >
          <option value="">Seleccione Sector</option>
          {sectors.map((sector) => (
            <option key={sector.name} value={sector.name}>
              {sector.name}
            </option>
          ))}
        </select>
      </div>

      {error && <span className="error-message">{error}</span>}

      <style jsx>{`
        .location-dropdown-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 8px;
        }
        @media (max-width: 480px) {
          .location-dropdown-container {
            grid-template-columns: 1fr;
            gap: 8px;
          }
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        label {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary);
        }
        select {
          padding: 12px 14px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: var(--bg-card);
          color: var(--text-primary);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        select:focus {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px var(--primary-glow);
        }
        select:disabled {
          background-color: var(--bg-disabled);
          color: var(--text-disabled);
          cursor: not-allowed;
          border-color: var(--border-disabled);
        }
        .input-error {
          border-color: var(--error-color) !important;
        }
        .error-message {
          grid-column: 1 / -1;
          color: var(--error-color);
          font-size: 12px;
          margin-top: -4px;
        }
      `}</style>
    </div>
  );
}
