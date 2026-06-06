// Paste your WeatherAPI.com key here (free at https://www.weatherapi.com/signup.aspx)
// Leave as YOUR_API_KEY_HERE to use the built-in fallback until you have a key
const API_KEY = 'YOUR_API_KEY_HERE';
const WEATHER_API_URL = 'https://api.weatherapi.com/v1/forecast.json';
const WEATHER_API_SEARCH_URL = 'https://api.weatherapi.com/v1/search.json';
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const forecastSection = document.getElementById('forecastSection');
const autocompleteList = document.getElementById('autocompleteList');

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

let searchTimeout = null;
let activeRequest = 0;
let autocompleteRequest = 0;
let activeSuggestionIndex = -1;
let suggestions = [];

searchBtn.addEventListener('click', () => {
    const location = searchInput.value.trim();
    if (location) {
        hideAutocomplete();
        getWeather(location);
    }
});

searchInput.addEventListener('keydown', (e) => {
    if (!autocompleteList.hidden && suggestions.length) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, suggestions.length - 1);
            updateActiveSuggestion();
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
            updateActiveSuggestion();
            return;
        }

        if (e.key === 'Escape') {
            hideAutocomplete();
            return;
        }

        if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
            e.preventDefault();
            selectSuggestion(suggestions[activeSuggestionIndex]);
            return;
        }
    }

    if (e.key === 'Enter') {
        const location = searchInput.value.trim();
        if (location) {
            hideAutocomplete();
            getWeather(location);
        }
    }
});

searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();

    if (query.length < 2) {
        hideAutocomplete();
        return;
    }

    searchTimeout = setTimeout(() => fetchSuggestions(query), 300);
});

searchInput.addEventListener('focus', () => {
    if (suggestions.length && searchInput.value.trim().length >= 2) {
        showAutocomplete();
    }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
        hideAutocomplete();
    }
});

function setLoading(isLoading) {
    forecastSection.classList.toggle('is-loading', isLoading);
    searchBtn.disabled = isLoading;
    searchBtn.innerHTML = isLoading
        ? '<i class="fa-solid fa-spinner fa-spin"></i> Searching'
        : 'Search';
}

async function fetchSuggestions(query) {
    const requestId = ++autocompleteRequest;

    try {
        const results = API_KEY !== 'YOUR_API_KEY_HERE'
            ? await fetchWeatherAPISuggestions(query)
            : await fetchOpenMeteoSuggestions(query);

        if (requestId !== autocompleteRequest) return;

        suggestions = results;
        activeSuggestionIndex = -1;
        renderSuggestions();
    } catch (error) {
        if (requestId !== autocompleteRequest) return;
        console.error('Error fetching suggestions:', error);
        hideAutocomplete();
    }
}

async function fetchWeatherAPISuggestions(query) {
    const res = await fetch(
        `${WEATHER_API_SEARCH_URL}?key=${API_KEY}&q=${encodeURIComponent(query)}`
    );
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error?.message || 'Could not load suggestions.');
    }

    if (!Array.isArray(data) || !data.length) {
        return [];
    }

    return data.slice(0, 6).map((place) => ({
        label: place.region
            ? `${place.name}, ${place.region}, ${place.country}`
            : `${place.name}, ${place.country}`,
        query: place.name
    }));
}

async function fetchOpenMeteoSuggestions(query) {
    const res = await fetch(
        `${GEO_URL}?name=${encodeURIComponent(query)}&count=6&language=en&format=json`
    );
    const data = await res.json();

    if (!data.results?.length) {
        return [];
    }

    return data.results.map((place) => ({
        label: place.admin1
            ? `${place.name}, ${place.admin1}, ${place.country}`
            : `${place.name}, ${place.country}`,
        query: place.name
    }));
}

function renderSuggestions() {
    autocompleteList.innerHTML = '';

    if (!suggestions.length) {
        hideAutocomplete();
        return;
    }

    suggestions.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'autocomplete-item';
        li.setAttribute('role', 'option');
        li.innerHTML = `<i class="fa-solid fa-location-dot"></i><span>${item.label}</span>`;
        li.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectSuggestion(item);
        });
        li.addEventListener('mouseenter', () => {
            activeSuggestionIndex = index;
            updateActiveSuggestion();
        });
        autocompleteList.appendChild(li);
    });

    showAutocomplete();
}

