import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Droplet } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSignup = searchParams.get('signup') === 'true';
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [farmName, setFarmName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    // TODO: Implement your auth logic
    // For now, just store a token and redirect
    localStorage.setItem('authToken', 'demo-token');
    localStorage.setItem('farmId', 'finch-farms');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-amber-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border-4 border-green-600 p-8">
        <div className="flex items-center gap-3 mb-8">
          <Droplet className="text-orange-600" size={36} />
          <div>
            <h1 className="text-2xl font-black text-slate-900">Finch Farms</h1>
            <p className="text-sm text-slate-600">Compliance Management</p>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          {isSignup ? 'Start Your Free Trial' : 'Welcome Back'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Farm/Company Name
              </label>
              <input
                type="text"
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-green-600 focus:outline-none"
                required
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-green-600 focus:outline-none"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-green-600 focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full px-6 py-4 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl font-bold hover:shadow-xl transition-all duration-300"
          >
            {isSignup ? 'Start Free Trial' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate(isSignup ? '/login' : '/login?signup=true')}
            className="text-green-600 font-semibold hover:text-green-700"
          >
            {isSignup ? 'Already have an account? Sign in' : 'Need an account? Start free trial'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;