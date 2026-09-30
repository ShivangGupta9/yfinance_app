from pathlib import Path

from flask import Flask, render_template, jsonify, Response
import yfinance as yf
import pandas as pd
import numpy as np


app = Flask(__name__)

# yfinance stores cookies and ticker time zones in a local SQLite cache. Put it
# beside the app so it works even when the user's default cache folder is not
# writable (for example, on a restricted Windows account).
YFINANCE_CACHE_DIR = Path(app.root_path) / '.cache' / 'yfinance'
YFINANCE_CACHE_DIR.mkdir(parents=True, exist_ok=True)
yf.set_tz_cache_location(str(YFINANCE_CACHE_DIR))


def clean_json(value):
    """Convert pandas/numpy values into values Flask can serialize as JSON."""
    if isinstance(value, dict):
        return {str(key): clean_json(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean_json(item) for item in value]
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    if isinstance(value, np.datetime64):
        return pd.Timestamp(value).isoformat()
    if isinstance(value, np.generic):
        value = value.item()
    if value is None or isinstance(value, (str, int, float, bool)):
        if isinstance(value, float) and not np.isfinite(value):
            return None
        return value
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return str(value)


def optional_property(ticker, name):
    """Return one optional yfinance property without failing the full request."""
    try:
        return getattr(ticker, name)
    except Exception as exc:
        app.logger.info('Yahoo Finance did not provide %s: %s', name, exc)
        return None
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/stock/<ticker>', methods=['GET'])
def get_stock_data(ticker):
    try:
        stock = yf.Ticker(ticker)
        
        # We need the 1 day interval for the last 2 years
        hist = stock.history(period="2y", interval="1d")
        
        if hist.empty:
            return jsonify({'error': f'No data found for {ticker}'}), 404
            
        # Reset index to get Date as a column
        hist.reset_index(inplace=True)
        # Convert Date to string for JSON serialization
        if 'Date' in hist.columns:
            hist['Date'] = hist['Date'].astype(str)
            
        # These fields are optional; a missing statement or news feed should
        # not prevent the price history and other available data from showing.
        info = optional_property(stock, 'info') or {}
            
        # We want to provide different tabs: financial statements, news, etc.
        # But some are properties on the ticker object. Let's send them if possible.
        def safe_json(df):
            if isinstance(df, pd.DataFrame) and not df.empty:
                frame = df.copy()
                frame.columns = [str(column) for column in frame.columns]
                records = frame.reset_index().to_dict(orient='records')
                return clean_json(records)
            return None
            
        # Prepare the response payload
        data = {
            'history': hist.to_dict(orient='records'),
            'info': info,
            'financials': safe_json(optional_property(stock, 'financials')),
            'balance_sheet': safe_json(optional_property(stock, 'balance_sheet')),
            'cash_flow': safe_json(optional_property(stock, 'cashflow')),
            'income_statement': safe_json(optional_property(stock, 'income_stmt')),
            'news': clean_json(optional_property(stock, 'news')),
            'institutional_holders': safe_json(optional_property(stock, 'institutional_holders')),
        }

        return jsonify(clean_json(data))
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/<ticker>', methods=['GET'])
def download_csv(ticker):
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period="2y", interval="1d")
        
        if hist.empty:
            return "No data found", 404
            
        csv = hist.to_csv()
        
        return Response(
            csv,
            mimetype="text/csv",
            headers={"Content-disposition":
                     f"attachment; filename={ticker}_2y_1d.csv"}
        )
    except Exception as e:
        return str(e), 500

if __name__ == '__main__':
    app.run(debug=True)