function updateActiveSuggestion() {
    const items = autocompleteList.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
        item.classList.toggle('active', index === activeSuggestionIndex);
    });

    if (activeSuggestionIndex >= 0 && items[activeSuggestionIndex]) {
        searchInput.value = suggestions[activeSuggestionIndex].query;
        items[activeSuggestionIndex].scrollIntoView({ block: 'nearest' });
    }
}

function selectSuggestion(item) {
    searchInput.value = item.query;
    hideAutocomplete();
    getWeather(item.query);
}

function showAutocomplete() {
    autocompleteList.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
}

function hideAutocomplete() {
    autocompleteList.hidden = true;
    autocompleteList.innerHTML = '';
    searchInput.setAttribute('aria-expanded', 'false');
    activeSuggestionIndex = -1;
    suggestions = [];
}

function formatDateFromParts(dayIndex, monthIndex, dayNum) {
    return {
        day: days[dayIndex],
        dateLabel: `${dayNum} ${monthNames[monthIndex]}`
    };
}

function formatISODate(dateString) {
    const normalized = dateString.includes(' ')
        ? dateString.replace(' ', 'T')
        : `${dateString}T12:00:00`;
    const date = new Date(normalized);
    return formatDateFromParts(date.getDay(), date.getMonth(), date.getDate());
}

async function getWeather(location) {
    const requestId = ++activeRequest;
    setLoading(true);

    try {
        const data = API_KEY !== 'YOUR_API_KEY_HERE'
            ? await fetchWeatherAPI(location)
            : await fetchOpenMeteo(location);

        if (requestId !== activeRequest) return;

        renderWeather(data);
        forecastSection.classList.add('is-loaded');
    } catch (error) {
        if (requestId !== activeRequest) return;
        console.error('Error fetching weather:', error);
    } finally {
        if (requestId === activeRequest) setLoading(false);
    }
}

async function fetchWeatherAPI(location) {
    const res = await fetch(
        `${WEATHER_API_URL}?key=${API_KEY}&q=${encodeURIComponent(location)}&days=3`
    );
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error?.message || 'Could not load weather data.');
    }

    const { location: loc, current, forecast } = data;
    const localDate = new Date(loc.localtime.replace(' ', 'T'));

    return {
        location: formatWeatherAPILocation(loc),
        today: formatDateFromParts(localDate.getDay(), localDate.getMonth(), localDate.getDate()),
        temp: Math.round(current.temp_c),
        feelsLike: Math.round(current.feelslike_c),
        icon: `https:${current.condition.icon}`,
        condition: current.condition.text,
        humidity: current.humidity,
        wind: Math.round(current.wind_kph),
        windDir: current.wind_dir,
        updated: current.last_updated,
        forecast: [
            mapWeatherAPIDay(forecast.forecastday[1]),
            mapWeatherAPIDay(forecast.forecastday[2])
        ].filter(Boolean)
    };
}

function formatWeatherAPILocation(loc) {
    if (loc.region && loc.region !== loc.name) {
        return `${loc.name}, ${loc.region}, ${loc.country}`;
    }
    return `${loc.name}, ${loc.country}`;
}

function mapWeatherAPIDay(dayData) {
    if (!dayData) return null;

    const formatted = formatISODate(dayData.date);
    return {
        day: formatted.day,
        dateLabel: formatted.dateLabel,
        icon: `https:${dayData.day.condition.icon}`,
        condition: dayData.day.condition.text,
        max: Math.round(dayData.day.maxtemp_c),
        min: Math.round(dayData.day.mintemp_c)
    };
}

