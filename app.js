let chartInstance = null;
let currentData = null; // För att spara json datan

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    fetchData(); // Hämtar verklig eller skrapad data
});

function initNavigation() {
    const navLinks = document.querySelectorAll('#nav-menu a');
    const views = document.querySelectorAll('.view');
    const pageTitle = document.getElementById('page-title');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Ändra active class på länkarna
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Ändra sidetitel baserat på länken
            pageTitle.textContent = link.innerText;

            // Göm alla vyer och visa den valda
            const targetId = link.getAttribute('data-target');
            views.forEach(v => v.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
        });
    });
}

function fetchData() {
    // Hämtar från vår lokala data.json (som scraper.js genererar)
    fetch('data.json')
        .then(response => {
            if(!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            currentData = data;
            updateUI(data);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            document.getElementById('sidebar-updated-time').innerText = "Kunde inte hämta data.";
        });
}

function updateUI(data) {
    // 1. Uppdatera Tidsstämplar och Källor
    const dateOpts = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    const dateFormatted = new Date(data.last_updated).toLocaleDateString('sv-SE', dateOpts);
    
    document.getElementById('sidebar-updated-time').innerText = "Senast: " + dateFormatted;
    document.getElementById('data-updated-text').innerText = dateFormatted;
    document.getElementById('data-source-text').innerText = data.source;

    // 2. Uppdatera KPI:er
    document.getElementById('daily-profit').innerText = '$' + data.kpi.daily_profit;
    const dailyTrend = document.getElementById('daily-trend');
    dailyTrend.innerHTML = `<i class="fa-solid fa-arrow-up"></i> ${data.kpi.daily_profit_trend}% vs igår`;
    dailyTrend.className = 'trend positive';

    document.getElementById('weekly-sales').innerText = data.kpi.weekly_sales;
    const weeklyTrend = document.getElementById('weekly-trend');
    weeklyTrend.innerHTML = `<i class="fa-solid fa-arrow-up"></i> ${data.kpi.weekly_sales_trend}% vs förra veckan`;
    weeklyTrend.className = 'trend positive';

    document.getElementById('yearly-profit').innerText = '$' + data.kpi.yearly_profit.toLocaleString();

    // 3. Generera Trender-tabellen
    populateTable(data.trending_products);

    // 4. Initiera Chart
    if (!chartInstance) {
        initChart(data.sales_data);
    }
}

function initChart(salesData) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); 
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
                tension: 0.4,
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
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });

    // Skapa en global funktion för att triggas av knapparna
    window.updateChart = function(period) {
        document.querySelectorAll('.btn-time').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
        chartInstance.data.labels = currentData.sales_data[period].labels;
        chartInstance.data.datasets[0].data = currentData.sales_data[period].data;
        chartInstance.update();
    };
}

function populateTable(products) {
    const tbody = document.querySelector('#trending-table tbody');
    tbody.innerHTML = '';
    
    products.forEach(prod => {
        // Amazon avgifter = 15%, plus $4 i fast tracking/frakt kostnad pga Temu långsamhet
        const amazonFees = prod.amazon_price * 0.15;
        const totalCost = prod.temu_price + amazonFees + 4.00;
        const profit = prod.amazon_price - totalCost;
        const profitMargin = ((profit / prod.amazon_price) * 100).toFixed(1);
        
        let hypeClass = "med";
        let hypeIcon = "fa-fire-flame-simple";
        if(prod.hype === "Extreme") { hypeClass = "high"; hypeIcon = "fa-fire"; }

        const row = `
            <tr>
                <td><img src="${prod.image}" alt="${prod.title}" class="prod-img"></td>
                <td>#${prod.rank}</td>
                <td><span class="trend-badge ${hypeClass}"><i class="fa-solid ${hypeIcon}"></i> ${prod.hype}</span></td>
                <td><strong>${prod.title}</strong><br><small><a href="${prod.source_temu}" style="color:#fbbf24;" target="_blank">Inköpspris (Temu)</a> | <a href="${prod.source_amazon}" style="color:#60a5fa;" target="_blank">Säljpris (Amazon)</a></small></td>
                <td>$${prod.temu_price.toFixed(2)}</td>
                <td>$${prod.amazon_price.toFixed(2)}</td>
                <td class="profit-margin">+$${profit.toFixed(2)} (${profitMargin}%)</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}
