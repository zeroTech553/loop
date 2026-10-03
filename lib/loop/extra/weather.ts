// src/lib/loop/extra/weather.ts
import type { ExtraResult } from "./convert";

const WMO_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  62: "Moderate rain",
  63: "Heavy rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow fall",
  73: "Moderate snow fall",
  75: "Heavy snow fall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

export const weatherTool = {
  name: "weather",
  usage: "/weather <city>",
  hint: "Check live weather conditions worldwide via Open-Meteo",
  async run(args: string, signal?: AbortSignal): Promise<ExtraResult> {
    const city = args.trim();
    if (!city) {
      return {
        title: "Weather",
        lines: ["Please provide a city name. Example: /weather Tokyo or /weather London"],
      };
    }

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    signal?.addEventListener("abort", () => ctl.abort(), { once: true });

    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
      const geoRes = await fetch(geoUrl, { signal: ctl.signal });
      if (!geoRes.ok) throw new Error("Geocoding failed");
      const geoData = await geoRes.json();
      if (!geoData.results || geoData.results.length === 0) {
        return {
          title: `Weather: ${city}`,
          lines: [`Could not find location "${city}". Try another city name.`],
        };
      }

      const loc = geoData.results[0];
      const lat = loc.latitude;
      const lon = loc.longitude;
      const name = loc.name;
      const country = loc.country || "";

      const fcUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`;
      const fcRes = await fetch(fcUrl, { signal: ctl.signal });
      if (!fcRes.ok) throw new Error("Forecast failed");
      const fcData = await fcRes.json();

      const cur = fcData.current;
      const tempC = cur.temperature_2m;
      const tempF = Math.round(((tempC * 9) / 5 + 32) * 10) / 10;
      const windKmh = cur.wind_speed_10m;
      const code = cur.weather_code;
      const condition = WMO_CODES[code] || "Weather Code " + code;

      return {
        title: `Weather in ${name}${country ? `, ${country}` : ""}`,
        lines: [
          `Condition: ${condition}`,
          `Temperature: ${tempC}°C (${tempF}°F)`,
          `Wind: ${windKmh} km/h`,
        ],
        link: `https://open-meteo.com/en/docs?latitude=${lat}&longitude=${lon}`,
      };
    } catch {
      return {
        title: `Weather: ${city}`,
        lines: ["Could not fetch weather data (timed out or network error)."],
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