async function fetchOpenMeteo(location) {
    const geoRes = await fetch(`${GEO_URL}?name=${encodeURIComponent(location)}&count=1&language=en`);
    const geoData = await geoRes.json();

    if (!geoData.results?.length) {
        throw new Error(`No results found for "${location}".`);
    }

    const place = geoData.results[0];
    const weatherRes = await fetch(
        `${OPEN_METEO_URL}?latitude=${place.latitude}&longitude=${place.longitude}` +
        '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,apparent_temperature' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
        '&timezone=auto&forecast_days=3'
    );
    const weather = await weatherRes.json();

    if (!weatherRes.ok) {
        throw new Error('Could not load forecast data.');
    }

    const now = new Date();
    const current = weather.current;
    const daily = weather.daily;

    return {
        location: place.admin1
            ? `${place.name}, ${place.admin1}, ${place.country}`
            : `${place.name}, ${place.country}`,
        today: formatDateFromParts(now.getDay(), now.getMonth(), now.getDate()),
        temp: Math.round(current.temperature_2m),
        feelsLike: Math.round(current.apparent_temperature),
        icon: getOpenMeteoIcon(current.weather_code),
        condition: getOpenMeteoCondition(current.weather_code),
        humidity: current.relative_humidity_2m,
        wind: Math.round(current.wind_speed_10m),
        windDir: getWindDirection(current.wind_direction_10m),
        updated: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        forecast: [1, 2].map((index) => {
            const date = new Date(`${daily.time[index]}T12:00:00`);
            const code = daily.weather_code[index];
            return {
                day: days[date.getDay()],
                dateLabel: `${date.getDate()} ${monthNames[date.getMonth()]}`,
                icon: getOpenMeteoIcon(code),
                condition: getOpenMeteoCondition(code),
                max: Math.round(daily.temperature_2m_max[index]),
                min: Math.round(daily.temperature_2m_min[index])
            };
        })
    };
}

function renderWeather(data) {
    document.getElementById('today-day').textContent = data.today.day;
    document.getElementById('today-date').textContent = data.today.dateLabel;
    document.getElementById('location-name').textContent = data.location;
    document.getElementById('today-temp').textContent = data.temp;
    document.getElementById('today-feels').textContent = data.feelsLike;
    document.getElementById('today-icon').src = data.icon;
    document.getElementById('today-icon').alt = data.condition;
    document.getElementById('today-condition').textContent = data.condition;
    document.getElementById('today-humidity').textContent = data.humidity;
    document.getElementById('today-wind').textContent = data.wind;
    document.getElementById('today-dir').textContent = data.windDir;
    document.getElementById('last-updated').textContent = `Updated ${data.updated}`;

    renderForecastDay('tomorrow', data.forecast[0]);
    renderForecastDay('day-after', data.forecast[1]);
}

function renderForecastDay(prefix, day) {
    if (!day) return;

    document.getElementById(`${prefix}-day`).textContent = day.day;
    document.getElementById(`${prefix}-date`).textContent = day.dateLabel;
    document.getElementById(`${prefix}-icon`).src = day.icon;
    document.getElementById(`${prefix}-icon`).alt = day.condition;
    document.getElementById(`${prefix}-max`).textContent = day.max;
    document.getElementById(`${prefix}-min`).textContent = day.min;
    document.getElementById(`${prefix}-condition`).textContent = day.condition;
}

function getOpenMeteoIcon(code) {
    const icons = {
        0: 'clear-day', 1: 'partly-cloudy-day', 2: 'partly-cloudy-day', 3: 'overcast',
        45: 'fog', 48: 'fog', 51: 'drizzle', 53: 'drizzle', 55: 'drizzle',
        61: 'rain', 63: 'rain', 65: 'extreme-rain', 71: 'snow', 73: 'snow', 75: 'snow',
        80: 'partly-cloudy-day-rain', 81: 'partly-cloudy-day-rain', 82: 'extreme-rain',
        95: 'thunderstorms-rain', 96: 'thunderstorms-rain', 99: 'thunderstorms-rain'
    };
    const name = icons[code] || 'cloudy';
    return `https://cdn.jsdelivr.net/gh/basmilius/weather-icons@2.0.0/production/fill/all/${name}.svg`;
}

function getOpenMeteoCondition(code) {
    const conditions = {
        0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Foggy', 48: 'Foggy', 51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
        61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
        71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
        80: 'Rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
        95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail'
    };
    return conditions[code] || 'Variable conditions';
}

function getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(degrees / 22.5) % 16];
}

getWeather('Cairo');
