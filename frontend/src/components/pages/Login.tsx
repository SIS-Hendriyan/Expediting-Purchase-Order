// src/components/pages/Login.tsx
import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Eye, EyeOff, AlertCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import logoImage from 'figma:asset/5634ad8959216fdb7980de73de586bfe04c49599.png';
import deliveryIllustration from 'figma:asset/2689e05f947e86ca8dbff7cd656a0f1867d6d570.png';

import { API } from '../../config';
import { saveAuthSession } from '../../utils/authSession';

export type UserRole = 'admin' | 'vendor' | 'user';

export interface User {
  email: string;
  name: string;
  role: UserRole;
  company?: string; // For vendors
  type?: string;    // Raw type from API
}

interface LoginProps {
  onLogin: (user: User) => void; // make it required in our app pattern
}

export default function Login({ onLogin }: LoginProps) {
  const [identifier, setIdentifier] = useState(''); // email / username / NRP
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // (kept for future if you add inline OTP)
  const [resendTimer, setResendTimer] = useState(0);
  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer((x) => x - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError('');

    const rawId = identifier.trim();
    const isEmail = rawId.includes('@');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch(API.LOGIN(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: rawId, password }),
        signal: controller.signal,
      });

      let json: any = null;
      try { json = await res.json(); } catch {}

      if (!res.ok) {
        const msg = json?.Message || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      if (!json || typeof json !== 'object') {
        throw new Error('Invalid server response');
      }
      // --- Success Handling ---
      if (json.ResponseCode === 200) {
        // Vendor step-1 marker
        if (isEmail && typeof json.Data === 'string' && json.Data === 'VENDOR') {
          // Tell App to route to OTP page
          onLogin({
            email: rawId,
            name: '',
            role: 'vendor',
            type: 'VENDOR',
          });
          return;
        }
        // Internal path (Data.internal + token)
        if (json.Data && json.Data.internal && json.Data.token) {
          const internal = json.Data.internal;
          const token = json.Data.token;
          // persist session
          saveAuthSession({
            kind: 'INTERNAL',
            email: internal.email ?? rawId,
            name: internal.name ?? '',
            nrp: internal.nrp ?? '',
            id: internal.id ?? '',
            role: internal.role ?? '',
            department: internal.department ?? '',
            jobsite: internal.jobsite ?? '',
            accessToken: token.access ?? '',
            refreshToken: token.refresh ?? '',
          });

          if (rememberMe && token.access) {
            try { localStorage.setItem('accessToken', token.access); } catch {}
          }

          const mappedRole: UserRole =
            String(internal.role || '').toLowerCase() === 'admin' ? 'admin' : 'user';

          onLogin({
            email: internal.email || rawId,
            name: internal.name || '',
            role: mappedRole,
            company: internal.jobsite || undefined,
            type: 'INTERNAL',
          });
          return;
        }

        // Fallback success → basic user
        onLogin({
          email: rawId,
          name: '',
          role: 'user',
          type: isEmail ? 'VENDOR' : 'INTERNAL',
        });
        return;
      }

      throw new Error(json.Message || 'Login gagal. Periksa kembali kredensial Anda.');
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Request timeout. Coba lagi sebentar lagi.');
      } else {
        console.error(err);
        setError(err?.message || 'Terjadi kesalahan saat login.');
      }
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #e8f1f3 0%, #f0f4f5 30%, #fef5ec 70%, #fdf0e5 100%)' }}
    >
      {/* blobs */}
      <div className="absolute top-0 left-0 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob" style={{ backgroundColor: '#014357' }} />
      <div className="absolute top-0 right-0 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-2000" style={{ backgroundColor: '#ED832D' }} />
      <div className="absolute bottom-0 left-1/2 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-4000" style={{ backgroundColor: '#008383' }} />

      <div className="w-full max-w-6xl relative z-10">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-white/50">
          <div className="flex flex-col lg:flex-row">
            {/* left visuals */}
            <div className="lg:w-1/2 p-12 lg:p-16 flex flex-col items-center justify-center bg-gradient-to-br from-white to-blue-50/30">
              <div className="mb-8 lg:absolute lg:top-8 lg:left-8">
                <img src={logoImage} alt="AlamTri Logo" className="h-16 object-contain" />
              </div>

              <div className="w-full max-w-md mb-8">
                <img src={deliveryIllustration} alt="Procurement Management" className="w-full h-auto object-contain hidden md:block" />
              </div>

              <div className="text-center max-w-md">
                <h2 className="mb-3" style={{ color: '#014357' }}>Streamline Your Procurement</h2>
                <p className="text-gray-600">Comprehensive vendor and purchase order management in one unified platform</p>
              </div>
            </div>

            {/* right form */}
            <div className="lg:w-1/2 p-8 lg:p-16 flex items-center justify-center">
              <div className="w-full max-w-md">
                <div className="mb-10">
                  <h1 className="mb-2" style={{ color: '#014357' }}>Welcome Back</h1>
                  <p className="text-gray-600">Access your procurement management workspace</p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="identifier" className="text-gray-700">Email or NRP</Label>
                      <TooltipProvider>
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <button type="button" className="group">
                              <Info className="h-4 w-4 text-gray-400 group-hover:text-[#008383] transition-colors" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs bg-[#1a1f2e] text-white p-3 rounded-lg shadow-xl border border-gray-700">
                            <p className="text-sm leading-relaxed">
                              <span className="font-semibold">Vendor:</span> Use your email address<br />
                              <span className="font-semibold">Internal Users:</span> Use your 8 digits NRP
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Input
                      id="identifier"
                      type="text"
                      placeholder="e.g., vendor@company.com or 12345678"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      className="h-12 bg-white/80 border-gray-200 focus:border-[#014357] focus:ring-[#014357] rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-700">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-12 pr-12 bg-white/80 border-gray-200 focus:border-[#014357] focus:ring-[#014357] rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-[#014357] focus:ring-[#014357]"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span className="text-gray-600 group-hover:text-gray-900 transition-colors">Remember me</span>
                    </label>
                    <button type="button" className="hover:underline transition-all" style={{ color: '#008383' }}>
                      Forgot password?
                    </button>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl"
                    disabled={isLoading}
                    style={{ background: 'linear-gradient(135deg, #014357 0%, #008383 100%)' }}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Signing in...
                      </span>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-200">
                  <p className="text-center text-sm text-gray-500">
                    Need help?{' '}
                    <button type="button" className="hover:underline font-semibold transition-colors" style={{ color: '#014357' }}>
                      Contact Administrator
                    </button>
                  </p>
                </div>

                <div className="mt-6 text-center text-xs text-gray-400">
                  © 2025 AlamTri. All rights reserved.
                </div>
              </div>
            </div>
            {/* end right panel */}
          </div>
        </div>
      </div>
    </div>
  );
}
