const fetchModule = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const ML_PREDICT_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000/predict";

async function predict(payload, timeoutMs = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchModule(ML_PREDICT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        if (!response.ok) throw new Error(`ML service returned ${response.status}`);
        return response.json();
    } finally {
        clearTimeout(timer);
    }
}

async function checkHealth(timeoutMs = 3000) {
    const base = ML_PREDICT_URL.replace("/predict", "");
    const response = await fetchModule(`${base}/health`, { signal: AbortSignal.timeout(timeoutMs) });
    return response.json();
}

module.exports = { predict, checkHealth };
