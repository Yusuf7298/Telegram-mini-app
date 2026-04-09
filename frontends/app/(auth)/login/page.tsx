"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validate = () => {
    if (!mobile.match(/^\+?\d{10,15}$/)) {
      setError("Enter a valid mobile number");
      return false;
    }
    if (!password || password.length < 4) {
      setError("Password must be at least 4 characters");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Simulate login
    }, 1200);
  };

  return (
    <div className="flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-[#101B2A] rounded-2xl shadow-lg p-6 flex flex-col items-center">
        <Image src="/logo.png" alt="BOXPLAY Logo" width={64} height={64} className="mb-4" />
        <h1 className="text-2xl font-bold text-white mb-1">Welcome Back</h1>
        <p className="text-gray-400 text-sm mb-6 text-center">Sign in to continue playing and earning</p>
        <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-gray-300 text-sm mb-1">Mobile Number</label>
            <div className="flex rounded-lg overflow-hidden bg-[#19233A] border border-[#232B3C] focus-within:border-blue-500">
              <span className="px-3 flex items-center text-gray-400 bg-[#232B3C]">+234</span>
              <input
                type="tel"
                className="flex-1 bg-transparent px-3 py-3 text-white outline-none placeholder-gray-500"
                placeholder="Enter mobile number"
                value={mobile}
                onChange={e => setMobile(e.target.value.replace(/^\+?234/, ''))}
                maxLength={15}
                inputMode="tel"
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-300 text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-lg bg-[#19233A] border border-[#232B3C] focus:border-blue-500 px-3 py-3 text-white outline-none placeholder-gray-500"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={4}
            />
          </div>
          {error && <div className="text-red-400 text-xs text-center -mt-2">{error}</div>}
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-green-500 text-white font-bold text-lg mt-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
        <div className="flex justify-between w-full mt-4 text-sm">
          <Link href="/forgot-password" className="text-blue-400 hover:underline">Forgot Password?</Link>
          <Link href="/signup" className="text-blue-400 hover:underline">Sign Up</Link>
        </div>
      </div>
    </div>
  );
}
