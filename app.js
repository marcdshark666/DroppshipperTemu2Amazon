// Mock Data för Grafer
const salesData = {
    day: {
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
        data: [12, 19, 3, 5, 2, 3, 10]
    },
    week: {
        labels: ['Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör', 'Sön'],
        data: [65, 59, 80, 81, 56, 55, 40]
    },
    month: {
        labels: ['Vecka 1', 'Vecka 2', 'Vecka 3', 'Vecka 4'],
        data: [320, 250, 410, 390]
    }
};

let chartInstance = null;

function initChart() {
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    // Gradient för grafen
    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // primary var
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: salesData.month.labels,
            datasets: [{
                label: 'Försäljning (Orders)',
                data: salesData.month.data,
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 3,
                tension: 0.4, // Smooth kurva
                fill: true,
                pointBackgroundColor: '#0f172a',
                pointBorderColor: '#3b82f6',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#94a3b8',
                    padding: 10,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

window.updateChart = function(period) {
    // Update active button
    document.querySelectorAll('.btn-time').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // Update chart data
    chartInstance.data.labels = salesData[period].labels;
    chartInstance.data.datasets[0].data = salesData[period].data;
    chartInstance.update();
}

// Generera trendande produkter mock data
const trendingProducts = [
    { rank: 1, hype: "Extreme", title: "Smart Posture Corrector 2026", temu: 3.50, amazon: 24.99 },
    { rank: 2, hype: "Extreme", title: "AI-Powered Mini Projector", temu: 22.00, amazon: 89.99 },
    { rank: 3, hype: "High", title: "Ergonomic Vertical Mouse", temu: 4.20, amazon: 29.99 },
    { rank: 4, hype: "High", title: "Minimalist LED Desk Lamp", temu: 8.50, amazon: 39.99 },
    { rank: 5, hype: "High", title: "Viral Ice Face Roller", temu: 1.20, amazon: 14.99 },
    { rank: 6, hype: "Medium", title: "Portable Blender Cup", temu: 9.00, amazon: 34.99 },
    { rank: 7, hype: "Medium", title: "Acupressure Yoga Mat", temu: 11.50, amazon: 45.99 },
    { rank: 8, hype: "Medium", title: "Reusable Lint Roller", temu: 2.10, amazon: 12.99 },
    { rank: 9, hype: "Medium", title: "Crystal Hair Eraser", temu: 1.80, amazon: 15.99 },
    { rank: 10, hype: "Medium", title: "Sunset Projection Lamp", temu: 5.00, amazon: 22.99 }
];

function populateTable() {
    const tbody = document.querySelector('#trending-table tbody');
    tbody.innerHTML = '';
    
    trendingProducts.forEach(prod => {
        // Beräkna Estimerad Marginal (Antag 15% Amazon avgifter + $4 Frakt)
        const amazonFees = prod.amazon * 0.15;
        const totalCost = prod.temu + amazonFees + 4.00;
        const profit = prod.amazon - totalCost;
        const profitMargin = ((profit / prod.amazon) * 100).toFixed(1);
        
        let hypeClass = "med";
        let hypeIcon = "fa-fire-flame-simple";
        if(prod.hype === "Extreme") { hypeClass = "high"; hypeIcon = "fa-fire"; }
        if(prod.hype === "High") { hypeClass = "med"; hypeIcon = "fa-arrow-trend-up"; }

        const row = `
            <tr>
                <td>#${prod.rank}</td>
                <td><span class="trend-badge ${hypeClass}"><i class="fa-solid ${hypeIcon}"></i> ${prod.hype}</span></td>
                <td><strong>${prod.title}</strong></td>
                <td>$${prod.temu.toFixed(2)}</td>
                <td>$${prod.amazon.toFixed(2)}</td>
                <td class="profit-margin">+$${profit.toFixed(2)} (${profitMargin}%)</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

// Simulera lite rullande siffror för KPI:erna
function animateKPIs() {
    document.getElementById('daily-profit').innerText = '$142.50';
    document.getElementById('weekly-sales').innerText = '1,204';
    document.getElementById('yearly-profit').innerText = '$18,430.00';
}

// Initiera
document.addEventListener('DOMContentLoaded', () => {
    initChart();
    populateTable();
    animateKPIs();
});
