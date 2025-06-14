import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet-routing-machine';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import './MapPage.css';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapPage() {
  const mapRef = useRef(null);
  const routingControlRef = useRef(null);
  const clickMarkerRef = useRef(null);

  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [startCoords, setStartCoords] = useState(null);
  const [endCoords, setEndCoords] = useState(null);
  const [suggestions, setSuggestions] = useState({ start: [], end: [] });
  const [routeDetails, setRouteDetails] = useState(null);
  const [activeField, setActiveField] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Ensure the map container exists before initializing
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;

    // Initialize map with proper options
    const map = L.map('map', {
      center: [19.076, 72.8777],
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
      touchZoom: true
    });
    
    mapRef.current = map;

    // Add tile layer with error handling
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      tileSize: 256,
      zoomOffset: 0,
      crossOrigin: true
    });

    tileLayer.addTo(map);

    // Handle tile loading errors
    tileLayer.on('tileerror', function(error) {
      console.warn('Tile loading error:', error);
    });

    // Force map to resize after a short delay
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;

      if (!activeField) {
        alert("Please click 📌 Set Start from Map or 📌 Set End from Map first.");
        return;
      }

      if (clickMarkerRef.current) {
        map.removeLayer(clickMarkerRef.current);
      }

      clickMarkerRef.current = L.marker([lat, lng]).addTo(map);

      try {
        setIsLoading(true);
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
        const data = await res.json();
        if (activeField === 'start') {
          setStartInput(data.display_name);
          setStartCoords([lat, lng]);
        } else if (activeField === 'end') {
          setEndInput(data.display_name);
          setEndCoords([lat, lng]);
        }
      } catch (err) {
        console.error("Error with reverse geocoding:", err);
      } finally {
        setIsLoading(false);
      }
    });

    // Cleanup function
    return () => {
      if (map) {
        map.remove();
      }
    };
  }, [activeField]);

  const fetchSuggestions = async (query, type) => {
    if (query.length < 3) return;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`);
      const data = await res.json();
      setSuggestions((prev) => ({ ...prev, [type]: data }));
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  };

  const handleSelectSuggestion = (type, place) => {
    const coords = [parseFloat(place.lat), parseFloat(place.lon)];
    if (type === 'start') {
      setStartInput(place.display_name);
      setStartCoords(coords);
    } else {
      setEndInput(place.display_name);
      setEndCoords(coords);
    }
    setSuggestions((prev) => ({ ...prev, [type]: [] }));
  };

  const useCurrentLocation = (type) => {
    if (!navigator.geolocation) return alert("Geolocation not supported");

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
        const data = await res.json();
        if (type === 'start') {
          setStartInput(data.display_name);
          setStartCoords([lat, lon]);
        } else {
          setEndInput(data.display_name);
          setEndCoords([lat, lon]);
        }
      } catch (err) {
        console.error("Reverse geocoding error:", err);
      } finally {
        setIsLoading(false);
      }
    });
  };

  const drawRoute = () => {
    if (!startCoords || !endCoords) {
      alert("Select both start and end locations.");
      return;
    }

    setIsLoading(true);
    if (routingControlRef.current) {
      mapRef.current.removeControl(routingControlRef.current);
    }

    routingControlRef.current = L.Routing.control({
      waypoints: [L.latLng(...startCoords), L.latLng(...endCoords)],
      routeWhileDragging: false,
      show: false,
      addWaypoints: false,
      createMarker: (i, wp) => L.marker(wp.latLng),
    })
      .on('routesfound', (e) => {
        const route = e.routes[0];
        const distance = (route.summary.totalDistance / 1000).toFixed(2);
        const time = (route.summary.totalTime / 60).toFixed(2);
        setRouteDetails({ distance, time });
        setIsLoading(false);
      })
      .addTo(mapRef.current);
  };

  const clearRoute = () => {
    if (routingControlRef.current) {
      mapRef.current.removeControl(routingControlRef.current);
      routingControlRef.current = null;
    }
    if (clickMarkerRef.current) {
      mapRef.current.removeLayer(clickMarkerRef.current);
      clickMarkerRef.current = null;
    }
    setRouteDetails(null);
    setStartCoords(null);
    setEndCoords(null);
    setStartInput('');
    setEndInput('');
    setActiveField(null);
    setSuggestions({ start: [], end: [] });
  };

  const handleLogout = () => {
    firebase.auth().signOut();
  };

  return (
    <div className="map-container">
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}
      
      <div className="controls-panel">
        <div className="header">
          <h1 className="title">🗺️ Route Planner</h1>
          <button className="logout-btn" onClick={handleLogout}>
            <span>🚪</span> Logout
          </button>
        </div>

        <div className="input-section">
          {/* Start Location */}
          <div className="location-group">
            <label className="location-label">
              <span className="label-icon">🟢</span>
              Starting Point
            </label>
            <div className="input-row">
              <input
                type="text"
                value={startInput}
                onChange={(e) => {
                  setStartInput(e.target.value);
                  fetchSuggestions(e.target.value, 'start');
                  setActiveField('start');
                }}
                placeholder="Enter starting location..."
                className="location-input"
              />
              <button 
                className="action-btn current-location" 
                onClick={() => useCurrentLocation('start')}
                title="Use current location"
              >
                📍
              </button>
              <button 
                className={`action-btn map-select ${activeField === 'start' ? 'active' : ''}`}
                onClick={() => setActiveField('start')}
                title="Select from map"
              >
                📌
              </button>
            </div>
            {suggestions.start.length > 0 && (
              <ul className="suggestions-list">
                {suggestions.start.map((place, i) => (
                  <li
                    key={i}
                    onClick={() => handleSelectSuggestion('start', place)}
                    className="suggestion-item"
                  >
                    <span className="suggestion-icon">📍</span>
                    {place.display_name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* End Location */}
          <div className="location-group">
            <label className="location-label">
              <span className="label-icon">🔴</span>
              Destination
            </label>
            <div className="input-row">
              <input
                type="text"
                value={endInput}
                onChange={(e) => {
                  setEndInput(e.target.value);
                  fetchSuggestions(e.target.value, 'end');
                  setActiveField('end');
                }}
                placeholder="Enter destination..."
                className="location-input"
              />
              <button 
                className="action-btn current-location" 
                onClick={() => useCurrentLocation('end')}
                title="Use current location"
              >
                📍
              </button>
              <button 
                className={`action-btn map-select ${activeField === 'end' ? 'active' : ''}`}
                onClick={() => setActiveField('end')}
                title="Select from map"
              >
                📌
              </button>
            </div>
            {suggestions.end.length > 0 && (
              <ul className="suggestions-list">
                {suggestions.end.map((place, i) => (
                  <li
                    key={i}
                    onClick={() => handleSelectSuggestion('end', place)}
                    className="suggestion-item"
                  >
                    <span className="suggestion-icon">📍</span>
                    {place.display_name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button className="primary-btn" onClick={drawRoute}>
            <span>🗺️</span> Find Route
          </button>
          <button className="secondary-btn" onClick={clearRoute}>
            <span>🗑️</span> Clear
          </button>
        </div>

        {/* Route Information */}
        {routeDetails && (
          <div className="route-info">
            <h3 className="route-info-title">📊 Route Details</h3>
            <div className="route-stats">
              <div className="stat-item">
                <span className="stat-icon">📏</span>
                <div className="stat-content">
                  <div className="stat-label">Distance</div>
                  <div className="stat-value">{routeDetails.distance} km</div>
                </div>
              </div>
              <div className="stat-item">
                <span className="stat-icon">⏱️</span>
                <div className="stat-content">
                  <div className="stat-label">Time</div>
                  <div className="stat-value">{routeDetails.time} mins</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeField && (
          <div className="instruction-banner">
            <span className="instruction-icon">💡</span>
            Click on the map to set your {activeField === 'start' ? 'starting point' : 'destination'}
          </div>
        )}
      </div>

      <div id="map" className="map-display"></div>
    </div>
  );
}

export default MapPage;