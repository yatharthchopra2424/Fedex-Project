import { useState } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { useMediaQuery } from 'react-responsive';
import polyline from '@mapbox/polyline';

const FitBounds = ({ bounds }) => {
  const map = useMap();
  map.fitBounds(bounds);
  return null;
};

const App = () => {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [vehicleType, setVehicleType] = useState('car');
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeRouteIndex, setActiveRouteIndex] = useState(null);

  const isMobile = useMediaQuery({ maxWidth: 767 });

  const handleOptimizeRoute = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post('http://localhost:5000/optimize_route', {
        start,
        end,
        vehicle_type: vehicleType,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      setRoute(response.data);
      setActiveRouteIndex(0); // Automatically select the best_route after optimization
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error || error.message || 'An error occurred while optimizing the route.';
        setError(errorMessage);
      } else {
        setError('An unexpected error occurred.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <h1 className="text-5xl font-bold text-center text-gray-100 mb-8">FedEx Smart Route Optimizer</h1>
      <div className="max-w-4xl mx-auto p-6 bg-gray-800 bg-opacity-70 backdrop-blur-md rounded-xl shadow-lg space-y-8">
        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-8`}>
          <div>
            <label className="block text-lg font-medium text-gray-300">Start Location</label>
            <input
              type="text"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-2 block w-full border border-gray-600 rounded-md p-4 text-lg text-gray-100 bg-gray-700 focus:ring-teal-600 focus:border-teal-600 hover:bg-gray-600 transition duration-200"
              placeholder="Enter start location"
            />
          </div>
          <div>
            <label className="block text-lg font-medium text-gray-300">End Location</label>
            <input
              type="text"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-2 block w-full border border-gray-600 rounded-md p-4 text-lg text-gray-100 bg-gray-700 focus:ring-teal-600 focus:border-teal-600 hover:bg-gray-600 transition duration-200"
              placeholder="Enter end location"
            />
          </div>
        </div>
        <div>
          <label className="block text-lg font-medium text-gray-300">Vehicle Type</label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="mt-2 block w-full border border-gray-600 rounded-md p-4 text-lg text-gray-100 bg-gray-700 focus:ring-teal-600 focus:border-teal-600 hover:bg-gray-600 transition duration-200"
          >
            <option value="car">Car</option>
            <option value="truck">Truck</option>
            <option value="van">Van</option>
            <option value="electric">Electric Vehicle</option>
          </select>
        </div>
        <button
          onClick={handleOptimizeRoute}
          disabled={loading}
          className="w-full bg-teal-600 text-white py-3 rounded-md text-lg hover:bg-teal-700 transition duration-300"
        >
          {loading ? 'Optimizing...' : 'Optimize Route'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-md">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {route && (
          <div>
            <div className="bg-gray-800 bg-opacity-70 backdrop-blur-md p-6 rounded-md shadow-lg">
              <h2 className="text-2xl font-semibold text-gray-100 mb-4">Best route from {start} to {end}</h2>
              <div className="space-y-4 text-lg text-gray-300">
                <p><strong>Provider:</strong> {route.route.provider}</p>
                <p><strong>Reason:</strong> {route.route.reason}</p>
                <p><strong>Distance:</strong> {(route.route.best_route.distance / 1000).toFixed(2)} km</p>
                <p><strong>Duration:</strong> {(route.route.best_route.duration / 60).toFixed(2)} minutes</p>
                <p><strong>Emissions:</strong> {route.emissions.toFixed(2)} g CO2</p>
                <p><strong>Weather:</strong> {route.weather.temperature}°C, Wind: {route.weather.wind_speed} km/h, Humidity: {route.weather.humidity}%</p>
                <p><strong>Air Quality Index:</strong> {route.air_quality}</p>
              </div>
            </div>

            <div className="mt-8">
              <MapContainer
                center={[route.route.best_route.steps[0].start_location.lat, route.route.best_route.steps[0].start_location.lng]}
                zoom={13}
                style={{ height: '400px', width: '100%' }}
                className="rounded-md shadow-lg"
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FitBounds
                  key="best-route-bounds"
                  bounds={[ 
                    [route.route.best_route.steps[0].start_location.lat, route.route.best_route.steps[0].start_location.lng],
                    [route.route.best_route.steps[route.route.best_route.steps.length - 1].start_location.lat, route.route.best_route.steps[route.route.best_route.steps.length - 1].start_location.lng]
                  ]}
                />
                {route.route.best_route.polyline && (
                  <Polyline
                    positions={polyline.decode(route.route.best_route.polyline)}
                    color="rgba(30, 144, 255, 0.8)"
                  />
                )}
              </MapContainer>
            </div>

            {Array.isArray(route.route.other_routes) && route.route.other_routes.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-4 justify-start">
                {route.route.other_routes.map((otherRoute, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveRouteIndex(index)}
                    className={`py-2 px-6 text-white rounded-md ${activeRouteIndex === index ? 'bg-teal-600' : 'bg-teal-400'} hover:bg-teal-500 transition duration-300`}
                  >
                    Route {index + 1}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-6 p-4 bg-gray-700 text-gray-300 rounded-md">
                <p>No other routes present.</p>
              </div>
            )}

            {activeRouteIndex !== null && route.route.other_routes && route.route.other_routes.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold text-gray-100 mb-4 mt-4">
                  Alternative Route {activeRouteIndex + 1} from {start} to {end}
                </h2>
                <div className="mt-6 space-y-4 text-lg text-gray-300">
                  <p><strong>Distance:</strong> {(route.route.other_routes[activeRouteIndex].route.distance / 1000).toFixed(2)} km</p>
                  <p><strong>Duration:</strong> {(route.route.other_routes[activeRouteIndex].route.duration / 60).toFixed(2)} minutes</p>
                  <p><strong>Emissions:</strong> {route.emissions.toFixed(2)} g CO2</p>
                  <p><strong>Weather:</strong> {route.weather.temperature}°C, Wind: {route.weather.wind_speed} km/h, Humidity: {route.weather.humidity}%</p>
                  <p><strong>Air Quality Index:</strong> {route.air_quality}</p>
                </div>
                <div className="mt-8">
                  <MapContainer
                    center={[route.route.other_routes[activeRouteIndex].route.steps[0].start_location.lat, route.route.other_routes[activeRouteIndex].route.steps[0].start_location.lng]}
                    zoom={13}
                    style={{ height: '400px', width: '100%' }}
                    className="rounded-md shadow-lg"
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <FitBounds
                      key={`alternative-route-bounds-${activeRouteIndex}`}
                      bounds={[ 
                        [route.route.other_routes[activeRouteIndex].route.steps[0].start_location.lat, route.route.other_routes[activeRouteIndex].route.steps[0].start_location.lng],
                        [route.route.other_routes[activeRouteIndex].route.steps[route.route.other_routes[activeRouteIndex].route.steps.length - 1].start_location.lat, route.route.other_routes[activeRouteIndex].route.steps[route.route.other_routes[activeRouteIndex].route.steps.length - 1].start_location.lng]
                      ]}
                    />
                    {route.route.other_routes[activeRouteIndex].route.polyline && (
                      <Polyline
                        positions={polyline.decode(route.route.other_routes[activeRouteIndex].route.polyline)}
                        color="rgba(30, 144, 255, 0.8)"
                      />
                    )}
                  </MapContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
