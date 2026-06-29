import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function RegisterForm({ onRegisterSuccess }) {
  const { setDbUser } = useAuth();
  const [role, setRole] = useState('DONOR'); // DONOR, NGO, DRIVER
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rif, setRif] = useState('');
  
  // Driver specific fields
  const [cedula, setCedula] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [licenseFile, setLicenseFile] = useState(null);
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverMessage, setServerMessage] = useState('');
  const [serverError, setServerError] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setLicenseFile(e.target.files[0]);
      // Clear specific error
      setErrors(prev => ({ ...prev, licenseFile: '' }));
    }
  };

  const validate = () => {
    const tempErrors = {};
    if (!email) tempErrors.email = 'El correo electrónico es obligatorio.';
    else if (!/\S+@\S+\.\S+/.test(email)) tempErrors.email = 'El correo electrónico no es válido.';
    
    if (!password) tempErrors.password = 'La contraseña es obligatoria.';
    else if (password.length < 6) tempErrors.password = 'La contraseña debe tener al menos 6 caracteres.';
    
    if (!name) tempErrors.name = 'El nombre es obligatorio.';

    if (role === 'DONOR' || role === 'NGO') {
      if (!rif) tempErrors.rif = 'El RIF es obligatorio para registrarse como ONG o Donante.';
    }

    if (role === 'DRIVER') {
      if (!cedula) tempErrors.cedula = 'La cédula es obligatoria.';
      if (!vehicleDetails) tempErrors.vehicleDetails = 'La descripción del vehículo es obligatoria.';
      if (!licensePlate) {
        tempErrors.licensePlate = 'La placa del vehículo es obligatoria.';
      } else if (!/^[A-Z0-9-]{6,10}$/.test(licensePlate.toUpperCase())) {
        tempErrors.licensePlate = 'El formato de la placa no es válido (ej. AB123CD o A123BCD, 6-10 caracteres).';
      }
      if (!licenseFile) {
        tempErrors.licenseFile = 'La licencia de conducir es obligatoria para registrarse como conductor.';
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
      // 1. Create in Firebase
      const firebaseUserCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = firebaseUserCredential.user;
      const firebaseId = firebaseUser.uid;

      const payload = {
        firebaseId,
        email,
        name,
        role,
      };

      if (role === 'DONOR' || role === 'NGO') {
        payload.rif = rif;
      }

      if (role === 'DRIVER') {
        // In a real app we'd upload the file first. Here we mock licenseDocUrl
        payload.driverDetails = {
          cedula,
          vehicleDetails,
          licensePlate: licensePlate.toUpperCase(),
          licenseDocUrl: licenseFile ? `/uploads/licenses/${licenseFile.name}` : '',
        };
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
        // Cleanup Firebase User if database register fails to avoid orphans
        await firebaseUser.delete();
        throw backendErr;
      }

      setServerMessage(data.message || 'Registro completado exitosamente.');
      
      // Update local context dbUser immediately
      if (setDbUser) {
        setDbUser(data.user);
      }

      // Clear form
      setEmail('');
      setPassword('');
      setName('');
      setRif('');
      setCedula('');
      setVehicleDetails('');
      setLicensePlate('');
      setLicenseFile(null);
      // Reset file input element visually
      const fileInput = document.getElementById('license-file');
      if (fileInput) fileInput.value = '';

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
    <div className="form-card">
      <h2>Crear Cuenta</h2>
      <p className="form-subtitle">Regístrese en la plataforma de ayuda humanitaria</p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="role-selector">
          <button
            type="button"
            className={role === 'DONOR' ? 'active' : ''}
            onClick={() => { setRole('DONOR'); setErrors({}); }}
          >
            Donante
          </button>
          <button
            type="button"
            className={role === 'NGO' ? 'active' : ''}
            onClick={() => { setRole('NGO'); setErrors({}); }}
          >
            ONG / Beneficiario
          </button>
          <button
            type="button"
            className={role === 'DRIVER' ? 'active' : ''}
            onClick={() => { setRole('DRIVER'); setErrors({}); }}
          >
            Conductor
          </button>
        </div>

        <div className="input-group">
          <label htmlFor="reg-name">Nombre Completo o Razón Social *</label>
          <input
            id="reg-name"
            type="text"
            placeholder="Ej. Juan Pérez o Fundación Simón Bolívar"
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

        {(role === 'DONOR' || role === 'NGO') && (
          <div className="input-group">
            <label htmlFor="reg-rif">RIF (Registro de Información Fiscal) *</label>
            <input
              id="reg-rif"
              type="text"
              placeholder="Ej. J-12345678-9"
              value={rif}
              onChange={(e) => setRif(e.target.value)}
              className={errors.rif ? 'input-error' : ''}
            />
            {errors.rif && <span className="error-message">{errors.rif}</span>}
          </div>
        )}

        {role === 'DRIVER' && (
          <div className="driver-fields">
            <div className="input-group">
              <label htmlFor="driver-cedula">Cédula de Identidad *</label>
              <input
                id="driver-cedula"
                type="text"
                placeholder="Ej. V-12345678"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                className={errors.cedula ? 'input-error' : ''}
              />
              {errors.cedula && <span className="error-message">{errors.cedula}</span>}
            </div>

            <div className="input-group">
              <label htmlFor="driver-vehicle">Descripción del Vehículo *</label>
              <input
                id="driver-vehicle"
                type="text"
                placeholder="Ej. Camión Ford Cargo 2012 blanco"
                value={vehicleDetails}
                onChange={(e) => setVehicleDetails(e.target.value)}
                className={errors.vehicleDetails ? 'input-error' : ''}
              />
              {errors.vehicleDetails && <span className="error-message">{errors.vehicleDetails}</span>}
            </div>

            <div className="input-group">
              <label htmlFor="driver-plate">Placa del Vehículo *</label>
              <input
                id="driver-plate"
                type="text"
                placeholder="Ej. AA123BB"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                className={errors.licensePlate ? 'input-error' : ''}
              />
              {errors.licensePlate && <span className="error-message">{errors.licensePlate}</span>}
            </div>

            <div className="input-group">
              <label htmlFor="license-file">Licencia de Conducir (Imagen/PDF) *</label>
              <input
                id="license-file"
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className={errors.licenseFile ? 'input-error' : ''}
              />
              {errors.licenseFile && <span className="error-message">{errors.licenseFile}</span>}
            </div>
          </div>
        )}

        {serverMessage && <div className="alert alert-success">{serverMessage}</div>}
        {serverError && <div className="alert alert-error">{serverError}</div>}

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Procesando...' : 'Registrarse'}
        </button>
      </form>

      <style jsx>{`
        .form-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
          backdrop-filter: blur(10px);
          max-width: 500px;
          margin: 0 auto;
        }
        @media (max-width: 480px) {
          .form-card {
            padding: 20px;
          }
        }
        h2 {
          font-size: 24px;
          margin-bottom: 6px;
          color: var(--text-primary);
          text-align: center;
        }
        .form-subtitle {
          color: var(--text-secondary);
          font-size: 14px;
          text-align: center;
          margin-bottom: 24px;
        }
        .role-selector {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          background-color: var(--bg-body);
          padding: 4px;
          border-radius: 10px;
          margin-bottom: 24px;
          border: 1px solid var(--border-color);
        }
        .role-selector button {
          background: none;
          border: none;
          padding: 10px 6px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          border-radius: 8px;
          cursor: pointer;
          transition: background-color 0.2s, color 0.2s;
        }
        .role-selector button.active {
          background-color: var(--primary-color);
          color: white;
          box-shadow: 0 4px 12px var(--primary-glow);
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 18px;
        }
        label {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary);
        }
        input[type="text"],
        input[type="email"],
        input[type="password"] {
          padding: 12px 14px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: var(--bg-body);
          color: var(--text-primary);
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        input:focus {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px var(--primary-glow);
        }
        input[type="file"] {
          font-size: 14px;
          color: var(--text-secondary);
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
          margin-bottom: 18px;
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
          padding: 14px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.1s;
        }
        .submit-btn:hover:not(:disabled) {
          background-color: var(--primary-hover);
        }
        .submit-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .driver-fields {
          animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
