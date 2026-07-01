import React, { useState, useEffect } from 'react';
import ItemAutocomplete from './ItemAutocomplete';

export default function ResourceCatalogForm({ token, onResourceCataloged, collectionCenters = [] }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [category, setCategory] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [collectionCenterId, setCollectionCenterId] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [useGps, setUseGps] = useState(true);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState('');
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (!useGps || collectionCenterId) return;
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
        },
        () => {
          setLatitude(null);
          setLongitude(null);
        },
        { enableHighAccuracy: true, timeout: 5000 },
      );
    }
  }, [useGps, collectionCenterId]);

  const handleCenterChange = (centerId) => {
    setCollectionCenterId(centerId);
    if (centerId) {
      const center = collectionCenters.find((c) => c.id === centerId);
      if (center) {
        setLatitude(center.latitude);
        setLongitude(center.longitude);
        setUseGps(false);
      }
    } else {
      setLatitude(null);
      setLongitude(null);
      setUseGps(true);
    }
  };

  const handleCategoryChange = (nextCategory) => {
    setCategory(nextCategory);
    if (nextCategory !== 'MEDICINES' && nextCategory !== 'FOOD') {
      setExpirationDate('');
    }
  };

  const handleGpsToggle = (checked) => {
    setUseGps(checked);
    if (!checked) {
      setLatitude(null);
      setLongitude(null);
    }
  };

  const validate = () => {
    const tempErrors = {};
    if (!selectedItem?.id) tempErrors.item = 'Seleccione o cree un ítem del catálogo.';

    const qty = Number(stockQuantity);
    if (!Number.isInteger(qty) || qty < 1 || String(stockQuantity).includes('.')) {
      tempErrors.stockQuantity = 'La cantidad debe ser un número entero mayor o igual a 1.';
    }

    const itemCategory = selectedItem?.category || category;
    if (itemCategory === 'MEDICINES' || itemCategory === 'FOOD') {
      if (!expirationDate) {
        tempErrors.expirationDate = 'La fecha de vencimiento es obligatoria para Alimentos y Medicamentos.';
      } else {
        const expDate = new Date(expirationDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expDate.setHours(0, 0, 0, 0);

        if (expDate < today) {
          tempErrors.expirationDate = 'No se pueden registrar recursos con fecha de vencimiento pasada.';
        }
      }
    }

    const hasCenter = Boolean(collectionCenterId);
    const hasGps = useGps && latitude != null && longitude != null;
    if (!hasCenter && !hasGps) {
      tempErrors.location = 'Indique un centro de acopio o active la ubicación GPS con coordenadas válidas.';
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
      const qty = parseInt(stockQuantity, 10);
      const payload = {
        itemId: selectedItem.id,
        stockQuantity: qty,
        collectionCenterId: collectionCenterId || undefined,
      };

      if (!collectionCenterId && useGps && latitude != null && longitude != null) {
        payload.latitude = latitude;
        payload.longitude = longitude;
      }

      if (expirationDate) {
        payload.expirationDate = new Date(expirationDate).toISOString();
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al catalogar recurso');
      }

      setServerMessage(data.message || 'Recurso registrado exitosamente.');

      setSelectedItem(null);
      setCategory('');
      setStockQuantity('');
      setExpirationDate('');
      setCollectionCenterId('');
      setLatitude(null);
      setLongitude(null);
      setUseGps(true);

      if (onResourceCataloged) {
        onResourceCataloged(data.resource);
      }
    } catch (err) {
      console.error(err);
      setServerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const itemCategory = selectedItem?.category || category;

  return (
    <div className="catalog-form-card">
      <h3>Catalogar Recurso</h3>
      <p className="form-subtitle">Registre alimentos, medicinas o servicios disponibles para donar</p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="input-group">
          <label>Ítem del catálogo *</label>
          <ItemAutocomplete
            value={selectedItem}
            category={category}
            onCategoryChange={handleCategoryChange}
            onChange={setSelectedItem}
            placeholder="Ej. Insulina, Harina de Maíz..."
          />
          {errors.item && <span className="error-message">{errors.item}</span>}
        </div>

        <div className="input-group">
          <label htmlFor="res-quantity">Cantidad *</label>
          <input
            id="res-quantity"
            type="number"
            min="1"
            step="1"
            placeholder="Ej. 100"
            value={stockQuantity}
            onChange={(e) => setStockQuantity(e.target.value)}
            className={errors.stockQuantity ? 'input-error' : ''}
          />
          {errors.stockQuantity && <span className="error-message">{errors.stockQuantity}</span>}
        </div>

        {(itemCategory === 'MEDICINES' || itemCategory === 'FOOD') && (
          <div className="input-group expiration-group">
            <label htmlFor="res-expiration">Fecha de Vencimiento *</label>
            <input
              id="res-expiration"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className={errors.expirationDate ? 'input-error' : ''}
            />
            {errors.expirationDate && <span className="error-message">{errors.expirationDate}</span>}
          </div>
        )}

        <div className="input-group">
          <label htmlFor="res-center">Centro de Acopio (ubicación de la oferta)</label>
          <select
            id="res-center"
            value={collectionCenterId}
            onChange={(e) => handleCenterChange(e.target.value)}
          >
            <option value="">Sin centro — usar mi ubicación GPS</option>
            {collectionCenters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {!collectionCenterId && (
          <div className="gps-status-row" style={{ marginBottom: '16px', fontSize: '12px' }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={useGps}
                onChange={(e) => handleGpsToggle(e.target.checked)}
              />
              Usar mi ubicación GPS como punto de origen de la oferta
            </label>
            {latitude != null && longitude != null && (
              <span style={{ color: 'var(--success-color)' }}>
                📍 {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </span>
            )}
          </div>
        )}

        {errors.location && <span className="error-message">{errors.location}</span>}

        {serverMessage && <div className="alert alert-success">{serverMessage}</div>}
        {serverError && <div className="alert alert-error">{serverError}</div>}

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Procesando...' : 'Registrar Recurso'}
        </button>
      </form>

      <style jsx>{`
        .catalog-form-card {
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
        input[type="number"],
        input[type="date"],
        select {
          padding: 11px 14px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background-color: #ffffff;
          color: #0f172a;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          width: 100%;
        }
        input:focus,
        select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }
        .input-error {
          border-color: #ef4444 !important;
        }
        .error-message {
          color: #dc2626;
          font-size: 12px;
          font-weight: 600;
        }
        .expiration-group {
          animation: slideDown 0.25s ease-out;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .alert {
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 16px;
          font-weight: 600;
        }
        .alert-success {
          background-color: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }
        .alert-error {
          background-color: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }
        .submit-btn {
          width: 100%;
          background-color: #2563eb;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.1s;
          box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        }
        .submit-btn:hover:not(:disabled) {
          background-color: #1d4ed8;
        }
        .submit-btn:active:not(:disabled) {
          transform: scale(0.99);
        }
        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
