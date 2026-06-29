import React, { useState } from 'react';

const CATEGORIES = [
  { value: 'MEDICINES', label: 'Medicamentos' },
  { value: 'FOOD', label: 'Alimentos' },
  { value: 'BLOOD_DONORS', label: 'Donantes de Sangre' },
  { value: 'HELPERS', label: 'Ayudantes/Voluntarios' },
  { value: 'MACHINES', label: 'Maquinaria' },
  { value: 'RESCUE_TEAMS', label: 'Equipos de Rescate' }
];

export default function ResourceCatalogForm({ token, onResourceCataloged }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState('');
  const [serverError, setServerError] = useState('');

  const validate = () => {
    const tempErrors = {};
    if (!name.trim()) tempErrors.name = 'El nombre del recurso es obligatorio.';
    if (!category) tempErrors.category = 'La categoría es obligatoria.';
    
    const qty = parseInt(stockQuantity, 10);
    if (isNaN(qty) || qty < 1) {
      tempErrors.stockQuantity = 'La cantidad debe ser un número entero mayor o igual a 1.';
    }

    if (category === 'MEDICINES' || category === 'FOOD') {
      if (!expirationDate) {
        tempErrors.expirationDate = 'La fecha de vencimiento es obligatoria para Alimentos y Medicamentos.';
      } else {
        const expDate = new Date(expirationDate);
        const today = new Date();
        // Clear time components for fair comparison
        today.setHours(0, 0, 0, 0);
        expDate.setHours(0, 0, 0, 0);

        if (expDate < today) {
          tempErrors.expirationDate = 'No se pueden registrar recursos con fecha de vencimiento pasada.';
        }
      }
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
      const payload = {
        name,
        category,
        stockQuantity: parseInt(stockQuantity, 10),
      };

      if (expirationDate) {
        // Convert to ISO 8601 string
        payload.expirationDate = new Date(expirationDate).toISOString();
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al catalogar recurso');
      }

      setServerMessage(data.message || 'Recurso registrado exitosamente.');
      
      // Reset form
      setName('');
      setCategory('');
      setStockQuantity('');
      setExpirationDate('');

      if (onResourceCataloged) {
        setTimeout(() => {
          onResourceCataloged(data.resource);
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
    <div className="catalog-form-card">
      <h3>Catalogar Recurso</h3>
      <p className="form-subtitle">Registre alimentos, medicinas o servicios disponibles para donar</p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="input-group">
          <label htmlFor="res-name">Nombre del Recurso / Item *</label>
          <input
            id="res-name"
            type="text"
            placeholder="Ej. Insulina, Harina de Maíz, Suero Fisiológico"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={errors.name ? 'input-error' : ''}
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        <div className="input-row">
          <div className="input-group">
            <label htmlFor="res-category">Categoría *</label>
            <select
              id="res-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                // Clear expiration date if category doesn't require it
                if (e.target.value !== 'MEDICINES' && e.target.value !== 'FOOD') {
                  setExpirationDate('');
                }
              }}
              className={errors.category ? 'input-error' : ''}
            >
              <option value="">Seleccione Categoría</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            {errors.category && <span className="error-message">{errors.category}</span>}
          </div>

          <div className="input-group">
            <label htmlFor="res-quantity">Cantidad *</label>
            <input
              id="res-quantity"
              type="number"
              min="1"
              placeholder="Ej. 100"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              className={errors.stockQuantity ? 'input-error' : ''}
            />
            {errors.stockQuantity && <span className="error-message">{errors.stockQuantity}</span>}
          </div>
        </div>

        {(category === 'MEDICINES' || category === 'FOOD') && (
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
        .input-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 480px) {
          .input-row {
            grid-template-columns: 1fr;
            gap: 0;
          }
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
        }
        label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
        }
        input[type="text"],
        input[type="number"],
        input[type="date"],
        select {
          padding: 11px 14px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: var(--bg-body);
          color: var(--text-primary);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        input:focus,
        select:focus {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px var(--primary-glow);
        }
        .input-error {
          border-color: var(--error-color) !important;
        }
        .error-message {
          color: var(--error-color);
          font-size: 12px;
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
      `}</style>
    </div>
  );
}
