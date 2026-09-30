document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('search-btn');
    const tickerInput = document.getElementById('ticker-input');
    const loadingState = document.getElementById('loading');
    const errorState = document.getElementById('error');
    const errorMessage = document.getElementById('error-message');
    const dashboard = document.getElementById('dashboard');
    const downloadBtn = document.getElementById('download-btn');
    
    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            
            // Update active states
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.add('hidden'));
            
            btn.classList.add('active');
            document.getElementById(target).classList.remove('hidden');
        });
    });

    const searchStock = async () => {
        const ticker = tickerInput.value.trim().toUpperCase();
        if (!ticker) return;

        // Reset UI
        loadingState.classList.remove('hidden');
        errorState.classList.add('hidden');
        dashboard.classList.add('hidden');
        
        try {
            const response = await fetch(`/api/stock/${ticker}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch data');
            }

            renderDashboard(ticker, data);
            
            // Set download link
            downloadBtn.href = `/api/download/${ticker}`;
            
            loadingState.classList.add('hidden');
            dashboard.classList.remove('hidden');

        } catch (error) {
            loadingState.classList.add('hidden');
            errorState.classList.remove('hidden');
            errorMessage.textContent = error.message;
        }
    };

    searchBtn.addEventListener('click', searchStock);
    tickerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchStock();
    });

    function formatNumber(num) {
        if (num === null || num === undefined) return '--';
        if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    
    function formatCurrency(num, currency = 'USD') {
        if (num === null || num === undefined) return '--';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(num);
    }

    function renderDashboard(ticker, data) {
        const info = data.info || {};
        
        // 1. Render Header Info
        document.getElementById('company-name').textContent = info.longName || info.shortName || ticker;
        document.getElementById('ticker-symbol').textContent = ticker;
        
        const currentPrice = info.currentPrice || info.regularMarketPrice;
        document.getElementById('current-price').textContent = currentPrice ? formatCurrency(currentPrice, info.currency) : '--';
        
        const changeElem = document.getElementById('price-change');
        if (info.currentPrice && info.previousClose) {
            const diff = info.currentPrice - info.previousClose;
            const pct = (diff / info.previousClose) * 100;
            const sign = diff >= 0 ? '+' : '';
            changeElem.textContent = `${sign}${formatCurrency(diff, info.currency)} (${sign}${pct.toFixed(2)}%)`;
            changeElem.className = `change ${diff >= 0 ? 'positive' : 'negative'}`;
        } else {
            changeElem.textContent = '';
        }

        // 2. Render Chart
        renderChart(data.history, ticker);
        
        // 3. Render Overview Info
        renderOverview(info);
        
        // 4. Render Financials, News, Holders
        renderTable(data.financials, 'financials-table', 'financials-empty');
        renderNews(data.news);
        renderTable(data.institutional_holders, 'holders-table', 'holders-empty');
    }

    function renderOverview(info) {
        const grid = document.getElementById('info-grid');
        grid.innerHTML = '';
        
        const fields = [
            { label: 'Sector', value: info.sector || '--' },
            { label: 'Industry', value: info.industry || '--' },
            { label: 'Market Cap', value: formatNumber(info.marketCap) },
            { label: 'P/E Ratio', value: info.trailingPE ? info.trailingPE.toFixed(2) : '--' },
            { label: 'Dividend Yield', value: info.dividendYield ? (info.dividendYield * 100).toFixed(2) + '%' : '--' },
            { label: '52 Week High', value: formatCurrency(info.fiftyTwoWeekHigh, info.currency) },
            { label: '52 Week Low', value: formatCurrency(info.fiftyTwoWeekLow, info.currency) },
            { label: 'Beta', value: info.beta ? info.beta.toFixed(2) : '--' }
        ];

        fields.forEach(f => {
            const div = document.createElement('div');
            div.className = 'info-item';
            div.innerHTML = `
                <div class="label">${f.label}</div>
                <div class="value">${f.value}</div>
            `;
            grid.appendChild(div);
        });

        document.getElementById('business-summary').textContent = info.longBusinessSummary || 'No description available.';
    }

    function renderChart(history, ticker) {
        if (!history || history.length === 0) return;

        const dates = [];
        const closes = [];

        history.forEach(row => {
            const d = row['Date'];
            if (d) {
                dates.push(d.split(' ')[0]);
                closes.push(row['Close']);
            }
        });

        // --- 2Y Price Change Summary ---
        const firstClose = closes[0];
        const lastClose  = closes[closes.length - 1];
        const totalDiff  = lastClose - firstClose;
        const totalPct   = (totalDiff / firstClose) * 100;
        const isPositive = totalDiff >= 0;
        const sign = isPositive ? '+' : '';
        const clr  = isPositive ? '#10b981' : '#ef4444';
        document.getElementById('chart-price-change').innerHTML =
            `<span style="color:${clr};font-weight:600;">${sign}$${Math.abs(totalDiff).toFixed(2)}</span>` +
            `<span style="color:${clr};font-weight:500;">(${sign}${totalPct.toFixed(2)}%)</span>`;

        // --- Plotly Chart ---
        const trace = {
            x: dates,
            y: closes,
            type: 'scatter',
            mode: 'lines',
            name: 'Close Price',
            line: { color: '#6366f1', width: 2, shape: 'spline' },
            fill: 'tozeroy',
            fillcolor: 'rgba(99, 102, 241, 0.1)'
        };

        const layout = {
            paper_bgcolor: 'transparent',
            plot_bgcolor:  'transparent',
            margin: { t: 10, l: 50, r: 10, b: 60 },
            dragmode: false,          // disable pan/zoom drag; rangeslider still works
            shapes: [],               // will be populated during comparison drag
            xaxis: {
                showgrid: false,
                color: '#94a3b8',
                rangeslider: {
                    visible: true,
                    bgcolor: 'rgba(30, 22, 68, 0.6)',
                    bordercolor: 'rgba(99, 102, 241, 0.3)',
                    borderwidth: 1,
                    thickness: 0.08
                },
                rangeselector: {
                    buttons: [
                        { count: 1, label: '1M', step: 'month', stepmode: 'backward' },
                        { count: 3, label: '3M', step: 'month', stepmode: 'backward' },
                        { count: 6, label: '6M', step: 'month', stepmode: 'backward' },
                        { count: 1, label: '1Y', step: 'year',  stepmode: 'backward' },
                        { step: 'all', label: '2Y' }
                    ],
                    bgcolor: 'rgba(30, 22, 68, 0.8)',
                    activecolor: '#6366f1',
                    bordercolor: 'rgba(99,102,241,0.4)',
                    font: { color: '#94a3b8', size: 12 }
                }
            },
            yaxis: {
                gridcolor: 'rgba(255,255,255,0.05)',
                color: '#94a3b8',
                tickprefix: '$'
            },
            hovermode: 'x unified',
            hoverlabel: {
                bgcolor: 'rgba(26, 19, 64, 0.95)',
                bordercolor: '#6366f1',
                font: { family: 'Inter, sans-serif', color: '#60a5fa', size: 13 }
            },
            font: { family: 'Inter, sans-serif' }
        };

        const config = { responsive: true, displayModeBar: false };
        Plotly.newPlot('price-chart', [trace], layout, config);

        // --- Drag-to-Compare Feature ---
        setupComparisonDrag(dates, closes);
    }

    function setupComparisonDrag(dates, closes) {
        const chartDiv = document.getElementById('price-chart');
        const compBox  = document.getElementById('chart-comparison-box');

        let isDragging = false;
        let anchorIdx  = null;

        // Start drag — but only if clicking on the main plot area (not the rangeslider at bottom)
        chartDiv.addEventListener('mousedown', (e) => {
            const rect = chartDiv.getBoundingClientRect();
            const relY = (e.clientY - rect.top) / rect.height;
            // Rangeslider occupies ~bottom 15% of the div — skip if clicked there
            if (relY > 0.84) return;

            isDragging = true;
            anchorIdx  = null;
            compBox.classList.add('hidden');
            // Clear any previous comparison lines
            Plotly.relayout('price-chart', { shapes: [] });
        });

        // End drag anywhere — keep lines + box visible for reference
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Use Plotly hover to read exact data-point index
        chartDiv.on('plotly_hover', (data) => {
            if (!isDragging) return;
            const pt     = data.points[0];
            const curIdx = pt.pointIndex;

            // First hover while holding: set the anchor line
            if (anchorIdx === null) {
                anchorIdx = curIdx;
                Plotly.relayout('price-chart', {
                    shapes: [{
                        type: 'line',
                        x0: dates[anchorIdx], x1: dates[anchorIdx],
                        y0: 0, y1: 1, yref: 'paper',
                        line: { color: '#60a5fa', width: 2, dash: 'dash' }
                    }]
                });
                return;
            }

            if (curIdx === anchorIdx) return; // identical point — skip

            const aDate = dates[anchorIdx];
            const bDate = dates[curIdx];
            const aVal  = closes[anchorIdx];
            const bVal  = closes[curIdx];
            const diff  = bVal - aVal;
            const pct   = (diff / aVal) * 100;
            const pos   = diff >= 0;
            const sig   = pos ? '+' : '';
            const col   = pos ? '#10b981' : '#ef4444';

            // Draw: shaded region + anchor line (blue dashed) + moving line (colored dotted)
            Plotly.relayout('price-chart', {
                shapes: [
                    {   // Shaded area between the two points
                        type: 'rect',
                        x0: aDate, x1: bDate,
                        y0: 0, y1: 1, yref: 'paper',
                        fillcolor: pos ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
                        line: { width: 0 }
                    },
                    {   // Anchor line — solid blue
                        type: 'line',
                        x0: aDate, x1: aDate,
                        y0: 0, y1: 1, yref: 'paper',
                        line: { color: '#60a5fa', width: 2, dash: 'dash' }
                    },
                    {   // Moving line — green or red depending on direction
                        type: 'line',
                        x0: bDate, x1: bDate,
                        y0: 0, y1: 1, yref: 'paper',
                        line: { color: col, width: 2, dash: 'dot' }
                    }
                ]
            });

            // Update the comparison box below the chart
            compBox.innerHTML = `
                <div class="cmp-row">
                    <span class="cmp-label">From</span>
                    <span class="cmp-val">${aDate} &mdash; <strong>$${aVal.toFixed(2)}</strong></span>
                </div>
                <div class="cmp-row">
                    <span class="cmp-label">To</span>
                    <span class="cmp-val">${bDate} &mdash; <strong>$${bVal.toFixed(2)}</strong></span>
                </div>
                <div class="cmp-divider"></div>
                <div class="cmp-row">
                    <span class="cmp-label">Change</span>
                    <span class="cmp-val" style="color:${col};font-weight:700;">
                        ${sig}$${Math.abs(diff).toFixed(2)} &nbsp;(${sig}${pct.toFixed(2)}%)
                    </span>
                </div>`;
            compBox.classList.remove('hidden');
        });
    }

    
    function renderTable(dataArray, tableId, emptyId) {
        const table = document.getElementById(tableId);
        const emptyMsg = document.getElementById(emptyId);
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        
        thead.innerHTML = '';
        tbody.innerHTML = '';
        
        if (!dataArray || dataArray.length === 0) {
            table.classList.add('hidden');
            emptyMsg.classList.remove('hidden');
            return;
        }
        
        table.classList.remove('hidden');
        emptyMsg.classList.add('hidden');
        
        // Create headers
        const keys = Object.keys(dataArray[0]);
        const trHead = document.createElement('tr');
        keys.forEach(k => {
            // Clean up pandas 'index' column name usually representing metric
            const text = k === 'index' ? 'Metric' : (typeof k === 'string' && k.includes('00:00') ? k.split(' ')[0] : k);
            const th = document.createElement('th');
            th.textContent = text;
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);
        
        // Create rows
        dataArray.forEach(row => {
            const tr = document.createElement('tr');
            keys.forEach(k => {
                const td = document.createElement('td');
                let val = row[k];
                if (typeof val === 'number') {
                    // Format large numbers
                    val = formatNumber(val);
                }
                td.textContent = val !== null ? val : '--';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    function renderNews(newsArray) {
        const grid = document.getElementById('news-grid');
        const emptyMsg = document.getElementById('news-empty');
        grid.innerHTML = '';
        
        if (!newsArray || newsArray.length === 0) {
            emptyMsg.classList.remove('hidden');
            return;
        }
        
        emptyMsg.classList.add('hidden');
        
        newsArray.forEach(item => {
            const date = new Date(item.providerPublishTime * 1000).toLocaleDateString();
            const div = document.createElement('div');
            div.className = 'news-card';
            div.innerHTML = `
                <a href="${item.link}" target="_blank" rel="noopener noreferrer">
                    <h4>${item.title}</h4>
                    <div class="news-meta">
                        <span>${item.publisher || 'Yahoo Finance'}</span>
                        <span>${date}</span>
                    </div>
                </a>
            `;
            grid.appendChild(div);
        });
    }
});
