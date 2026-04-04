import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { Buildings, ChartBar, Star, TrendUp, Sparkle, ArrowRight } from '@phosphor-icons/react';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/dashboard/stats`, {
        withCredentials: true
      });
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const sentimentChartData = {
    labels: ['Positive', 'Neutral', 'Negative'],
    datasets: [{
      data: stats ? [
        stats.sentiment_distribution.positive,
        stats.sentiment_distribution.neutral,
        stats.sentiment_distribution.negative
      ] : [0, 0, 0],
      backgroundColor: ['#111111', '#A3A3A3', '#FF331F'],
      borderWidth: 0,
    }]
  };

  const ratingChartData = {
    labels: ['1★', '2★', '3★', '4★', '5★'],
    datasets: [{
      label: 'Reviews',
      data: stats ? [
        stats.rating_distribution[1],
        stats.rating_distribution[2],
        stats.rating_distribution[3],
        stats.rating_distribution[4],
        stats.rating_distribution[5]
      ] : [0, 0, 0, 0, 0],
      backgroundColor: '#111111',
      borderRadius: 0,
    }]
  };

  const chartOptions = {
    plugins: {
      legend: {
        labels: {
          font: { family: 'Satoshi', weight: 500 },
          color: '#111111'
        }
      },
      tooltip: {
        backgroundColor: '#111111',
        titleFont: { family: 'Cabinet Grotesk', weight: 700 },
        bodyFont: { family: 'Satoshi' },
        padding: 12,
        cornerRadius: 0,
      }
    }
  };

  const barOptions = {
    ...chartOptions,
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Satoshi', weight: 500 }, color: '#737373' }
      },
      y: {
        grid: { color: '#E5E5E5' },
        ticks: { font: { family: 'Satoshi' }, color: '#737373' }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="loader w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard" className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tighter">
          Dashboard
        </h1>
        <p className="text-text-muted font-body mt-2">Welcome back, {user?.name || 'User'}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <div data-testid="stat-businesses" className="bg-white border border-secondary p-6 rounded-none hover:border-primary transition-colors duration-200">
          <div className="flex items-center gap-4">
            <div className="bg-primary p-3">
              <Buildings weight="duotone" size={24} className="text-white" />
            </div>
            <div>
              <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-text-muted">Businesses</p>
              <p className="font-heading text-3xl font-black">{stats?.total_businesses || 0}</p>
            </div>
          </div>
        </div>

        <div data-testid="stat-reviews" className="bg-white border border-secondary p-6 rounded-none hover:border-primary transition-colors duration-200">
          <div className="flex items-center gap-4">
            <div className="bg-primary p-3">
              <ChartBar weight="duotone" size={24} className="text-white" />
            </div>
            <div>
              <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-text-muted">Reviews</p>
              <p className="font-heading text-3xl font-black">{stats?.total_reviews || 0}</p>
            </div>
          </div>
        </div>

        <div data-testid="stat-positive" className="bg-white border border-secondary p-6 rounded-none hover:border-primary transition-colors duration-200">
          <div className="flex items-center gap-4">
            <div className="bg-primary p-3">
              <TrendUp weight="duotone" size={24} className="text-white" />
            </div>
            <div>
              <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-text-muted">Positive</p>
              <p className="font-heading text-3xl font-black">{stats?.sentiment_distribution?.positive || 0}</p>
            </div>
          </div>
        </div>

        <div data-testid="stat-negative" className="bg-white border border-secondary p-6 rounded-none hover:border-primary transition-colors duration-200">
          <div className="flex items-center gap-4">
            <div className="bg-accent p-3">
              <Star weight="duotone" size={24} className="text-white" />
            </div>
            <div>
              <p className="font-body text-xs font-bold uppercase tracking-[0.2em] text-text-muted">Negative</p>
              <p className="font-heading text-3xl font-black text-accent">{stats?.sentiment_distribution?.negative || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-8">
        <div data-testid="sentiment-chart" className="bg-white border border-secondary p-6 rounded-none">
          <h2 className="font-heading text-xl font-bold mb-6">Sentiment Distribution</h2>
          <div className="h-64 flex items-center justify-center">
            <Pie data={sentimentChartData} options={chartOptions} />
          </div>
        </div>

        <div data-testid="rating-chart" className="bg-white border border-secondary p-6 rounded-none">
          <h2 className="font-heading text-xl font-bold mb-6">Rating Distribution</h2>
          <div className="h-64">
            <Bar data={ratingChartData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* AI Summary Placeholder */}
      <div data-testid="ai-summary-card" className="bg-background border-2 border-primary p-6 rounded-none shadow-[4px_4px_0_0_#111111] mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Sparkle weight="duotone" size={24} className="text-accent" />
          <h2 className="font-heading text-xl font-bold">AI Insights</h2>
          <span className="bg-accent text-white px-2 py-0.5 text-xs font-bold uppercase tracking-wider">Placeholder</span>
        </div>
        <p className="text-text-muted font-body">
          AI-powered sentiment analysis and review summaries will appear here. This feature analyzes patterns 
          in customer feedback to provide actionable insights for your business decisions.
        </p>
        <div className="mt-4 pt-4 border-t border-secondary">
          <p className="text-sm text-text-muted font-body">
            <strong>Coming soon:</strong> Sentiment trends, keyword extraction, and AI-generated recommendations.
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link 
          to="/businesses"
          data-testid="view-businesses-link"
          className="bg-white border border-secondary p-6 rounded-none hover:border-primary transition-colors duration-200 flex items-center justify-between group"
        >
          <div>
            <h3 className="font-heading text-lg font-bold">Manage Businesses</h3>
            <p className="text-text-muted font-body text-sm">Add and manage local businesses</p>
          </div>
          <ArrowRight weight="bold" size={24} className="text-text-muted group-hover:text-primary transition-colors" />
        </Link>

        <Link 
          to="/reviews"
          data-testid="view-reviews-link"
          className="bg-white border border-secondary p-6 rounded-none hover:border-primary transition-colors duration-200 flex items-center justify-between group"
        >
          <div>
            <h3 className="font-heading text-lg font-bold">View Reviews</h3>
            <p className="text-text-muted font-body text-sm">Browse and analyze customer reviews</p>
          </div>
          <ArrowRight weight="bold" size={24} className="text-text-muted group-hover:text-primary transition-colors" />
        </Link>
      </div>

      {/* Top Businesses */}
      {stats?.top_businesses?.length > 0 && (
        <div className="mt-8">
          <h2 className="font-heading text-2xl font-bold mb-4">Top Rated Businesses</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.top_businesses.map((business) => (
              <div key={business._id} className="bg-white border border-secondary p-4 rounded-none hover:border-primary transition-colors">
                <h3 className="font-heading font-bold">{business.name}</h3>
                <p className="text-text-muted text-sm">{business.category}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Star weight="fill" className="text-primary" size={16} />
                  <span className="font-bold">{business.avg_rating}</span>
                  <span className="text-text-muted text-sm">({business.review_count} reviews)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Reviews */}
      {stats?.recent_reviews?.length > 0 && (
        <div className="mt-8">
          <h2 className="font-heading text-2xl font-bold mb-4">Recent Reviews</h2>
          <div className="space-y-4">
            {stats.recent_reviews.map((review) => (
              <div key={review._id} className="bg-white border border-secondary p-4 rounded-none">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold">{review.reviewer_name}</span>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        weight={i < review.rating ? "fill" : "regular"} 
                        className={i < review.rating ? "text-primary" : "text-secondary"} 
                        size={16} 
                      />
                    ))}
                  </div>
                </div>
                <p className="text-text-muted text-sm line-clamp-2">{review.text}</p>
                <span className={`inline-block mt-2 px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                  review.sentiment === 'positive' ? 'bg-primary text-white' :
                  review.sentiment === 'negative' ? 'bg-accent text-white' :
                  'bg-secondary text-text-muted'
                }`}>
                  {review.sentiment}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
