import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { ChatText, Plus, Pencil, Trash, Star, MagnifyingGlass, X, Buildings } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function Reviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [selectedSentiment, setSelectedSentiment] = useState('');
  const [formData, setFormData] = useState({ business_id: '', rating: 5, text: '', reviewer_name: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [reviewsRes, businessesRes] = await Promise.all([
        axios.get(`${API_URL}/api/reviews`, { withCredentials: true }),
        axios.get(`${API_URL}/api/businesses`, { withCredentials: true })
      ]);
      setReviews(reviewsRes.data);
      setBusinesses(businessesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingReview) {
        await axios.put(`${API_URL}/api/reviews/${editingReview._id}`, {
          rating: formData.rating,
          text: formData.text
        }, { withCredentials: true });
      } else {
        await axios.post(`${API_URL}/api/reviews`, formData, { withCredentials: true });
      }
      setShowModal(false);
      setEditingReview(null);
      setFormData({ business_id: '', rating: 5, text: '', reviewer_name: '' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save review');
    }
  };

  const handleEdit = (review) => {
    setEditingReview(review);
    setFormData({ 
      business_id: review.business_id, 
      rating: review.rating, 
      text: review.text, 
      reviewer_name: review.reviewer_name 
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;
    try {
      await axios.delete(`${API_URL}/api/reviews/${id}`, { withCredentials: true });
      fetchData();
    } catch (error) {
      console.error('Failed to delete review:', error);
    }
  };

  const getBusinessName = (businessId) => {
    const business = businesses.find(b => b._id === businessId);
    return business ? business.name : 'Unknown Business';
  };

  const filteredReviews = reviews.filter(r => {
    if (selectedBusiness && r.business_id !== selectedBusiness) return false;
    if (selectedSentiment && r.sentiment !== selectedSentiment) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="loader w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div data-testid="reviews-page" className="p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tighter">
            Reviews
          </h1>
          <p className="text-text-muted font-body mt-2">Customer feedback and ratings</p>
        </div>
        <button
          data-testid="add-review-button"
          onClick={() => { 
            setShowModal(true); 
            setEditingReview(null); 
            setFormData({ business_id: businesses[0]?._id || '', rating: 5, text: '', reviewer_name: '' }); 
          }}
          disabled={businesses.length === 0}
          className="bg-primary text-white px-6 py-2.5 font-bold tracking-wide rounded-none border-2 border-primary hover:bg-white hover:text-primary transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus weight="bold" size={20} />
          Add Review
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <select
          data-testid="business-filter-select"
          value={selectedBusiness}
          onChange={(e) => setSelectedBusiness(e.target.value)}
          className="border border-secondary rounded-none px-4 py-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-primary bg-white transition-all duration-200 font-body flex-1 md:flex-none"
        >
          <option value="">All Businesses</option>
          {businesses.map((business) => (
            <option key={business._id} value={business._id}>{business.name}</option>
          ))}
        </select>
        
        <select
          data-testid="sentiment-filter-select"
          value={selectedSentiment}
          onChange={(e) => setSelectedSentiment(e.target.value)}
          className="border border-secondary rounded-none px-4 py-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-primary bg-white transition-all duration-200 font-body flex-1 md:flex-none"
        >
          <option value="">All Sentiments</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </select>
      </div>

      {/* Reviews List */}
      {businesses.length === 0 ? (
        <div className="bg-white border border-secondary p-12 rounded-none text-center">
          <Buildings weight="duotone" size={48} className="mx-auto text-text-muted mb-4" />
          <h3 className="font-heading text-xl font-bold mb-2">No businesses yet</h3>
          <p className="text-text-muted font-body">Add a business first to start adding reviews</p>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="bg-white border border-secondary p-12 rounded-none text-center">
          <ChatText weight="duotone" size={48} className="mx-auto text-text-muted mb-4" />
          <h3 className="font-heading text-xl font-bold mb-2">No reviews yet</h3>
          <p className="text-text-muted font-body">Add your first review to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((review) => (
            <div 
              key={review._id} 
              data-testid={`review-card-${review._id}`}
              className="bg-white border border-secondary p-6 rounded-none hover:border-primary transition-colors duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-heading font-bold">{review.reviewer_name}</h3>
                  <p className="text-text-muted font-body text-sm">{getBusinessName(review.business_id)}</p>
                </div>
                <div className="flex items-center gap-4">
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
                  <div className="flex gap-2">
                    <button
                      data-testid={`edit-review-${review._id}`}
                      onClick={() => handleEdit(review)}
                      className="p-2 border border-secondary hover:border-primary transition-colors"
                    >
                      <Pencil weight="duotone" size={16} />
                    </button>
                    <button
                      data-testid={`delete-review-${review._id}`}
                      onClick={() => handleDelete(review._id)}
                      className="p-2 border border-secondary hover:border-accent hover:text-accent transition-colors"
                    >
                      <Trash weight="duotone" size={16} />
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-text-main font-body mb-4">{review.text}</p>
              <div className="flex items-center gap-4">
                <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${
                  review.sentiment === 'positive' ? 'bg-primary text-white' :
                  review.sentiment === 'negative' ? 'bg-accent text-white' :
                  'bg-secondary text-text-muted'
                }`}>
                  {review.sentiment}
                </span>
                {review.ai_summary && (
                  <span className="text-text-muted text-sm font-body">AI Summary available</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white border-2 border-primary rounded-none shadow-[8px_8px_0_0_#111111] p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-2xl font-bold">
                {editingReview ? 'Edit Review' : 'Add Review'}
              </h2>
              <button 
                data-testid="close-review-modal-button"
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-secondary transition-colors"
              >
                <X weight="bold" size={20} />
              </button>
            </div>

            {error && (
              <div className="bg-accent/10 border-2 border-accent text-accent px-4 py-3 mb-6 font-body text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingReview && (
                <div>
                  <label className="font-body text-xs font-bold uppercase tracking-[0.2em] text-text-muted block mb-2">
                    Business
                  </label>
                  <select
                    data-testid="review-business-select"
                    value={formData.business_id}
                    onChange={(e) => setFormData({ ...formData, business_id: e.target.value })}
                    className="border border-secondary rounded-none px-4 py-2.5 w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-primary bg-white transition-all duration-200 font-body"
                    required
                  >
                    <option value="">Select a business</option>
                    {businesses.map((business) => (
                      <option key={business._id} value={business._id}>{business.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="font-body text-xs font-bold uppercase tracking-[0.2em] text-text-muted block mb-2">
                  Rating
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      data-testid={`rating-${rating}`}
                      onClick={() => setFormData({ ...formData, rating })}
                      className="p-2 hover:bg-secondary transition-colors"
                    >
                      <Star 
                        weight={rating <= formData.rating ? "fill" : "regular"} 
                        className={rating <= formData.rating ? "text-primary" : "text-secondary"} 
                        size={24} 
                      />
                    </button>
                  ))}
                </div>
              </div>

              {!editingReview && (
                <div>
                  <label className="font-body text-xs font-bold uppercase tracking-[0.2em] text-text-muted block mb-2">
                    Reviewer Name (Optional)
                  </label>
                  <input
                    data-testid="reviewer-name-input"
                    type="text"
                    value={formData.reviewer_name}
                    onChange={(e) => setFormData({ ...formData, reviewer_name: e.target.value })}
                    className="border border-secondary rounded-none px-4 py-2.5 w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-primary bg-white transition-all duration-200 font-body"
                    placeholder="Leave blank to use your name"
                  />
                </div>
              )}

              <div>
                <label className="font-body text-xs font-bold uppercase tracking-[0.2em] text-text-muted block mb-2">
                  Review
                </label>
                <textarea
                  data-testid="review-text-input"
                  value={formData.text}
                  onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  className="border border-secondary rounded-none px-4 py-2.5 w-full h-32 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-primary bg-white transition-all duration-200 font-body resize-none"
                  placeholder="Write your review..."
                  required
                />
              </div>

              <button
                data-testid="submit-review-button"
                type="submit"
                className="w-full bg-primary text-white px-6 py-3 font-bold tracking-wide rounded-none border-2 border-primary hover:bg-white hover:text-primary transition-all duration-200 mt-6"
              >
                {editingReview ? 'Update Review' : 'Submit Review'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
