'use strict';

const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const YANDEX_KEY = process.env.YANDEX_WEATHER_KEY || '';
if (!YANDEX_KEY) {
  console.warn('[WARN] YANDEX_WEATHER_KEY не задан — запросы к API вернут 401');
}

const CACHE_WEATHER_MS  = 10 * 60 * 1000;
const CACHE_FORECAST_MS = 30 * 60 * 1000;
const cache = new Map();

function cacheGet(key, ttl) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) { cache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

const CITIES = [
  { name: 'Москва',            lat: 55.7558, lon: 37.6176 },
  { name: 'Санкт-Петербург',   lat: 59.9343, lon: 30.3351 },
  { name: 'Новосибирск',       lat: 54.9884, lon: 82.9979 },
  { name: 'Екатеринбург',      lat: 56.8389, lon: 60.6057 },
  { name: 'Казань',            lat: 55.7887, lon: 49.1221 },
  { name: 'Нижний Новгород',   lat: 56.2965, lon: 43.9361 },
  { name: 'Челябинск',         lat: 55.1644, lon: 61.4368 },
  { name: 'Самара',            lat: 53.1959, lon: 50.1468 },
  { name: 'Уфа',               lat: 54.7388, lon: 55.9721 },
  { name: 'Ростов-на-Дону',    lat: 47.2357, lon: 39.7015 },
  { name: 'Омск',              lat: 54.9924, lon: 73.3686 },
  { name: 'Красноярск',        lat: 56.0184, lon: 92.8672 },
  { name: 'Воронеж',           lat: 51.6720, lon: 39.1843 },
  { name: 'Пермь',             lat: 58.0105, lon: 56.2502 },
  { name: 'Волгоград',         lat: 48.7080, lon: 44.5133 },
  { name: 'Краснодар',         lat: 45.0448, lon: 38.9760 },
  { name: 'Саратов',           lat: 51.5924, lon: 45.9608 },
  { name: 'Тюмень',            lat: 57.1522, lon: 65.5272 },
  { name: 'Тольятти',          lat: 53.5303, lon: 49.3461 },
  { name: 'Ижевск',            lat: 56.8527, lon: 53.2114 },
  { name: 'Барнаул',           lat: 53.3606, lon: 83.7636 },
  { name: 'Иркутск',           lat: 52.2978, lon: 104.2964 },
  { name: 'Хабаровск',         lat: 48.4827, lon: 135.0840 },
  { name: 'Ульяновск',         lat: 54.3282, lon: 48.3866 },
  { name: 'Ярославль',         lat: 57.6261, lon: 39.8845 },
  { name: 'Владивосток',       lat: 43.1332, lon: 131.9113 },
  { name: 'Махачкала',         lat: 42.9849, lon: 47.5047 },
  { name: 'Томск',             lat: 56.4977, lon: 84.9744 },
  { name: 'Оренбург',          lat: 51.7727, lon: 55.0988 },
  { name: 'Кемерово',          lat: 55.3349, lon: 86.0883 },
  { name: 'Новокузнецк',       lat: 53.7596, lon: 87.1125 },
  { name: 'Рязань',            lat: 54.6269, lon: 39.6916 },
  { name: 'Астрахань',         lat: 46.3497, lon: 48.0408 },
  { name: 'Набережные Челны',  lat: 55.7435, lon: 52.4045 },
  { name: 'Пенза',             lat: 53.1959, lon: 45.0186 },
  { name: 'Киров',             lat: 58.6035, lon: 49.6682 },
  { name: 'Липецк',            lat: 52.6031, lon: 39.5708 },
  { name: 'Чебоксары',         lat: 56.1439, lon: 47.2489 },
  { name: 'Тула',              lat: 54.1961, lon: 37.6182 },
  { name: 'Калининград',       lat: 54.7104, lon: 20.4522 },
  { name: 'Брянск',            lat: 53.2521, lon: 34.3717 },
  { name: 'Иваново',           lat: 57.0005, lon: 40.9739 },
  { name: 'Магнитогорск',      lat: 53.4072, lon: 59.0608 },
  { name: 'Нижний Тагил',      lat: 57.9098, lon: 59.9815 },
  { name: 'Улан-Удэ',          lat: 51.8334, lon: 107.5847 },
  { name: 'Сочи',              lat: 43.5855, lon: 39.7231 },
  { name: 'Якутск',            lat: 62.0354, lon: 129.6755 },
  { name: 'Мурманск',          lat: 68.9585, lon: 33.0827 },
  { name: 'Архангельск',       lat: 64.5401, lon: 40.5433 },
  { name: 'Симферополь',       lat: 44.9572, lon: 34.1108 },
  { name: 'Севастополь',       lat: 44.6054, lon: 33.5220 },
];

app.use(express.static(path.join(__dirname, 'public')));

// [FIX #5] .startsWith() → .includes() — поиск по подстроке
app.get('/api/suggest', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.json([]);
  const matches = CITIES
    .filter(c => c.name.toLowerCase().includes(q))
    .slice(0, 8)
    .map(c => ({ name: c.name, lat: c.lat, lon: c.lon }));
  res.json(matches);
});

