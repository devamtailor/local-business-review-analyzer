import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { UploadSimple, Globe, GoogleLogo, FileCsv, CheckCircle, WarningCircle, CloudArrowUp, Spinner } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TABS = [
  { id: 'csv', label: 'CSV Upload', icon: FileCsv },
  { id: 'manual', label: 'Paste Reviews', icon: UploadSimple },
  { id: 'url', label: 'URL Scrape', icon: Globe },
  { id: 'google', label: 'Google Reviews', icon: GoogleLogo },
];

export default function ImportReviews() {
  const [activeTab, setActiveTab] = useState('csv');
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // CSV state
  const [csvFile, setCsvFile] = useState(null);
  const [csvBusinessId, setCsvBusinessId] = useState('');
  const [dragging, setDragging] = useState(false);

  // URL state
  const [urlInput, setUrlInput] = useState('');
  const [urlBusinessId, setUrlBusinessId] = useState('');

  // Manual Paste state
  const [manualInput, setManualInput] = useState('');
  const [manualBusinessId, setManualBusinessId] = useState('');

  // Google state
  const [placeId, setPlaceId] = useState('');
  const [googleBusinessId, setGoogleBusinessId] = useState('');
  const [googleConfigured] = useState(false); // Will be resolved from backend

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/businesses`, { withCredentials: true });
      setBusinesses(data);
      if (data.length > 0) {
        setCsvBusinessId(data[0]._id);
        setUrlBusinessId(data[0]._id);
        setManualBusinessId(data[0]._id);
        setGoogleBusinessId(data[0]._id);
      }
    } catch {
      /* silently fail */
    }
  };

  const reset = () => { setResult(null); setError(null); };

  // ─── CSV Import ───────────────────────────────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) setCsvFile(f);
    else setError('Please drop a .csv file');
  }, []);

  const submitCsv = async () => {
    if (!csvFile || !csvBusinessId) return setError('Select a business and upload a CSV file');
    reset();
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', csvFile);
      fd.append('business_id', csvBusinessId);
      const { data } = await axios.post(`${API_URL}/api/reviews/import/csv`, fd, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(data);
      setCsvFile(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── URL Import ───────────────────────────────────────────────────────────
  const submitUrl = async () => {
    if (!urlInput || !urlBusinessId) return setError('Enter a URL and select a business');
    reset();
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/reviews/import/url`, {
        business_id: urlBusinessId, url: urlInput
      }, { withCredentials: true });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Scraping failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── Manual Import ────────────────────────────────────────────────────────
  const submitManual = async () => {
    if (!manualInput || !manualBusinessId) return setError('Enter reviews and select a business');
    reset();
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/reviews/import/manual`, {
        business_id: manualBusinessId, text: manualInput
      }, { withCredentials: true });
      setResult(data);
      setManualInput('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Manual import failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── Google Import ────────────────────────────────────────────────────────
  const submitGoogle = async () => {
    if (!placeId || !googleBusinessId) return setError('Enter a Place ID and select a business');
    reset();
    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/reviews/import/google`, {
        business_id: googleBusinessId, place_id: placeId
      }, { withCredentials: true });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Google import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tighter">Import Reviews</h1>
        <p className="text-text-muted font-body mt-2">
          Pull reviews from multiple sources into your analyzer
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-8 border border-secondary overflow-hidden">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); reset(); }}
              className={`flex items-center gap-2 px-5 py-3.5 font-body font-semibold text-sm transition-all flex-1 justify-center ${
                activeTab === tab.id
                  ? 'bg-primary text-white'
                  : 'bg-white text-text-muted hover:bg-secondary hover:text-primary'
              }`}
            >
              <Icon weight={activeTab === tab.id ? 'fill' : 'duotone'} size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Business Selector (shared) */}
      {businesses.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 p-4 mb-6 flex items-center gap-3">
          <WarningCircle size={20} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700 font-body">
            No businesses found. <a href="/businesses" className="underline font-semibold">Create a business</a> first to import reviews.
          </p>
        </div>
      ) : null}

      {/* ── CSV Tab ── */}
      {activeTab === 'csv' && (
        <div className="space-y-6">
          <div>
            <label className="block font-body text-sm font-semibold mb-2 uppercase tracking-wider text-text-muted">
              Target Business
            </label>
            <select
              value={csvBusinessId}
              onChange={e => setCsvBusinessId(e.target.value)}
              className="w-full border border-secondary bg-white px-4 py-3 font-body focus:outline-none focus:border-primary"
            >
              {businesses.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>

          {/* CSV Format hint */}
          <div className="bg-secondary/50 border border-secondary p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <p className="font-body text-sm font-semibold mb-2">Expected CSV columns:</p>
              <code className="text-xs bg-white border border-secondary px-3 py-2 block font-mono">
                rating, text, reviewer_name (optional), source (optional)
              </code>
              <p className="text-xs text-text-muted mt-2 font-body">
                • <strong>rating</strong>: 1–5 integer &nbsp;•&nbsp; <strong>text</strong>: review content (required) &nbsp;•&nbsp; <strong>reviewer_name</strong>: author name
              </p>
            </div>
            <button
              onClick={() => {
                const csvContent = "name,rating,review\nJohn Doe,5,Great service!\nJane Smith,4,Good experience.";
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'review_template.csv';
                a.click();
              }}
              className="text-xs font-semibold text-primary border border-primary px-3 py-2 hover:bg-primary hover:text-white transition-colors whitespace-nowrap"
            >
              Download Template
            </button>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed p-12 text-center transition-all cursor-pointer relative ${
              dragging ? 'border-primary bg-primary/5' : 'border-secondary hover:border-primary hover:bg-secondary/40'
            }`}
            onClick={() => document.getElementById('csv-file-input').click()}
          >
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { if (e.target.files[0]) setCsvFile(e.target.files[0]); }}
            />
            <CloudArrowUp size={48} weight="duotone" className={`mx-auto mb-4 ${dragging ? 'text-primary' : 'text-text-muted'}`} />
            {csvFile ? (
              <div>
                <p className="font-body font-semibold text-primary">{csvFile.name}</p>
                <p className="text-text-muted text-sm mt-1">{(csvFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-body font-semibold">Drop your CSV here or click to browse</p>
                <p className="text-text-muted text-sm mt-1">Supports .csv files up to 10MB</p>
              </div>
            )}
          </div>

          <button
            onClick={submitCsv}
            disabled={loading || !csvFile || !csvBusinessId}
            className="flex items-center gap-2 bg-primary text-white px-8 py-3.5 font-body font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Spinner size={18} className="animate-spin" /> : <UploadSimple size={18} weight="bold" />}
            {loading ? 'Importing...' : 'Import CSV'}
          </button>
        </div>
      )}

      {/* ── Manual Paste Tab ── */}
      {activeTab === 'manual' && (
        <div className="space-y-6">
          <div>
            <label className="block font-body text-sm font-semibold mb-2 uppercase tracking-wider text-text-muted">
              Target Business
            </label>
            <select
              value={manualBusinessId}
              onChange={e => setManualBusinessId(e.target.value)}
              className="w-full border border-secondary bg-white px-4 py-3 font-body focus:outline-none focus:border-primary"
            >
              {businesses.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block font-body text-sm font-semibold mb-2 uppercase tracking-wider text-text-muted">
              Paste Reviews (One per line)
            </label>
            <textarea
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              placeholder="The food was amazing!\nService was a bit slow, but overall good.\nWill definitely come back."
              className="w-full border border-secondary bg-white px-4 py-3 font-body focus:outline-none focus:border-primary h-48 resize-y"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-blue-700 font-body">
              <strong>Note:</strong> Paste each review on a new line. We will attempt to import each line as a distinct review. Default rating will be standard.
            </p>
          </div>

          <button
            onClick={submitManual}
            disabled={loading || !manualInput || !manualBusinessId}
            className="flex items-center gap-2 bg-primary text-white px-8 py-3.5 font-body font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Spinner size={18} className="animate-spin" /> : <UploadSimple size={18} weight="bold" />}
            {loading ? 'Importing...' : 'Import Parsed Reviews'}
          </button>
        </div>
      )}

      {/* ── URL Tab ── */}
      {activeTab === 'url' && (
        <div className="space-y-6">
          <div>
            <label className="block font-body text-sm font-semibold mb-2 uppercase tracking-wider text-text-muted">
              Target Business
            </label>
            <select
              value={urlBusinessId}
              onChange={e => setUrlBusinessId(e.target.value)}
              className="w-full border border-secondary bg-white px-4 py-3 font-body focus:outline-none focus:border-primary"
            >
              {businesses.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block font-body text-sm font-semibold mb-2 uppercase tracking-wider text-text-muted">
              Page URL to Scrape
            </label>
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://www.yelp.com/biz/your-business"
              className="w-full border border-secondary bg-white px-4 py-3 font-body focus:outline-none focus:border-primary"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4">
            <p className="text-sm text-blue-700 font-body">
              <strong>Note:</strong> URL scraping works best on pages with structured review content.
              It extracts visible text blocks from the page. Results may vary by website structure.
            </p>
          </div>

          <button
            onClick={submitUrl}
            disabled={loading || !urlInput || !urlBusinessId}
            className="flex items-center gap-2 bg-primary text-white px-8 py-3.5 font-body font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Spinner size={18} className="animate-spin" /> : <Globe size={18} weight="bold" />}
            {loading ? 'Scraping...' : 'Scrape Reviews'}
          </button>
        </div>
      )}

      {/* ── Google Tab ── */}
      {activeTab === 'google' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 p-5 flex gap-4">
            <WarningCircle size={24} weight="fill" className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-body font-semibold text-amber-800 mb-1">Google Places API Key Required</p>
              <p className="text-sm text-amber-700 font-body">
                To enable Google Reviews import, add your <code className="font-mono text-xs bg-amber-100 px-1">GOOGLE_PLACES_API_KEY</code> to <code className="font-mono text-xs bg-amber-100 px-1">backend/.env</code>.
                Get a free key at <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="underline font-semibold">Google Cloud Console</a>.
              </p>
            </div>
          </div>

          <div>
            <label className="block font-body text-sm font-semibold mb-2 uppercase tracking-wider text-text-muted">
              Target Business
            </label>
            <select
              value={googleBusinessId}
              onChange={e => setGoogleBusinessId(e.target.value)}
              className="w-full border border-secondary bg-white px-4 py-3 font-body focus:outline-none focus:border-primary"
            >
              {businesses.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block font-body text-sm font-semibold mb-2 uppercase tracking-wider text-text-muted">
              Google Place ID
            </label>
            <input
              type="text"
              value={placeId}
              onChange={e => setPlaceId(e.target.value)}
              placeholder="e.g. ChIJN1t_tDeuEmsRUsoyG83frY4"
              className="w-full border border-secondary bg-white px-4 py-3 font-body focus:outline-none focus:border-primary"
            />
            <p className="text-xs text-text-muted mt-2 font-body">
              Find the Place ID using <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noreferrer" className="underline">Google's Place ID Finder</a>
            </p>
          </div>

          <button
            onClick={submitGoogle}
            disabled={loading || !placeId || !googleBusinessId}
            className="flex items-center gap-2 bg-primary text-white px-8 py-3.5 font-body font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Spinner size={18} className="animate-spin" /> : <GoogleLogo size={18} weight="bold" />}
            {loading ? 'Fetching...' : 'Import from Google'}
          </button>
        </div>
      )}

      {/* ── Result / Error ── */}
      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <WarningCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" weight="fill" />
          <p className="text-sm text-red-700 font-body">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 bg-green-50 border border-green-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle size={24} weight="fill" className="text-green-600" />
            <h3 className="font-heading text-lg font-bold text-green-800">Import Successful</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white border border-green-200 p-4 text-center">
              <p className="font-heading text-3xl font-black text-green-700">{result.inserted}</p>
              <p className="text-xs font-body font-semibold uppercase tracking-wider text-text-muted mt-1">New Reviews Added</p>
            </div>
            <div className="bg-white border border-green-200 p-4 text-center">
              <p className="font-heading text-3xl font-black text-primary">{result.total_found}</p>
              <p className="text-xs font-body font-semibold uppercase tracking-wider text-text-muted mt-1">Total Found</p>
            </div>
          </div>
          <p className="text-sm text-green-700 font-body">{result.message}</p>
          {result.preview && (
            <div className="mt-4">
              <p className="font-body text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Preview</p>
              <ul className="space-y-1">
                {result.preview.map((p, i) => (
                  <li key={i} className="text-sm text-text-muted font-body bg-white border border-green-100 px-3 py-2">
                    <span className="text-primary font-semibold">{i + 1}.</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <a href="/analysis" className="inline-block mt-4 text-sm text-primary font-semibold underline font-body">
            → Run AI Analysis on these reviews
          </a>
        </div>
      )}
    </div>
  );
}
