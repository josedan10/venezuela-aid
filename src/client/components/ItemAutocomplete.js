import React, { useState, useEffect, useRef } from 'react';

const CATEGORIES = [
  { value: 'MEDICINES', label: 'Medicamentos' },
  { value: 'FOOD', label: 'Alimentos' },
  { value: 'BLOOD_DONORS', label: 'Donantes de Sangre' },
  { value: 'HELPERS', label: 'Ayudantes/Voluntarios' },
  { value: 'MACHINES', label: 'Maquinaria' },
  { value: 'RESCUE_TEAMS', label: 'Equipos de Rescate' },
];

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

export default function ItemAutocomplete({
  value,
  category,
  onCategoryChange,
  onChange,
  disabled = false,
  placeholder = 'Buscar o crear ítem...',
}) {
  const [query, setQuery] = useState(value?.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setQuery(value?.name || '');
  }, [value?.id, value?.name]);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        if (category) params.set('category', category);
        params.set('limit', '20');
        const res = await fetch(`${API}/items?${params.toString()}`, { signal: controller.signal });
        if (res.ok) {
          setSuggestions(await res.json());
        }
      } catch (e) {
        if (e.name !== 'AbortError') {
          console.error('Error fetching items:', e);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, category, open]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmed = query.trim();
  const exactMatch = suggestions.find(
    (s) => s.name.toLowerCase() === trimmed.toLowerCase() && (!category || s.category === category),
  );
  const canCreate = trimmed.length > 0 && category && !exactMatch;

  const selectItem = (item) => {
    onChange(item);
    setQuery(item.name);
    setOpen(false);
  };

  const createItem = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`${API}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, category }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al crear ítem');
      selectItem(data.item);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="item-autocomplete" ref={wrapperRef}>
      <div className="item-autocomplete-row">
        <select
          className="category-filter"
          value={category || ''}
          onChange={(e) => {
            onCategoryChange?.(e.target.value);
            onChange(null);
            setQuery('');
          }}
          disabled={disabled}
        >
          <option value="">Categoría *</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <div className="autocomplete-input-wrap">
          <input
            type="text"
            className="autocomplete-input"
            placeholder={category ? placeholder : 'Seleccione categoría primero'}
            value={query}
            disabled={disabled || !category}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              if (value) onChange(null);
            }}
          />
          {open && category && (
            <ul className="autocomplete-dropdown">
              {loading && <li className="dropdown-hint">Buscando...</li>}
              {!loading && suggestions.length === 0 && !canCreate && (
                <li className="dropdown-hint">Sin resultados</li>
              )}
              {suggestions.map((item) => (
                <li key={item.id}>
                  <button type="button" className="dropdown-option" onClick={() => selectItem(item)}>
                    <span className="option-name">{item.name}</span>
                    <span className="option-cat">{item.category}</span>
                  </button>
                </li>
              ))}
              {canCreate && (
                <li>
                  <button type="button" className="dropdown-option create-option" onClick={createItem} disabled={creating}>
                    {creating ? 'Creando...' : `+ Crear "${trimmed}"`}
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <style jsx>{`
        .item-autocomplete {
          flex: 1;
          min-width: 0;
        }
        .item-autocomplete-row {
          display: flex;
          gap: 8px;
        }
        .category-filter {
          width: 140px;
          flex-shrink: 0;
          padding: 10px 8px;
          font-size: 12px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--bg-card);
          color: var(--text-primary);
        }
        .autocomplete-input-wrap {
          position: relative;
          flex: 1;
        }
        .autocomplete-input {
          width: 100%;
          padding: 10px 12px;
          font-size: 13px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--bg-card);
          color: var(--text-primary);
          box-sizing: border-box;
        }
        .autocomplete-dropdown {
          position: absolute;
          z-index: 50;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          max-height: 220px;
          overflow-y: auto;
          margin: 0;
          padding: 4px;
          list-style: none;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }
        .dropdown-option {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border: none;
          background: none;
          cursor: pointer;
          text-align: left;
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 13px;
        }
        .dropdown-option:hover {
          background: var(--primary-glow);
        }
        .create-option {
          color: var(--primary-color);
          font-weight: 600;
        }
        .option-cat {
          font-size: 10px;
          color: var(--text-secondary);
        }
        .dropdown-hint {
          padding: 8px 10px;
          font-size: 12px;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}
