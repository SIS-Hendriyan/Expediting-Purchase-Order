// src/components/pages/OTP.tsx
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { AlertCircle } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';

import logoImage from 'figma:asset/5634ad8959216fdb7980de73de586bfe04c49599.png';
import deliveryIllustration from 'figma:asset/2689e05f947e86ca8dbff7cd656a0f1867d6d570.png';

import { API } from '../../config';
import { saveAuthSession } from '../../utils/authSession';
import type { User } from './Login';

interface OTPProps {
  user: User | null;                // vendor user from App after login step-1
  onVerified: (user: User) => void; // callback -> App: OTP success
}

const RESEND_COOLDOWN = 60;

export function OTP({ user, onVerified }: OTPProps) {
  const email = user?.email || '';

  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(v => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || otp.length !== 6 || isLoading) return;

    setIsLoading(true);
    setOtpError('');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(API.VERIFY_OTP(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ email, otp }),
      });

      let json: any = null;
      try { json = await res.json(); } catch { throw new Error('Invalid server response'); }

      if (!res.ok) throw new Error(json?.Message || `HTTP ${res.status}`);

      // Expected: { ResponseCode: 200, Data: { token: { access }, vendor: {...} } }
      if (json?.ResponseCode === 200 && json?.Data) {
        const { token, vendor } = json.Data;

        const completeName =
          vendor?.complete_name ||
          vendor?.profile?.CompleteName ||
          vendor?.VendorName ||
          user?.name ||
          '';

        const vendorId = vendor?.vendor_id || vendor?.profile?.VendorID || '';
        const vendorName = vendor?.profile?.VendorName || vendor?.VendorName || '';
        const accessToken = token?.access || '';

        // Persist vendor session
        saveAuthSession({
          kind: 'VENDOR',
          email,
          completeName,
          accessToken,
          id: vendorId,
          vendorName,
        });

        // Optional: mirror token
        if (accessToken) {
          try { localStorage.setItem('accessToken', accessToken); } catch {}
        }

        // Notify App
        onVerified({
          email,
          name: completeName,
          role: 'vendor',
          company: vendorName || vendorId,
          type: vendor?.type || 'VENDOR',
        });
        return;
      }

      throw new Error(json?.Message || 'OTP verification failed.');
    } catch (err: any) {
      setOtpError(err?.name === 'AbortError' ? 'Request timeout. Please try again.' : err?.message || 'Failed to verify OTP.');
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  };

  const handleResendOTP = () => {
    if (!email || resendTimer > 0) return;
    // TODO: call resend endpoint if available
    setOtp('');
    setOtpError('');
    setResendTimer(RESEND_COOLDOWN);
  };

  const gradientBg = 'linear-gradient(135deg, #e8f1f3 0%, #f0f4f5 30%, #fef5ec 70%, #fdf0e5 100%)';
  const primaryGradient = 'linear-gradient(135deg, #014357 0%, #008383 100%)';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: gradientBg }}>
      {/* blobs */}
      <div className="absolute top-0 left-0 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob" style={{ backgroundColor: '#014357' }} />
      <div className="absolute top-0 right-0 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-2000" style={{ backgroundColor: '#ED832D' }} />
      <div className="absolute bottom-0 left-1/2 w-72 h-72 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-4000" style={{ backgroundColor: '#008383' }} />

      <div className="w-full max-w-6xl relative z-10">
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-white/50">
          <div className="flex flex-col lg:flex-row">
            {/* LEFT */}
            <div className="lg:w-1/2 p-12 lg:p-16 flex flex-col items-center justify-center bg-gradient-to-br from-white to-blue-50/30 relative">
              <div className="mb-8 lg:absolute lg:top-8 lg:left-8">
                <img src={logoImage} alt="AlamTri Logo" className="h-16 object-contain" />
              </div>
              <div className="w-full max-w-md mb-8">
                <img src={deliveryIllustration} alt="Procurement Management" className="w-full h-auto object-contain hidden md:block" />
              </div>
              <div className="text-center max-w-md">
                <h2 className="mb-3 text-2xl font-semibold" style={{ color: '#014357' }}>
                  Secure Vendor Verification
                </h2>
                <p className="text-gray-600 text-sm">
                  An extra security step to protect your vendor account and procurement data.
                </p>
              </div>
            </div>

            {/* RIGHT */}
            <div className="lg:w-1/2 p-8 lg:p-16 flex items-center justify-center">
              <div className="w-full max-w-md">
                <div className="mb-10">
                  <h1 className="mb-2 text-3xl font-semibold" style={{ color: '#014357' }}>
                    Verify Your Identity
                  </h1>
                  <p className="text-gray-600 text-sm">
                    Enter the 6-digit verification code sent to{' '}
                    <span className="font-semibold" style={{ color: '#014357' }}>
                      {email || '-'}
                    </span>.
                  </p>
                </div>

                {otpError && (
                  <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{otpError}</span>
                  </div>
                )}

                <form onSubmit={handleOTPSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-gray-700 text-sm font-medium">Enter 6-digit OTP Code</Label>
                    <div className="flex justify-center">
                      <InputOTP maxLength={6} value={otp} onChange={(value) => setOtp(value)}>
                        <InputOTPGroup>
                          {[0, 1, 2, 3, 4, 5].map(i => (
                            <InputOTPSlot key={i} index={i} className="h-14 w-12 text-lg border-gray-200 focus:border-[#014357]" />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>

                  <div className="text-center text-sm">
                    {resendTimer > 0 ? (
                      <p className="text-gray-500">
                        You can request a new code in{' '}
                        <span className="font-semibold" style={{ color: '#014357' }}>
                          {resendTimer}s
                        </span>
                      </p>
                    ) : (
                      <p className="text-gray-600">
                        Didn&apos;t receive the code?{' '}
                        <button type="button" onClick={handleResendOTP} className="hover:underline font-semibold" style={{ color: '#008383' }}>
                          Resend Code
                        </button>
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl"
                    disabled={isLoading || otp.length !== 6 || !email}
                    style={{ background: primaryGradient }}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Verifying...
                      </span>
                    ) : (
                      'Verify OTP'
                    )}
                  </Button>
                </form>

                <div className="mt-8 text-center text-xs text-gray-400">© 2025 AlamTri. All rights reserved.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export default too (so either `import { OTP } ...` or `import OTP ...` works)
export default OTP;
