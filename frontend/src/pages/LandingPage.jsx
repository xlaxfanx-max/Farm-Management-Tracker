import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplet, MapPin, FileText, TrendingUp, CheckCircle, ArrowRight, Leaf, Shield, BarChart3, Users } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 4);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: FileText,
      title: "Pesticide Tracking",
      description: "Log applications with precision. Meet California DPR and FSMA requirements effortlessly.",
      color: "from-amber-500 to-orange-600"
    },
    {
      icon: Droplet,
      title: "Water Quality Management",
      description: "Track water sources and test results. Stay compliant with agricultural water standards.",
      color: "from-blue-500 to-cyan-600"
    },
    {
      icon: MapPin,
      title: "Field & Farm Organization",
      description: "Manage multiple farms and fields. Visual organization for complex operations.",
      color: "from-green-500 to-emerald-600"
    },
    {
      icon: BarChart3,
      title: "Compliance Reporting",
      description: "Generate reports instantly. Audit-ready documentation at your fingertips.",
      color: "from-purple-500 to-violet-600"
    }
  ];

  const benefits = [
    { text: "Reduce reporting time by 80%", icon: TrendingUp },
    { text: "Never miss a compliance deadline", icon: CheckCircle },
    { text: "Scale across multiple farms", icon: Users },
    { text: "California DPR & FSMA compliant", icon: Shield }
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@700&family=Outfit:wght@400;600;700;900&family=Inter:wght@400;600;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 10px) scale(1.05); }
        }
        
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.3; }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out;
        }
        
        .animation-delay-300 {
          animation-delay: 300ms;
          animation-fill-mode: both;
        }
        
        .animate-fade-in {
          animation: fade-in-up 0.6s ease-out;
          animation-fill-mode: both;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #f8fafc, #f0fdf4, #fffbeb)', overflow: 'hidden' }}>
        {/* Animated background elements */}
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.3 }}>
          <div 
            className="animate-blob"
            style={{
              position: 'absolute',
              top: '5rem',
              right: '5rem',
              width: '24rem',
              height: '24rem',
              background: '#86efac',
              borderRadius: '9999px',
              mixBlendMode: 'multiply',
              filter: 'blur(64px)',
              transform: `translateY(${scrollY * 0.2}px)`
            }}
          />
          <div 
            className="animate-blob animation-delay-2000"
            style={{
              position: 'absolute',
              top: '10rem',
              left: '5rem',
              width: '24rem',
              height: '24rem',
              background: '#fcd34d',
              borderRadius: '9999px',
              mixBlendMode: 'multiply',
              filter: 'blur(64px)',
              transform: `translateY(${scrollY * 0.3}px)`
            }}
          />
          <div 
            className="animate-blob animation-delay-4000"
            style={{
              position: 'absolute',
              bottom: '5rem',
              left: '33%',
              width: '24rem',
              height: '24rem',
              background: '#fdba74',
              borderRadius: '9999px',
              mixBlendMode: 'multiply',
              filter: 'blur(64px)',
              transform: `translateY(${scrollY * 0.15}px)`
            }}
          />
        </div>

        {/* Header */}
        <header style={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 10, 
          background: 'rgba(255, 255, 255, 0.8)', 
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(34, 197, 94, 0.5)'
        }}>
          <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ position: 'relative' }}>
                <Leaf style={{ color: '#16a34a', position: 'absolute', top: '-0.5rem', right: '-0.5rem' }} className="animate-pulse" size={20} />
                <Droplet style={{ color: '#ea580c' }} size={36} />
              </div>
              <div>
                <h1 style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 900, 
                  background: 'linear-gradient(to right, #15803d, #ea580c)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontFamily: "'Space Grotesk', sans-serif"
                }}>
                  Finch Farms
                </h1>
                <p style={{ fontSize: '0.75rem', color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Compliance Management System
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                onClick={() => navigate('/login')}
                style={{
                padding: '0.625rem 1.5rem',
                background: 'linear-gradient(to right, #16a34a, #059669)',
                color: 'white',
                borderRadius: '9999px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                Sign In
              </button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section style={{ position: 'relative', zIndex: 10, maxWidth: '80rem', margin: '0 auto', padding: '6rem 1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem', alignItems: 'center' }}>
            <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ 
                display: 'inline-block', 
                padding: '0.5rem 1rem', 
                background: '#dcfce7', 
                border: '2px solid #16a34a', 
                borderRadius: '9999px',
                width: 'fit-content'
              }}>
                <span style={{ color: '#166534', fontWeight: 700, fontSize: '0.875rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  🍊 Trusted by California Citrus Growers
                </span>
              </div>
              
              <h2 style={{ 
                fontSize: 'clamp(2.5rem, 8vw, 4rem)', 
                fontWeight: 900, 
                lineHeight: 1.1,
                color: '#0f172a',
                fontFamily: "'Archivo Black', sans-serif"
              }}>
                Track Every
                <span style={{ 
                  display: 'block',
                  background: 'linear-gradient(to right, #ea580c, #fbbf24, #16a34a)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  Drop & Spray
                </span>
              </h2>
              
              <p style={{ fontSize: '1.25rem', color: '#475569', lineHeight: 1.6, maxWidth: '36rem' }}>
                Professional compliance platform for pesticide application and water quality tracking. 
                Trusted by Finch Farms, built for growing operations.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                  <button
                    onClick={() => navigate('/login')}
                    style={{
                      padding: '1rem 2rem',
                      background: 'linear-gradient(to right, #ea580c, #fbbf24)',
                      color: 'white',
                      borderRadius: '1rem',
                      fontWeight: 700,
                      fontSize: '1.125rem',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.3s',
                      boxShadow: '0 10px 15px rgba(0,0,0,0.1)'
                    }}>
                    Sign In
                    <ArrowRight size={20} />
                  </button>
                </div>
              </div>

              <div style={{ paddingTop: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                {benefits.map((benefit, idx) => {
                  const Icon = benefit.icon;
                  return (
                    <div key={idx} className="animate-fade-in" style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      color: '#334155',
                      animationDelay: `${idx * 150}ms`
                    }}>
                      <div style={{ padding: '0.25rem', background: '#dcfce7', borderRadius: '9999px' }}>
                        <Icon size={16} style={{ color: '#15803d' }} />
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{benefit.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dashboard Preview */}
            <div className="animate-fade-in-up animation-delay-300" style={{ position: 'relative' }}>
              <div className="animate-pulse-slow" style={{
                position: 'absolute',
                inset: '-1rem',
                background: 'linear-gradient(to right, #16a34a, #fbbf24)',
                borderRadius: '1.5rem',
                filter: 'blur(32px)',
                opacity: 0.2
              }} />
              <div style={{ 
                position: 'relative',
                background: 'white', 
                borderRadius: '1.5rem', 
                boxShadow: '0 25px 50px rgba(0,0,0,0.2)',
                border: '4px solid white',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  background: 'linear-gradient(to right, #16a34a, #059669)',
                  padding: '1rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '9999px', background: '#fca5a5' }} />
                    <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '9999px', background: '#fcd34d' }} />
                    <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '9999px', background: '#86efac' }} />
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                    app.finchfarms.com
                  </span>
                </div>
                <div style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '1.125rem' }}>Recent Applications</h3>
                    <button style={{ color: '#16a34a', fontSize: '0.875rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                      View All →
                    </button>
                  </div>
                  {[1, 2, 3].map((i) => (
                    <div key={i} style={{ 
                      background: 'linear-gradient(to right, #f8fafc, #f0fdf4)',
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      border: '1px solid #bbf7d0',
                      marginBottom: '1rem',
                      transition: 'box-shadow 0.3s'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ fontWeight: 700, color: '#1e293b' }}>Field {i}A</span>
                          <span style={{ color: '#64748b', fontSize: '0.875rem', marginLeft: '0.5rem' }}>Valencia Oranges</span>
                        </div>
                        <span style={{ 
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: i === 1 ? '#dcfce7' : '#fef3c7',
                          color: i === 1 ? '#15803d' : '#a16207'
                        }}>
                          {i === 1 ? 'Complete' : 'Pending'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
                        <span>🧪 Product XYZ</span>
                        <span>📅 {new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section style={{ position: 'relative', zIndex: 10, maxWidth: '80rem', margin: '0 auto', padding: '6rem 1.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ 
              fontSize: 'clamp(2rem, 5vw, 3rem)', 
              fontWeight: 900,
              color: '#0f172a',
              marginBottom: '1rem',
              fontFamily: "'Archivo Black', sans-serif"
            }}>
              Everything You Need
            </h2>
            <p style={{ fontSize: '1.25rem', color: '#475569', maxWidth: '42rem', margin: '0 auto' }}>
              From pesticide logs to water testing, manage your entire compliance workflow in one place
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              const isActive = activeFeature === idx;
              return (
                <div
                  key={idx}
                  onMouseEnter={() => setActiveFeature(idx)}
                  style={{
                    position: 'relative',
                    padding: '2rem',
                    borderRadius: '1rem',
                    transition: 'all 0.5s',
                    cursor: 'pointer',
                    background: isActive ? 'white' : 'rgba(255,255,255,0.8)',
                    boxShadow: isActive ? '0 25px 50px rgba(0,0,0,0.15)' : '0 4px 6px rgba(0,0,0,0.1)',
                    transform: isActive ? 'scale(1.05)' : 'scale(1)',
                    border: isActive ? '4px solid #16a34a' : '2px solid #e2e8f0'
                  }}
                >
                  <div style={{ 
                    display: 'inline-flex',
                    padding: '1rem',
                    borderRadius: '1rem',
                    background: `linear-gradient(to bottom right, ${feature.color.split(' ')[1]}, ${feature.color.split(' ')[3]})`,
                    marginBottom: '1.5rem',
                    transition: 'transform 0.3s',
                    transform: isActive ? 'scale(1.1) rotate(3deg)' : 'scale(1)'
                  }}>
                    <Icon style={{ color: 'white' }} size={32} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.75rem' }}>
                    {feature.title}
                  </h3>
                  <p style={{ color: '#475569', lineHeight: 1.6 }}>
                    {feature.description}
                  </p>
                  {isActive && (
                    <div style={{ 
                      position: 'absolute',
                      bottom: '-0.25rem',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '5rem',
                      height: '0.25rem',
                      background: 'linear-gradient(to right, #16a34a, #fbbf24)',
                      borderRadius: '9999px'
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Pricing Section */}
        <section style={{ position: 'relative', zIndex: 10, maxWidth: '80rem', margin: '0 auto', padding: '6rem 1.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ 
              fontSize: 'clamp(2rem, 5vw, 3rem)', 
              fontWeight: 900,
              color: '#0f172a',
              marginBottom: '1rem',
              fontFamily: "'Archivo Black', sans-serif"
            }}>
              Simple, Transparent Pricing
            </h2>
            <p style={{ fontSize: '1.25rem', color: '#475569', maxWidth: '42rem', margin: '0 auto' }}>
              One price. Full access. No hidden fees or per-user charges.
            </p>
          </div>

          <div style={{ maxWidth: '42rem', margin: '0 auto' }}>
            <div style={{ 
              position: 'relative',
              background: 'white',
              borderRadius: '1.5rem',
              boxShadow: '0 25px 50px rgba(0,0,0,0.2)',
              border: '4px solid #16a34a',
              overflow: 'hidden'
            }}>
              <div style={{ 
                position: 'absolute',
                top: 0,
                right: 0,
                background: 'linear-gradient(to bottom right, #ea580c, #fbbf24)',
                color: 'white',
                padding: '0.5rem 1.5rem',
                borderBottomLeftRadius: '1rem',
                fontWeight: 700,
                fontSize: '0.875rem'
              }}>
                MOST POPULAR
              </div>
              <div style={{ padding: '3rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', marginBottom: '1rem' }}>
                    Professional Plan
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <span style={{ 
                      fontSize: '3.75rem',
                      fontWeight: 900,
                      background: 'linear-gradient(to right, #16a34a, #ea580c)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                      $50
                    </span>
                    <span style={{ fontSize: '1.5rem', color: '#475569', marginBottom: '0.5rem' }}>/month</span>
                  </div>
                  <p style={{ color: '#475569' }}>Per farm operation • Billed monthly</p>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  {[
                    'Unlimited pesticide application tracking',
                    'Water quality testing & compliance',
                    'Multiple farms & fields management',
                    'FSMA & California DPR compliant reports',
                    'Mobile-friendly access from anywhere',
                    'Secure cloud storage & backups',
                    'Email support within 24 hours',
                    'Regular feature updates included'
                  ].map((feature, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      marginBottom: '1rem'
                    }}>
                      <CheckCircle style={{ color: '#16a34a', flexShrink: 0, marginTop: '0.125rem' }} size={20} />
                      <span style={{ color: '#334155' }}>{feature}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <button
                    onClick={() => navigate('/login')}
                    style={{
                      width: '100%',
                      padding: '1rem 2rem',
                      background: 'linear-gradient(to right, #ea580c, #fbbf24)',
                      color: 'white',
                      borderRadius: '1rem',
                      fontWeight: 900,
                      fontSize: '1.125rem',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.3s',
                      boxShadow: '0 10px 15px rgba(0,0,0,0.1)',
                      marginBottom: '0.75rem'
                    }}>
                    Sign In
                    <ArrowRight size={20} />
                  </button>
                  <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#64748b' }}>
                    Access by invitation only
                  </p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '3rem', textAlign: 'center' }}>
              <h4 style={{ fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
                Need something custom?
              </h4>
              <p style={{ color: '#475569', maxWidth: '32rem', margin: '0 auto 1rem' }}>
                Managing multiple farms or need additional features? We offer enterprise pricing and custom integrations for larger operations.
              </p>
              <button style={{ 
                color: '#16a34a',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem'
              }}>
                Contact us for enterprise pricing
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>

        {/* Social Proof Section */}
        <section style={{ position: 'relative', zIndex: 10, maxWidth: '80rem', margin: '0 auto', padding: '6rem 1.5rem' }}>
          <div style={{ 
            background: 'linear-gradient(to bottom right, #0f172a, #14532d, #0f172a)',
            borderRadius: '1.5rem',
            padding: '3rem',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.1 }}>
              <div style={{ position: 'absolute', top: '2.5rem', right: '2.5rem', fontSize: '9rem' }}>🍊</div>
              <div style={{ position: 'absolute', bottom: '2.5rem', left: '2.5rem', fontSize: '9rem' }}>🌿</div>
            </div>
            <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
              <h2 style={{ 
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                fontWeight: 900,
                marginBottom: '2rem',
                fontFamily: "'Archivo Black', sans-serif"
              }}>
                Proven on Our Farm, Ready for Yours
              </h2>
              <p style={{ fontSize: '1.25rem', color: '#86efac', maxWidth: '48rem', margin: '0 auto 2rem' }}>
                Battle-tested at Finch Farms. Now available to help your operation stay compliant and efficient.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', paddingTop: '2rem' }}>
                <div>
                  <div style={{ 
                    fontSize: '3rem',
                    fontWeight: 900,
                    background: 'linear-gradient(to right, #86efac, #fcd34d)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '0.5rem'
                  }}>
                    500+
                  </div>
                  <div style={{ color: '#86efac' }}>Acres at Finch Farms</div>
                </div>
                <div>
                  <div style={{ 
                    fontSize: '3rem',
                    fontWeight: 900,
                    background: 'linear-gradient(to right, #86efac, #fcd34d)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '0.5rem'
                  }}>
                    3+ Years
                  </div>
                  <div style={{ color: '#86efac' }}>In Active Use</div>
                </div>
                <div>
                  <div style={{ 
                    fontSize: '3rem',
                    fontWeight: 900,
                    background: 'linear-gradient(to right, #86efac, #fcd34d)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '0.5rem'
                  }}>
                    100%
                  </div>
                  <div style={{ color: '#86efac' }}>Compliance Rate</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section style={{ position: 'relative', zIndex: 10, maxWidth: '80rem', margin: '0 auto', padding: '6rem 1.5rem' }}>
          <div style={{ 
            background: 'linear-gradient(to right, #ea580c, #fbbf24, #16a34a)',
            borderRadius: '1.5rem',
            padding: '3rem',
            textAlign: 'center',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ 
              position: 'absolute',
              inset: 0,
              backgroundImage: 'url(\'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC4xIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+\')',
              opacity: 0.2
            }} />
            <div style={{ position: 'relative', zIndex: 10 }}>
              <h2 style={{ 
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                fontWeight: 900,
                marginBottom: '1.5rem',
                fontFamily: "'Archivo Black', sans-serif"
              }}>
                Ready to Simplify Your Compliance?
              </h2>
              <p style={{ fontSize: '1.25rem', maxWidth: '42rem', margin: '0 auto 2rem', color: 'rgba(255,255,255,0.9)' }}>
                Professional compliance management for $50/month.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', alignItems: 'center', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
                  <button
                    onClick={() => navigate('/login')}
                    style={{
                      padding: '1.25rem 2.5rem',
                      background: 'white',
                      color: '#ea580c',
                      borderRadius: '1rem',
                      fontWeight: 900,
                      fontSize: '1.125rem',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.3s',
                      boxShadow: '0 10px 15px rgba(0,0,0,0.1)'
                    }}>
                    Sign In
                    <ArrowRight size={20} />
                  </button>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', paddingTop: '0.5rem' }}>
                  Access by invitation only
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ 
          position: 'relative',
          zIndex: 10,
          borderTop: '1px solid #e2e8f0',
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '3rem 1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Droplet style={{ color: '#ea580c' }} size={28} />
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>Finch Farms</span>
                </div>
                <p style={{ color: '#475569', fontSize: '0.875rem' }}>
                  Professional compliance management for California citrus operations.
                </p>
              </div>
              <div>
                <h4 style={{ fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Product</h4>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <a href="#" style={{ color: '#475569', fontSize: '0.875rem', textDecoration: 'none' }}>Features</a>
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <a href="#" style={{ color: '#475569', fontSize: '0.875rem', textDecoration: 'none' }}>Pricing ($50/mo)</a>
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <a href="#" style={{ color: '#475569', fontSize: '0.875rem', textDecoration: 'none' }}>Demo</a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Resources</h4>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <a href="#" style={{ color: '#475569', fontSize: '0.875rem', textDecoration: 'none' }}>Documentation</a>
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <a href="#" style={{ color: '#475569', fontSize: '0.875rem', textDecoration: 'none' }}>Compliance Guide</a>
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <a href="#" style={{ color: '#475569', fontSize: '0.875rem', textDecoration: 'none' }}>Support</a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Company</h4>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <a href="#" style={{ color: '#475569', fontSize: '0.875rem', textDecoration: 'none' }}>About</a>
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <a href="#" style={{ color: '#475569', fontSize: '0.875rem', textDecoration: 'none' }}>Contact</a>
                  </li>
                  <li style={{ marginBottom: '0.5rem' }}>
                    <a href="#" style={{ color: '#475569', fontSize: '0.875rem', textDecoration: 'none' }}>Privacy</a>
                  </li>
                </ul>
              </div>
            </div>
            <div style={{ paddingTop: '2rem', borderTop: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
              © 2024 Finch Farms LLC. Professional compliance management for California citrus growers.
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default LandingPage;