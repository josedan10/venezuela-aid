import React, { useState, useEffect } from 'react';
import LocationDropdown from './LocationDropdown';

export default function NeedSubmissionForm({ token, onNeedSubmitted }) {
  const [description, setDescription] = useState('');
  const [urgencyRating, setUrgencyRating] = useState(3); // 1 to 5
  const [state, setState] = useState('');
  const [sector, setSector] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  
  // Available resource list to choose from
  const [resources, setResources] = useState([]);
  // Selected items in the need: { resourceId, quantity }
  const [selectedItems, setSelectedItems] = useState([{ resourceId: '', quantity: 1 }]);
  
  const [gpsAttempted, setGpsAttempted] = useState(false);
  const [gpsError, setGpsError] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [gpsDialogMessage, setGpsDialogMessage] = useState('');

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState('');
  const [serverError, setServerError] = useState('');

  // Fetch available resources when mounting
  useEffect(() => {
    async function fetchResources() {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/resources`);
        if (response.ok) {
          const data = await response.json();
          setResources(data);
        }
      } catch (err) {
        console.error('Error fetching resources:', err);
      }
    }
    fetchResources();
    
    // Automatically try to acquire GPS coordinates when mounting
    detectGPS();
  }, []);

  const detectGPS = () => {
    setGpsAttempted(true);
    setGpsError(false);
    setGpsSuccess(false);
    setGpsDialogMessage('');

    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setGpsSuccess(true);
          // Set some default state/sector based on coordinates if desired, 
          // but we still let them refine it.
        },
        (error) => {
          console.warn('GPS coordinates acquisition failed:', error);
          setGpsError(true);
          setGpsDialogMessage('No pudimos obtener su ubicación. Por favor, seleccione su estado y sector manualmente.');
          setLatitude(null);
          setLongitude(null);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setGpsError(true);
      setGpsDialogMessage('Geolocalización no soportada por el navegador. Seleccione su ubicación manualmente.');
    }
  };

  const handleLocationChange = (location) => {
    setState(location.state);
    setSector(location.sector);
    // If native GPS coordinates are disabled, fallback to manual selection's coordinates
    if (gpsError) {
      setLatitude(location.latitude);
      setLongitude(location.longitude);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...selectedItems];
    if (field === 'quantity') {
      updated[index][field] = parseInt(value, 10) || 0;
    } else {
      updated[index][field] = value;
    }
    setSelectedItems(updated);
  };

  const addItemRow = () => {
    setSelectedItems([...selectedItems, { resourceId: '', quantity: 1 }]);
  };

  const removeItemRow = (index) => {
    if (selectedItems.length > 1) {
      const updated = selectedItems.filter((_, idx) => idx !== index);
      setSelectedItems(updated);
    }
  };

  const validate = () => {
    const tempErrors = {};
    if (!description.trim()) tempErrors.description = 'La descripción es obligatoria.';
    if (!state) tempErrors.state = 'El estado es obligatorio.';
    if (!sector) tempErrors.sector = 'El sector es obligatorio.';

    // Check items
    const validItems = selectedItems.filter(item => item.resourceId && item.quantity > 0);
    if (validItems.length === 0) {
      tempErrors.items = 'Debe agregar al menos un ítem válido con cantidad mayor a 0.';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerMessage('');
    setServerError('');

    if (!validate()) return;

    setLoading(true);

    try {
      const validItems = selectedItems.filter(item => item.resourceId && item.quantity > 0);
      
      // Get NGO ID from token or parse JWT. For simplicity, we can pass NGO ID in the body as expected by the NestJS controller.
      let ngoId = '';
      if (token) {
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const payload = JSON.parse(window.atob(base64));
          ngoId = payload.sub;
        } catch (jwtErr) {
          console.error('Error parsing token:', jwtErr);
        }
      }

      const payload = {
        ngoId,
        description,
        urgencyRating: parseInt(urgencyRating, 10),
        state,
        sector,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        items: validItems,
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/needs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al enviar necesidad');
      }

      // Check if it is a critical urgency need (calculated urgency score >= 80)
      if (data.urgencyScore >= 80) {
        setServerMessage('Solicitud registrada con prioridad crítica (ATENCIÓN INMEDIATA).');
      } else {
        setServerMessage(data.message || 'Solicitud registrada exitosamente.');
      }
      
      // Reset form
      setDescription('');
      setUrgencyRating(3);
      setSelectedItems([{ resourceId: '', quantity: 1 }]);
      // re-trigger GPS detection
      detectGPS();

      if (onNeedSubmitted) {
        setTimeout(() => {
          onNeedSubmitted(data);
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="need-form-card">
      <h3>Crear Solicitud de Ayuda (Necesidad)</h3>
      <p className="form-subtitle">Registre las carencias urgentes de su comunidad u organización</p>

      {gpsDialogMessage && (
        <div className="gps-alert">
          <div className="gps-alert-icon">⚠️</div>
          <div className="gps-alert-text">{gpsDialogMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="input-group">
          <label htmlFor="need-description">Descripción de la Causa / Necesidad *</label>
          <textarea
            id="need-description"
            rows="3"
            placeholder="Describa brevemente la situación y los insumos requeridos"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={errors.description ? 'input-error' : ''}
          />
          {errors.description && <span className="error-message">{errors.description}</span>}
        </div>

        <div className="input-group">
          <label>Nivel de Urgencia Declarado *</label>
          <div className="urgency-rating-bar">
            {[1, 2, 3, 4, 5].map((num) => {
              const labels = ['Bajo', 'Menor', 'Medio', 'Alto', 'Crítico'];
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setUrgencyRating(num)}
                  className={`rating-btn rating-${num} ${urgencyRating === num ? 'active' : ''}`}
                  title={labels[num - 1]}
                >
                  {num} ({labels[num - 1]})
                </button>
              );
            })}
          </div>
        </div>

        {/* Location Dropdown falls back to manual input or coordinates based on selection */}
        <LocationDropdown
          onChange={handleLocationChange}
          error={errors.state || errors.sector ? 'El estado y el sector son obligatorios.' : null}
        />

        <div className="gps-status-row">
          {gpsSuccess && (
            <span className="gps-success-msg">
              📍 Ubicación GPS obtenida: {latitude?.toFixed(4)}, {longitude?.toFixed(4)}
            </span>
          )}
          <button type="button" onClick={detectGPS} className="gps-retry-btn">
            Recargar Ubicación GPS
          </button>
        </div>

        <div className="items-section">
          <h4>Recursos Requeridos *</h4>
          {errors.items && <span className="error-message block-error">{errors.items}</span>}
          
          {selectedItems.map((item, index) => (
            <div key={index} className="item-row">
              <select
                value={item.resourceId}
                onChange={(e) => handleItemChange(index, 'resourceId', e.target.value)}
                className="resource-select"
              >
                <option value="">Seleccione Recurso</option>
                {resources.map((res) => (
                  <option key={res.id} value={res.id}>
                    {res.name} (Stock: {res.stockQuantity}) - {res.category}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                placeholder="Cant."
                value={item.quantity}
                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                className="quantity-input"
              />

              <button
                type="button"
                onClick={() => removeItemRow(index)}
                disabled={selectedItems.length <= 1}
                className="delete-item-btn"
                title="Eliminar ítem"
              >
                ✕
              </button>
            </div>
          ))}

          <button type="button" onClick={addItemRow} className="add-item-btn">
            + Agregar Otro Recurso
          </button>
        </div>

        {serverMessage && <div className="alert alert-success">{serverMessage}</div>}
        {serverError && <div className="alert alert-error">{serverError}</div>}

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Procesando...' : 'Enviar Solicitud'}
        </button>
      </form>

      <style jsx>{`
        .need-form-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
        }
        h3 {
          font-size: 20px;
          margin-bottom: 4px;
          color: var(--text-primary);
        }
        .form-subtitle {
          color: var(--text-secondary);
          font-size: 13px;
          margin-bottom: 20px;
        }
        .gps-alert {
          display: flex;
          gap: 10px;
          background-color: var(--warning-glow);
          color: var(--warning-color);
          border: 1px solid var(--warning-color);
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 20px;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.4;
          animation: slideDown 0.3s ease-out;
        }
        .gps-alert-icon {
          font-size: 16px;
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
        }
        label {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }
        textarea {
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background-color: #ffffff;
          color: #0f172a;
          font-size: 14px;
          outline: none;
          resize: vertical;
          font-family: inherit;
          transition: border-color 0.2s, box-shadow 0.2s;
          width: 100%;
        }
        textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }
        .urgency-rating-bar {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .rating-btn {
          flex: 1;
          padding: 10px 4px;
          font-size: 12px;
          font-weight: 600;
          background-color: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          color: #475569;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .rating-btn.active.rating-1 { background-color: #10b981; color: white; border-color: #10b981; }
        .rating-btn.active.rating-2 { background-color: #84cc16; color: white; border-color: #84cc16; }
        .rating-btn.active.rating-3 { background-color: #f59e0b; color: white; border-color: #f59e0b; }
        .rating-btn.active.rating-4 { background-color: #f97316; color: white; border-color: #f97316; }
        .rating-btn.active.rating-5 { background-color: #ef4444; color: white; border-color: #ef4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.3); }
        
        .gps-status-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          font-size: 12px;
          gap: 8px;
        }
        .gps-success-msg {
          color: #10b981;
          font-weight: 600;
        }
        .gps-retry-btn {
          background: none;
          border: none;
          color: #2563eb;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
        }
        .items-section {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }
        h4 {
          margin-top: 0;
          margin-bottom: 12px;
          font-size: 15px;
          color: #0f172a;
          font-weight: 700;
        }
        .block-error {
          display: block;
          margin-bottom: 10px;
        }
        .item-row {
          display: flex;
          gap: 8px;
          margin-bottom: 10px;
          align-items: center;
        }
        .resource-select {
          flex: 1;
          padding: 10px;
          font-size: 13px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background-color: #ffffff;
          color: #0f172a;
        }
        .quantity-input {
          width: 80px;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background-color: #ffffff;
          color: #0f172a;
          font-size: 13px;
          outline: none;
        }
        .delete-item-btn {
          background: none;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          width: 36px;
          height: 36px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s, color 0.2s;
        }
        .delete-item-btn:hover:not(:disabled) {
          background-color: var(--error-glow);
          color: var(--error-color);
          border-color: var(--error-color);
        }
        .delete-item-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .add-item-btn {
          background: none;
          border: 1px dashed var(--primary-color);
          color: var(--primary-color);
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          font-size: 13px;
          transition: background-color 0.2s;
        }
        .add-item-btn:hover {
          background-color: var(--primary-glow);
        }
        .input-error {
          border-color: var(--error-color) !important;
        }
        .error-message {
          color: var(--error-color);
          font-size: 12px;
        }
        .alert {
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 16px;
          font-weight: 500;
        }
        .alert-success {
          background-color: var(--success-glow);
          color: var(--success-color);
          border: 1px solid var(--success-color);
        }
        .alert-error {
          background-color: var(--error-glow);
          color: var(--error-color);
          border: 1px solid var(--error-color);
        }
        .submit-btn {
          width: 100%;
          background-color: var(--primary-color);
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.1s;
        }
        .submit-btn:hover:not(:disabled) {
          background-color: var(--primary-hover);
        }
        .submit-btn:active:not(:disabled) {
          transform: scale(0.99);
        }
        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
