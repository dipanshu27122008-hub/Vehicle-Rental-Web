document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("weather-form");
  if (!form) return;
  const city = document.getElementById("weather-city");
  const result = document.getElementById("weather-result");
  const error = document.getElementById("weather-error");
  const weatherMap = { 0: ["☀️", "Sunny", "SUV"], 1: ["⛅", "Mostly clear", "SUV"], 2: ["⛅", "Partly cloudy", "Hatchback"], 3: ["☁️", "Cloudy", "Hatchback"], 45: ["🌫️", "Foggy", "Bike not recommended"], 48: ["🌫️", "Foggy", "Bike not recommended"], 51: ["🌧️", "Drizzle", "Sedan"], 53: ["🌧️", "Drizzle", "Sedan"], 55: ["🌧️", "Drizzle", "Sedan"], 61: ["🌧️", "Rainy", "Sedan"], 63: ["🌧️", "Rainy", "Sedan"], 65: ["🌧️", "Rainy", "Sedan"], 71: ["❄️", "Snowy", "Luxury"], 73: ["❄️", "Snowy", "Luxury"], 75: ["❄️", "Snowy", "Luxury"], 80: ["🌦️", "Rain showers", "Sedan"], 81: ["🌦️", "Rain showers", "Sedan"], 82: ["🌦️", "Rain showers", "Sedan"], 95: ["⛈️", "Thunderstorm", "Sedan"] };
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); error.textContent = ""; result.hidden = true;
    const name = city.value.trim(); if (!name) { error.textContent = "Enter a city name."; return; }
    try {
      const place = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`).then((response) => response.json());
      if (!place.results?.[0]) throw new Error("not-found");
      const location = place.results[0];
      const data = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`).then((response) => response.json());
      if (!data.current) throw new Error("weather-unavailable");
      const [icon, description, defaultRecommendation] = weatherMap[data.current.weather_code] || ["🌤️", "Current conditions", "SUV"];
      const recommendation = data.current.temperature_2m <= 10 ? "Luxury" : defaultRecommendation;
      document.getElementById("weather-icon").textContent = icon; document.getElementById("weather-temperature").textContent = `${Math.round(data.current.temperature_2m)}°C`; document.getElementById("weather-description").textContent = `${description} in ${location.name}`; document.getElementById("weather-humidity").textContent = `${data.current.relative_humidity_2m}%`; document.getElementById("weather-recommendation").textContent = recommendation; result.hidden = false;
    } catch { error.textContent = "City not found or weather is currently unavailable."; }
  });
});
