"use client";
import { useRef, useState, useEffect } from "react";
import Image from "next/image";

const OTP_LENGTH = 6;

export default function VerifyOtpPage() {
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timer, setTimer] = useState(30);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (timer > 0) {
      const t = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timer]);

  useEffect(() => {
    if (inputs.current[active]) {
      inputs.current[active]?.focus();
    }
  }, [active]);

  const handleChange = (i: number, val: string) => {
    if (!/^[0-9]?$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[i] = val;
    setOtp(newOtp);
    if (val && i < OTP_LENGTH - 1) setActive(i + 1);
    if (!val && i > 0) setActive(i - 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      setActive(i - 1);
    }
    if (e.key === "ArrowLeft" && i > 0) setActive(i - 1);
    if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) setActive(i + 1);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH).split("");
    if (pasted.length === OTP_LENGTH) {
      setOtp(pasted);
      setActive(OTP_LENGTH - 1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.some(d => d === "")) {
      setError("Please enter the 6-digit code");
      return;
    }
    setError("");
    setLoading(true);
    setTimeout(() => setLoading(false), 1200);
  };

  const handleResend = () => {
    setTimer(30);
    setOtp(Array(OTP_LENGTH).fill(""));
    setActive(0);
  };

  return (
    <div className="flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-[#101B2A] rounded-2xl shadow-lg p-6 flex flex-col items-center">
        <Image src="/logo.png" alt="BOXPLAY Logo" width={64} height={64} className="mb-4" />
        <h1 className="text-2xl font-bold text-white mb-1">Verify Your Account</h1>
        <p className="text-gray-400 text-sm mb-6 text-center">Enter the code sent to your phone</p>
        <form className="w-full flex flex-col items-center gap-4" onSubmit={handleSubmit}>
          <div className="flex gap-2 justify-center mb-2">
            {otp.map((val, i) => (
              <input
                key={i}
                ref={el => (inputs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                className={`w-12 h-12 text-center text-2xl rounded-lg border-2 bg-[#19233A] border-[#232B3C] focus:border-blue-500 text-white outline-none transition ${error ? 'border-red-400' : ''}`}
                value={val}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onFocus={() => setActive(i)}
                onPaste={handlePaste}
                autoFocus={i === 0}
              />
            ))}
          </div>
          {error && <div className="text-red-400 text-xs text-center -mt-2">{error}</div>}
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-green-500 text-white font-bold text-lg mt-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
            disabled={loading}
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>
        <div className="w-full text-center mt-4 text-sm">
          {timer > 0 ? (
            <span className="text-gray-400">Resend code in <span className="text-white font-semibold">{timer}s</span></span>
          ) : (
            <button className="text-blue-400 hover:underline font-semibold" onClick={handleResend}>Resend Code</button>
          )}
        </div>
      </div>
    </div>
  );
}
