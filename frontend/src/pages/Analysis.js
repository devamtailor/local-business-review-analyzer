import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Sparkle, Buildings, ThumbsUp, ThumbsDown, Lightbulb,
  WarningCircle, Spinner, CheckCircle, Robot, ArrowCounterClockwise,
  Fire, Calendar, TrendUp
} from '@phosphor-icons/react';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SENTIMENT_COLORS = {
  positive: { bg: '#22c55e', light: '#f0fdf4', border: '#86efac', text: '#15803d' },
  neutral:  { bg: '#6b7280', light: '#f9fafb', border: '#d1d5db', text: '#374151' },
  negative: { bg: '#ef4444', light: '#fef2f2', border: '#fca5a5', text: '#b91c1c' },
};

function SentimentBadge({ sentiment }) {
  const c = SENTIMENT_COLORS[sentiment] || SENTIMENT_COLORS.neutral;
  return (
    <span
      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full"
      style={{ background: c.light, color: c.text, border: `1px solid ${c.border}` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full inline-block"
        style={{ background: c.bg }}
      />
      {sentiment}
    </span>
  );
}

export default function Analysis() {
  const [businesses, setBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBusinesses();
  }, []);

  useEffect(() => {
    if (selectedBusiness) fetchExistingAnalysis(selectedBusiness);
  }, [selectedBusiness]);

  const fetchBusinesses = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/businesses`, { withCredentials: true });
      setBusinesses(data);
      if (data.length > 0) setSelectedBusiness(data[0]._id);
    } catch { /* silently fail */ }
  };

  const fetchExistingAnalysis = async (businessId) => {
    setFetching(true);
    setError(null);
    setAnalysis(null);
    try {
      const { data } = await axios.get(
        `${API_URL}/api/reviews/analyze/${businessId}`,
        { withCredentials: true }
      );
      setAnalysis(data);
    } catch (err) {
      if (err.response?.status !== 404) {
        setError(err.response?.data?.detail || 'Failed to load analysis');
      }
    } finally {
      setFetching(false);
    }
  };

  const runAnalysis = async () => {
    if (!selectedBusiness) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(
        `${API_URL}/api/reviews/analyze`,
        { business_id: selectedBusiness },
        { withCredentials: true }
      );
      setAnalysis(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const selectedBiz = businesses.find(b => b._id === selectedBusiness);

  // ── Charts ──────────────────────────────────────────────────────────────
  const sentimentChartData = analysis ? {
    labels: ['Positive', 'Neutral', 'Negative'],
    datasets: [{
      data: [
        analysis.sentiment_distribution?.positive || 0,
        analysis.sentiment_distribution?.neutral || 0,
        analysis.sentiment_distribution?.negative || 0,
      ],
      backgroundColor: ['#22c55e', '#6b7280', '#ef4444'],
      borderWidth: 0,
    }]
  } : null;

  const ratingBarData = analysis ? {
    labels: ['Positive', 'Neutral', 'Negative'],
    datasets: [{
      label: 'Reviews',
      data: [
        analysis.sentiment_distribution?.positive || 0,
        analysis.sentiment_distribution?.neutral || 0,
        analysis.sentiment_distribution?.negative || 0,
      ],
      backgroundColor: ['#22c55e', '#6b7280', '#ef4444'],
      borderRadius: 4,
    }]
  } : null;

  const chartOptions = {
    plugins: {
      legend: {
        labels: { font: { family: 'Satoshi', weight: 500, size: 12 }, color: '#374151' }
      },
      tooltip: {
        backgroundColor: '#111111',
        titleFont: { family: 'Cabinet Grotesk', weight: 700 },
        bodyFont: { family: 'Satoshi' },
        padding: 12,
        cornerRadius: 4,
      }
    }
  };

  const barOptions = {
    ...chartOptions,
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: 'Satoshi' }, color: '#6b7280' } },
      y: { grid: { color: '#f3f4f6' }, ticks: { font: { family: 'Satoshi' }, color: '#6b7280' } }
    }
  };

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tighter flex items-center gap-3">
            AI Analysis
            <Sparkle weight="duotone" size={36} className="text-accent" />
          </h1>
          <p className="text-text-muted font-body mt-2">
            Powered by Google Gemini — sentiment, summaries & improvement suggestions
          </p>
        </div>
      </div>

      {/* Business Selector + Action Row */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <select
          value={selectedBusiness}
          onChange={e => setSelectedBusiness(e.target.value)}
          className="flex-1 border border-secondary bg-white px-4 py-3 font-body focus:outline-none focus:border-primary"
        >
          {businesses.length === 0 && <option value="">No businesses found</option>}
          {businesses.map(b => (
            <option key={b._id} value={b._id}>
              {b.name} — {b.category} ({b.review_count || 0} reviews)
            </option>
          ))}
        </select>
        <button
          onClick={runAnalysis}
          disabled={loading || !selectedBusiness}
          className="flex items-center gap-2 bg-primary text-white px-8 py-3 font-body font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading
            ? <><Spinner size={18} className="animate-spin" /> Analyzing…</>
            : analysis
            ? <><ArrowCounterClockwise size={18} weight="bold" /> Re-analyze</>
            : <><Robot size={18} weight="duotone" /> Run AI Analysis</>
          }
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <WarningCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" weight="fill" />
          <p className="text-sm text-red-700 font-body">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {(fetching || loading) && !analysis && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-secondary p-6 animate-pulse">
              <div className="h-4 bg-secondary rounded w-1/4 mb-3" />
              <div className="h-3 bg-secondary rounded w-3/4 mb-2" />
              <div className="h-3 bg-secondary rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!fetching && !loading && !analysis && !error && (
        <div className="bg-white border border-secondary p-12 text-center">
          <Robot size={56} weight="duotone" className="mx-auto mb-4 text-text-muted" />
          <h3 className="font-heading text-2xl font-bold mb-2">No Analysis Yet</h3>
          <p className="text-text-muted font-body mb-6">
            {selectedBiz
              ? `Select "${selectedBiz.name}" and click Run AI Analysis to get insights.`
              : 'Select a business and run analysis.'
            }
          </p>
          <a href="/import" className="inline-block border border-primary text-primary px-6 py-2.5 font-body font-semibold hover:bg-primary hover:text-white transition-colors">
            Import Reviews First →
          </a>
        </div>
      )}

      {/* ── Analysis Results ── */}
      {analysis && !loading && (
        <div className="space-y-6">
          
          {/* AI Status banner */}
          <div className={`flex items-center gap-3 px-5 py-3 border ${
            analysis.ai_powered === false
              ? 'bg-amber-50 border-amber-200'
              : 'bg-green-50 border-green-200'
          }`}>
            {analysis.ai_powered === false
              ? <WarningCircle size={18} className="text-amber-600" weight="fill" />
              : <CheckCircle size={18} className="text-green-600" weight="fill" />
            }
            <p className="text-sm font-body">
              {analysis.ai_powered === false
                ? <>Rule-based analysis (no Gemini key). Add <code className="font-mono text-xs bg-amber-100 px-1">GEMINI_API_KEY</code> to <code className="font-mono text-xs bg-amber-100 px-1">backend/.env</code> for AI-powered insights.</>
                : <>AI-powered analysis by Google Gemini · {analysis.review_count} reviews analyzed · {new Date(analysis.analyzed_at).toLocaleString()}</>
              }
            </p>
          </div>

          {/* Overall Sentiment Hero */}
          <div className={`p-6 border-2`} style={{
            background: SENTIMENT_COLORS[analysis.overall_sentiment]?.light,
            borderColor: SENTIMENT_COLORS[analysis.overall_sentiment]?.border,
          }}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-text-muted mb-1">Overall Sentiment</p>
                <div className="flex items-center gap-3">
                  <span className="font-heading text-4xl font-black capitalize"
                    style={{ color: SENTIMENT_COLORS[analysis.overall_sentiment]?.text }}>
                    {analysis.overall_sentiment}
                  </span>
                  {analysis.overall_sentiment === 'positive'
                    ? <ThumbsUp size={32} weight="fill" style={{ color: SENTIMENT_COLORS.positive.bg }} />
                    : analysis.overall_sentiment === 'negative'
                    ? <ThumbsDown size={32} weight="fill" style={{ color: SENTIMENT_COLORS.negative.bg }} />
                    : null}
                </div>
              </div>
              <div className="flex gap-4">
                {Object.entries(analysis.sentiment_distribution || {}).map(([key, val]) => (
                  <div key={key} className="text-center">
                    <p className="font-heading text-2xl font-black" style={{ color: SENTIMENT_COLORS[key]?.bg }}>{val}</p>
                    <p className="text-xs font-body uppercase tracking-wider text-text-muted capitalize">{key}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-secondary p-6">
              <h2 className="font-heading text-lg font-bold mb-4">Sentiment Breakdown</h2>
              <div className="h-56 flex items-center justify-center">
                {sentimentChartData && <Doughnut data={sentimentChartData} options={chartOptions} />}
              </div>
            </div>
            <div className="bg-white border border-secondary p-6">
              <h2 className="font-heading text-lg font-bold mb-4">Review Distribution</h2>
              <div className="h-56">
                {ratingBarData && <Bar data={ratingBarData} options={barOptions} />}
              </div>
            </div>
          </div>

          {/* Summary & Keywords */}
          <div className="bg-white border border-secondary p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkle weight="fill" size={22} className="text-accent" />
              <h2 className="font-heading text-xl font-bold">AI Summary</h2>
            </div>
            <p className="font-body text-text-muted leading-relaxed mb-4">{analysis.summary}</p>
            {analysis.keywords?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-secondary">
                {analysis.keywords.map((kw, i) => (
                  <span key={i} className="px-3 py-1 bg-secondary text-text-muted font-body text-xs font-semibold uppercase tracking-wider rounded-none">
                    #{kw}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 🌟 AI BUSINESS ADVISOR 🌟 */}
          <div className="mt-8 mb-6">
            <h2 className="font-heading text-3xl font-black mb-1 flex items-center gap-3">
              AI Business Advisor
            </h2>
            <p className="text-text-muted font-body mb-6">Your strategic action plan based on AI insights.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Urgent Issues */}
              <div className="bg-red-50/50 border border-red-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-4">
                  <Fire weight="duotone" size={24} className="text-red-500" />
                  <h3 className="font-heading text-lg font-bold text-red-900">Urgent Issues</h3>
                </div>
                <p className="text-sm text-red-700/80 mb-4 font-body font-semibold uppercase tracking-wider">What is hurting you most</p>
                {analysis.urgent_issues?.length > 0 ? (
                  <ul className="space-y-3">
                    {analysis.urgent_issues.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-2"></span>
                        <span className="font-body text-sm text-red-900">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-text-muted text-sm font-body italic">No urgent issues detected.</p>
                )}
              </div>

              {/* Weekly Action Plan */}
              <div className="bg-blue-50/50 border border-blue-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar weight="duotone" size={24} className="text-blue-500" />
                  <h3 className="font-heading text-lg font-bold text-blue-900">Weekly Action Plan</h3>
                </div>
                <p className="text-sm text-blue-700/80 mb-4 font-body font-semibold uppercase tracking-wider">What to fix this week</p>
                {analysis.weekly_action_plan?.length > 0 ? (
                  <ul className="space-y-3">
                    {analysis.weekly_action_plan.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="text-blue-500 font-bold text-sm mt-0.5">{i + 1}.</span>
                        <span className="font-body text-sm text-blue-900">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-text-muted text-sm font-body italic">No specific actions for this week.</p>
                )}
              </div>

              {/* Growth Opportunities */}
              <div className="bg-green-50/50 border border-green-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-4">
                  <TrendUp weight="duotone" size={24} className="text-green-500" />
                  <h3 className="font-heading text-lg font-bold text-green-900">Growth Opportunities</h3>
                </div>
                <p className="text-sm text-green-700/80 mb-4 font-body font-semibold uppercase tracking-wider">Double down strategy</p>
                {analysis.growth_opportunities?.length > 0 ? (
                  <ul className="space-y-3">
                    {analysis.growth_opportunities.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="text-green-500 font-bold text-sm mt-0.5">✦</span>
                        <span className="font-body text-sm text-green-900">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-text-muted text-sm font-body italic">More data needed for growth strategies.</p>
                )}
              </div>
            </div>
          </div>

          {/* 3-Column insights (Standard Metrics) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top Complaints */}
            <div className="bg-white border border-secondary p-6">
              <div className="flex items-center gap-2 mb-4">
                <ThumbsDown weight="duotone" size={20} className="text-red-500" />
                <h2 className="font-heading text-lg font-bold">Top Complaints</h2>
              </div>
              {analysis.top_complaints?.length > 0 ? (
                <ul className="space-y-3">
                  {analysis.top_complaints.map((c, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 rounded-full">{i + 1}</span>
                      <span className="font-body text-sm text-text-muted">{c}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-text-muted text-sm font-body">No complaints identified.</p>
              )}
            </div>

            {/* Top Strengths */}
            <div className="bg-white border border-secondary p-6">
              <div className="flex items-center gap-2 mb-4">
                <ThumbsUp weight="duotone" size={20} className="text-green-500" />
                <h2 className="font-heading text-lg font-bold">Top Strengths</h2>
              </div>
              {analysis.top_strengths?.length > 0 ? (
                <ul className="space-y-3">
                  {analysis.top_strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 bg-green-100 text-green-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 rounded-full">✓</span>
                      <span className="font-body text-sm text-text-muted">{s}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-text-muted text-sm font-body">No strengths identified.</p>
              )}
            </div>

            {/* Improvement Suggestions */}
            <div className="bg-white border border-secondary p-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb weight="duotone" size={20} className="text-amber-500" />
                <h2 className="font-heading text-lg font-bold">Suggestions</h2>
              </div>
              {analysis.improvement_suggestions?.length > 0 ? (
                <ul className="space-y-3">
                  {analysis.improvement_suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 bg-amber-100 text-amber-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 rounded-full">
                        <Lightbulb size={10} weight="fill" />
                      </span>
                      <span className="font-body text-sm text-text-muted">{s}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-text-muted text-sm font-body">No suggestions available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
