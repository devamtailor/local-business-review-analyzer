import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Buildings, Plus, Pencil, Trash, Star, MagnifyingGlass, X } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function Businesses() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', category: '', address: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/businesses`, {
        withCredentials: true
      });
      setBusinesses(data);
    } catch (error) {
      console.error('Failed to fetch businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingBusiness) {
        await axios.put(`${API_URL}/api/businesses/${editingBusiness._id}`, formData, {
          withCredentials: true
        });
      } else {
        await axios.post(`${API_URL}/api/businesses`, formData, {
          withCredentials: true
        });
      }
      setShowModal(false);
      setEditingBusiness(null);
      setFormData({ name: '', category: '', address: '' });
      fetchBusinesses();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save business');
    }
  };

  const handleEdit = (business) => {
    setEditingBusiness(business);
    setFormData({ name: business.name, category: business.category, address: business.address || '' });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this business?')) return;
    try {
      await axios.delete(`${API_URL}/api/businesses/${id}`, {
        withCredentials: true
      });
      fetchBusinesses();
    } catch (error) {
      console.error('Failed to delete business:', error);
    }
  };

  const filteredBusinesses = businesses.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="loader w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div data-testid="businesses-page" className="p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tighter">
            Businesses
          </h1>
          <p className="text-text-muted font-body mt-2">Manage local businesses</p>
        </div>
        <button
          data-testid="add-business-button"
          onClick={() => { setShowModal(true); setEditingBusiness(null); setFormData({ name: '', category: '', address: '' }); }}
          className="bg-primary text-white px-6 py-2.5 font-bold tracking-wide rounded-none border-2 border-primary hover:bg-white hover:text-primary transition-all duration-200 flex items-center gap-2"
        >
          <Plus weight="bold" size={20} />
          Add Business
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <MagnifyingGlass weight="duotone" className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
        <input
          data-testid="business-search-input"
          type="text"
          placeholder="Search businesses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border border-secondary rounded-none px-4 py-2.5 pl-12 w-full max-w-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-primary bg-white transition-all duration-200 font-body"
        />
      </div>

      {/* Businesses Grid */}
      {filteredBusinesses.length === 0 ? (
        <div className="bg-white border border-secondary p-12 rounded-none text-center">
          <Buildings weight="duotone" size={48} className="mx-auto text-text-muted mb-4" />
          <h3 className="font-heading text-xl font-bold mb-2">No businesses yet</h3>
          <p className="text-text-muted font-body">Add your first business to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredBusinesses.map((business) => (
            <div 
              key={business._id} 
              data-testid={`business-card-${business._id}`}
              className="bg-white border border-secondary p-6 rounded-none hover:border-primary transition-colors duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-primary p-3">
                  <Buildings weight="duotone" size={24} className="text-white" />
                </div>
                <div className="flex gap-2">
                  <button
                    data-testid={`edit-business-${business._id}`}
                    onClick={() => handleEdit(business)}
                    className="p-2 border border-secondary hover:border-primary transition-colors"
                  >
                    <Pencil weight="duotone" size={16} />
                  </button>
                  <button
                    data-testid={`delete-business-${business._id}`}
                    onClick={() => handleDelete(business._id)}
                    className="p-2 border border-secondary hover:border-accent hover:text-accent transition-colors"
                  >
                    <Trash weight="duotone" size={16} />
                  </button>
                </div>
              </div>
              <h3 className="font-heading text-xl font-bold mb-1">{business.name}</h3>
              <p className="text-text-muted font-body text-sm mb-2">{business.category}</p>
              {business.address && (
                <p className="text-text-muted font-body text-sm mb-4">{business.address}</p>
              )}
              <div className="flex items-center gap-2 pt-4 border-t border-secondary">
                <Star weight="fill" className="text-primary" size={16} />
                <span className="font-bold">{business.avg_rating || 0}</span>
                <span className="text-text-muted text-sm">({business.review_count || 0} reviews)</span>
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
                {editingBusiness ? 'Edit Business' : 'Add Business'}
              </h2>
              <button 
                data-testid="close-modal-button"
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
              <div>
                <label className="font-body text-xs font-bold uppercase tracking-[0.2em] text-text-muted block mb-2">
                  Business Name
                </label>
                <input
                  data-testid="business-name-input"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="border border-secondary rounded-none px-4 py-2.5 w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-primary bg-white transition-all duration-200 font-body"
                  required
                />
              </div>

              <div>
                <label className="font-body text-xs font-bold uppercase tracking-[0.2em] text-text-muted block mb-2">
                  Category
                </label>
                <input
                  data-testid="business-category-input"
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="border border-secondary rounded-none px-4 py-2.5 w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-primary bg-white transition-all duration-200 font-body"
                  placeholder="e.g., Restaurant, Retail, Services"
                  required
                />
              </div>

              <div>
                <label className="font-body text-xs font-bold uppercase tracking-[0.2em] text-text-muted block mb-2">
                  Address (Optional)
                </label>
                <input
                  data-testid="business-address-input"
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="border border-secondary rounded-none px-4 py-2.5 w-full focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-primary bg-white transition-all duration-200 font-body"
                />
              </div>

              <button
                data-testid="submit-business-button"
                type="submit"
                className="w-full bg-primary text-white px-6 py-3 font-bold tracking-wide rounded-none border-2 border-primary hover:bg-white hover:text-primary transition-all duration-200 mt-6"
              >
                {editingBusiness ? 'Update Business' : 'Add Business'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
