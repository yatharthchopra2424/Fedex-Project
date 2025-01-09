from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import polyline
from math import radians, sin, cos, sqrt, atan2
import numpy as np
from datetime import datetime, timedelta
import traceback
import logging
import json

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.DEBUG)

class RouteOptimizer:
    def __init__(self):
        self.google_maps_api_key = "8325ab772fmsh32cf687b4554e6ep105da9jsnd326380d6393"
        self.aqicn_api_key = "4a46023e39f843b14cad08e314749000b54be42c"
        self.openweathermap_api_key = "4c61f798e1507fb0f06b70da4c7d41c8"
        self.base_url = "https://google-map-places.p.rapidapi.com"

    # FIXED    
    def get_routes(self, start, end):
        url = f"{self.base_url}/maps/api/directions/json"
        
        querystring = {
            "origin": start,
            "destination": end,
            "alternatives": "true"
        }
        
        headers = {
            "X-RapidAPI-Key": self.google_maps_api_key,
            "X-RapidAPI-Host": "google-map-places.p.rapidapi.com"
        }
        
        response = requests.get(url, headers=headers, params=querystring)
        data = response.json()
        app.logger.debug(f"Google Maps API response: {data}")
        
        if 'routes' not in data:
            raise ValueError("No routes found in Google Maps API response")
        
        app.logger.debug(f"Google Maps API response: {data}")
        
        return [self.parse_route(route) for route in data['routes']]

    def parse_route(self, route):
        return {
            "distance": route['legs'][0]['distance']['value'],
            "duration": route['legs'][0]['duration']['value'],
            "polyline": route['overview_polyline']['points'],
            "steps": route['legs'][0]['steps']
        }

    def compare_routes(self, routes):
        def heuristic(route):
            return route['duration'] + route['distance'] / 100

        scored_routes = [(route, heuristic(route)) for route in routes]
        best_route = min(scored_routes, key=lambda x: x[1])
        
        other_routes = [
            {
                "route": route,
                "reason": f"Score: {score:.2f} (Best: {best_route[1]:.2f})"
            }
            for route, score in scored_routes if route != best_route[0]
        ]
        
        return {
            "best_route": best_route[0],
            "other_routes": other_routes
        }

    def get_route(self, start, end, vehicleType):
        routes = self.get_routes(start, end)
        compared_routes = self.compare_routes(routes)
        best_route = compared_routes['best_route']

        start_coords = self.get_coordinates(start)
        end_coords = self.get_coordinates(end)

        weather_data = self.get_weather_data(start_coords)
        air_quality = self.get_air_quality(start_coords)
        # traffic_data = self.get_traffic_data(start_coords, end_coords)
        emissions = self.calculate_emissions(best_route, vehicleType, weather_data, air_quality)

        app.logger.debug(f"Best route: {best_route}")
        app.logger.debug(f"Compared routes: {compared_routes}")
        app.logger.debug(f"Emissions: {emissions}")
        app.logger.debug(f"Weather: {weather_data}")
        app.logger.debug(f"Air quality: {air_quality}")
        # app.logger.debug(f"Traffic: {traffic_data}")


        return {
            "route": compared_routes,
            "emissions": emissions,
            "weather": weather_data,
            "air_quality": air_quality,
            # "traffic": traffic_data
        }

    #FIXED
    def get_coordinates(self, place):
        url = f"{self.base_url}/maps/api/geocode/json"
        querystring = {"address": place}

        headers = {
            "X-RapidAPI-Key": self.google_maps_api_key,
            "X-RapidAPI-Host": "google-map-places.p.rapidapi.com"
        }
        response = requests.get(url, headers=headers, params=querystring)
        data = response.json()
        if data['results']:
            location = data['results'][0]['geometry']['location']
            return location['lat'], location['lng']
        return None

    def get_weather_data(self, location):
        url = f"https://api.openweathermap.org/data/2.5/weather"
        params = {
            "lat": location[0],
            "lon": location[1],
            "appid": self.openweathermap_api_key,
            "units": "metric"
        }
        response = requests.get(url, params=params)
        data = response.json()
        return {
            "temperature": data['main']['temp'],
            "humidity": data['main']['humidity'],
            "wind_speed": data['wind']['speed'],
            "precipitation": data.get('rain', {}).get('1h', 0)
        }

    def get_air_quality(self, location):
        url = f"https://api.waqi.info/feed/geo:{location[0]};{location[1]}/"
        params = {"token": self.aqicn_api_key}
        response = requests.get(url, params=params)
        data = response.json()
        return data['data']['aqi']

    def calculate_emissions(self, route, vehicle_type, weather, air_quality):
        base_emission_rate = {
            "car": 120,
            "truck": 300,
            "van": 200,
            "electric": 30
        }

        distance_km = route['distance'] / 1000
        base_emissions = base_emission_rate.get(vehicle_type, 150) * distance_km

        weather_factor = 1 + (weather['temperature'] - 20) * 0.01 + weather['humidity'] * 0.001 + weather['wind_speed'] * 0.005
        aqi_factor = 1 + (air_quality - 50) * 0.002
        total_emissions = base_emissions * weather_factor * aqi_factor

        return total_emissions

route_optimizer = RouteOptimizer()

@app.route('/optimize_route', methods=['POST', 'OPTIONS'])
def optimize_route():
    if request.method == 'OPTIONS':
        return '', 204
    try:
        if not request.is_json:
            raise ValueError("Invalid JSON data")
        data = request.get_json()
        if data is None:
            raise ValueError("No JSON data received")
        # app.logger.debug(f"Received data: {data}")
        start = data['start']
        end = data['end']
        vehicle_type = data['vehicle_type']

        result = route_optimizer.get_route(start, end, vehicle_type)
        return jsonify(result)
    except ValueError as e:
        app.logger.error(f"ValueError in optimize_route: {str(e)}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        app.logger.error(f"Error in optimize_route: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({"error": "An unexpected error occurred. Please try again later."}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)