import { useState, useEffect, useRef } from "react";
import { MapPin, Navigation, X, Search, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useLocation } from "../context/LocationContext";
import { useLockBodyScroll, useEscapeKey } from "../lib/hooks";
import { cx } from "../lib/format";

const POPULAR_CITIES = [
  { name: "Delhi", pincode: "110001", lat: 28.6139, lng: 77.209 },
  { name: "Mumbai", pincode: "400001", lat: 19.076, lng: 72.8777 },
  { name: "Bengaluru", pincode: "560001", lat: 12.9716, lng: 77.5946 },
  { name: "Kolkata", pincode: "700001", lat: 22.5726, lng: 88.3639 },
  { name: "Hyderabad", pincode: "500001", lat: 17.385, lng: 78.4867 },
  { name: "Chennai", pincode: "600001", lat: 13.0827, lng: 80.2707 },
  { name: "Pune", pincode: "411001", lat: 18.5204, lng: 73.8567 },
  { name: "Ahmedabad", pincode: "380001", lat: 23.0225, lng: 72.5714 },
];

/**
 * LocationModal – lets the user:
 *  1. Detect their current GPS location (Google Maps Geocoding)
 *  2. Search for any address with Google Places Autocomplete
 *  3. Pick from a list of popular cities
 */
export default function LocationModal({ open, onClose }) {
  const { location, detecting, error, mapsReady, apiKey, detectFromGPS, setFromPlace, setError } =
    useLocation();

  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [success, setSuccess] = useState(false);

  const inputRef = useRef(null);
  const autocompleteServiceRef = useRef(null);
  const sessionTokenRef = useRef(null);

  useLockBodyScroll(open);
  useEscapeKey(onClose, open);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
      setPredictions([]);
      setSuccess(false);
    }
  }, [open]);

  // Init autocomplete service once maps SDK is ready
  useEffect(() => {
    if (mapsReady && window.google?.maps?.places) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }
  }, [mapsReady]);

  // Search with Google Places Autocomplete
  useEffect(() => {
    if (!query.trim() || !autocompleteServiceRef.current) {
      setPredictions([]);
      return;
    }
    const t = setTimeout(() => {
      setSearching(true);
      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: "in" },
          sessionToken: sessionTokenRef.current,
        },
        (results, status) => {
          setSearching(false);
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(results);
          } else {
            setPredictions([]);
          }
        }
      );
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handlePredictionSelect = (prediction) => {
    // Use PlacesService to get full details
    const map = new window.google.maps.Map(document.createElement("div"));
    const service = new window.google.maps.places.PlacesService(map);
    service.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["address_components", "formatted_address", "geometry", "name"],
        sessionToken: sessionTokenRef.current,
      },
      (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          setFromPlace(place);
          setSuccess(true);
          // Refresh session token
          sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
          setTimeout(onClose, 800);
        }
      }
    );
  };

  const handleCitySelect = (city) => {
    // Quick-set from a popular city (no geocoding round-trip needed)
    setFromPlace({
      address_components: [
        { long_name: city.name, types: ["locality"] },
        { long_name: city.pincode, types: ["postal_code"] },
      ],
      formatted_address: `${city.name}, India`,
      geometry: {
        location: {
          lat: () => city.lat,
          lng: () => city.lng,
        },
      },
    });
    setSuccess(true);
    setTimeout(onClose, 600);
  };

  const handleDetect = async () => {
    setSuccess(false);
    await detectFromGPS();
    setSuccess(true);
    setTimeout(onClose, 1000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy-deep/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl shadow-2xl animate-slide-up sm:animate-fade-in overflow-hidden">
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-outline-variant" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/60">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-on-surface">Set Delivery Location</h2>
              <p className="text-xs text-on-surface-variant">
                {location.fullAddress
                  ? `Current: ${location.shortLabel}`
                  : "Help us deliver to you faster"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* GPS Detect Button */}
          <button
            onClick={handleDetect}
            disabled={detecting}
            className={cx(
              "w-full flex items-center gap-3 px-5 py-4 rounded-xl border-2 font-semibold transition-all",
              detecting
                ? "border-primary/40 bg-primary/5 text-primary cursor-not-allowed"
                : success
                ? "border-success-green bg-success-green/10 text-success-green"
                : "border-primary/30 text-primary hover:bg-primary/5 hover:border-primary"
            )}
          >
            {detecting ? (
              <Loader2 className="h-5 w-5 animate-spin shrink-0" />
            ) : success ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <Navigation className="h-5 w-5 shrink-0" />
            )}
            <span>
              {detecting
                ? "Detecting your location…"
                : success
                ? `Location set: ${location.shortLabel}`
                : "Use my current location"}
            </span>
          </button>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-error-container text-on-error-container text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">Location Error</p>
                <p>{error}</p>
                {error.includes("denied") && (
                  <p className="mt-1 text-xs opacity-80">
                    Open your browser settings → Site settings → Location → Allow for this site.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Search Box */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin text-outline" />
              ) : (
                <Search className="h-4 w-4 text-outline" />
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setError(null); }}
              placeholder={
                mapsReady
                  ? "Search area, street, city or pincode…"
                  : apiKey
                  ? "Loading Google Maps…"
                  : "Enter area or pincode (Maps key not set)"
              }
              className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-sm"
            />
          </div>

          {/* Autocomplete Predictions */}
          {predictions.length > 0 && (
            <div className="rounded-xl border border-outline-variant overflow-hidden shadow-sm">
              {predictions.map((pred, i) => (
                <button
                  key={pred.place_id}
                  onClick={() => handlePredictionSelect(pred)}
                  className={cx(
                    "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-container-low transition-colors",
                    i < predictions.length - 1 ? "border-b border-outline-variant/50" : ""
                  )}
                >
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-outline" />
                  <div>
                    <p className="text-sm font-semibold text-on-surface leading-snug">
                      {pred.structured_formatting?.main_text}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {pred.structured_formatting?.secondary_text}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Divider */}
          {!query && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-outline-variant/60" />
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                  Popular Cities
                </span>
                <div className="flex-1 h-px bg-outline-variant/60" />
              </div>

              {/* Popular Cities Grid */}
              <div className="grid grid-cols-4 gap-2">
                {POPULAR_CITIES.map((city) => (
                  <button
                    key={city.name}
                    onClick={() => handleCitySelect(city)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-outline-variant hover:border-primary/40 hover:bg-primary/5 transition-all group"
                  >
                    <span className="text-xl leading-none">
                      {city.name === "Delhi" ? "🏛️" :
                       city.name === "Mumbai" ? "🌊" :
                       city.name === "Bengaluru" ? "🌿" :
                       city.name === "Kolkata" ? "🎨" :
                       city.name === "Hyderabad" ? "💎" :
                       city.name === "Chennai" ? "🏖️" :
                       city.name === "Pune" ? "🎓" : "🏙️"}
                    </span>
                    <span className="text-xs font-semibold text-on-surface group-hover:text-primary text-center leading-tight">
                      {city.name}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* No API Key notice */}
          {!apiKey && (
            <p className="text-xs text-center text-on-surface-variant bg-surface-container rounded-lg px-4 py-3">
              💡 Add your{" "}
              <code className="font-mono bg-surface-container-high px-1 rounded">
                VITE_GOOGLE_MAPS_API_KEY
              </code>{" "}
              to <code className="font-mono bg-surface-container-high px-1 rounded">.env</code> to
              enable full Google Maps search.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
