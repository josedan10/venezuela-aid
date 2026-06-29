import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function RegisterForm({ onRegisterSuccess }) {
  const { setDbUser } = useAuth();
  
  // Multiple roles state
  const [selectedRoles, setSelectedRoles] = useState({
    DONOR: true, // Default
    DRIVER: false,
    NGO: false,
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rif, setRif] = useState('');
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState('');
  const [serverError, setServerError] = useState('');

  const toggleRole = (roleKey) => {
    setSelectedRoles(prev => {
      const next = { ...prev, [roleKey]: !prev[roleKey] };
      // Make sure at least one role is selected
      const anySelected = Object.values(next).some(val => val);
      if (!anySelected) {
        return prev;
      }
      return next;
    });
  };

  const validate = () => {
    const tempErrors = {};
    if (!email) tempErrors.email = 'El correo electrónico es obligatorio.';
    else if (!/\S+@\S+\.\S+/.test(email)) tempErrors.email = 'El correo electrónico no es válido.';
    
    if (!password) tempErrors.password = 'La contraseña es obligatoria.';
    else if (password.length < 6) tempErrors.password = 'La contraseña debe tener al menos 6 caracteres.';
    
    if (!name) tempErrors.name = 'El nombre es obligatorio.';

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerMessage('');
    setServerError('');

    if (!validate()) return;

    setLoading(true);

    const rolesList = Object.keys(selectedRoles)
      .filter(key => selectedRoles[key])
      .join(',');

    try {
      // 1. Create in Firebase
      const firebaseUserCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = firebaseUserCredential.user;
      const firebaseId = firebaseUser.uid;

      const payload = {
        firebaseId,
        email,
        name,
        roles: rolesList,
      };

      if (rif && (selectedRoles.NGO || selectedRoles.DONOR)) {
        payload.rif = rif;
      }

      // 2. Register in NestJS Backend
      let data;
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/users/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Error en el registro del backend');
        }
      } catch (backendErr) {
        await firebaseUser.delete();
        throw backendErr;
      }

      setServerMessage(data.message || 'Registro completado exitosamente.');
      
      if (setDbUser) {
        setDbUser(data.user);
      }

      // Clear form
      setEmail('');
      setPassword('');
      setName('');
      setRif('');
      setSelectedRoles({
        DONOR: true,
        DRIVER: false,
        NGO: false,
      });

      if (onRegisterSuccess) {
        setTimeout(() => {
          onRegisterSuccess(data);
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
    <div className="register-form-container glass-card">
      <h3 className="form-title">Crear Cuenta</h3>
      <p className="form-subtitle">Únase a la red nacional de ayuda humanitaria</p>

      <form onSubmit={handleSubmit} noValidate>
        <label className="field-label">Seleccione sus roles (puede elegir varios) *</label>
        <div className="role-selector-grid">
          <button
            type="button"
            className={selectedRoles.DONOR ? 'active' : ''}
            onClick={() => toggleRole('DONOR')}
          >
            Donante {selectedRoles.DONOR && '✓'}
          </button>
          <button
            type="button"
            className={selectedRoles.NGO ? 'active' : ''}
            onClick={() => toggleRole('NGO')}
          >
            ONG {selectedRoles.NGO && '✓'}
          </button>
          <button
            type="button"
            className={selectedRoles.DRIVER ? 'active' : ''}
            onClick={() => toggleRole('DRIVER')}
          >
            Conductor {selectedRoles.DRIVER && '✓'}
          </button>
        </div>

        <div className="input-group">
          <label htmlFor="reg-name">Nombre Completo o Institución *</label>
          <input
            id="reg-name"
            type="text"
            placeholder="Ej. Juan Pérez o Fundación Bolívar"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={errors.name ? 'input-error' : ''}
          />
          {errors.name && <span className="error-message">{errors.name}</span>}
        </div>

        <div className="input-group">
          <label htmlFor="reg-email">Correo Electrónico *</label>
          <input
            id="reg-email"
            type="email"
            placeholder="ejemplo@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={errors.email ? 'input-error' : ''}
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>

        <div className="input-group">
          <label htmlFor="reg-password">Contraseña (mínimo 6 caracteres) *</label>
          <input
            id="reg-password"
            type="password"
            placeholder="••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={errors.password ? 'input-error' : ''}
          />
          {errors.password && <span className="error-message">{errors.password}</span>}
        </div>

        {(selectedRoles.DONOR || selectedRoles.NGO) && (
          <div className="input-group animate-fade-in">
            <label htmlFor="reg-rif">RIF (Opcional)</label>
            <input
              id="reg-rif"
              type="text"
              placeholder="Ej. J-12345678-9"
              value={rif}
              onChange={(e) => setRif(e.target.value)}
            />
          </div>
        )}

        {selectedRoles.DRIVER && (
          <div className="driver-info-badge animate-fade-in">
            🚚 Como Conductor, podrás detallar tu vehículo y placa desde el panel de usuario más tarde para comenzar a transportar insumos.
          </div>
        )}

        {serverMessage && <div className="alert alert-success">{serverMessage}</div>}
        {serverError && <div className="alert alert-error">{serverError}</div>}

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
        </button>
      </form>

      <style jsx>{`
        .register-form-container {
          padding: 24px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .form-title {
          font-size: 20px;
          font-weight: 700;
          color: #f8fafc;
          margin-bottom: 4px;
          text-align: center;
        }
        .form-subtitle {
          font-size: 12px;
          color: #94a3b8;
          text-align: center;
          margin-bottom: 20px;
        }
        .field-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #cbd5e1;
          margin-bottom: 8px;
        }
        .role-selector-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          margin-bottom: 20px;
        }
        .role-selector-grid button {
          padding: 10px 4px;
          font-size: 12px;
          font-weight: 700;
          color: #94a3b8;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .role-selector-grid button:hover {
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.07);
        }
        .role-selector-grid button.active {
          background-color: #3b82f6;
          border-color: #3b82f6;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
        }
        .input-group label {
          font-size: 12px;
          font-weight: 600;
          color: #cbd5e1;
        }
        input {
          padding: 11px 13px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background-color: rgba(0, 0, 0, 0.3);
          color: #f8fafc;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
        }
        .input-error {
          border-color: #ef4444 !important;
        }
        .error-message {
          color: #f87171;
          font-size: 11px;
        }
        .driver-info-badge {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.2);
          color: #93c5fd;
          font-size: 11px;
          line-height: 1.4;
          padding: 10px 12px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .alert {
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 12px;
          margin-bottom: 16px;
          font-weight: 600;
          text-align: center;
        }
        .alert-success {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .alert-error {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .submit-btn {
          width: 100%;
          background-color: #3b82f6;
          color: #ffffff;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.1s;
        }
        .submit-btn:hover:not(:disabled) {
          background-color: #2563eb;
        }
        .submit-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .animate-fade-in {
          animation: fadeIn 0.25s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
