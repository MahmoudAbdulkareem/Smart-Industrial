function rand(min, max) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(1));
}

function getEnergyHistory() {
    const baseline = 120;
    return Array.from({ length: 24 }, (_, h) => ({
        hour:     `${String(h).padStart(2, "0")}:00`,
        actual:   parseFloat((baseline * (0.7 + Math.sin(h / 4) * 0.3 + rand(-0.05, 0.25))).toFixed(1)),
        baseline: parseFloat((baseline * (0.8 + Math.sin(h / 4) * 0.2)).toFixed(1)),
    }));
}

function getEnergyData() {
    const baseline = 120;
    return {
        baseline,
        current: parseFloat((baseline * rand(0.85, 1.45)).toFixed(1)),
        water:   { current: rand(38, 58), baseline: 45 },
        gas:     { current: rand(22, 48), baseline: 30 },
        kpis: {
            pue: rand(1.15, 1.85),
            eer: rand(2.8, 4.2),
            co2: rand(42, 78),
        },
        history: getEnergyHistory(),
    };
}

module.exports = { getEnergyData };
