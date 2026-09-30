from flask import Flask, render_template, jsonify, Response
import yfinance as yf
import pandas as pd


app = Flask(__name__)
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
            
        # Extract features
        info = {}
        try:
            info = stock.info
        except Exception:
            pass # In case not available
            
        # We want to provide different tabs: financial statements, news, etc.
        # But some are properties on the ticker object. Let's send them if possible.
        def safe_json(df):
            if df is not None and not df.empty:
                df_copy = df.copy()
                df_copy.columns = [str(c) for c in df_copy.columns]
                return df_copy.reset_index().to_dict(orient='records')
            return None
            
        # Prepare the response payload
        data = {
            'history': hist.to_dict(orient='records'),
            'info': info,
            'financials': safe_json(stock.financials),
            'balance_sheet': safe_json(stock.balance_sheet),
            'cash_flow': safe_json(stock.cashflow),
            'income_statement': safe_json(stock.income_stmt),
            'news': stock.news if hasattr(stock, 'news') else None,
            'institutional_holders': safe_json(stock.institutional_holders),
        }
        
        # Replace NaNs with None for valid JSON
        # This is a bit tricky for everything recursively, but we handled the DataFrames mostly.
        # Let's clean the dict recursively.
        def clean_nans(d):
            if isinstance(d, dict):
                return {k: clean_nans(v) for k, v in d.items()}
            elif isinstance(d, list):
                return [clean_nans(i) for i in d]
            elif isinstance(d, float) and pd.isna(d):
                return None
            else:
                return d
                
        cleaned_data = clean_nans(data)
        
        return jsonify(cleaned_data)
        
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
