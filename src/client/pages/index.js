import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Head from 'next/head';
import RegisterForm from '../components/RegisterForm';
import ResourceCatalogForm from '../components/ResourceCatalogForm';
import NeedSubmissionForm from '../components/NeedSubmissionForm';
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('../components/MapComponent'), { ssr: false });
import { initSocket, sendLocation, disconnectSocket, syncBufferedCoordinates } from '../utils/socket';
import { getBufferedCoordinates, hasBufferedCoordinates } from '../utils/indexeddb';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user: firebaseUser, dbUser, token: authToken, logout, setDbUser, loading } = useAuth();
  const currentUser = dbUser;
  const [activeTab, setActiveTab] = useState('mapa_publico'); // mapa_publico, donor, ngo, driver, admin, register
  const [showPanels, setShowPanels] = useState(true);

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

  // Collection Centers state
  const [collectionCentersList, setCollectionCentersList] = useState([]);
  const [mapClickLocation, setMapClickLocation] = useState(null);
  const [registeringCenter, setRegisteringCenter] = useState(false);
  const [centerName, setCenterName] = useState('');
  const [centerDesc, setCenterDesc] = useState('');
  const [centerAddress, setCenterAddress] = useState('');
  const [centerServices, setCenterServices] = useState([]);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [userGeolocation, setUserGeolocation] = useState(null);

  // Panel minimize states
  const [leftMinimized, setLeftMinimized] = useState(false);
  const [rightMinimized, setRightMinimized] = useState(false);

  // Teams state
  const [availableTeams, setAvailableTeams] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [teamSharing, setTeamSharing] = useState(false);
  const [mapStyle, setMapStyle] = useState('light'); // default to light style
  const [selectedPoint, setSelectedPoint] = useState(null);

  // Complete Driver Profile form fields
  const [driverCedula, setDriverCedula] = useState('');
  const [driverVehicle, setDriverVehicle] = useState('');
  const [driverPlate, setDriverPlate] = useState('');
  const [driverLicenseUrl, setDriverLicenseUrl] = useState('');
  const [driverProfileMessage, setDriverProfileMessage] = useState('');
  const [driverProfileError, setDriverProfileError] = useState('');

  // Driver active tracking state
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

  // Driver settings and nearby Needs
  const [driverRadius, setDriverRadius] = useState(15);
  const [driverGpsSharing, setDriverGpsSharing] = useState(true);

  // Selfie capture states
  const [cameraActive, setCameraActive] = useState(false);
  const [selfieCaptureUrl, setSelfieCaptureUrl] = useState(null);
  const [selfieSaving, setSelfieSaving] = useState(false);
  const [selfieError, setSelfieError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Delivery confirmation fields
  const [deliverySignature, setDeliverySignature] = useState('');
  const [deliveryPhoto, setDeliveryPhoto] = useState('');
  const [deliveryError, setDeliveryError] = useState('');
  const [deliveryMessage, setDeliveryMessage] = useState('');

  const countdownIntervalRef = useRef(null);

  // Fetch updated profile
  const fetchProfile = async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/users/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setDbUser(data.user);
      }
    } catch (e) {
      console.error('Error refreshing profile:', e);
    }
  };

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

  const refreshCollectionCenters = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/collection-centers`);
      if (res.ok) {
        const data = await res.json();
        setCollectionCentersList(data);
      }
    } catch (e) {
      console.error('Error refreshing collection centers:', e);
    }
  };

  const fetchPendingDrivers = async () => {
    try {
      const mockDrivers = [
        { id: 'seed-driver-maria-uid', name: 'María Rodríguez', email: 'conductor.maria@gmail.com', roles: 'DRIVER', driverDetails: { status: 'PENDING_APPROVAL', cedula: 'V-87654321', vehicleDetails: 'Chevrolet Silverado, Color Gris', licensePlate: 'XYZ98W', licenseDocUrl: 'https://storage.googleapis.com/ve-aid-licenses/v87654321.pdf' } }
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
    refreshCollectionCenters();
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

  // Auto-switch to user's dashboard tab on login or refresh
  useEffect(() => {
    if (currentUser && activeTab === 'mapa_publico') {
      const roles = currentUser.roles.split(',');
      if (roles.includes('ADMIN')) {
        setActiveTab('admin');
      } else if (roles.includes('DRIVER')) {
        setActiveTab('driver');
      } else if (roles.includes('NGO')) {
        setActiveTab('ngo');
      } else if (roles.includes('DONOR')) {
        setActiveTab('donor');
      }
    }
  }, [currentUser]);

  // Request browser geolocation on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('[Geolocation] Location obtained:', position.coords.latitude, position.coords.longitude);
          setUserGeolocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('[Geolocation] Error fetching browser geolocation:', error);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Sync offline coordinates regularly
  useEffect(() => {
    let interval = null;
    if (!offlineSimulation) {
      interval = setInterval(async () => {
        const hasOffline = await hasBufferedCoordinates();
        if (hasOffline) {
          console.log('[Offline Sync] Syncing buffered coordinates...');
          await syncBufferedCoordinates();
          const coords = await getBufferedCoordinates();
          setOfflineCount(coords.length);
        }
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [offlineSimulation]);

  // Handle auto-routing tabs on login
  useEffect(() => {
    if (dbUser) {
      const userRoles = dbUser.roles.split(',');
      if (userRoles.includes('ADMIN')) {
        setActiveTab('admin');
      } else if (userRoles.includes('NGO')) {
        setActiveTab('ngo');
      } else if (userRoles.includes('DRIVER')) {
        setActiveTab('driver');
      } else if (userRoles.includes('DONOR')) {
        setActiveTab('donor');
      }
    } else {
      setActiveTab('mapa_publico');
    }
  }, [dbUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess('');

    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setLoginSuccess('Sesión iniciada correctamente.');
      setLoginEmail('');
      setLoginPassword('');
    } catch (err) {
      setLoginError(err.message || 'Error al iniciar sesión');
    }
  };

  const handleLogout = async () => {
    if (currentUser && currentUser.roles.split(',').includes('DRIVER')) {
      stopGPSTracking();
    }
    disconnectSocket();
    await logout();
    setDriverAvailable(false);
    setDriverStatusMessage('');
    setActiveProposal(null);
    setActiveTask(null);
    setOfflineSimulation(false);
    setOfflineCount(0);
    setMyTeam(null);
    setTeamSharing(false);
    setActiveTab('mapa_publico');
  };

  const fetchMyTeamDetails = async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/teams/my-team`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setMyTeam(data);
        if (data.inTeam) {
          setTeamSharing(data.shareLocationWithTeam);
        }
      }
    } catch (e) {
      console.error('Error fetching team details:', e);
    }
  };

  const fetchAvailableTeams = async () => {
    if (!authToken) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/teams`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableTeams(data);
      }
    } catch (e) {
      console.error('Error fetching available teams:', e);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!teamName) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name: teamName, description: teamDesc }),
      });
      if (res.ok) {
        setTeamName('');
        setTeamDesc('');
        await fetchMyTeamDetails();
      } else {
        const err = await res.json();
        alert(err.message || 'Error al crear el equipo.');
      }
    } catch (err) {
      console.error('Error creating team:', err);
    }
  };

  const handleJoinTeam = async (teamId) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/teams/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ teamId }),
      });
      if (res.ok) {
        await fetchMyTeamDetails();
      } else {
        const err = await res.json();
        alert(err.message || 'Error al unirse al equipo.');
      }
    } catch (err) {
      console.error('Error joining team:', err);
    }
  };

  const handleLeaveTeam = async () => {
    if (!confirm('¿Estás seguro de que quieres salir de este equipo?')) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/teams/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        setMyTeam(null);
        setTeamSharing(false);
        await fetchAvailableTeams();
      } else {
        const err = await res.json();
        alert(err.message || 'Error al salir del equipo.');
      }
    } catch (err) {
      console.error('Error leaving team:', err);
    }
  };

  const handleToggleSharing = async (e) => {
    const val = e.target.checked;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/teams/toggle-sharing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ share: val }),
      });
      if (res.ok) {
        setTeamSharing(val);
        await fetchMyTeamDetails();
      } else {
        const err = await res.json();
        alert(err.message || 'Error al actualizar preferencia de ubicación.');
      }
    } catch (err) {
      console.error('Error toggling location sharing:', err);
    }
  };

  // Unified Socket.io connection & listener hook
  useEffect(() => {
    if (currentUser && authToken) {
      const isDriver = currentUser.roles.split(',').includes('DRIVER');
      const socketInstance = initSocket(
        isDriver ? currentUser.id : null,
        {
          onProposal: (payload) => {
            setActiveProposal(payload);
            setProposalCountdown(payload.timeoutSeconds || 60);
          },
          onConnect: async () => {
            console.log('[Socket] Conectado al servidor.');
            if (myTeam?.inTeam) {
              socketInstance.emit('join_team', { teamId: myTeam.team.id });
            }
            const coords = await getBufferedCoordinates();
            setOfflineCount(coords.length);
          },
          onDisconnect: () => {
            console.log('[Socket] Desconectado.');
          }
        },
        currentUser.id
      );

      socketInstance.on('team_location_update', (data) => {
        console.log('[Team Socket] Recibida actualización de ubicación de miembro:', data);
        setMyTeam((prev) => {
          if (!prev || !prev.inTeam) return prev;
          const updatedMembers = prev.team.members.map((m) => {
            if (m.id === data.userId) {
              return {
                ...m,
                location: {
                  latitude: data.latitude,
                  longitude: data.longitude,
                  updatedAt: data.timestamp,
                },
              };
            }
            return m;
          });
          return {
            ...prev,
            team: {
              ...prev.team,
              members: updatedMembers,
            },
          };
        });
      });

      return () => {
        disconnectSocket();
      };
    }
  }, [currentUser, authToken, myTeam?.team?.id]);

  // Geolocation sharing push hook
  useEffect(() => {
    let interval = null;
    if (currentUser && myTeam?.inTeam && teamSharing && !offlineSimulation) {
      console.log('[Team GPS] Iniciando envío periódico de ubicación...');
      if (userGeolocation) {
        sendLocation(null, userGeolocation.lat, userGeolocation.lng);
      }

      interval = setInterval(() => {
        if (typeof window !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setUserGeolocation({ lat, lng });
            sendLocation(null, lat, lng);
          });
        }
      }, 15000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentUser, myTeam?.inTeam, teamSharing, userGeolocation, offlineSimulation]);

  // Fetch available teams and details when token is available
  useEffect(() => {
    if (authToken) {
      fetchMyTeamDetails();
      fetchAvailableTeams();
    }
  }, [authToken]);

  // Fetch details on activeTab Change
  useEffect(() => {
    if (activeTab === 'equipos' && authToken) {
      fetchMyTeamDetails();
      fetchAvailableTeams();
    }
  }, [activeTab, authToken]);

  const toggleAvailability = async () => {
    if (!currentUser || !currentUser.roles.split(',').includes('DRIVER')) return;

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

  const startGPSTracking = () => {
    if (gpsIntervalId) clearInterval(gpsIntervalId);
    if (!driverGpsSharing) {
      console.log('[GPS] Rastro GPS desactivado en configuración.');
      return;
    }

    console.log('[GPS] Iniciando rastreo de coordenadas...');
    let lat = 10.5186;
    let lng = -66.9503;

    const intervalId = setInterval(async () => {
      lat += (Math.random() - 0.5) * 0.002;
      lng += (Math.random() - 0.5) * 0.002;

      setDriverLat(lat);
      setDriverLng(lng);

      const timestamp = new Date().toLocaleTimeString();
      setLocationLog((prev) => [
        { lat, lng, time: timestamp, status: offlineSimulation ? 'Buffered (Offline)' : 'Sent (Online)' },
        ...prev.slice(0, 19),
      ]);

      try {
        await sendLocation(currentUser.id, lat, lng);
        const coords = await getBufferedCoordinates();
        setOfflineCount(coords.length);
      } catch (e) {
        console.error('Error sending GPS log:', e);
      }
    }, 15000);

    setGpsIntervalId(intervalId);
  };

  const stopGPSTracking = () => {
    if (gpsIntervalId) {
      clearInterval(gpsIntervalId);
      setGpsIntervalId(null);
    }
  };

  const toggleGpsSharing = () => {
    const nextVal = !driverGpsSharing;
    setDriverGpsSharing(nextVal);
    if (nextVal) {
      if (activeTask) startGPSTracking();
    } else {
      stopGPSTracking();
      sendLocation(currentUser?.id, null, null);
    }
  };

  const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radio de la tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const startCamera = async () => {
    try {
      setSelfieError('');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setSelfieError('No se pudo acceder a la cámara. Por favor otorga permisos de cámara.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      setSelfieCaptureUrl(dataUrl);
      
      // Detener flujo de cámara
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setCameraActive(false);
    }
  };

  const retakePhoto = () => {
    setSelfieCaptureUrl(null);
    startCamera();
  };

  const saveSelfie = async () => {
    if (!selfieCaptureUrl) return;
    setSelfieSaving(true);
    setSelfieError('');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/users/save-selfie`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ selfieUrl: selfieCaptureUrl }),
      });
      if (response.ok) {
        await fetchProfile();
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Error al guardar la selfie');
      }
    } catch (err) {
      setSelfieError(err.message);
    } finally {
      setSelfieSaving(false);
    }
  };

  const toggleOfflineSimulation = () => {
    const nextOfflineState = !offlineSimulation;
    setOfflineSimulation(nextOfflineState);

    if (nextOfflineState) {
      disconnectSocket();
      console.warn('[Network Simulator] Modo Fuera de Línea Activado. El socket se desconectó.');
    } else {
      console.log('[Network Simulator] Conexión de Red Restablecida. Conectando socket...');
      if (currentUser) {
        initDriverSockets(currentUser.id);
        setTimeout(async () => {
          await syncBufferedCoordinates();
          const coords = await getBufferedCoordinates();
          setOfflineCount(coords.length);
        }, 1000);
      }
    }
  };

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

  // Complete driver profile submit
  const handleCompleteDriverProfile = async (e) => {
    e.preventDefault();
    setDriverProfileError('');
    setDriverProfileMessage('');

    if (!driverCedula || !driverVehicle || !driverPlate) {
      setDriverProfileError('La cédula, descripción del vehículo y la placa son obligatorios.');
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/users/complete-driver-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          cedula: driverCedula,
          vehicleDetails: driverVehicle,
          licensePlate: driverPlate.toUpperCase(),
          licenseDocUrl: driverLicenseUrl || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Error al actualizar perfil de conductor');
      }

      setDriverProfileMessage(data.message || 'Perfil de conductor actualizado con éxito.');
      await fetchProfile(); // Update local dbUser in Context
    } catch (err) {
      setDriverProfileError(err.message);
    }
  };

  // Handle map click to capture coordinates
  const handleMapClick = useCallback((lat, lng) => {
    setMapClickLocation({ lat, lng });
    setRegisteringCenter(true);
    setIsSelectingLocation(false); // Turn off selection mode once clicked
  }, []);

  // Handle map point click selection
  const handlePointClick = useCallback((point) => {
    setSelectedPoint(point);
    setLeftMinimized(false);
  }, []);

  // Register collection center submit
  const handleRegisterCenter = async (e) => {
    e.preventDefault();
    if (!centerName || !centerDesc || centerServices.length === 0) {
      alert('Por favor completa los campos obligatorios del centro de acopio.');
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/collection-centers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          name: centerName,
          description: centerDesc,
          latitude: mapClickLocation.lat,
          longitude: mapClickLocation.lng,
          address: centerAddress,
          services: centerServices.join(','),
        }),
      });

      if (response.ok) {
        alert('Centro de acopio registrado correctamente en el mapa.');
        setRegisteringCenter(false);
        setMapClickLocation(null);
        setCenterName('');
        setCenterDesc('');
        setCenterAddress('');
        setCenterServices([]);
        refreshCollectionCenters();
      } else {
        const errData = await response.json();
        alert(`Error: ${errData.message || 'No se pudo guardar el centro de acopio.'}`);
      }
    } catch (err) {
      alert(`Error de conexión: ${err.message}`);
    }
  };

  const handleServiceCheckbox = (service) => {
    setCenterServices(prev => 
      prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
    );
  };

  const userRoles = currentUser ? currentUser.roles.split(',') : [];

  const memoizedDriverLocation = useMemo(() => {
    if (currentUser && userRoles.includes('DRIVER')) {
      return { lat: driverLat, lng: driverLng };
    }
    return null;
  }, [currentUser, userRoles.join(','), driverLat, driverLng]);

  const memoizedTeamMembers = useMemo(() => {
    return myTeam?.inTeam ? myTeam.team.members : [];
  }, [myTeam?.inTeam, myTeam?.team?.members]);

  if (loading) {
    return (
      <div className="home-wrapper">
        <div className="app-loading-container">
          <div className="spinner"></div>
          <p>Cargando AyudaVenezuela...</p>
        </div>
        <style jsx>{`
          .app-loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            color: white;
            font-family: system-ui, sans-serif;
            background: #0b0f19;
          }
          .spinner {
            border: 4px solid rgba(255, 255, 255, 0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #3b82f6;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // If user is authenticated but has no selfie, force selfie capture!
  if (currentUser && !currentUser.selfieUrl) {
    return (
      <div className="home-wrapper">
        <div className="selfie-capture-overlay glass animate-fade-in">
          <div className="selfie-card glass-card">
            <span className="selfie-badge-icon">📸</span>
            <h2>Verificación de Identidad Requerida</h2>
            <p className="selfie-instructions">
              Para comenzar a operar en <strong>AyudaVenezuela</strong>, debes tomarte una selfie en vivo utilizando tu cámara. 
              Esto nos permite garantizar que todos los colaboradores sean personas reales.
            </p>
            
            <div className="camera-viewport-container">
              {selfieCaptureUrl ? (
                <img src={selfieCaptureUrl} className="selfie-preview-img" alt="Selfie Capturada" />
              ) : (
                <video ref={videoRef} autoPlay playsInline className="selfie-video-preview"></video>
              )}
              
              {!cameraActive && !selfieCaptureUrl && (
                <div className="camera-placeholder">
                  <span>Cámara inactiva</span>
                </div>
              )}
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>

            {selfieError && <div className="selfie-error-msg">⚠️ {selfieError}</div>}

            <div className="selfie-actions-row">
              {!cameraActive && !selfieCaptureUrl && (
                <button onClick={startCamera} className="selfie-action-btn primary">
                  Activar Cámara
                </button>
              )}

              {cameraActive && (
                <button onClick={capturePhoto} className="selfie-action-btn capture">
                  Capturar Foto
                </button>
              )}

              {selfieCaptureUrl && (
                <>
                  <button onClick={saveSelfie} disabled={selfieSaving} className="selfie-action-btn primary">
                    {selfieSaving ? 'Guardando...' : 'Guardar y Continuar'}
                  </button>
                  <button onClick={retakePhoto} disabled={selfieSaving} className="selfie-action-btn secondary">
                    Tomar Otra
                  </button>
                </>
              )}
            </div>
            
            <button onClick={handleLogout} className="selfie-logout-btn">Cerrar Sesión</button>
          </div>
        </div>
        <style jsx>{`
          .selfie-capture-overlay {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100vw;
            height: 100vh;
            background: rgba(11, 15, 25, 0.9);
            box-sizing: border-box;
            padding: 20px;
          }
          .selfie-card {
            max-width: 440px;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 30px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
            border-radius: 20px;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          .selfie-badge-icon {
            font-size: 40px;
            margin-bottom: 12px;
          }
          .selfie-card h2 {
            font-size: 20px;
            color: #f8fafc;
            margin: 0 0 10px 0;
            font-weight: 700;
          }
          .selfie-instructions {
            font-size: 13px;
            color: #cbd5e1;
            line-height: 1.5;
            margin-bottom: 20px;
          }
          .camera-viewport-container {
            width: 260px;
            height: 260px;
            border-radius: 50%;
            overflow: hidden;
            border: 4px solid #3b82f6;
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
            position: relative;
            background: #000;
            margin-bottom: 20px;
          }
          .selfie-video-preview, .selfie-preview-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .camera-placeholder {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            font-size: 13px;
          }
          .selfie-error-msg {
            color: #ef4444;
            font-size: 12px;
            margin-bottom: 15px;
            font-weight: bold;
          }
          .selfie-actions-row {
            display: flex;
            gap: 12px;
            width: 100%;
            margin-bottom: 15px;
          }
          .selfie-action-btn {
            flex: 1;
            padding: 12px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
          }
          .selfie-action-btn.primary {
            background-color: #3b82f6;
            color: white;
          }
          .selfie-action-btn.primary:hover {
            background-color: #2563eb;
          }
          .selfie-action-btn.capture {
            background-color: #ef4444;
            color: white;
            animation: pulse-red 1.5s infinite;
          }
          .selfie-action-btn.secondary {
            background-color: rgba(255, 255, 255, 0.08);
            color: #cbd5e1;
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          .selfie-action-btn.secondary:hover {
            background-color: rgba(255, 255, 255, 0.15);
          }
          .selfie-logout-btn {
            background: none;
            border: none;
            color: #94a3b8;
            font-size: 12px;
            cursor: pointer;
            transition: color 0.2s;
            margin-top: 10px;
            text-decoration: underline;
          }
          .selfie-logout-btn:hover {
            color: #f8fafc;
          }
          @keyframes pulse-red {
            0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="home-wrapper">
      <Head>
        <title>AyudaVenezuela - Plataforma de Auxilio y Centros de Acopio</title>
      </Head>

      {/* FULL VIEW MAP RENDERED IN THE BACKGROUND */}
      <MapComponent
        needs={needsQueue}
        collectionCenters={collectionCentersList}
        driverLocation={memoizedDriverLocation}
        userGeolocation={userGeolocation}
        teamMembers={memoizedTeamMembers}
        currentUser={currentUser}
        activeTask={activeTask}
        onMapClick={isSelectingLocation ? handleMapClick : null}
        mapStyle={mapStyle}
        onPointClick={handlePointClick}
      />

      {/* FLOATING ACTION OVERLAY CONTROLLER */}
      <div className="floating-ui-container">
        
        {/* Bottom controls panel holding the UI toggler and Map Style selector */}
        <div className="bottom-controls-bar glass animate-fade-in">
          <button 
            className="toggle-ui-btn"
            onClick={() => setShowPanels(!showPanels)}
            title={showPanels ? "Ocultar Paneles de Datos" : "Mostrar Paneles de Datos"}
          >
            {showPanels ? 'Ocultar UI ✕' : 'Mostrar Control UI 👁️'}
          </button>
          
          <div className="map-style-selector">
            <span className="style-label">Mapa:</span>
            <select
              value={mapStyle}
              onChange={(e) => setMapStyle(e.target.value)}
              className="map-style-select"
            >
              <option value="light">Claro ☀️</option>
              <option value="dark">Oscuro 🌙</option>
              <option value="classic">Estándar 🗺️</option>
              <option value="satellite">Satélite 🛰️</option>
            </select>
          </div>
        </div>

        {showPanels && (
          <div className="panels-layout-wrapper">
            
            {/* FLOATING HEADER: Brand Logo and Login/Logout status */}
            <div className="floating-header glass animate-fade-in">
              <div className="brand-box">
                <span className="brand-logo">🇻🇪</span>
                <div className="brand-text">
                  <h2>AyudaVenezuela</h2>
                  <p>Coordinación Humanitaria de Emergencia</p>
                </div>
              </div>
              
              {currentUser ? (
                <div className="header-session-info">
                  <span>Conectado: <strong>{currentUser.name}</strong></span>
                  <button onClick={handleLogout} className="logout-btn">Salir</button>
                </div>
              ) : (
                <span className="guest-badge">Modo Invitado / Observador</span>
              )}
            </div>

            {/* TWO FLOATING COLUMNS OVER THE MAP */}
            <div className="floating-body-columns">
              
              {/* LEFT COLUMN: Navigation & Dynamic tab forms */}
              <div className={`column-panel left-panel animate-slide-up ${leftMinimized ? 'minimized' : ''}`}>
                <div className="panel-header-minimize">
                  <span>{leftMinimized ? '📁 Panel de Control' : ''}</span>
                  <button 
                    className="minimize-panel-btn" 
                    onClick={() => setLeftMinimized(!leftMinimized)}
                    title={leftMinimized ? "Maximizar Panel" : "Minimizar Panel"}
                  >
                    {leftMinimized ? '➕' : '➖'}
                  </button>
                </div>

                {selectedPoint && !leftMinimized && (
                  <div className="selected-point-details-card glass animate-fade-in">
                    <div className="card-header">
                      <span className="point-type-badge">
                        {selectedPoint.type === 'center' ? '🏠 Centro de Acopio' : '🚨 Necesidad'}
                      </span>
                      <button onClick={() => setSelectedPoint(null)} className="close-point-btn" title="Cerrar detalles">✕</button>
                    </div>

                    <div className="card-body">
                      {selectedPoint.type === 'center' ? (
                        <>
                          <h3>{selectedPoint.data.name}</h3>
                          <p className="point-desc"><strong>Servicios:</strong> {selectedPoint.data.services}</p>
                          {selectedPoint.data.address && (
                            <p className="point-desc"><strong>Dirección:</strong> {selectedPoint.data.address}</p>
                          )}
                          <p className="point-desc"><strong>Descripción:</strong> {selectedPoint.data.description}</p>
                          <p className="point-coords">📍 Coordenadas: {parseFloat(selectedPoint.data.latitude).toFixed(5)}, {parseFloat(selectedPoint.data.longitude).toFixed(5)}</p>
                          
                          {currentUser && userRoles.includes('NGO') && (
                            <button
                              onClick={() => {
                                // Pre-fill need creation form coordinates
                                setNeedLat(selectedPoint.data.latitude);
                                setNeedLng(selectedPoint.data.longitude);
                                setNeedState(selectedPoint.data.address?.split(',')[0] || '');
                                setActiveTab('need');
                              }}
                              className="point-action-btn"
                            >
                              ✍️ Crear Solicitud Aquí
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <h3>{selectedPoint.data.state} - {selectedPoint.data.sector}</h3>
                          <p className="point-desc"><strong>Descripción:</strong> {selectedPoint.data.description}</p>
                          <div className="point-meta-row">
                            <span className={`point-urgency-badge ${selectedPoint.data.urgencyScore >= 80 ? 'high' : 'normal'}`}>
                              Urgencia: {selectedPoint.data.urgencyScore}
                            </span>
                            <span className="point-status-badge">
                              {selectedPoint.data.status === 'PENDING' ? 'Pendiente' : selectedPoint.data.status === 'ALLOCATED' ? 'Asignado' : 'Entregado'}
                            </span>
                          </div>
                          <p className="point-coords">📍 Coordenadas: {parseFloat(selectedPoint.data.latitude).toFixed(5)}, {parseFloat(selectedPoint.data.longitude).toFixed(5)}</p>

                          {currentUser && userRoles.includes('ADMIN') && selectedPoint.data.status === 'PENDING' && (
                            <button
                              onClick={() => handleProposeDispatch(selectedPoint.data.id)}
                              className="point-action-btn dispatch-action"
                            >
                              ⚡ Asignar Conductor Cercano
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {!leftMinimized && (
                  <>
                    {/* Navigation Tabs */}
                    <div className="nav-tabs glass">
                      <button
                        onClick={() => setActiveTab('mapa_publico')}
                        className={activeTab === 'mapa_publico' ? 'tab-btn active' : 'tab-btn'}
                      >
                        Inicio
                      </button>
                      {(!currentUser || userRoles.includes('DONOR')) && (
                        <button
                          onClick={() => setActiveTab('donor')}
                          className={activeTab === 'donor' ? 'tab-btn active' : 'tab-btn'}
                        >
                          Donantes
                        </button>
                      )}
                      {(!currentUser || userRoles.includes('NGO')) && (
                        <button
                          onClick={() => setActiveTab('ngo')}
                          className={activeTab === 'ngo' ? 'tab-btn active' : 'tab-btn'}
                        >
                          ONGs
                        </button>
                      )}
                      {(!currentUser || userRoles.includes('DRIVER')) && (
                        <button
                          onClick={() => setActiveTab('driver')}
                          className={activeTab === 'driver' ? 'tab-btn active' : 'tab-btn'}
                        >
                          Conductores
                        </button>
                      )}
                      {(!currentUser || userRoles.includes('ADMIN')) && (
                        <button
                          onClick={() => setActiveTab('admin')}
                          className={activeTab === 'admin' ? 'tab-btn active' : 'tab-btn'}
                        >
                          Admin
                        </button>
                      )}
                      {currentUser && (
                        <button
                          onClick={() => setActiveTab('equipos')}
                          className={activeTab === 'equipos' ? 'tab-btn active' : 'tab-btn'}
                        >
                          Equipos
                        </button>
                      )}
                      {!currentUser && (
                        <button
                          onClick={() => setActiveTab('register')}
                          className={activeTab === 'register' ? 'tab-btn register-tab active' : 'tab-btn register-tab'}
                        >
                          Registrarse
                        </button>
                      )}
                    </div>

                {/* MAP INSTRUCTIONS TAB (LANDING VIEW) */}
                {activeTab === 'mapa_publico' && (
                  <div className="tab-pane-content glass-card">
                    <div className="welcome-badge">Panel Informativo</div>
                    <p className="panel-text">
                      Estás visualizando el mapa nacional de ayuda en tiempo real.
                    </p>
                    <div className="legend-box">
                      <div className="legend-item"><span className="dot red"></span><span>Emergencia Inmediata</span></div>
                      <div className="legend-item"><span className="dot blue"></span><span>Necesidad Normal</span></div>
                      <div className="legend-item"><span className="dot orange"></span><span>Centro de Acopio (🏠)</span></div>
                      <div className="legend-item"><span className="dot cyan"></span><span>Mi Ubicación Actual (👤)</span></div>
                    </div>

                    <button
                      className={`register-center-trigger-btn ${isSelectingLocation ? 'active' : ''}`}
                      onClick={() => setIsSelectingLocation(!isSelectingLocation)}
                    >
                      {isSelectingLocation ? '✕ Cancelar Registro' : '📍 Registrar Centro de Acopio'}
                    </button>

                    <p className="panel-text-small text-orange" style={{ marginTop: '12px' }}>
                      {isSelectingLocation 
                        ? '👉 Ahora haz clic sobre cualquier punto del mapa para ubicar el centro.' 
                        : '💡 Presiona el botón de arriba y luego haz clic en el mapa para registrar un nuevo centro de acopio.'}
                    </p>
                  </div>
                )}

                {/* REGISTER TAB */}
                {activeTab === 'register' && !currentUser && (
                  <RegisterForm onRegisterSuccess={() => setActiveTab('donor')} />
                )}

                {/* DONOR DASHBOARD */}
                {activeTab === 'donor' && (
                  <div className="tab-pane-content">
                    {currentUser && userRoles.includes('DONOR') ? (
                      <div className="glass-card">
                        <div className="welcome-badge">Aportar Recursos</div>
                        <ResourceCatalogForm token={authToken} onResourceCataloged={refreshResources} />
                      </div>
                    ) : (
                      <div className="auth-required-card glass-card">
                        <h3>Acceso Limitado a Donantes</h3>
                        <p>Inicie sesión con su cuenta de Donante para catalogar y registrar aportes.</p>
                        {!currentUser && renderLoginForm()}
                      </div>
                    )}
                  </div>
                )}

                {/* NGO DASHBOARD */}
                {activeTab === 'ngo' && (
                  <div className="tab-pane-content">
                    {currentUser && userRoles.includes('NGO') ? (
                      <div className="glass-card">
                        <div className="welcome-badge">Solicitar Insumos</div>
                        <NeedSubmissionForm token={authToken} onNeedSubmitted={refreshNeeds} />
                      </div>
                    ) : (
                      <div className="auth-required-card glass-card">
                        <h3>Acceso Limitado a ONGs</h3>
                        <p>Inicie sesión con su cuenta de ONG / Beneficiario para crear solicitudes de insumos.</p>
                        {!currentUser && renderLoginForm()}
                      </div>
                    )}
                  </div>
                )}

                {/* DRIVER DASHBOARD */}
                {activeTab === 'driver' && (
                  <div className="tab-pane-content">
                    {currentUser && userRoles.includes('DRIVER') ? (
                      <div className="driver-dashboard-grid">
                        
                        {/* Account state banner */}
                        <div className="driver-status-card glass-card">
                          <div className="driver-header">
                            <h3>Mi Perfil de Conductor</h3>
                            {currentUser.driverDetails ? (
                              <span className={`status-badge ${currentUser.driverDetails.status}`}>
                                {currentUser.driverDetails.status === 'VERIFIED' ? 'Verificado' : 'Pendiente'}
                              </span>
                            ) : (
                              <span className="status-badge PENDING_APPROVAL">Incompleto</span>
                            )}
                          </div>

                          {!currentUser.driverDetails ? (
                            <div className="complete-profile-form-box">
                              <div className="alert alert-warning">
                                Completa tus datos de vehículo y placa para poder conectarte y recibir asignaciones.
                              </div>

                              <form onSubmit={handleCompleteDriverProfile} className="complete-profile-form">
                                <div className="input-group">
                                  <label htmlFor="drv-cedula">Cédula de Identidad *</label>
                                  <input
                                    id="drv-cedula"
                                    type="text"
                                    placeholder="Ej. V-12345678"
                                    value={driverCedula}
                                    onChange={(e) => setDriverCedula(e.target.value)}
                                    required
                                  />
                                </div>

                                <div className="input-group">
                                  <label htmlFor="drv-vehicle">Descripción del Vehículo *</label>
                                  <input
                                    id="drv-vehicle"
                                    type="text"
                                    placeholder="Ej. Camión Hilux Blanco 4x4"
                                    value={driverVehicle}
                                    onChange={(e) => setDriverVehicle(e.target.value)}
                                    required
                                  />
                                </div>

                                <div className="input-group">
                                  <label htmlFor="drv-plate">Placa del Vehículo *</label>
                                  <input
                                    id="drv-plate"
                                    type="text"
                                    placeholder="Ej. AA123BB"
                                    value={driverPlate}
                                    onChange={(e) => setDriverPlate(e.target.value)}
                                    required
                                  />
                                </div>

                                <div className="input-group">
                                  <label htmlFor="drv-license-url">Enlace de la Licencia Digital (Opcional)</label>
                                  <input
                                    id="drv-license-url"
                                    type="text"
                                    placeholder="Ej. /uploads/licenses/lic-123.jpg"
                                    value={driverLicenseUrl}
                                    onChange={(e) => setDriverLicenseUrl(e.target.value)}
                                  />
                                </div>

                                {driverProfileError && <span className="error-message">{driverProfileError}</span>}
                                {driverProfileMessage && <span className="success-message">{driverProfileMessage}</span>}

                                <button type="submit" className="confirm-btn">Enviar Perfil</button>
                              </form>
                            </div>
                          ) : currentUser.driverDetails.status !== 'VERIFIED' ? (
                            <div className="alert alert-warning">
                              Su documentación está en revisión por un administrador. No puede recibir propuestas hasta ser verificado.
                            </div>
                          ) : (
                            <>
                              <div className="availability-toggle-section">
                                <p>
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
                                  <span>Simulador Fuera de Línea</span>
                                  <span className={`network-status ${offlineSimulation ? 'offline' : 'online'}`}>
                                    {offlineSimulation ? '🔴 SIN SEÑAL' : '🟢 CON SEÑAL'}
                                  </span>
                                </div>
                                <button
                                  onClick={toggleOfflineSimulation}
                                  className={`network-toggle-btn ${offlineSimulation ? 'reconnect' : 'disconnect'}`}
                                >
                                  {offlineSimulation ? 'Sincronizar Coordenadas' : 'Simular Corte de Señal'}
                                </button>
                                {offlineCount > 0 && (
                                  <div className="offline-buffer-badge">
                                    ⚠️ {offlineCount} coordenadas en cola local esperando señal...
                                  </div>
                                )}
                              </div>

                              {/* Driver Alert Radius & GPS Sharing Settings */}
                              <div className="driver-settings-card glass-card">
                                <h4>⚙️ Ajustes del Conductor</h4>
                                
                                <div className="setting-row">
                                  <label>Rastreo y Compartición de Ubicación (GPS):</label>
                                  <button
                                    onClick={toggleGpsSharing}
                                    type="button"
                                    className={`toggle-btn ${driverGpsSharing ? 'online' : 'offline'}`}
                                  >
                                    {driverGpsSharing ? '🟢 Transmitiendo GPS' : '🔴 GPS Detenido'}
                                  </button>
                                </div>

                                <div className="setting-row" style={{ marginTop: '14px' }}>
                                  <label>Radio de Cobertura para Alertas: <strong>{driverRadius} km</strong></label>
                                  <input
                                    type="range"
                                    min="1"
                                    max="50"
                                    value={driverRadius}
                                    onChange={(e) => setDriverRadius(parseInt(e.target.value))}
                                    className="radius-range-slider"
                                  />
                                </div>
                              </div>

                              {/* Needs in Range Alerts list */}
                              <div className="nearby-needs-card glass-card">
                                <h4>🔔 Alertas Cercanas en tu Zona ({driverRadius} km)</h4>
                                <div className="nearby-needs-list">
                                  {needsQueue
                                    .filter(need => need.status === 'PENDING')
                                    .filter(need => {
                                      if (!need.latitude || !need.longitude) return false;
                                      const dist = getDistanceKm(driverLat, driverLng, parseFloat(need.latitude), parseFloat(need.longitude));
                                      return dist <= driverRadius;
                                    })
                                    .map(need => {
                                      const dist = getDistanceKm(driverLat, driverLng, parseFloat(need.latitude), parseFloat(need.longitude));
                                      return (
                                        <div key={need.id} className="nearby-need-row">
                                          <div className="need-meta">
                                            <span className="need-location">{need.state} - {need.sector}</span>
                                            <span className="need-distance">{dist.toFixed(1)} km</span>
                                          </div>
                                          <p className="need-desc-text">{need.description}</p>
                                          <span className={`urgency-tag ${need.urgencyScore >= 80 ? 'high' : 'normal'}`}>
                                            Prioridad: {need.urgencyScore}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  {needsQueue
                                    .filter(need => need.status === 'PENDING')
                                    .filter(need => {
                                      if (!need.latitude || !need.longitude) return false;
                                      const dist = getDistanceKm(driverLat, driverLng, parseFloat(need.latitude), parseFloat(need.longitude));
                                      return dist <= driverRadius;
                                    }).length === 0 && (
                                      <p className="no-needs-msg">No hay alertas activas en tu radio de cobertura.</p>
                                    )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* ACTIVE OFFER PROPOSAL */}
                        {activeProposal && (
                          <div className="proposal-card glass-card active-glow">
                            <div className="proposal-pulse-header">
                              <h4>🚨 ¡DESPACHO PROPUESTO!</h4>
                              <span className="countdown-timer">{proposalCountdown}s</span>
                            </div>
                            <p className="proposal-desc">{activeProposal.description}</p>
                            <div className="proposal-actions">
                              <button onClick={handleAcceptProposal} className="accept-btn">Aceptar</button>
                              <button onClick={handleRejectProposal} className="reject-btn">Rechazar</button>
                            </div>
                          </div>
                        )}

                        {/* ACTIVE TRANSIT TASK */}
                        {activeTask && (
                          <div className="active-task-card glass-card">
                            <h4>📦 Entrega en Progreso</h4>
                            <div className="task-details">
                              <p>ID: <code>{activeTask.id}</code></p>
                              <p>Ubicación GPS: {driverLat.toFixed(4)}, {driverLng.toFixed(4)}</p>
                              {activeTask.need && activeTask.need.latitude && activeTask.need.longitude && (
                                <div className="maps-navigation-box">
                                  <a 
                                    href={`https://www.google.com/maps/dir/?api=1&origin=${driverLat},${driverLng}&destination=${activeTask.need.latitude},${activeTask.need.longitude}&travelmode=driving`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="google-maps-btn"
                                  >
                                    🗺️ Abrir en Google Maps para Navegar
                                  </a>
                                </div>
                              )}
                            </div>

                            <form onSubmit={handleConfirmDelivery} className="confirm-delivery-form">
                              <h5>Confirmar Recepción</h5>
                              <div className="input-group">
                                <label htmlFor="del-signature">Nombre / Cédula Receptor</label>
                                <input
                                  id="del-signature"
                                  type="text"
                                  value={deliverySignature}
                                  onChange={(e) => setDeliverySignature(e.target.value)}
                                />
                              </div>
                              <div className="input-group">
                                <label htmlFor="del-photo">URL Foto de Entrega</label>
                                <input
                                  id="del-photo"
                                  type="text"
                                  value={deliveryPhoto}
                                  onChange={(e) => setDeliveryPhoto(e.target.value)}
                                />
                              </div>
                              {deliveryError && <span className="error-message">{deliveryError}</span>}
                              {deliveryMessage && <span className="success-message">{deliveryMessage}</span>}
                              <button type="submit" className="confirm-btn">Confirmar Entrega</button>
                            </form>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="auth-required-card glass-card">
                        <h3>Acceso Conductor Requerido</h3>
                        <p>Inicie sesión con su cuenta de Conductor para conectarse y administrar entregas.</p>
                        {!currentUser && renderLoginForm()}
                      </div>
                    )}
                  </div>
                )}

                {/* ADMINISTRATOR SIMULATOR TAB */}
                {activeTab === 'admin' && (
                  <div className="tab-pane-content">
                    {currentUser && userRoles.includes('ADMIN') ? (
                      <div className="admin-panel">
                        <div className="admin-drivers-section glass-card">
                          <h4>Vetting de Conductores</h4>
                          {adminMessage && <div className="alert alert-info">{adminMessage}</div>}
                          <div className="drivers-approval-list">
                             {pendingDrivers.map((driver) => (
                              <div key={driver.id} className="driver-approval-row">
                                <div className="driver-info">
                                  <span className="driver-name">{driver.name}</span>
                                  <span className="driver-sub">Cédula: {driver.driverDetails.cedula}</span>
                                </div>
                                <button onClick={() => handleApproveDriver(driver.id)} className="approve-btn">Aprobar</button>
                              </div>
                            ))}
                            {pendingDrivers.length === 0 && <p className="no-drivers-msg">No hay conductores pendientes.</p>}
                          </div>
                        </div>

                        <div className="admin-matching-section glass-card margin-top">
                          <h4>Emparejamiento Manual</h4>
                          <div className="matching-controls-list">
                            {needsQueue.filter(n => n.status === 'PENDING').map((need) => (
                              <div key={need.id} className="matching-row">
                                <div className="matching-info">
                                  <span className="need-title">{need.description}</span>
                                </div>
                                <button onClick={() => simulateDispatchproposal(need.id)} className="match-btn">Asignar Conductor</button>
                              </div>
                            ))}
                            {needsQueue.filter(n => n.status === 'PENDING').length === 0 && <p className="no-matching-msg">No hay solicitudes pendientes.</p>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="auth-required-card glass-card">
                        <h3>Acceso Administrador Requerido</h3>
                        <p>Inicie sesión con cuenta de Administrador para realizar vetting.</p>
                        {!currentUser && renderLoginForm()}
                      </div>
                    )}
                  </div>
                )}

                {/* TEAMS MANAGEMENT TAB */}
                {activeTab === 'equipos' && (
                  <div className="tab-pane-content">
                    {currentUser ? (
                      <div className="teams-dashboard">
                        {myTeam && myTeam.inTeam ? (
                          <div className="glass-card">
                            <div className="welcome-badge">Mi Equipo: {myTeam.team.name}</div>
                            {myTeam.team.description && (
                              <p className="team-description">{myTeam.team.description}</p>
                            )}
                            
                            <div className="team-sharing-control">
                              <label className="checkbox-label location-sharing-switch">
                                <input
                                  type="checkbox"
                                  checked={teamSharing}
                                  onChange={handleToggleSharing}
                                />
                                📡 Compartir mi ubicación en tiempo real con el equipo
                              </label>
                            </div>

                            <div className="team-members-section">
                              <h4>Miembros del Equipo</h4>
                              <div className="team-members-list">
                                {myTeam.team.members.map((member) => (
                                  <div key={member.id} className="team-member-row">
                                    <div className="member-meta">
                                      <span className="member-name">
                                        {member.name} {member.id === currentUser.id ? '(Tú)' : ''}
                                      </span>
                                      <span className="member-roles">{member.roles.split(',').join(', ')}</span>
                                    </div>
                                    <div className="member-location-status">
                                      {member.shareLocationWithTeam ? (
                                        member.location ? (
                                          <span className="location-active-badge">
                                            🟢 En vivo: {member.location.latitude.toFixed(4)}, {member.location.longitude.toFixed(4)}
                                          </span>
                                        ) : (
                                          <span className="location-pending-badge">🟡 Esperando GPS</span>
                                        )
                                      ) : (
                                        <span className="location-inactive-badge">🔴 Sin compartir</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <button onClick={handleLeaveTeam} className="leave-team-btn">
                              Salir del Equipo
                            </button>
                          </div>
                        ) : (
                          <div className="teams-setup">
                            <div className="glass-card">
                              <h4>Crear un Equipo Nuevo</h4>
                              <form onSubmit={handleCreateTeam} className="create-team-form">
                                <div className="input-group">
                                  <label htmlFor="team-name">Nombre del Equipo *</label>
                                  <input
                                    id="team-name"
                                    type="text"
                                    placeholder="Ej. Unidad de Rescate Caracas"
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    required
                                  />
                                </div>
                                <div className="input-group">
                                  <label htmlFor="team-desc">Descripción</label>
                                  <input
                                    id="team-desc"
                                    type="text"
                                    placeholder="Ej. Grupo de conductores voluntarios."
                                    value={teamDesc}
                                    onChange={(e) => setTeamDesc(e.target.value)}
                                  />
                                </div>
                                <button type="submit" className="confirm-btn">Crear Equipo</button>
                              </form>
                            </div>

                            <div className="glass-card margin-top">
                              <h4>Unirse a un Equipo Existente</h4>
                              <div className="available-teams-list">
                                {availableTeams.map((team) => (
                                  <div key={team.id} className="available-team-row">
                                    <div className="team-info">
                                      <span className="available-team-name">{team.name}</span>
                                      {team.description && (
                                        <span className="available-team-desc">{team.description}</span>
                                      )}
                                      <span className="team-creator">Creado por: {team.creator.name}</span>
                                    </div>
                                    <button
                                      onClick={() => handleJoinTeam(team.id)}
                                      className="join-team-btn"
                                    >
                                      Unirse
                                    </button>
                                  </div>
                                ))}
                                {availableTeams.length === 0 && (
                                  <p className="no-teams-msg">No hay equipos disponibles.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="auth-required-card glass-card">
                        <h3>Acceso Requerido</h3>
                        <p>Inicie sesión con su cuenta para crear o unirse a un equipo.</p>
                        {renderLoginForm()}
                      </div>
                    )}
                  </div>
                )}

                  </>
                )}
              </div>

              {/* RIGHT COLUMN: Queues and stock summaries */}
              <div className={`column-panel right-panel animate-slide-up ${rightMinimized ? 'minimized' : ''}`}>
                <div className="panel-header-minimize">
                  <span>{rightMinimized ? '📊 Resumen General' : ''}</span>
                  <button 
                    className="minimize-panel-btn" 
                    onClick={() => setRightMinimized(!rightMinimized)}
                    title={rightMinimized ? "Maximizar Panel" : "Minimizar Panel"}
                  >
                    {rightMinimized ? '➕' : '➖'}
                  </button>
                </div>

                {!rightMinimized && (
                  <>
                
                {/* NEEDS PRIORITY QUEUE */}
                <div className="status-panel glass-card">
                  <div className="panel-header">
                    <h3>Cola de Urgencias</h3>
                    <button onClick={refreshNeeds} className="refresh-btn">↻</button>
                  </div>
                  <div className="needs-list">
                    {needsQueue.map((need) => {
                      const isHigh = need.urgencyScore >= 80;
                      return (
                        <div key={need.id} className={`need-item-card ${isHigh ? 'priority-high-border' : ''}`}>
                          <div className="need-card-header">
                            <span className="need-location">{need.state} - {need.sector}</span>
                            <span className={`priority-badge ${isHigh ? 'high' : 'normal'}`}>
                              {isHigh ? 'INMEDIATO' : `Prioridad: ${need.urgencyScore}`}
                            </span>
                          </div>
                          <p className="need-card-desc">{need.description}</p>
                          <div className="need-card-footer">
                            <span className={`status-badge-need ${need.status}`}>
                              {need.status === 'PENDING' ? 'Pendiente' : 
                               need.status === 'ALLOCATED' ? 'Asignada' : 'Entregado'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {needsQueue.length === 0 && <p className="empty-panel-msg">No hay solicitudes.</p>}
                  </div>
                </div>

                {/* ACTIVE INVENTORY CATALOG */}
                <div className="status-panel glass-card margin-top">
                  <div className="panel-header">
                    <h3>Inventario Disponible</h3>
                    <button onClick={refreshResources} className="refresh-btn">↻</button>
                  </div>
                  <div className="resources-list-box">
                    {resourcesList.map((res) => (
                      <div key={res.id} className="resource-row">
                        <div className="resource-meta">
                          <span className="res-row-name">{res.name}</span>
                          <span className="res-row-category">{res.category}</span>
                        </div>
                        <span className="res-row-qty">{res.stockQuantity} un.</span>
                      </div>
                    ))}
                    {resourcesList.length === 0 && <p className="empty-panel-msg">No hay recursos.</p>}
                  </div>
                </div>
                  </>
                )}
              </div>

            </div>

            {/* MAP CLICK MODAL OVERLAY FOR REGISTERING A CENTER */}
            {registeringCenter && mapClickLocation && (
              <div className="collection-center-modal glass-card animate-fade-in">
                <h3>Registrar Centro de Acopio</h3>
                <p className="modal-coords">Ubicación elegida: {mapClickLocation.lat.toFixed(5)}, {mapClickLocation.lng.toFixed(5)}</p>
                
                <form onSubmit={handleRegisterCenter}>
                  <div className="input-group">
                    <label htmlFor="center-name">Nombre del Centro *</label>
                    <input
                      id="center-name"
                      type="text"
                      placeholder="Ej. Comedor Comunitario El Valle"
                      value={centerName}
                      onChange={(e) => setCenterName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="center-desc">Descripción de la Ayuda *</label>
                    <textarea
                      id="center-desc"
                      placeholder="Ej. Ofrecemos comida caliente y camas para emergencias."
                      value={centerDesc}
                      onChange={(e) => setCenterDesc(e.target.value)}
                      required
                      rows={3}
                      className="textarea-input"
                    />
                  </div>

                  <div className="input-group">
                    <label>Servicios Ofrecidos *</label>
                    <div className="checkbox-grid">
                      <label className="checkbox-label">
                        <input type="checkbox" checked={centerServices.includes('Comida')} onChange={() => handleServiceCheckbox('Comida')} />
                        Alimentos
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={centerServices.includes('Medicina')} onChange={() => handleServiceCheckbox('Medicina')} />
                        Medicina
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={centerServices.includes('Camas')} onChange={() => handleServiceCheckbox('Camas')} />
                        Dormitorio
                      </label>
                      <label className="checkbox-label">
                        <input type="checkbox" checked={centerServices.includes('Refugio')} onChange={() => handleServiceCheckbox('Refugio')} />
                        Refugio
                      </label>
                    </div>
                  </div>

                  <div className="input-group">
                    <label htmlFor="center-address">Dirección Física</label>
                    <input
                      id="center-address"
                      type="text"
                      placeholder="Ej. Frente a Plaza Bolívar"
                      value={centerAddress}
                      onChange={(e) => setCenterAddress(e.target.value)}
                    />
                  </div>

                  <div className="modal-actions">
                    <button type="submit" className="confirm-btn">Guardar Centro</button>
                    <button type="button" className="reject-btn" onClick={() => { setRegisteringCenter(false); setMapClickLocation(null); }}>Cancelar</button>
                  </div>
                </form>
              </div>
            )}
            
          </div>
        )}
      </div>

      <style jsx>{`
        .home-wrapper {
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background-color: #0b0f19;
        }

        .floating-ui-container {
          position: relative;
          z-index: 10;
          width: 100%;
          height: 100%;
          pointer-events: none; /* Let map clicks pass through */
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
        }

        .panels-layout-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 20px;
          box-sizing: border-box;
        }

        .bottom-controls-bar {
          position: fixed;
          bottom: 20px;
          left: 20px;
          pointer-events: auto;
          z-index: 100;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 16px;
          border-radius: 30px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
        }

        .toggle-ui-btn {
          background: none;
          border: none;
          font-weight: 700;
          font-size: 13px;
          color: #f8fafc;
          cursor: pointer;
          transition: all 0.2s;
          padding: 6px 12px;
          border-radius: 20px;
        }

        .toggle-ui-btn:hover {
          background-color: rgba(255, 255, 255, 0.08);
        }

        .map-style-selector {
          display: flex;
          align-items: center;
          gap: 6px;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          padding-left: 12px;
        }

        .style-label {
          font-size: 11px;
          color: #cbd5e1;
          font-weight: bold;
          text-transform: uppercase;
        }

        .map-style-select {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #f8fafc;
          border-radius: 12px;
          padding: 4px 8px;
          font-size: 12px;
          outline: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .map-style-select:hover {
          border-color: rgba(255, 255, 255, 0.2);
          background: rgba(0, 0, 0, 0.6);
        }

        /* Floating Header design */
        .floating-header {
          pointer-events: auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 24px;
          border-radius: 16px;
          margin-bottom: 20px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
          width: 100%;
          box-sizing: border-box;
        }

        .brand-box {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-logo {
          font-size: 28px;
        }

        .brand-text h2 {
          font-size: 18px;
          font-weight: 800;
          color: #f8fafc;
          letter-spacing: -0.5px;
        }

        .brand-text p {
          font-size: 11px;
          color: #94a3b8;
        }

        .header-session-info {
          display: flex;
          align-items: center;
          gap: 14px;
          font-size: 13px;
          color: #e2e8f0;
        }

        .logout-btn {
          background-color: #ef4444;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 12px;
          transition: opacity 0.2s;
        }

        .logout-btn:hover { opacity: 0.9; }
        .guest-badge {
          background-color: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          color: #cbd5e1;
        }

        /* Columns Floating Panels Layout */
        .floating-body-columns {
          display: flex;
          justify-content: space-between;
          flex: 1;
          height: calc(100vh - 160px);
          gap: 20px;
          box-sizing: border-box;
          overflow: hidden;
        }

        .column-panel {
          pointer-events: auto; /* Re-enable click actions */
          display: flex;
          flex-direction: column;
          max-height: 100%;
          overflow-y: auto;
          gap: 16px;
          /* Custom scrollbar */
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }

        .column-panel::-webkit-scrollbar {
          width: 6px;
        }
        .column-panel::-webkit-scrollbar-thumb {
          background-color: rgba(255,255,255,0.1);
          border-radius: 3px;
        }

        .left-panel {
          width: 440px;
        }

        .right-panel {
          width: 380px;
        }

        @media (max-width: 900px) {
          .floating-body-columns {
            flex-direction: column;
            overflow-y: auto;
          }
          .left-panel, .right-panel {
            width: 100%;
            max-height: none;
          }
        }

        /* Glass Cards styles */
        .glass-card {
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        .welcome-badge {
          font-size: 15px;
          font-weight: 700;
          color: #f97316;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .panel-text {
          font-size: 13px;
          color: #cbd5e1;
          line-height: 1.5;
          margin-bottom: 14px;
        }

        .panel-text-small {
          font-size: 12px;
          line-height: 1.4;
        }

        .text-orange {
          color: #fdba74;
        }

        .legend-box {
          display: flex;
          flex-direction: column;
          gap: 8px;
          background: rgba(0, 0, 0, 0.2);
          padding: 12px;
          border-radius: 10px;
          margin-bottom: 16px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: #cbd5e1;
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .dot.red { background-color: #ef4444; box-shadow: 0 0 8px #ef4444; }
        .dot.blue { background-color: #3b82f6; }
        .dot.orange { background-color: #f97316; }
        .dot.cyan { background-color: #06b6d4; box-shadow: 0 0 8px #06b6d4; }

        .register-center-trigger-btn {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid rgba(249, 115, 22, 0.4);
          background-color: rgba(249, 115, 22, 0.1);
          color: #fdba74;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 14px;
        }
        .register-center-trigger-btn:hover {
          background-color: rgba(249, 115, 22, 0.2);
          border-color: rgba(249, 115, 22, 0.6);
        }
        .register-center-trigger-btn.active {
          background-color: #ef4444;
          border-color: #ef4444;
          color: white;
          animation: pulse-red-btn 1.5s infinite;
        }
        @keyframes pulse-red-btn {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .nav-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          padding: 4px;
          border-radius: 12px;
          margin-bottom: 14px;
          pointer-events: auto;
        }

        .tab-btn {
          flex: 1;
          min-width: 75px;
          background: none;
          border: none;
          padding: 10px 4px;
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          color: #f8fafc;
          background-color: rgba(255, 255, 255, 0.03);
        }

        .tab-btn.active {
          color: #f8fafc;
          background-color: rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
        }

        .tab-btn.register-tab {
          background-color: rgba(59, 130, 246, 0.1);
          color: #60a5fa;
        }
        .tab-btn.register-tab.active {
          background-color: #3b82f6;
          color: white;
        }

        .auth-required-card {
          text-align: center;
        }
        .auth-required-card h3 {
          font-size: 18px;
          margin-bottom: 8px;
          color: #f8fafc;
        }
        .auth-required-card p {
          color: #94a3b8;
          font-size: 13px;
          margin-bottom: 20px;
        }

        .login-mini-form {
          max-width: 100%;
          margin: 0 auto;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .login-mini-form label {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .login-mini-form input {
          width: 100%;
          padding: 12px 14px;
          background-color: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          color: white;
          outline: none;
          font-size: 13px;
          transition: all 0.2s;
        }
        .login-mini-form input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
        }
        .login-submit-btn {
          background-color: #3b82f6;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }
        .login-submit-btn:hover {
          background-color: #2563eb;
          transform: translateY(-1px);
        }
        .login-submit-btn:active {
          transform: translateY(0);
        }

        .panel-header-minimize {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 11px;
          font-weight: bold;
          color: #cbd5e1;
          user-select: none;
        }

        .minimize-panel-btn {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 12px;
          cursor: pointer;
          transition: transform 0.2s;
          padding: 4px;
        }

        .minimize-panel-btn:hover {
          color: #f8fafc;
          transform: scale(1.1);
        }

        .column-panel.minimized {
          height: auto !important;
          max-height: 40px !important;
          overflow: hidden !important;
          padding: 0 !important;
          transition: max-height 0.3s ease-out;
        }

        /* Teams Styles */
        .teams-dashboard, .teams-setup {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .team-description {
          font-size: 12px;
          color: #cbd5e1;
          margin-bottom: 14px;
          line-height: 1.4;
        }

        .team-sharing-control {
          background: rgba(6, 182, 212, 0.1);
          border: 1px solid rgba(6, 182, 212, 0.25);
          padding: 12px;
          border-radius: 10px;
          margin-bottom: 14px;
        }

        .location-sharing-switch {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #a5f3fc;
          cursor: pointer;
        }

        .team-members-section h4 {
          font-size: 13px;
          color: #f8fafc;
          margin-bottom: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 6px;
        }

        .team-members-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 200px;
          overflow-y: auto;
        }

        .team-member-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
        }

        .member-meta {
          display: flex;
          flex-direction: column;
        }

        .member-name {
          font-size: 12px;
          font-weight: 600;
          color: #f8fafc;
        }

        .member-roles {
          font-size: 9px;
          color: #94a3b8;
          text-transform: uppercase;
        }

        .location-active-badge {
          font-size: 10px;
          color: #34d399;
          font-weight: bold;
        }

        .location-pending-badge {
          font-size: 10px;
          color: #fbbf24;
        }

        .location-inactive-badge {
          font-size: 10px;
          color: #f87171;
        }

        .leave-team-btn {
          width: 100%;
          padding: 11px;
          background-color: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          border-radius: 10px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 10px;
        }

        .leave-team-btn:hover {
          background-color: rgba(239, 68, 68, 0.25);
        }

        .available-teams-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 200px;
          overflow-y: auto;
        }

        .available-team-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
        }

        .team-info {
          display: flex;
          flex-direction: column;
        }

        .available-team-name {
          font-size: 12px;
          font-weight: 600;
          color: #f8fafc;
        }

        .available-team-desc {
          font-size: 10px;
          color: #cbd5e1;
        }

        .team-creator {
          font-size: 9px;
          color: #94a3b8;
        }

        .join-team-btn {
          padding: 6px 12px;
          background-color: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .join-team-btn:hover {
          background-color: rgba(59, 130, 246, 0.25);
        }

        /* Selected point details card overlay */
        .selected-point-details-card {
          margin: 14px;
          padding: 16px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.95);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        }

        .selected-point-details-card .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .point-type-badge {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          padding: 4px 8px;
          border-radius: 6px;
          letter-spacing: 0.5px;
        }

        .close-point-btn {
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: color 0.2s;
        }

        .close-point-btn:hover {
          color: #f8fafc;
        }

        .selected-point-details-card h3 {
          font-size: 15px;
          color: #f8fafc;
          margin: 0 0 10px 0;
          font-weight: 700;
        }

        .point-desc {
          font-size: 12px;
          color: #cbd5e1;
          margin: 0 0 8px 0;
          line-height: 1.4;
        }

        .point-coords {
          font-size: 10px;
          color: #94a3b8;
          margin: 6px 0 12px 0;
        }

        .point-meta-row {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
        }

        .point-urgency-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .point-urgency-badge.high {
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
        }

        .point-urgency-badge.normal {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }

        .point-status-badge {
          font-size: 11px;
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .point-action-btn {
          width: 100%;
          padding: 10px;
          background-color: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .point-action-btn:hover {
          background-color: rgba(59, 130, 246, 0.25);
          transform: translateY(-1px);
        }

        .point-action-btn.dispatch-action {
          background-color: rgba(249, 115, 22, 0.15);
          border-color: rgba(249, 115, 22, 0.3);
          color: #ff9800;
        }

        .point-action-btn.dispatch-action:hover {
          background-color: rgba(249, 115, 22, 0.25);
        }

        /* Collection Center register Modal on top of map */
        .collection-center-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 1000;
          pointer-events: auto;
          width: 460px;
          max-width: 90%;
          max-height: 85vh;
          overflow-y: auto;
          background: rgba(15, 23, 42, 0.95);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(249, 115, 22, 0.3);
          border-radius: 20px;
          padding: 28px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
          animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        @keyframes scaleUp {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        .collection-center-modal h3 {
          font-size: 20px;
          color: #f97316;
          margin-bottom: 4px;
        }
        .modal-coords {
          font-size: 11px;
          color: #94a3b8;
          font-family: monospace;
          margin-bottom: 18px;
        }
        .textarea-input {
          padding: 10px;
          background-color: #0b0f19;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: white;
          font-size: 13px;
          font-family: inherit;
          resize: vertical;
          outline: none;
        }
        .textarea-input:focus { border-color: #f97316; }
        .checkbox-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          background: rgba(0, 0, 0, 0.2);
          padding: 10px;
          border-radius: 8px;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          cursor: pointer;
          color: #cbd5e1;
        }
        .modal-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }

        /* Complete profile & Driver Styles */
        .complete-profile-form-box {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 16px;
          margin-top: 10px;
        }
        .complete-profile-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .input-group label {
          font-size: 12px;
          color: #cbd5e1;
          font-weight: 500;
        }
        .input-group input[type="text"] {
          padding: 10px 12px;
          background-color: #0b0f19;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: white;
          font-size: 13px;
          outline: none;
        }
        .input-group input[type="text"]:focus {
          border-color: #3b82f6;
        }

        .driver-dashboard-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .driver-status-card {
          padding: 20px;
          border-radius: 16px;
        }
        .driver-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 10px;
          margin-bottom: 14px;
        }
        .status-badge {
          padding: 3px 8px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 700;
        }
        .status-badge.VERIFIED { background-color: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid #10b981; }
        .status-badge.PENDING_APPROVAL { background-color: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid #f59e0b; }
        
        .availability-toggle-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(0, 0, 0, 0.2);
          padding: 12px;
          border-radius: 10px;
        }
        .status-online { color: #10b981; }
        .status-offline { color: #94a3b8; }
        .toggle-btn {
          border: none;
          padding: 8px 14px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
        }
        .toggle-btn.online { background-color: #374151; color: white; }
        .toggle-btn.offline { background-color: #10b981; color: white; }

        .network-simulator-card {
          margin-top: 14px;
          border-top: 1px dashed rgba(255, 255, 255, 0.08);
          padding-top: 14px;
        }
        .network-sim-header {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
          color: #94a3b8;
        }
        .network-status.online { color: #10b981; }
        .network-status.offline { color: #ef4444; }
        .network-toggle-btn {
          width: 100%;
          padding: 8px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 12px;
          cursor: pointer;
        }
        .network-toggle-btn.disconnect { background-color: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid #ef4444; }
        .network-toggle-btn.reconnect { background-color: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid #10b981; }
        .offline-buffer-badge {
          margin-top: 8px;
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1px solid #f59e0b;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 11px;
        }

        /* Driver setting adjustments & alert cards */
        .driver-settings-card, .nearby-needs-card {
          margin-top: 14px;
          border-top: 1px dashed rgba(255, 255, 255, 0.08);
          padding-top: 14px;
        }
        .setting-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .setting-row label {
          font-size: 11px;
          color: #94a3b8;
          text-transform: uppercase;
          font-weight: bold;
        }
        .radius-range-slider {
          width: 100%;
          cursor: pointer;
          accent-color: #3b82f6;
          margin-top: 4px;
        }
        .nearby-needs-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 250px;
          overflow-y: auto;
          margin-top: 10px;
        }
        .nearby-need-row {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .need-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .need-location {
          font-size: 12px;
          font-weight: 700;
          color: #f8fafc;
        }
        .need-distance {
          font-size: 10px;
          color: #38bdf8;
          font-weight: bold;
        }
        .need-desc-text {
          font-size: 11px;
          color: #cbd5e1;
          margin: 0;
        }
        .no-needs-msg {
          font-size: 11px;
          color: #94a3b8;
          text-align: center;
          padding: 12px;
          margin: 0;
        }
        .google-maps-btn {
          display: inline-block;
          width: 100%;
          text-align: center;
          padding: 11px;
          background-color: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #34d399;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          margin-top: 10px;
          box-sizing: border-box;
          transition: all 0.2s;
        }
        .google-maps-btn:hover {
          background-color: rgba(16, 185, 129, 0.25);
          transform: translateY(-1px);
        }

        .proposal-card {
          border: 1px solid #3b82f6;
          animation: pulseProposal 2s infinite;
          padding: 20px;
          border-radius: 16px;
        }
        @keyframes pulseProposal {
          0% { box-shadow: 0 0 10px rgba(59, 130, 246, 0.2); }
          50% { box-shadow: 0 0 25px rgba(59, 130, 246, 0.4); border-color: #60a5fa; }
          100% { box-shadow: 0 0 10px rgba(59, 130, 246, 0.2); }
        }
        .proposal-pulse-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .proposal-pulse-header h4 { color: #60a5fa; font-size: 14px; font-weight: 800; }
        .countdown-timer { background: #ef4444; color: white; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
        .proposal-actions { display: flex; gap: 8px; margin-top: 12px; }
        .proposal-actions button { flex: 1; padding: 8px; border-radius: 6px; font-weight: 700; font-size: 12px; border: none; cursor: pointer; }
        .accept-btn { background: #10b981; color: white; }
        .reject-btn { background: #374151; color: white; }

        .active-task-card {
          padding: 20px;
          border-radius: 16px;
        }
        .task-details {
          background-color: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 12px;
          border-radius: 10px;
          font-size: 12px;
          margin-bottom: 14px;
        }
        .confirm-delivery-form {
          border-top: 1px dashed rgba(255, 255, 255, 0.08);
          padding-top: 12px;
        }
        .confirm-btn {
          width: 100%;
          background: #3b82f6;
          color: white;
          border: none;
          padding: 10px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          margin-top: 10px;
        }

        /* Admin panel approval row */
        .driver-approval-row, .matching-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 10px 14px;
          border-radius: 10px;
        }
        .driver-info, .matching-info {
          display: flex;
          flex-direction: column;
        }
        .driver-name, .need-title { font-weight: 600; font-size: 13px; color: #f8fafc; }
        .driver-sub { font-size: 11px; color: #94a3b8; }
        .approve-btn, .match-btn { background: #3b82f6; color: white; border: none; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; }
        
        /* Queues & Resource catalogs right panel cards */
        .status-panel {
          padding: 20px;
          border-radius: 16px;
        }
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .panel-header h3 { font-size: 14px; font-weight: 800; color: #f8fafc; text-transform: uppercase; letter-spacing: 0.5px; }
        .refresh-btn {
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 12px;
        }

        .needs-list, .resources-list-box {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 280px;
          overflow-y: auto;
        }

        .need-item-card {
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 12px;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .priority-high-border { border-color: rgba(239, 68, 68, 0.3) !important; }
        .need-card-header { display: flex; justify-content: space-between; font-size: 11px; }
        .need-location { font-weight: 700; color: #94a3b8; }
        .priority-badge { font-weight: 800; }
        .priority-badge.high { color: #f87171; }
        .priority-badge.normal { color: #60a5fa; }
        .need-card-desc { font-size: 12px; color: #cbd5e1; line-height: 1.4; }
        .need-card-footer { border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 6px; font-size: 10px; }
        
        .resource-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .resource-meta { display: flex; flex-direction: column; }
        .res-row-name { font-size: 12px; font-weight: 600; color: #f8fafc; }
        .res-row-category { font-size: 9px; color: #94a3b8; text-transform: uppercase; }
        .res-row-qty { font-size: 12px; font-weight: 700; color: #fdba74; }

        .empty-panel-msg { font-size: 11px; color: #94a3b8; font-style: italic; text-align: center; padding: 10px 0; }
        .margin-top { margin-top: 16px; }

        .alert {
          padding: 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .alert-warning { background-color: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid #f59e0b; }
        .alert-info { background-color: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid #3b82f6; }
        .alert-success { background-color: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid #10b981; }

        .error-message { color: #ef4444; font-size: 11px; }
        .success-message { color: #10b981; font-size: 11px; }

        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        .animate-slide-up { animation: slideUp 0.3s ease-out; }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
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
          style={{backgroundColor: 'transparent', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8'}}
        >
          Crear cuenta nueva
        </button>
      </form>
    );
  }
}
