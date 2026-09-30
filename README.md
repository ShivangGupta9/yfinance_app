# Stock Analyzer Application

A robust, premium-styled financial web application built with Python, Flask, and the `yfinance` library. It provides an intuitive interface for searching stock tickers, viewing historical data, and analyzing financial details.

## Features

- **Historical Data**: View the last 2 years of daily historical stock price data.
- **Financial Statements**: Access balance sheets, income statements, and cash flows.
- **News**: Get the latest news for a specific stock ticker.
- **Data Export**: Export historical dataset for a specific stock to a CSV file.

## Tech Stack

- **Backend**: Python, Flask
- **Data Gathering & Processing**: `yfinance`, `pandas`
- **Frontend**: HTML, CSS, JavaScript (Plotly for charts)

## Prerequisites

- Python 3.7+
- pip (Python package installer)

## Installation

1. Select your desired directory or create a new one, then navigate into it.
2. If you are using a virtual environment, activate it.
3. Install the required dependencies:

```bash
pip install -r requirements.txt
```

## Running the Application

1. Start the Flask server:

```bash
python app.py
```

2. Open your web browser and navigate to `http://localhost:5000`.

## API Endpoints

- `GET /api/stock/<ticker>`: Fetches historical data (2 years, daily interval), company info, financial statements, news, and institutional holders in JSON format for the provided ticker.
- `GET /api/download/<ticker>`: Downloads the 2-year historical data for the requested ticker as a CSV file (`<ticker>_2y_1d.csv`).
