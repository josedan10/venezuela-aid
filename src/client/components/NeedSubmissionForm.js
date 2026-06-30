import React, { useState, useEffect } from 'react';
import LocationDropdown from './LocationDropdown';
import ItemAutocomplete from './ItemAutocomplete';

export default function NeedSubmissionForm({ token, ngoId, onNeedSubmitted, prefill = null }) {
  const [description, setDescription] = useState('');
  const [urgencyRating, setUrgencyRating] = useState(3);
  const [state, setState] = useState(prefill?.state || '');
  const [sector, setSector] = useState(prefill?.sector || '');
  const [latitude, setLatitude] = useState(prefill?.latitude ?? null);
  const [longitude, setLongitude] = useState(prefill?.longitude ?? null);
  const [collectionCenterId, setCollectionCenterId] = useState(prefill?.collectionCenterId || '');
  const [collectionCenterName, setCollectionCenterName] = useState(prefill?.collectionCenterName || '');

  const [selectedItems, setSelectedItems] = useState([
    { itemId: '', itemName: '', category: '', quantity: 1 },
  ]);

  const [gpsAttempted, setGpsAttempted] = useState(false);
  const [gpsError, setGpsError] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [gpsDialogMessage, setGpsDialogMessage] = useState('');

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState('');
  const [serverError, setServerError] = useState('');

  const hasPrefillOrigin = prefill?.latitude != null && prefill?.longitude != null;

  useEffect(() => {
    if (!prefill) {
      setCollectionCenterId('');
      setCollectionCenterName('');
      return;
    }
    if (prefill.latitude != null) setLatitude(prefill.latitude);
    if (prefill.longitude != null) setLongitude(prefill.longitude);
    if (prefill.state) setState(prefill.state);
    if (prefill.sector) setSector(prefill.sector);
    if (prefill.collectionCenterId) setCollectionCenterId(prefill.collectionCenterId);
    if (prefill.collectionCenterName) setCollectionCenterName(prefill.collectionCenterName);
    if (prefill.description) setDescription(prefill.description);
  }, [prefill]);

  useEffect(() => {
    if (hasPrefillOrigin) return;
    detectGPS();
  }, [hasPrefillOrigin]);

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
        },
        (error) => {
          console.warn('GPS coordinates acquisition failed:', error);
          setGpsError(true);
          setGpsDialogMessage('No pudimos obtener su ubicación. Por favor, seleccione su estado y sector manualmente.');
          setLatitude(null);
          setLongitude(null);
        },
        { enableHighAccuracy: true, timeout: 5000 },
      );
    } else {
      setGpsError(true);
      setGpsDialogMessage('Geolocalización no soportada por el navegador. Seleccione su ubicación manualmente.');
    }
  };

  const handleLocationChange = (location) => {
    setState(location.state);
    setSector(location.sector);
    if (gpsError) {
      setLatitude(location.latitude);
      setLongitude(location.longitude);
    }
  };

  const handleItemChange = (index, field, value) => {
    setSelectedItems((prev) => {
      const updated = [...prev];
      if (field === 'quantity') {
        updated[index] = { ...updated[index], [field]: parseInt(value, 10) || 0 };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const handleItemSelect = (index, catalogItem) => {
    setSelectedItems((prev) => {
      const updated = [...prev];
      if (catalogItem) {
        updated[index] = {
          ...updated[index],
          itemId: catalogItem.id,
          itemName: catalogItem.name,
          category: catalogItem.category,
        };
      } else {
        updated[index] = {
          ...updated[index],
          itemId: '',
          itemName: '',
        };
      }
      return updated;
    });
  };

  const addItemRow = () => {
    setSelectedItems((prev) => [...prev, { itemId: '', itemName: '', category: '', quantity: 1 }]);
  };

  const removeItemRow = (index) => {
    setSelectedItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== index) : prev));
  };

  const validate = () => {
    const tempErrors = {};
    if (!description.trim()) tempErrors.description = 'La descripción es obligatoria.';
    if (!state) tempErrors.state = 'El estado es obligatorio.';
    if (!sector) tempErrors.sector = 'El sector es obligatorio.';

    const validItems = selectedItems.filter((item) => item.itemId && item.quantity > 0);
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
      const validItems = selectedItems
        .filter((item) => item.itemId && item.quantity > 0)
        .map((item) => ({ itemId: item.itemId, quantity: item.quantity }));

      if (!ngoId) {
        throw new Error('Debe iniciar sesión como ONG para registrar una solicitud.');
      }

      const payload = {
        ngoId,
        description,
        urgencyRating: parseInt(urgencyRating, 10),
        state,
        sector,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        collectionCenterId: collectionCenterId || null,
        items: validItems,
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/needs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al enviar necesidad');
      }

      if (data.urgencyScore >= 80) {
        setServerMessage('Solicitud registrada con prioridad crítica (ATENCIÓN INMEDIATA).');
      } else if (data.matching?.matched > 0) {
        setServerMessage(
          `${data.message || 'Solicitud registrada.'} ${data.matching.matched}/${data.matching.total} ítems emparejados cerca del punto de origen.`,
        );
      } else {
        setServerMessage(data.message || 'Solicitud registrada exitosamente.');
      }

      setDescription('');
      setUrgencyRating(3);
      setSelectedItems([{ itemId: '', itemName: '', category: '', quantity: 1 }]);
      setCollectionCenterId('');
      setCollectionCenterName('');
      if (!hasPrefillOrigin) {
        detectGPS();
      }

      if (onNeedSubmitted) {
        setTimeout(() => onNeedSubmitted(data), 1500);
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

      {collectionCenterName && (
        <div className="gps-alert" style={{ background: 'var(--primary-glow)', color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}>
          <div className="gps-alert-icon">🏠</div>
          <div className="gps-alert-text">
            Solicitud desde centro de acopio: <strong>{collectionCenterName}</strong>
          </div>
        </div>
      )}

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
          <h4>Ítems Requeridos *</h4>
          <p className="items-hint">
            Busque en el catálogo por categoría o cree un ítem nuevo si no existe.
          </p>
          {errors.items && <span className="error-message block-error">{errors.items}</span>}

          {selectedItems.map((item, index) => (
            <div key={index} className="item-row">
              <ItemAutocomplete
                value={item.itemId ? { id: item.itemId, name: item.itemName } : null}
                category={item.category}
                onCategoryChange={(cat) => handleItemChange(index, 'category', cat)}
                onChange={(catalogItem) => handleItemSelect(index, catalogItem)}
              />

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
            + Agregar Otro Ítem
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
        h3 { font-size: 20px; margin-bottom: 4px; color: var(--text-primary); }
        .form-subtitle { color: var(--text-secondary); font-size: 13px; margin-bottom: 20px; }
        .gps-alert {
          display: flex; gap: 10px;
          background-color: var(--warning-glow);
          color: var(--warning-color);
          border: 1px solid var(--warning-color);
          padding: 12px; border-radius: 8px; margin-bottom: 20px;
          font-size: 13px; font-weight: 500; line-height: 1.4;
        }
        .input-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
        label { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
        textarea {
          padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);
          background-color: var(--bg-body); color: var(--text-primary); font-size: 14px;
          resize: vertical; font-family: inherit;
        }
        .urgency-rating-bar { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; }
        .rating-btn {
          flex: 1; padding: 10px 4px; font-size: 12px; font-weight: 500;
          background-color: var(--bg-body); border: 1px solid var(--border-color);
          border-radius: 6px; color: var(--text-secondary); cursor: pointer;
        }
        .rating-btn.active.rating-5 { background-color: var(--error-color); color: white; }
        .gps-status-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; font-size: 12px; }
        .gps-success-msg { color: var(--success-color); font-weight: 500; }
        .gps-retry-btn { background: none; border: none; color: var(--primary-color); font-weight: 600; cursor: pointer; text-decoration: underline; }
        .items-section {
          background-color: var(--bg-body); border: 1px solid var(--border-color);
          border-radius: 8px; padding: 16px; margin-bottom: 20px;
        }
        h4 { margin-top: 0; margin-bottom: 12px; font-size: 15px; }
        .items-hint { font-size: 12px; color: var(--text-secondary); margin: -6px 0 12px; line-height: 1.4; }
        .item-row { display: flex; gap: 8px; margin-bottom: 10px; align-items: flex-start; }
        .quantity-input {
          width: 80px; padding: 10px; border-radius: 8px;
          border: 1px solid var(--border-color); background-color: var(--bg-card);
          font-size: 13px; flex-shrink: 0;
        }
        .delete-item-btn {
          background: none; border: 1px solid var(--border-color); width: 36px; height: 36px;
          border-radius: 8px; cursor: pointer; flex-shrink: 0;
        }
        .add-item-btn {
          background: none; border: 1px dashed var(--primary-color); color: var(--primary-color);
          width: 100%; padding: 10px; border-radius: 8px; font-weight: 500; cursor: pointer;
        }
        .alert { padding: 12px; border-radius: 8px; font-size: 14px; margin-bottom: 16px; }
        .alert-success { background-color: var(--success-glow); color: var(--success-color); border: 1px solid var(--success-color); }
        .alert-error { background-color: var(--error-glow); color: var(--error-color); border: 1px solid var(--error-color); }
        .submit-btn {
          width: 100%; background-color: var(--primary-color); color: white; border: none;
          padding: 12px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;
        }
        .error-message { color: var(--error-color); font-size: 12px; }
        .block-error { display: block; margin-bottom: 10px; }
        .input-error { border-color: var(--error-color) !important; }
      `}</style>
    </div>
  );
}
