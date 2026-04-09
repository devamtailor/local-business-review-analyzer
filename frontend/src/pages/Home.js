import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MagnifyingGlass, Star, ArrowRight, Buildings } from '@phosphor-icons/react';

const API_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";

function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchTrending();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const performSearch = async (query) => {
    setIsSearching(true);
    setShowDropdown(true);
    setSelectedIndex(-1);
    try {
      const response = await fetch(`${API_URL}/api/public/businesses/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        setSearchResults(await response.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || searchResults.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < searchResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
        navigate(`/business/${searchResults[selectedIndex]._id}`);
      }
    }
  };

  const highlightMatch = (text, q) => {
    if (!q) return text;
    const parts = text.split(new RegExp(`(${q})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === q.toLowerCase() ? <span key={i} className="text-primary font-bold">{part}</span> : part
    );
  };

  const fetchTrending = async () => {
    try {
        const response = await fetch(`${API_URL}/api/public/businesses/trending`);
        if (response.ok) {
            const data = await response.json();
            setTrending(data);
        }
    } catch (e) {
        console.error("Failed to fetch trending", e);
    } finally {
        setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim().length >= 2 && searchResults.length > 0) {
      if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
        navigate(`/business/${searchResults[selectedIndex]._id}`);
      } else {
        navigate(`/business/${searchResults[0]._id}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-white text-text flex flex-col font-body">
      
      {/* Header */}
      <header className="fixed w-full top-0 bg-white/80 backdrop-blur-md z-50 border-b border-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="font-heading text-2xl font-black tracking-tighter text-text">
              REVIEW<span className="text-primary font-black">.</span>AI
            </Link>
          </div>
          <div className="flex items-center gap-4">
               <Link to="/login" className="font-medium text-text-muted hover:text-text transition-colors">Log in</Link>
               <Link to="/register" className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
                 Get Started
               </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-16 pb-12">
          <h1 className="text-5xl md:text-7xl font-heading font-black tracking-tight text-text mb-6">
            Discover places you'll <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent drop-shadow-sm">love.</span>
          </h1>
          <p className="text-xl md:text-2xl text-text-muted font-light max-w-3xl mx-auto mb-10">
            Read authentic reviews, earn rewards, and find the best local businesses powered by AI insights.
          </p>

          <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative group" ref={dropdownRef}>
            <div className="relative flex items-center w-full h-16 rounded-2xl focus-within:shadow-xl bg-white overflow-hidden border border-secondary transition-all duration-300">
              <div className="grid place-items-center h-full w-14 text-text-muted">
                <MagnifyingGlass size={24} />
              </div>
              <input
                className="peer h-full w-full outline-none text-lg text-text bg-transparent pr-2"
                type="text"
                id="search"
                autoComplete="off"
                placeholder="Search for a business..."
                value={searchQuery}
                onKeyDown={handleKeyDown}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                   if (searchQuery.trim().length >= 2) setShowDropdown(true);
                }}
              />
              <button type="submit" className="h-full px-6 bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-medium transition-all">
                Search
              </button>
            </div>
            
            {/* Search Dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-secondary z-50 overflow-hidden animate-fade-in text-left">
                  {isSearching ? (
                      <div className="p-4 text-center text-text-muted text-sm flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                          Searching...
                      </div>
                  ) : searchResults.length > 0 ? (
                      <ul className="max-h-64 overflow-y-auto">
                          {searchResults.map((b, idx) => (
                              <li key={b._id} className={`border-b border-secondary last:border-0 hover:bg-background transition-colors ${selectedIndex === idx ? 'bg-primary/5' : ''}`}>
                                  <Link to={`/business/${b._id}`} className="block p-4 flex justify-between items-center" onClick={() => setShowDropdown(false)}>
                                      <div>
                                          <div className="text-text">{highlightMatch(b.name, searchQuery)}</div>
                                          {b.category && <div className="text-xs text-text-muted mt-1">{b.category}</div>}
                                      </div>
                                      {b.average_rating > 0 && (
                                          <div className="flex items-center gap-1 text-sm bg-background px-2 py-1 rounded">
                                              <Star weight="fill" className="text-yellow-400" size={14} /> 
                                              <span className="font-bold">{b.average_rating.toFixed(1)}</span>
                                          </div>
                                      )}
                                  </Link>
                              </li>
                          ))}
                      </ul>
                  ) : (
                      <div className="p-4 text-center text-text-muted text-sm">No businesses found for "{searchQuery}"</div>
                  )}
              </div>
            )}
            
          </form>
        </div>

        {/* Live Reviews Feed Marquee */}
        <div className="w-full overflow-hidden flex flex-col gap-4 py-10 relative">
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white to-transparent z-10"></div>
            <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white to-transparent z-10"></div>
            
            {/* ROW 1 */}
            <div className="flex w-[200%] animate-marquee pause-on-hover gap-6">
                {[...Array(10)].map((_, i) => (
                   <div key={i} className="w-80 min-w-[320px] bg-white border border-secondary p-5 rounded-2xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] flex flex-col gap-3">
                     <div className="flex justify-between items-start">
                         <div>
                             <h4 className="font-bold text-text truncate w-48">Awesome Cafe {i+1}</h4>
                             <div className="flex items-center text-yellow-400 gap-1 mt-1">
                                 <Star weight="fill" size={14} />
                                 <span className="text-text-muted text-xs font-medium">5.0</span>
                             </div>
                         </div>
                         <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                            US
                         </div>
                     </div>
                     <p className="text-text-muted text-sm line-clamp-3">
                         "Absolutely loved the vibe here! The coffee was exceptional and the staff was super friendly. Highly recommended if you are in the area."
                     </p>
                   </div>
                ))}
            </div>

            {/* ROW 2 reverse */}
            <div className="flex w-[200%] animate-marquee-reverse pause-on-hover gap-6 ml-[-50%]">
                {[...Array(10)].map((_, i) => (
                   <div key={i} className="w-80 min-w-[320px] bg-white border border-secondary p-5 rounded-2xl shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] flex flex-col gap-3">
                     <div className="flex justify-between items-start">
                         <div>
                             <h4 className="font-bold text-text truncate w-48">Tech Fixers {i+1}</h4>
                             <div className="flex items-center text-yellow-400 gap-1 mt-1">
                                 <Star weight="fill" size={14} />
                                 <span className="text-text-muted text-xs font-medium">4.5</span>
                             </div>
                         </div>
                         <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs uppercase">
                            AJ
                         </div>
                     </div>
                     <p className="text-text-muted text-sm line-clamp-3">
                         "Fast service, managed to repair my screen in under an hour. A bit pricey but worth the convenience."
                     </p>
                   </div>
                ))}
            </div>
        </div>

        {/* Trending Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="flex items-center justify-between mb-10">
               <h2 className="text-3xl font-heading font-bold text-text">Trending Businesses 🔥</h2>
               <button className="flex items-center gap-2 text-accent hover:text-accent/80 font-medium transition-colors">
                   View all <ArrowRight weight="bold" size={16} />
               </button>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                   <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {trending.length > 0 ? trending.map((business) => (
                        <Link to={`/business/${business._id}`} key={business._id} className="group flex flex-col bg-white border border-secondary rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                            <div className="h-32 bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center text-text-muted/50 group-hover:scale-105 transition-transform duration-500">
                                <Buildings size={48} weight="duotone" />
                            </div>
                            <div className="p-6 flex-grow flex flex-col">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-heading font-bold text-xl text-text truncate pr-4">{business.name}</h3>
                                    <div className="flex items-center gap-1 bg-background px-2 py-1 rounded-md text-sm font-medium">
                                        <Star weight="fill" className="text-yellow-400" size={16}/>
                                        {business.avg_rating > 0 ? business.avg_rating.toFixed(1) : "New"}
                                    </div>
                                </div>
                                <p className="text-text-muted text-sm mb-4">{business.category}</p>
                                <div className="mt-auto flex items-center justify-between text-sm">
                                    <span className="text-text-muted">{business.review_count} reviews</span>
                                    {/* Optional: we could fetch offer presence here but for now just show a link */}
                                    <span className="text-accent font-medium group-hover:underline flex items-center gap-1">
                                        Visit Page <ArrowRight size={14} />
                                    </span>
                                </div>
                            </div>
                        </Link>
                    )) : (
                        <div className="col-span-full text-center p-12 text-text-muted bg-background rounded-2xl border border-dashed border-secondary">
                            No trending businesses yet. Check back later!
                        </div>
                    )}
                </div>
            )}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-secondary py-12">
         <div className="max-w-7xl mx-auto px-4 text-center">
             <p className="font-heading font-bold text-xl mb-4">REVIEW<span className="text-accent">.</span>AI</p>
             <p className="text-text-muted mb-8 max-w-md mx-auto">The modern platform to discover, review, and get rewarded by the businesses you love.</p>
             <p className="text-text-muted text-sm pb-8 border-b border-secondary/50">© {new Date().getFullYear()} Review.AI platform. All rights reserved.</p>
         </div>
      </footer>
    </div>
  );
}

export default Home;
