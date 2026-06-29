import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import RegisterForm from '../components/RegisterForm';
import ResourceCatalogForm from '../components/ResourceCatalogForm';
import NeedSubmissionForm from '../components/NeedSubmissionForm';
import { initSocket, sendLocation, disconnectSocket, syncBufferedCoordinates } from '../utils/socket';
import { getBufferedCoordinates, hasBufferedCoordinates } from '../utils/indexeddb';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user: firebaseUser, dbUser, token: authToken, logout, setDbUser } = useAuth();
  const currentUser = dbUser;
  const [activeTab, setActiveTab] = useState('donor'); // donor, ngo, driver, admin, register
  
  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');

  // Admin simulation state
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [adminMessage, setAdminMessage] = useState('');

  // Resources state
  const [resourcesList, setResourcesList] = useState([]);

  // Needs state
  const [needsQueue, setNeedsQueue] = useState([]);

  // Driver state
  const [driverAvailable, setDriverAvailable] = useState(false);
  const [driverStatusMessage, setDriverStatusMessage] = useState('');
  const [activeProposal, setActiveProposal] = useState(null);
  const [proposalCountdown, setProposalCountdown] = useState(0);
  const [activeTask, setActiveTask] = useState(null);
  const [gpsIntervalId, setGpsIntervalId] = useState(null);
  const [driverLat, setDriverLat] = useState(10.5186); // Caracas default
  const [driverLng, setDriverLng] = useState(-66.9503);
  const [locationLog, setLocationLog] = useState([]);
  const [offlineSimulation, setOfflineSimulation] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);

  // Delivery confirmation fields
  const [deliverySignature, setDeliverySignature] = useState('');
  const [deliveryPhoto, setDeliveryPhoto] = useState('');
  const [deliveryError, setDeliveryError] = useState('');
  const [deliveryMessage, setDeliveryMessage] = useState('');

  const countdownIntervalRef = useRef(null);

  // Refresh lists
  const refreshResources = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/resources`);
      if (res.ok) {
        const data = await res.json();
        setResourcesList(data);
      }
    } catch (e) {
      console.error('Error refreshing resources:', e);
    }
  };

  const refreshNeeds = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/needs`);
      if (res.ok) {
        const data = await res.json();
        setNeedsQueue(data);
      }
    } catch (e) {
      console.error('Error refreshing needs:', e);
    }
  };

  const fetchPendingDrivers = async () => {
    // In a real app we'd query /users with filters. Here we can use standard DB querying mock or seed simulation
    // Let's query db or mock it.
    // For demo purposes, we will mock pending drivers but try to get details if possible.
    try {
      // Create simple list from seed or backend if we can search.
      // Alternatively, let's fetch custom list of drivers if any registered.
      // We can mock it for the administrator UI.
      const mockDrivers = [
        { id: '1', name: 'Carlos Mendoza', email: 'carlos@conductor.com', role: 'DRIVER', driverDetails: { status: 'PENDING_APPROVAL', cedula: 'V-15894125', vehicleDetails: 'Camioneta Toyota Hilux azul', licensePlate: 'AE123XX' } }
      ];
      setPendingDrivers(mockDrivers);
    } catch (e) {
      console.error(e);
    }
  };

  // Run on mount or tab change
  useEffect(() => {
    refreshResources();
    refreshNeeds();
    if (activeTab === 'admin') {
      fetchPendingDrivers();
    }
  }, [activeTab]);

  // Handle countdown for proposal
  useEffect(() => {
    if (activeProposal && proposalCountdown > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setProposalCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            setActiveProposal(null);
            // Re-fetch to see updated status
            refreshNeeds();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdownIntervalRef.current);
  }, [activeProposal, proposalCountdown]);

  // Clean GPS loop on unmount
  useEffect(() => {
    return () => {
      if (gpsIntervalId) clearInterval(gpsIntervalId);
    };
  }, [gpsIntervalId]);

  // Sync offline coordinates regularly
  useEffect(() => {
    let interval = null;
    if (!offlineSimulation) {
      interval = setInterval(async () => {
        const hasOffline = await hasBufferedCoordinates();
        if (hasOffline) {
          console.log('[Offline Sync] Syncing buffered coordinates...');
          await syncBufferedCoordinates();
          // Update count
          const coords = await getBufferedCoordinates();
          setOfflineCount(coords.length);
        }
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [offlineSimulation]);

  useEffect(() => {
    if (dbUser) {
      if (dbUser.role === 'DRIVER') {
        setActiveTab('driver');
        initDriverSockets(dbUser.id);
      } else if (dbUser.role === 'NGO') {
        setActiveTab('ngo');
      } else if (dbUser.role === 'DONOR') {
        setActiveTab('donor');
      } else if (dbUser.role === 'ADMIN') {
        setActiveTab('admin');
      }
    }
  }, [dbUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess('');

    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setLoginSuccess('Sesión iniciada correctamente.');
      
      // Reset login form
      setLoginEmail('');
      setLoginPassword('');
    } catch (err) {
      setLoginError(err.message || 'Error al iniciar sesión');
    }
  };

  const handleLogout = async () => {
    if (currentUser && currentUser.role === 'DRIVER') {
      stopGPSTracking();
      disconnectSocket();
    }
    await logout();
    setDriverAvailable(false);
    setDriverStatusMessage('');
    setActiveProposal(null);
    setActiveTask(null);
    setOfflineSimulation(false);
    setOfflineCount(0);
  };

  // Socket triggers for driver
  const initDriverSockets = (driverId) => {
    initSocket(driverId, {
      onProposal: (payload) => {
        setActiveProposal(payload);
        setProposalCountdown(payload.timeoutSeconds || 60);
      },
      onConnect: async () => {
        console.log('Socket client connected.');
        // Update count of offline
        const coords = await getBufferedCoordinates();
        setOfflineCount(coords.length);
      },
      onDisconnect: () => {
        console.log('Socket client disconnected.');
      }
    });
  };

  // Toggle availability
  const toggleAvailability = async () => {
    if (!currentUser || currentUser.role !== 'DRIVER') return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/users/toggle-availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          driverId: currentUser.id,
          available: !driverAvailable,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Error al cambiar estado');
      }

      setDriverAvailable(data.available);
      setDriverStatusMessage(data.message);
    } catch (err) {
      console.error(err);
      setDriverStatusMessage(`Error: ${err.message}`);
    }
  };

  // Driver task actions
  const handleAcceptProposal = async () => {
    if (!activeProposal || !currentUser) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/dispatch/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          driverId: currentUser.id,
          taskId: activeProposal.taskId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Error al aceptar despacho');
      }

      setActiveTask(data.task);
      setActiveProposal(null);
      
      // Start real-time GPS coordinates stream
      startGPSTracking();
      refreshNeeds();
    } catch (err) {
      alert(err.message);
      setActiveProposal(null);
    }
  };

  const handleRejectProposal = async () => {
    if (!activeProposal || !currentUser) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/dispatch/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          driverId: currentUser.id,
          taskId: activeProposal.taskId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error al rechazar despacho');
      }

      setActiveProposal(null);
      refreshNeeds();
    } catch (err) {
      alert(err.message);
      setActiveProposal(null);
    }
  };

  // Simulates GPS updates every 15 seconds
  const startGPSTracking = () => {
    if (gpsIntervalId) clearInterval(gpsIntervalId);

    console.log('[GPS] Iniciando rastreo de coordenadas...');
    
    // Initial coordinates centered at Caracas
    let lat = 10.5186;
    let lng = -66.9503;

    const intervalId = setInterval(async () => {
      // Simulate minor movements
      lat += (Math.random() - 0.5) * 0.002;
      lng += (Math.random() - 0.5) * 0.002;

      setDriverLat(lat);
      setDriverLng(lng);

      const timestamp = new Date().toLocaleTimeString();
      setLocationLog((prev) => [
        { lat, lng, time: timestamp, status: offlineSimulation ? 'Buffered (Offline)' : 'Sent (Online)' },
        ...prev.slice(0, 19), // keep last 20 logs
      ]);

      try {
        await sendLocation(currentUser.id, lat, lng);
        
        // Count update
        const coords = await getBufferedCoordinates();
        setOfflineCount(coords.length);
      } catch (e) {
        console.error('Error sending GPS log:', e);
      }
    }, 15000); // 15 seconds required by spec

    setGpsIntervalId(intervalId);
  };

  const stopGPSTracking = () => {
    if (gpsIntervalId) {
      clearInterval(gpsIntervalId);
      setGpsIntervalId(null);
    }
  };

  // Toggle offline simulation
  const toggleOfflineSimulation = () => {
    const nextOfflineState = !offlineSimulation;
    setOfflineSimulation(nextOfflineState);

    if (nextOfflineState) {
      // Disconnect socket to simulate cellular network loss
      disconnectSocket();
      console.warn('[Network Simulator] Modo Fuera de Línea Activado. El socket se desconectó.');
    } else {
      // Reconnect socket and sync buffered coordinates batch
      console.log('[Network Simulator] Conexión de Red Restablecida. Conectando socket...');
      if (currentUser) {
        initDriverSockets(currentUser.id);
        // We also explicitly call sync after connection or let socket connect callback trigger it
        setTimeout(async () => {
          await syncBufferedCoordinates();
          const coords = await getBufferedCoordinates();
          setOfflineCount(coords.length);
        }, 1000);
      }
    }
  };

  // Confirm delivery
  const handleConfirmDelivery = async (e) => {
    e.preventDefault();
    setDeliveryError('');
    setDeliveryMessage('');

    if (!deliverySignature && !deliveryPhoto) {
      setDeliveryError('Debe proporcionar una firma digital o una foto como prueba de entrega.');
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/dispatch/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          driverId: currentUser.id,
          taskId: activeTask.id,
          signatureUrl: deliverySignature || null,
          photoUrl: deliveryPhoto || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Error al confirmar entrega');
      }

      setDeliveryMessage(data.message || 'Entrega confirmada con éxito.');
      setActiveTask(null);
      setDeliverySignature('');
      setDeliveryPhoto('');
      stopGPSTracking();

      refreshResources();
      refreshNeeds();
    } catch (err) {
      setDeliveryError(err.message);
    }
  };

  // Admin operations
  const handleApproveDriver = async (driverId) => {
    setAdminMessage('');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/users/approve-driver/${driverId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Error al aprobar conductor');
      }

      setAdminMessage(data.message || 'Conductor aprobado y verificado.');
      fetchPendingDrivers();
    } catch (err) {
      setAdminMessage(`Error: ${err.message}`);
    }
  };

  const simulateDispatchproposal = async (needId) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/dispatch/propose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ needId }),
      });

      const data = await response.json();
      alert(data.message);
      refreshNeeds();
    } catch (e) {
      alert(`Error al generar propuesta: ${e.message}`);
    }
  };

  return (
    <div className="home-wrapper">
      <Head>
        <title>AyudaVenezuela - Panel Principal SPA</title>
      </Head>

      {/* Hero Welcome banner */}
      <div className="hero-banner glass animate-fade-in">
        <h1>Coordinación Humanitaria de Emergencia</h1>
        <p>Distribución de alimentos, medicinas y apoyo logístico en zonas rurales e intermitentes.</p>
        
        {currentUser ? (
          <div className="user-info-card">
            <span>Sesión activa: <strong>{currentUser.name}</strong> ({currentUser.role})</span>
            <button onClick={handleLogout} className="logout-btn">Cerrar Sesión</button>
          </div>
        ) : (
          <div className="guest-banner-msg">Regístrese o inicie sesión para registrar aportes o solicitar insumos.</div>
        )}
      </div>

      {/* Main Grid: Forms and views */}
      <div className="main-content-grid">
        
        {/* Left Side: Forms / Dashboard Panels depending on active tab */}
        <div className="dashboard-forms-column animate-slide-up">
          
          {/* Navigation Tabs */}
          <div className="nav-tabs glass">
            <button
              onClick={() => setActiveTab('donor')}
              className={activeTab === 'donor' ? 'tab-btn active' : 'tab-btn'}
            >
              Donantes
            </button>
            <button
              onClick={() => setActiveTab('ngo')}
              className={activeTab === 'ngo' ? 'tab-btn active' : 'tab-btn'}
            >
              ONGs
            </button>
            <button
              onClick={() => setActiveTab('driver')}
              className={activeTab === 'driver' ? 'tab-btn active' : 'tab-btn'}
            >
              Conductores
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={activeTab === 'admin' ? 'tab-btn active' : 'tab-btn'}
            >
              Administrador
            </button>
            {!currentUser && (
              <button
                onClick={() => setActiveTab('register')}
                className={activeTab === 'register' ? 'tab-btn register-tab active' : 'tab-btn register-tab'}
              >
                Registrarse
              </button>
            )}
          </div>

          {/* REGISTER TAB */}
          {activeTab === 'register' && !currentUser && (
            <RegisterForm onRegisterSuccess={() => setActiveTab('donor')} />
          )}

          {/* DONOR DASHBOARD */}
          {activeTab === 'donor' && (
            <div className="tab-pane">
              {currentUser && currentUser.role === 'DONOR' ? (
                <div className="dashboard-inner">
                  <div className="welcome-badge">Panel de Donantes</div>
                  <ResourceCatalogForm token={authToken} onResourceCataloged={refreshResources} />
                </div>
              ) : (
                <div className="auth-required-card glass">
                  <h3>Acceso Limitado a Donantes</h3>
                  <p>Inicie sesión con su cuenta de Donante para catalogar y registrar aportes.</p>
                  {!currentUser && renderLoginForm()}
                </div>
              )}
            </div>
          )}

          {/* NGO DASHBOARD */}
          {activeTab === 'ngo' && (
            <div className="tab-pane">
              {currentUser && currentUser.role === 'NGO' ? (
                <div className="dashboard-inner">
                  <div className="welcome-badge">Panel de ONGs / Solicitudes</div>
                  <NeedSubmissionForm token={authToken} onNeedSubmitted={refreshNeeds} />
                </div>
              ) : (
                <div className="auth-required-card glass">
                  <h3>Acceso Limitado a ONGs</h3>
                  <p>Inicie sesión con su cuenta de ONG / Beneficiario para crear solicitudes de insumos.</p>
                  {!currentUser && renderLoginForm()}
                </div>
              )}
            </div>
          )}

          {/* DRIVER DASHBOARD */}
          {activeTab === 'driver' && (
            <div className="tab-pane">
              {currentUser && currentUser.role === 'DRIVER' ? (
                <div className="dashboard-inner driver-dashboard-grid">
                  
                  {/* Account state banner */}
                  <div className="driver-status-card glass">
                    <div className="driver-header">
                      <h3>Mi Cuenta de Conductor</h3>
                      <span className={`status-badge ${currentUser.status}`}>
                        {currentUser.status === 'VERIFIED' ? 'Verificado' : 'Pendiente de Aprobación'}
                      </span>
                    </div>

                    {currentUser.status !== 'VERIFIED' ? (
                      <div className="alert alert-warning margin-top">
                        Su documentación de conducir está en revisión por un administrador. No puede recibir propuestas hasta ser verificado.
                      </div>
                    ) : (
                      <>
                        <div className="availability-toggle-section">
                          <p>
                            Estado Actual: {' '}
                            <strong className={driverAvailable ? 'status-online' : 'status-offline'}>
                              {driverAvailable ? 'DISPONIBLE PARA DESPACHOS' : 'NO DISPONIBLE'}
                            </strong>
                          </p>
                          <button
                            onClick={toggleAvailability}
                            className={`toggle-btn ${driverAvailable ? 'online' : 'offline'}`}
                          >
                            {driverAvailable ? 'Desconectarse' : 'Conectarse (Disponible)'}
                          </button>
                        </div>
                        {driverStatusMessage && <div className="status-msg">{driverStatusMessage}</div>}

                        {/* Network Loss Simulator */}
                        <div className="network-simulator-card">
                          <div className="network-sim-header">
                            <span>Simulador de Red Celular (Prueba Offline)</span>
                            <span className={`network-status ${offlineSimulation ? 'offline' : 'online'}`}>
                              {offlineSimulation ? '🔴 SIN SEÑAL' : '🟢 CON SEÑAL'}
                            </span>
                          </div>
                          <p className="network-sim-desc">
                            Simule la pérdida de señal celular en carreteras de Venezuela. Las coordenadas GPS en tránsito se guardarán en IndexedDB y se subirán juntas cuando reactive la red.
                          </p>
                          <button
                            onClick={toggleOfflineSimulation}
                            className={`network-toggle-btn ${offlineSimulation ? 'reconnect' : 'disconnect'}`}
                          >
                            {offlineSimulation ? 'Restablecer Red (Sincronizar)' : 'Cortar Red (Simular Desconexión)'}
                          </button>
                          {offlineCount > 0 && (
                            <div className="offline-buffer-badge">
                              ⚠️ {offlineCount} coordenadas en cola local (IndexedDB) esperando señal...
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* ACTIVE OFFER PROPOSAL */}
                  {activeProposal && (
                    <div className="proposal-card glass active-glow">
                      <div className="proposal-pulse-header">
                        <h4>🚨 ¡PROPUESTA DE ENTREGA DISPONIBLE!</h4>
                        <span className="countdown-timer">{proposalCountdown}s</span>
                      </div>
                      <p className="proposal-desc">{activeProposal.description}</p>
                      <p className="proposal-sub">Seleccione una opción antes de que expire el tiempo.</p>
                      
                      <div className="proposal-actions">
                        <button onClick={handleAcceptProposal} className="accept-btn">Aceptar Despacho</button>
                        <button onClick={handleRejectProposal} className="reject-btn">Rechazar</button>
                      </div>
                    </div>
                  )}

                  {/* ACTIVE TRANSIT TASK */}
                  {activeTask && (
                    <div className="active-task-card glass">
                      <h4>📦 Entrega en Progreso</h4>
                      <div className="task-details">
                        <p>ID de Despacho: <code>{activeTask.id}</code></p>
                        <p>Estado del Despacho: <span className="badge-transit">EN TRÁNSITO</span></p>
                        <div className="gps-live-box">
                          <span className="gps-indicator"></span>
                          <span>Ubicación GPS actual: {driverLat.toFixed(5)}, {driverLng.toFixed(5)}</span>
                        </div>
                      </div>

                      {/* Delivery Confirmation Form */}
                      <form onSubmit={handleConfirmDelivery} className="confirm-delivery-form">
                        <h5>Confirmar Recepción de Ayuda</h5>
                        <p className="delivery-instructions">Para finalizar la entrega, registre la firma digital del receptor o el URL de la fotografía de prueba.</p>
                        
                        <div className="input-group">
                          <label htmlFor="del-signature">Firma Digital del Receptor (Nombre/Cédula)</label>
                          <input
                            id="del-signature"
                            type="text"
                            placeholder="Ej. María Rodríguez - V-9876543"
                            value={deliverySignature}
                            onChange={(e) => setDeliverySignature(e.target.value)}
                          />
                        </div>

                        <div className="input-group">
                          <label htmlFor="del-photo">URL de la Foto de Prueba de Entrega</label>
                          <input
                            id="del-photo"
                            type="text"
                            placeholder="Ej. /uploads/evidence/task-001.jpg"
                            value={deliveryPhoto}
                            onChange={(e) => setDeliveryPhoto(e.target.value)}
                          />
                        </div>

                        {deliveryError && <span className="error-message">{deliveryError}</span>}
                        {deliveryMessage && <span className="success-message">{deliveryMessage}</span>}

                        <button type="submit" className="confirm-btn">Confirmar Entrega Completa</button>
                      </form>

                      {/* Location updates log */}
                      <div className="location-logs-container">
                        <h6>Registro Local de Coordenadas (Últimos Puntos):</h6>
                        <div className="location-logs-list">
                          {locationLog.map((log, index) => (
                            <div key={index} className="log-row">
                              <span>{log.time}</span>
                              <span>{log.lat.toFixed(4)}, {log.lng.toFixed(4)}</span>
                              <span className={log.status.includes('Sent') ? 'log-sent' : 'log-buffered'}>
                                {log.status}
                              </span>
                            </div>
                          ))}
                          {locationLog.length === 0 && <p className="no-logs">Comenzando a registrar coordenadas cada 15s...</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="auth-required-card glass">
                  <h3>Acceso Limitado a Conductores</h3>
                  <p>Inicie sesión con su cuenta de Conductor para conectarse y administrar entregas.</p>
                  {!currentUser && renderLoginForm()}
                </div>
              )}
            </div>
          )}

          {/* ADMINISTRATOR SIMULATOR TAB */}
          {activeTab === 'admin' && (
            <div className="tab-pane">
              {currentUser && currentUser.role === 'ADMIN' ? (
                <div className="dashboard-inner admin-panel">
                  <div className="welcome-badge admin-badge">Simulador Administrativo</div>
                  
                  <div className="admin-drivers-section glass">
                    <h4>Vetting de Conductores Pendientes</h4>
                    <p className="admin-instructions">Revise la documentación y apruebe conductores para que puedan ponerse disponibles para dispatches.</p>
                    
                    {adminMessage && <div className="alert alert-info">{adminMessage}</div>}

                    <div className="drivers-approval-list">
                      {pendingDrivers.map((driver) => (
                        <div key={driver.id} className="driver-approval-row">
                          <div className="driver-info">
                            <span className="driver-name">{driver.name}</span>
                            <span className="driver-sub">Cédula: {driver.driverDetails.cedula} | Placa: {driver.driverDetails.licensePlate}</span>
                            <span className="driver-vehicle">{driver.driverDetails.vehicleDetails}</span>
                            <a href={driver.driverDetails.licenseDocUrl} target="_blank" className="license-link">
                              Ver Licencia de Conducir 📄
                            </a>
                          </div>
                          <button
                            onClick={() => handleApproveDriver(driver.id)}
                            className="approve-btn"
                          >
                            Aprobar Cuenta
                          </button>
                        </div>
                      ))}
                      {pendingDrivers.length === 0 && (
                        <p className="no-drivers-msg">No hay solicitudes de conductores pendientes de revisión en este momento.</p>
                      )}
                    </div>
                  </div>

                  <div className="admin-matching-section glass margin-top">
                    <h4>Emparejamiento Manual / Simulación</h4>
                    <p className="admin-instructions">
                      Asigne y empareje solicitudes de ONGs abiertas con los donantes/recursos catalogados para crear propuestas de despacho automáticamente.
                    </p>
                    
                    <div className="matching-controls-list">
                      {needsQueue.filter(n => n.status === 'PENDING').map((need) => (
                        <div key={need.id} className="matching-row">
                          <div className="matching-info">
                            <span className="need-title">{need.description}</span>
                            <span className="need-sub">
                              Ubicación: {need.state}, {need.sector} | Prioridad: {need.urgencyScore}
                            </span>
                          </div>
                          <button
                            onClick={() => simulateDispatchproposal(need.id)}
                            className="match-btn"
                          >
                            Emparejar y Proponer Despacho
                          </button>
                        </div>
                      ))}
                      {needsQueue.filter(n => n.status === 'PENDING').length === 0 && (
                        <p className="no-matching-msg">No hay solicitudes pendientes de emparejamiento.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="auth-required-card glass">
                  <h3>Acceso Administrador Requerido</h3>
                  <p>Inicie sesión con una cuenta de Administrador para vetar conductores y forzar emparejamientos.</p>
                  {!currentUser && renderLoginForm()}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Side: Active Inventory & Needs Priorities Queue */}
        <div className="dashboard-status-column animate-slide-up">
          
          {/* NEEDS PRIORITY QUEUE */}
          <div className="status-panel glass">
            <div className="panel-header">
              <h3>Cola de Necesidades Priorizadas</h3>
              <button onClick={refreshNeeds} className="refresh-btn" title="Refrescar">↻</button>
            </div>
            <p className="panel-desc">Solicitudes activas ordenadas por puntaje de urgencia calculado.</p>

            <div className="needs-list">
              {needsQueue.map((need) => {
                const isHigh = need.urgencyScore >= 80;
                return (
                  <div key={need.id} className={`need-item-card ${isHigh ? 'priority-high-border' : ''}`}>
                    <div className="need-card-header">
                      <span className="need-location">{need.state} - {need.sector}</span>
                      <span className={`priority-badge ${isHigh ? 'high' : 'normal'}`}>
                        {isHigh ? 'ATENCIÓN INMEDIATA' : `Prioridad: ${need.urgencyScore}`}
                      </span>
                    </div>
                    <p className="need-card-desc">{need.description}</p>
                    
                    {need.items && need.items.length > 0 && (
                      <div className="need-items-list">
                        <strong>Artículos requeridos:</strong>
                        <ul>
                          {need.items.map((item, idx) => (
                            <li key={idx}>
                              {item.resource ? item.resource.name : 'Recurso'} - Cantidad: {item.quantity}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="need-card-footer">
                      <span className={`status-badge-need ${need.status}`}>
                        {need.status === 'PENDING' ? 'Abierta/Pendiente' : 
                         need.status === 'ALLOCATED' ? 'Asignada / Reservado' : 'Entregado'}
                      </span>
                      <span className="date-tag">{new Date(need.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
              {needsQueue.length === 0 && (
                <p className="empty-panel-msg">No hay solicitudes de auxilio registradas.</p>
              )}
            </div>
          </div>

          {/* ACTIVE INVENTORY CATALOG */}
          <div className="status-panel glass margin-top">
            <div className="panel-header">
              <h3>Catálogo de Recursos & Stock</h3>
              <button onClick={refreshResources} className="refresh-btn" title="Refrescar">↻</button>
            </div>
            <p className="panel-desc">Inventario total de recursos disponibles para asignación.</p>

            <div className="resources-list-box">
              {resourcesList.map((res) => (
                <div key={res.id} className="resource-row">
                  <div className="resource-meta">
                    <span className="res-row-name">{res.name}</span>
                    <span className="res-row-category">{res.category}</span>
                  </div>
                  <div className="resource-stock-box">
                    <span className="res-row-qty">{res.stockQuantity} unidades</span>
                    {res.expirationDate && (
                      <span className="res-row-exp">
                        Vence: {new Date(res.expirationDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {resourcesList.length === 0 && (
                <p className="empty-panel-msg">No hay recursos catalogados en el sistema.</p>
              )}
            </div>
          </div>

        </div>

      </div>

      <style jsx>{`
        .home-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .hero-banner {
          padding: 30px 40px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        @media (max-width: 600px) {
          .hero-banner {
            padding: 20px;
          }
        }
        .hero-banner h1 {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -1px;
          background: linear-gradient(90deg, #f59e0b, #2563eb, #ef4444);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .hero-banner p {
          color: var(--text-secondary);
          font-size: 16px;
          max-width: 700px;
        }
        .user-info-card {
          margin-top: 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          background-color: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          border: 1px solid var(--border-color);
          font-size: 14px;
        }
        @media (max-width: 600px) {
          .user-info-card {
            flex-direction: column;
            gap: 10px;
            align-items: flex-start;
          }
        }
        .logout-btn {
          background-color: var(--error-color);
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: opacity 0.2s;
        }
        .logout-btn:hover {
          opacity: 0.9;
        }
        .guest-banner-msg {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 10px;
        }
        .main-content-grid {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .main-content-grid {
            grid-template-columns: 1fr;
          }
        }
        .nav-tabs {
          display: flex;
          gap: 4px;
          padding: 4px;
          border-radius: 12px;
          margin-bottom: 20px;
        }
        .tab-btn {
          flex: 1;
          background: none;
          border: none;
          padding: 12px 6px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tab-btn:hover {
          color: var(--text-primary);
          background-color: rgba(255, 255, 255, 0.03);
        }
        .tab-btn.active {
          color: var(--text-primary);
          background-color: rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }
        .tab-btn.register-tab {
          background-color: rgba(37, 99, 235, 0.1);
          color: var(--primary-color);
        }
        .tab-btn.register-tab.active {
          background-color: var(--primary-color);
          color: white;
        }
        .auth-required-card {
          padding: 30px;
          text-align: center;
          border-radius: 12px;
        }
        .auth-required-card h3 {
          font-size: 20px;
          margin-bottom: 8px;
        }
        .auth-required-card p {
          color: var(--text-secondary);
          font-size: 14px;
          margin-bottom: 24px;
        }
        .login-mini-form {
          max-width: 320px;
          margin: 0 auto;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .login-mini-form label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
        }
        .login-mini-form input {
          width: 100%;
          padding: 10px;
          background-color: var(--bg-body);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          color: white;
          outline: none;
        }
        .login-mini-form input:focus {
          border-color: var(--primary-color);
        }
        .login-submit-btn {
          background-color: var(--primary-color);
          color: white;
          border: none;
          padding: 12px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .login-submit-btn:hover {
          background-color: var(--primary-hover);
        }
        
        /* Driver styles */
        .driver-dashboard-grid {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .driver-status-card {
          padding: 24px;
          border-radius: 12px;
        }
        .driver-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .status-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
        }
        .status-badge.VERIFIED { background-color: var(--success-glow); color: var(--success-color); border: 1px solid var(--success-color); }
        .status-badge.PENDING_APPROVAL { background-color: var(--warning-glow); color: var(--warning-color); border: 1px solid var(--warning-color); }
        .availability-toggle-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: rgba(255, 255, 255, 0.03);
          padding: 16px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
        }
        @media (max-width: 480px) {
          .availability-toggle-section {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }
        }
        .status-online { color: var(--success-color); }
        .status-offline { color: var(--text-secondary); }
        .toggle-btn {
          border: none;
          padding: 10px 16px;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .toggle-btn.online { background-color: #374151; color: white; }
        .toggle-btn.offline { background-color: var(--success-color); color: white; }
        .status-msg {
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 8px;
          font-style: italic;
        }
        .network-simulator-card {
          margin-top: 20px;
          border-top: 1px solid var(--border-color);
          padding-top: 20px;
        }
        .network-sim-header {
          display: flex;
          justify-content: space-between;
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 8px;
        }
        .network-sim-desc {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 12px;
        }
        .network-toggle-btn {
          width: 100%;
          padding: 10px;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .network-toggle-btn.disconnect { background-color: var(--error-glow); color: var(--error-color); border: 1px solid var(--error-color); }
        .network-toggle-btn.reconnect { background-color: var(--success-glow); color: var(--success-color); border: 1px solid var(--success-color); }
        .offline-buffer-badge {
          margin-top: 10px;
          background-color: var(--warning-glow);
          color: var(--warning-color);
          border: 1px solid var(--warning-color);
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }
        
        /* Proposal offer styling */
        .proposal-card {
          padding: 24px;
          border-radius: 12px;
          border: 1px solid var(--primary-color) !important;
          animation: pulseProposal 2s infinite;
        }
        @keyframes pulseProposal {
          0% { box-shadow: 0 0 10px rgba(37, 99, 235, 0.15); }
          50% { box-shadow: 0 0 25px rgba(37, 99, 235, 0.35); border-color: rgba(37, 99, 235, 0.6); }
          100% { box-shadow: 0 0 10px rgba(37, 99, 235, 0.15); }
        }
        .proposal-pulse-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .proposal-pulse-header h4 {
          color: var(--secondary-color);
          font-size: 16px;
          font-weight: 700;
        }
        .countdown-timer {
          background-color: var(--error-color);
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
        }
        .proposal-desc {
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 8px;
        }
        .proposal-sub {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }
        .proposal-actions {
          display: flex;
          gap: 10px;
        }
        .proposal-actions button {
          flex: 1;
          padding: 11px;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }
        .accept-btn { background-color: var(--success-color); color: white; }
        .reject-btn { background-color: #374151; color: white; }
        
        /* Active task / transit styling */
        .active-task-card {
          padding: 24px;
          border-radius: 12px;
        }
        .active-task-card h4 {
          font-size: 18px;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 10px;
        }
        .task-details {
          background-color: rgba(255, 255, 255, 0.02);
          padding: 16px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          margin-bottom: 20px;
          font-size: 13px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .task-details code {
          font-family: monospace;
          background-color: rgba(0, 0, 0, 0.3);
          padding: 2px 6px;
          border-radius: 4px;
        }
        .badge-transit {
          background-color: var(--primary-glow);
          color: var(--primary-color);
          border: 1px solid var(--primary-color);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
        }
        .gps-live-box {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
          color: var(--success-color);
          margin-top: 4px;
        }
        .gps-indicator {
          width: 8px;
          height: 8px;
          background-color: var(--success-color);
          border-radius: 50%;
          animation: pulse 1.2s infinite;
        }
        .confirm-delivery-form {
          border-top: 1px dashed var(--border-color);
          padding-top: 16px;
          margin-bottom: 20px;
        }
        .confirm-delivery-form h5 {
          font-size: 15px;
          margin-bottom: 6px;
        }
        .delivery-instructions {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 12px;
        }
        .confirm-btn {
          width: 100%;
          background-color: var(--primary-color);
          color: white;
          border: none;
          padding: 12px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          margin-top: 12px;
          transition: background-color 0.2s;
        }
        .confirm-btn:hover { background-color: var(--primary-hover); }
        .location-logs-container {
          background-color: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 12px;
        }
        .location-logs-container h6 {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
          color: var(--text-secondary);
        }
        .location-logs-list {
          max-height: 120px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-family: monospace;
          font-size: 11px;
        }
        .log-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 6px;
          background-color: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }
        .log-sent { color: var(--success-color); }
        .log-buffered { color: var(--warning-color); }
        .no-logs {
          color: var(--text-secondary);
          font-style: italic;
        }
        
        /* Admin tab styles */
        .admin-drivers-section,
        .admin-matching-section {
          padding: 24px;
          border-radius: 12px;
        }
        .admin-instructions {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }
        .drivers-approval-list,
        .matching-controls-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .driver-approval-row,
        .matching-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          padding: 14px;
          border-radius: 8px;
        }
        @media (max-width: 600px) {
          .driver-approval-row,
          .matching-row {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }
        }
        .driver-info,
        .matching-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .driver-name,
        .need-title {
          font-weight: 600;
          font-size: 14px;
        }
        .driver-sub,
        .need-sub {
          font-size: 12px;
          color: var(--text-secondary);
        }
        .driver-vehicle {
          font-size: 12px;
        }
        .license-link {
          font-size: 12px;
          color: var(--primary-color);
          text-decoration: underline;
          margin-top: 4px;
        }
        .approve-btn,
        .match-btn {
          background-color: var(--primary-color);
          color: white;
          border: none;
          padding: 8px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .approve-btn:hover,
        .match-btn:hover {
          background-color: var(--primary-hover);
        }
        .no-drivers-msg,
        .no-matching-msg {
          font-size: 13px;
          color: var(--text-secondary);
          text-align: center;
          font-style: italic;
          padding: 10px;
        }

        /* Right panel styles: Needs queue and resources */
        .status-panel {
          padding: 24px;
          border-radius: 16px;
        }
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .refresh-btn {
          background: none;
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          transition: all 0.2s;
        }
        .refresh-btn:hover {
          border-color: var(--text-primary);
          color: var(--text-primary);
        }
        .panel-desc {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 20px;
        }
        .needs-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 500px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .need-item-card {
          background-color: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: transform 0.2s, background-color 0.2s;
        }
        .need-item-card:hover {
          transform: translateY(-2px);
          background-color: rgba(255, 255, 255, 0.04);
        }
        .priority-high-border {
          border: 1px solid rgba(239, 68, 68, 0.4) !important;
          background-color: rgba(239, 68, 68, 0.02);
        }
        .need-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          gap: 6px;
        }
        .need-location {
          font-weight: 600;
          color: var(--text-secondary);
        }
        .priority-badge {
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
        }
        .priority-badge.high { background-color: var(--error-glow); color: var(--error-color); border: 1px solid var(--error-color); }
        .priority-badge.normal { background-color: var(--primary-glow); color: var(--primary-color); border: 1px solid var(--primary-color); }
        .need-card-desc {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
        }
        .need-items-list {
          font-size: 12px;
          background-color: rgba(0, 0, 0, 0.2);
          padding: 8px 12px;
          border-radius: 6px;
        }
        .need-items-list ul {
          margin-top: 4px;
          padding-left: 16px;
        }
        .need-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          border-top: 1px solid var(--border-color);
          padding-top: 8px;
          margin-top: 4px;
        }
        .status-badge-need {
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
        }
        .status-badge-need.PENDING { background-color: rgba(255, 255, 255, 0.05); color: var(--text-secondary); }
        .status-badge-need.ALLOCATED { background-color: var(--warning-glow); color: var(--warning-color); }
        .status-badge-need.FULFILLED { background-color: var(--success-glow); color: var(--success-color); }
        .date-tag {
          color: var(--text-secondary);
        }
        
        /* Resources list styling */
        .resources-list-box {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 400px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .resource-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background-color: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          transition: background-color 0.2s;
        }
        .resource-row:hover {
          background-color: rgba(255, 255, 255, 0.04);
        }
        .resource-meta {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .res-row-name {
          font-size: 13px;
          font-weight: 600;
        }
        .res-row-category {
          font-size: 10px;
          color: var(--text-secondary);
          text-transform: uppercase;
        }
        .resource-stock-box {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }
        .res-row-qty {
          font-size: 13px;
          font-weight: 700;
          color: var(--secondary-color);
        }
        .res-row-exp {
          font-size: 10px;
          color: var(--error-color);
          font-weight: 500;
        }
        .empty-panel-msg {
          font-size: 12px;
          color: var(--text-secondary);
          text-align: center;
          font-style: italic;
          padding: 20px 0;
        }
        
        .margin-top {
          margin-top: 20px;
        }
        .alert-info {
          background-color: var(--primary-glow);
          color: var(--primary-color);
          border: 1px solid var(--primary-color);
        }
      `}</style>
    </div>
  );

  // Mini login renderer
  function renderLoginForm() {
    return (
      <form onSubmit={handleLogin} className="login-mini-form">
        <div className="input-group">
          <label htmlFor="login-email">Correo Electrónico</label>
          <input
            id="login-email"
            type="email"
            placeholder="ejemplo@correo.com"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="login-password">Contraseña</label>
          <input
            id="login-password"
            type="password"
            placeholder="••••••"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            required
          />
        </div>

        {loginError && <span className="error-message">{loginError}</span>}
        {loginSuccess && <span className="success-message" style={{color: 'var(--success-color)'}}>{loginSuccess}</span>}

        <button type="submit" className="login-submit-btn">Iniciar Sesión</button>
        <button
          type="button"
          onClick={() => setActiveTab('register')}
          className="login-submit-btn"
          style={{backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)'}}
        >
          Crear cuenta nueva
        </button>
      </form>
    );
  }
}
