import React, { useState, useEffect } from 'react';
import { Gift, Ticket, Plus, Building, Tag } from '@phosphor-icons/react';
const API_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";

function Offers() {
  const [businesses, setBusinesses] = useState([]);
  const [offers, setOffers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
      business_id: '',
      title: '',
      description: '',
      reward_type: 'discount',
      reward_value: '',
      expiry_date: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, oRes, cRes] = await Promise.all([
          fetch(`${API_URL}/api/businesses`, { credentials: 'include' }),
          fetch(`${API_URL}/api/offers`, { credentials: 'include' }),
          fetch(`${API_URL}/api/coupons`, { credentials: 'include' })
      ]);
      
      if (bRes.ok) setBusinesses(await bRes.json());
      if (oRes.ok) setOffers(await oRes.json());
      if (cRes.ok) setCoupons(await cRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffer = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      setSubmitError('');
      
      try {
          const payload = { ...formData };
          if (!payload.expiry_date) delete payload.expiry_date;
          if (!payload.business_id) throw new Error("Please select a business");

          const response = await fetch(`${API_URL}/api/offers`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(payload)
          });
          
          if (!response.ok) {
              const data = await response.json();
              throw new Error(data.detail || "Failed to create offer");
          }
          
          setIsCreating(false);
          setFormData({ business_id: '', title: '', description: '', reward_type: 'discount', reward_value: '', expiry_date: '' });
          fetchData();
      } catch (err) {
          setSubmitError(err.message);
      } finally {
          setSubmitting(false);
      }
  };

  if (loading) {
      return (
        <div className="flex items-center justify-center p-12">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 font-body">
        
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-heading font-black tracking-tight text-text mb-2">Rewards & Offers</h1>
          <p className="text-text-muted">Incentivize your customers to leave reviews.</p>
        </div>
        <button 
           onClick={() => setIsCreating(!isCreating)}
           className="bg-accent hover:opacity-90 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center gap-2"
        >
            {isCreating ? 'Cancel' : <><Plus weight="bold" /> Create Offer</>}
        </button>
      </div>

      {isCreating && (
          <div className="bg-white border border-secondary p-6 rounded-2xl shadow-sm mb-8 animate-fade-in">
              <h2 className="text-2xl font-bold mb-6">Create New Offer</h2>
              {submitError && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm">{submitError}</div>}
              
              <form onSubmit={handleCreateOffer} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-bold text-text-muted mb-1">Select Business</label>
                          <select 
                             className="w-full bg-background border border-secondary rounded-lg px-4 py-2"
                             value={formData.business_id}
                             onChange={e => setFormData({...formData, business_id: e.target.value})}
                             required
                          >
                              <option value="">-- Choose a business --</option>
                              {businesses.map(b => (
                                  <option key={b._id} value={b._id}>{b.name}</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-text-muted mb-1">Offer Title</label>
                          <input 
                             type="text" 
                             required
                             placeholder="e.g. 10% Off Next Visit"
                             className="w-full bg-background border border-secondary rounded-lg px-4 py-2"
                             value={formData.title}
                             onChange={e => setFormData({...formData, title: e.target.value})}
                          />
                      </div>
                      <div className="md:col-span-2">
                          <label className="block text-sm font-bold text-text-muted mb-1">Description (shown to customer)</label>
                          <input 
                             type="text" 
                             required
                             placeholder="Leave us a review and get 10% off your entire order next time!"
                             className="w-full bg-background border border-secondary rounded-lg px-4 py-2"
                             value={formData.description}
                             onChange={e => setFormData({...formData, description: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-text-muted mb-1">Reward Type</label>
                          <select 
                             className="w-full bg-background border border-secondary rounded-lg px-4 py-2"
                             value={formData.reward_type}
                             onChange={e => setFormData({...formData, reward_type: e.target.value})}
                          >
                              <option value="discount">Discount (%)</option>
                              <option value="cashback">Cashback ($)</option>
                              <option value="gift">Free Gift</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-text-muted mb-1">Reward Value</label>
                          <input 
                             type="text" 
                             required
                             placeholder="e.g. 10 or Free Coffee"
                             className="w-full bg-background border border-secondary rounded-lg px-4 py-2"
                             value={formData.reward_value}
                             onChange={e => setFormData({...formData, reward_value: e.target.value})}
                          />
                      </div>
                  </div>
                  
                  <div className="pt-4 border-t border-secondary flex justify-end">
                      <button 
                         type="submit" 
                         disabled={submitting}
                         className="bg-primary text-white font-bold px-6 py-2 rounded-xl"
                      >
                         {submitting ? 'Saving...' : 'Save Offer'}
                      </button>
                  </div>
              </form>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Offers List */}
          <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2 border-b border-secondary pb-2">
                  <Gift size={24} weight="duotone" className="text-accent" /> Active Offers
              </h3>
              {offers.length === 0 ? (
                  <div className="text-text-muted text-sm text-center py-8 bg-white border border-secondary rounded-2xl">No offers created yet.</div>
              ) : (
                  offers.map(offer => {
                     const b = businesses.find(b => b._id === offer.business_id);
                     return (
                         <div key={offer._id} className="bg-white border border-secondary rounded-2xl p-5 shadow-sm">
                             <div className="flex justify-between items-start mb-2">
                                 <h4 className="font-bold text-lg text-text">{offer.title}</h4>
                                 <span className="bg-accent/10 text-accent text-xs font-bold px-2 py-1 rounded capitalize">{offer.reward_type}</span>
                             </div>
                             <p className="text-sm text-text-muted mb-3">{offer.description}</p>
                             <div className="flex items-center text-xs text-text-muted bg-background px-3 py-1.5 rounded-lg w-fit gap-1">
                                 <Building size={14} /> {b ? b.name : 'Unknown Business'}
                             </div>
                         </div>
                     )
                  })
              )}
          </div>

          {/* Generated Coupons */}
          <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2 border-b border-secondary pb-2">
                  <Ticket size={24} weight="duotone" className="text-primary" /> Generated Coupons
              </h3>
              {coupons.length === 0 ? (
                  <div className="text-text-muted text-sm text-center py-8 bg-white border border-secondary rounded-2xl">No coupons issued yet.</div>
              ) : (
                  <div className="bg-white border border-secondary rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-background text-text-muted font-bold text-xs uppercase tracking-wider">
                              <tr>
                                  <th className="px-5 py-3">Code</th>
                                  <th className="px-5 py-3">User</th>
                                  <th className="px-5 py-3">Status</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-secondary">
                              {coupons.map(coupon => (
                                  <tr key={coupon._id} className="hover:bg-background/50">
                                      <td className="px-5 py-3 font-mono font-bold">{coupon.coupon_code}</td>
                                      <td className="px-5 py-3 text-text-muted">{coupon.user_name}</td>
                                      <td className="px-5 py-3">
                                          <span className={`px-2 py-1 rounded text-xs font-bold ${coupon.status === 'unused' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                              {coupon.status}
                                          </span>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              )}
          </div>

      </div>

    </div>
  );
}

export default Offers;
