import { createContext, useContext, useState, useEffect, useCallback } from "react";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export const LocationContext = createContext(null);

const DEFAULT_LOCATION = {
  label: "Detect location",
  shortLabel: "Detect",
  lat: null,
  lng: null,
  pincode: "",
  city: "",
  state: "",
  fullAddress: "",
};

/**
 * Loads the Google Maps JS SDK once, returning a promise that resolves
 * when window.google.maps is available.
 */
let _sdkPromise = null;
function loadGoogleMapsSDK(apiKey) {
  if (_sdkPromise) return _sdkPromise;
  _sdkPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve(window.google.maps);
      return;
    }
    const callbackName = "__gmInitCallback__";
    window[callbackName] = () => resolve(window.google.maps);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = (e) => reject(new Error("Failed to load Google Maps SDK"));
    document.head.appendChild(script);
  });
  return _sdkPromise;
}

/**
 * Reverse geocodes lat/lng using the Geocoding API.
 * Returns structured location object.
 */
async function reverseGeocode(lat, lng, apiKey) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Geocoding request failed");
  const data = await resp.json();
  if (data.status !== "OK" || !data.results.length) throw new Error("No results from geocoder");
  const result = data.results[0];
  const components = result.address_components || [];

  const get = (types) => {
    const comp = components.find((c) => types.some((t) => c.types.includes(t)));
    return comp ? comp.long_name : "";
  };

  const city =
    get(["locality"]) ||
    get(["administrative_area_level_2"]) ||
    get(["sublocality_level_1"]);
  const state = get(["administrative_area_level_1"]);
  const pincode = get(["postal_code"]);
  const sublocality = get(["sublocality_level_1", "sublocality_level_2"]);
  const shortLabel = sublocality ? `${sublocality}, ${pincode || city}` : (city || "Your location");

  return {
    lat,
    lng,
    city,
    state,
    pincode,
    fullAddress: result.formatted_address,
    shortLabel,
    label: result.formatted_address,
  };
}

/**
 * Parses a Google Places autocomplete result into our location shape.
 */
function parsePlaceResult(place) {
  const components = place.address_components || [];
  const get = (types) => {
    const comp = components.find((c) => types.some((t) => c.types.includes(t)));
    return comp ? comp.long_name : "";
  };
  const city =
    get(["locality"]) ||
    get(["administrative_area_level_2"]) ||
    get(["sublocality_level_1"]);
  const state = get(["administrative_area_level_1"]);
  const pincode = get(["postal_code"]);
  const sublocality = get(["sublocality_level_1", "sublocality_level_2"]);
  const lat = place.geometry?.location?.lat?.() ?? null;
  const lng = place.geometry?.location?.lng?.() ?? null;
  const shortLabel = sublocality ? `${sublocality}, ${pincode || city}` : (city || place.formatted_address);

  return {
    lat,
    lng,
    city,
    state,
    pincode,
    fullAddress: place.formatted_address || "",
    shortLabel,
    label: place.formatted_address || "",
  };
}

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(() => {
    try {
      const saved = localStorage.getItem("subhone_location");
      return saved ? JSON.parse(saved) : DEFAULT_LOCATION;
    } catch {
      return DEFAULT_LOCATION;
    }
  });
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState(null);
  const [mapsReady, setMapsReady] = useState(false);

  // Persist to localStorage whenever location changes
  useEffect(() => {
    if (location.lat) {
      localStorage.setItem("subhone_location", JSON.stringify(location));
    }
  }, [location]);

  // Load Google Maps SDK on mount if API key is available
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;
    loadGoogleMapsSDK(GOOGLE_MAPS_API_KEY)
      .then(() => setMapsReady(true))
      .catch((e) => console.warn("Google Maps SDK load error:", e));
  }, []);

  const detectFromGPS = useCallback(async () => {
    setDetecting(true);
    setError(null);
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      );
      const { latitude: lat, longitude: lng } = pos.coords;

      if (!GOOGLE_MAPS_API_KEY) {
        // Fallback: just show coordinates
        setLocation({
          lat,
          lng,
          city: "",
          state: "",
          pincode: "",
          fullAddress: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          shortLabel: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        });
        return;
      }

      const loc = await reverseGeocode(lat, lng, GOOGLE_MAPS_API_KEY);
      setLocation(loc);
    } catch (e) {
      const msg =
        e.code === 1
          ? "Location permission denied. Please allow location access in your browser settings."
          : e.code === 2
          ? "Location unavailable. Check your device settings."
          : e.code === 3
          ? "Location request timed out."
          : e.message || "Could not detect location.";
      setError(msg);
    } finally {
      setDetecting(false);
    }
  }, []);

  const setFromPlace = useCallback((place) => {
    const loc = parsePlaceResult(place);
    setLocation(loc);
  }, []);

  const clearLocation = useCallback(() => {
    setLocation(DEFAULT_LOCATION);
    localStorage.removeItem("subhone_location");
  }, []);

  return (
    <LocationContext.Provider
      value={{
        location,
        detecting,
        error,
        mapsReady,
        apiKey: GOOGLE_MAPS_API_KEY,
        detectFromGPS,
        setFromPlace,
        clearLocation,
        setError,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}