app.get('/api/cities', (_req, res) => {
  res.json(CITIES.map(c => ({ name: c.name, lat: c.lat, lon: c.lon })));
});

app.get('/api/geocode', (req, res) => {
  const name = (req.query.city || '').trim();
  if (!name) return res.status(400).json({ error: 'city required' });
  const city = CITIES.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (city) return res.json({ name: city.name, lat: city.lat, lon: city.lon });
  const fuzzy = CITIES.find(c => c.name.toLowerCase().includes(name.toLowerCase()));
  if (fuzzy) return res.json({ name: fuzzy.name, lat: fuzzy.lat, lon: fuzzy.lon });
  return res.status(404).json({ error: 'Город не найден' });
});

// [NEW #1] Обратное геокодирование — ближайший город из справочника
app.get('/api/reverse-geocode', (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (isNaN(lat) || isNaN(lon)) return res.status(400).json({ error: 'lat, lon required' });

  function distSq(a, b) {
    const dLat = (a.lat - b.lat) * Math.PI / 180;
    const dLon = (a.lon - b.lon) * Math.PI / 180;
    return dLat * dLat + dLon * dLon;
  }

  let nearest = CITIES[0];
  let minD = distSq({ lat, lon }, nearest);
  for (const c of CITIES) {
    const d = distSq({ lat, lon }, c);
    if (d < minD) { minD = d; nearest = c; }
  }
  res.json({ name: nearest.name, lat: nearest.lat, lon: nearest.lon });
});

// [FIX #2] limit=7  [FIX #3] hours=true  [FIX #4] pressure_mm, uv_index, sunrise, sunset
app.get('/api/combined', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat, lon required' });

  const key = `combined:${Number(lat).toFixed(4)}:${Number(lon).toFixed(4)}`;
  const cached = cacheGet(key, CACHE_WEATHER_MS);
  if (cached) return res.json(cached);

  try {
    const url = `https://api.weather.yandex.ru/v2/forecast?lat=${lat}&lon=${lon}&lang=ru_RU&limit=7&hours=true`;
    const resp = await fetch(url, {
      headers: { 'X-Yandex-Weather-Key': YANDEX_KEY }
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('[API] combined error', resp.status, text);
      return res.status(502).json({ error: 'Данные временно недоступны' });
    }
    const json = await resp.json();

    const f = json.fact || {};
    const weather = {
      temp:        f.temp,
      feels_like:  f.feels_like,
      condition:   f.condition,
      humidity:    f.humidity,
      wind_speed:  f.wind_speed,
      wind_dir:    f.wind_dir,
      icon:        f.icon,
      obs_time:    f.obs_time,
      pressure_mm: f.pressure_mm,   // [NEW #4]
      uv_index:    f.uv_index,      // [NEW #4]
    };

    const forecast = (json.forecasts || []).slice(0, 7).map(day => ({
      date:       day.date,
      day_temp:   day.parts?.day?.temp_avg    ?? day.parts?.day_short?.temp,
      night_temp: day.parts?.night?.temp_min  ?? day.parts?.night_short?.temp,
      condition:  day.parts?.day?.condition   ?? day.parts?.day_short?.condition,
      prec_prob:  day.parts?.day?.prec_prob   ?? 0,
      icon:       day.parts?.day?.icon        ?? day.parts?.day_short?.icon,
      sunrise:    day.sunrise,   // [NEW #4]
      sunset:     day.sunset,    // [NEW #4]
    }));

    // [NEW #3] Почасовой прогноз на сегодня
    const hours = (json.forecasts?.[0]?.hours || []).map(h => ({
      hour:      h.hour,
      temp:      h.temp,
      condition: h.condition,
      prec_prob: h.prec_prob,
      icon:      h.icon,
    }));

    const data = { weather, forecast, hours };
    cacheSet(key, data);
    res.json(data);
  } catch (e) {
    console.error('[API] combined fetch error', e.message);
    res.status(502).json({ error: 'Данные временно недоступны' });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Server] http://localhost:${PORT}`);
  console.log(`[Server] API key: ${YANDEX_KEY ? 'задан ✓' : 'НЕ ЗАДАН ✗'}`);
});
