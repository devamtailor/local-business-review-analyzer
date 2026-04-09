import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, Gift, MapPin, Tag, Sparkle, ChatText, WarningCircle, CheckCircle } from '@phosphor-icons/react';
const API_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";

function PublicBusiness() {
  const { id } = useParams();
  const [business, setBusiness] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Review Form state
  const [rating, setRating] = useState(5);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  
  // Coupon Result State
  const [couponCode, setCouponCode] = useState(null);
  const [offerText, setOfferText] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Business details (includes AI Preview)
      const bRes = await fetch(`${API_URL}/api/public/businesses/${id}`);
      if (bRes.ok) {
        setBusiness(await bRes.json());
      }
      
      // Fetch Offers
      const oRes = await fetch(`${API_URL}/api/public/offers/business/${id}`);
      if (oRes.ok) {
        setOffers(await oRes.json());
      }

      // Fetch Reviews
      const rRes = await fetch(`${API_URL}/api/public/reviews?business_id=${id}`);
      if (rRes.ok) {
        setReviews(await rRes.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewerName || !reviewText) {
        setSubmitError("Please fill out your name and the review text.");
        return;
    }
    
    setSubmitLoading(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    
    try {
      const response = await fetch(`${API_URL}/api/public/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: id,
          rating,
          reviewer_name: reviewerName,
          text: reviewText
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Failed to submit review");
      }

      setSubmitSuccess(true);
      if (data.coupon_code) {
          setCouponCode(data.coupon_code);
          setOfferText(data.offer_text);
      }
      
      // Reset form
      setReviewText('');
      setReviewerName('');
      setRating(5);
      
      // Refresh reviews
      await fetchData();

    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <WarningCircle size={64} weight="duotone" className="text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-text mb-2">Business Not Found</h2>
        <p className="text-text-muted mb-6">This business may be private or no longer exists.</p>
        <Link to="/" className="text-accent font-medium hover:underline flex items-center gap-2">
            Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body pb-20">
        
       {/* Top Nav */}
       <div className="bg-white border-b border-secondary p-4 sticky top-0 z-40">
           <div className="max-w-5xl mx-auto flex items-center justify-between">
               <Link to="/" className="font-heading text-xl font-black text-text">
                  REVIEW<span className="text-accent">.</span>AI
               </Link>
           </div>
       </div>

       <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-8">
           {/* Business Header */}
           <div className="bg-white rounded-2xl p-8 border border-secondary shadow-sm mb-8 flex flex-col md:flex-row gap-8 items-start">
               <div className="flex-grow">
                   <h1 className="text-4xl font-heading font-black text-text mb-2">{business.name}</h1>
                   <div className="flex items-center gap-4 text-sm text-text-muted mb-6">
                       <span className="flex items-center gap-1"><Tag size={16} /> {business.category}</span>
                       {business.address && (
                           <span className="flex items-center gap-1"><MapPin size={16} /> {business.address}</span>
                       )}
                   </div>
                   
                   <div className="flex items-center gap-4 mb-4">
                       <div className="flex bg-primary/10 text-primary px-4 py-3 rounded-xl border border-primary/20 items-center justify-center gap-3">
                           <Star size={32} weight="fill" className="text-yellow-500" />
                           <div>
                               <div className="text-2xl font-black">{business.avg_rating > 0 ? business.avg_rating.toFixed(1) : "New"}</div>
                               <div className="text-xs uppercase tracking-wider font-bold opacity-75">{business.review_count} Reviews</div>
                           </div>
                       </div>
                   </div>
               </div>

               {/* AI Preview Card */}
               <div className="w-full md:w-96 flex-shrink-0 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-accent/20">
                   <div className="flex justify-between items-center mb-4">
                       <h3 className="font-bold text-text flex items-center gap-2">
                           <Sparkle size={20} weight="fill" className="text-accent" />
                           AI Insights
                       </h3>
                   </div>
                   
                   {business.ai_preview ? (
                       <div className="text-sm text-text-muted space-y-3">
                           <p className="line-clamp-4">"{business.ai_preview.summary}"</p>
                           {business.ai_preview.top_strengths?.length > 0 && (
                               <div>
                                    <span className="font-semibold text-green-600 block mb-1">Loved features:</span>
                                    <p>{business.ai_preview.top_strengths.slice(0, 2).join(", ")}</p>
                               </div>
                           )}
                       </div>
                   ) : (
                       <div className="text-sm text-text-muted italic flex flex-col items-center text-center p-4">
                           <ChatText size={32} weight="duotone" className="mb-2 opacity-50" />
                           No insights available yet.<br/> Be the first to leave a review!
                       </div>
                   )}
               </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               
               {/* Main Reviews Column */}
               <div className="lg:col-span-2 space-y-6">
                   <h2 className="text-2xl font-bold font-heading text-text">Customer Reviews</h2>
                   
                   {reviews.length === 0 ? (
                       <div className="bg-white p-8 rounded-2xl border border-secondary text-center text-text-muted">
                           No reviews yet. Share your experience!
                       </div>
                   ) : (
                       <div className="space-y-4">
                           {reviews.map(review => (
                              <div key={review._id} className="bg-white p-6 rounded-2xl border border-secondary shadow-sm">
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="flex gap-3 items-center">
                                          <div className="w-10 h-10 rounded-full bg-background border border-secondary flex items-center justify-center font-bold text-text">
                                             {review.reviewer_name?.charAt(0).toUpperCase() || 'U'}
                                          </div>
                                          <div>
                                              <p className="font-bold text-text">{review.reviewer_name || 'Anonymous'}</p>
                                              <p className="text-xs text-text-muted">{new Date(review.created_at).toLocaleDateString()}</p>
                                          </div>
                                      </div>
                                      <div className="flex text-yellow-400">
                                          {[...Array(5)].map((_, i) => (
                                            <Star key={i} weight={i < review.rating ? "fill" : "regular"} size={16} />
                                          ))}
                                      </div>
                                  </div>
                                  <p className="text-text-muted text-sm">{review.text}</p>
                              </div>
                           ))}
                       </div>
                   )}
               </div>

               {/* Right Sidebar: Write Review & Offers */}
               <div className="space-y-6">
                   
                   {/* Offers List */}
                   {offers.length > 0 && (
                       <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-200">
                           <h3 className="font-bold text-orange-800 flex items-center gap-2 mb-4">
                               <Gift size={24} weight="fill" />
                               Active Rewards!
                           </h3>
                           <div className="space-y-3">
                                {offers.map(offer => (
                                    <div key={offer._id} className="bg-white/80 p-4 rounded-xl shadow-sm border border-orange-100">
                                        <p className="font-bold text-text text-sm mb-1">{offer.title}</p>
                                        <p className="text-xs text-text-muted mb-2">{offer.description}</p>
                                        <div className="inline-block bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded">
                                            🎁 Get a Reward for Reviewing
                                        </div>
                                    </div>
                                ))}
                           </div>
                       </div>
                   )}

                   {/* Write Review Form */}
                   <div className="bg-white rounded-2xl p-6 border border-secondary shadow-sm">
                       <h3 className="font-bold text-xl text-text mb-4">Write a Review</h3>
                       
                       {/* Success & Coupon Display */}
                       {submitSuccess && !couponCode && (
                           <div className="mb-4 bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 flex items-start gap-2">
                               <CheckCircle size={20} className="flex-shrink-0 mt-0.5" />
                               <p className="text-sm font-medium">Review submitted successfully! Thank you.</p>
                           </div>
                       )}

                       {couponCode && (
                           <div className="mb-6 p-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-lg text-center transform hover:scale-[1.02] transition-transform">
                               <Gift size={32} weight="fill" className="mx-auto mb-2 text-yellow-300" />
                               <h4 className="font-bold text-xl mb-1">Surprise! 🎉</h4>
                               <p className="text-sm opacity-90 mb-4">{offerText}</p>
                               <div className="bg-black/20 font-mono font-bold text-2xl tracking-widest py-3 px-4 rounded-xl border border-white/20 select-all">
                                   {couponCode}
                               </div>
                               <p className="text-xs mt-3 opacity-75">Show this code at the store to claim your reward.</p>
                           </div>
                       )}

                       {submitError && (
                           <div className="mb-4 text-sm bg-red-50 text-red-600 p-3 rounded-lg border border-red-200">
                               {submitError}
                           </div>
                       )}

                       <form onSubmit={handleReviewSubmit} className="space-y-4">
                           <div>
                               <label className="block text-sm font-bold text-text-muted mb-2">Rating</label>
                               <div className="flex gap-2">
                                  {[1, 2, 3, 4, 5].map(star => (
                                     <button
                                       type="button"
                                       key={star}
                                       onClick={() => setRating(star)}
                                       className={`transition-colors ${star <= rating ? 'text-yellow-400' : 'text-secondary hover:text-yellow-200'}`}
                                     >
                                         <Star weight="fill" size={32} />
                                     </button>
                                  ))}
                               </div>
                           </div>
                           
                           <div>
                               <label className="block text-sm font-bold text-text-muted mb-1">Your Name</label>
                               <input 
                                   type="text" 
                                   value={reviewerName}
                                   onChange={e => setReviewerName(e.target.value)}
                                   className="w-full bg-background border border-secondary rounded-lg px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                   placeholder="John Doe"
                               />
                           </div>

                           <div>
                               <label className="block text-sm font-bold text-text-muted mb-1">Review</label>
                               <textarea 
                                   value={reviewText}
                                   onChange={e => setReviewText(e.target.value)}
                                   className="w-full h-24 bg-background border border-secondary rounded-lg px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                                   placeholder="Tell us about your experience..."
                               ></textarea>
                           </div>

                           <button 
                               type="submit" 
                               disabled={submitLoading}
                               className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
                           >
                               {submitLoading ? 'Submitting...' : 'Post Review'}
                           </button>
                       </form>
                   </div>

               </div>
           </div>
       </div>

    </div>
  );
}

export default PublicBusiness;
