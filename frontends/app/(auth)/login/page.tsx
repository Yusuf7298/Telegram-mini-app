"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithTelegram } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await loginWithTelegram();
      router.replace("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0b1526] to-[#08101d] px-4 py-6">
      <div className="w-full max-w-sm rounded-2xl bg-[#101B2A] p-5 shadow-lg sm:p-6 flex flex-col items-center">
        <Image src="/logo.png" alt="BOXPLAY Logo" width={64} height={64} className="mb-4" />
        <h1 className="mb-1 text-xl font-bold text-white sm:text-2xl">Welcome Back</h1>
        <p className="mb-6 text-center text-sm text-gray-300 sm:text-base">Continue with Telegram to access your wallet and rewards</p>
        <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
          {error && <div className="text-center text-sm text-red-400">{error}</div>}
          <button
            type="submit"
            className="mt-2 min-h-[44px] w-full rounded-lg bg-gradient-to-r from-blue-600 to-green-500 px-4 py-3 text-base font-bold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            aria-label="Continue with Telegram"
          >
            {loading ? "Signing in..." : "Continue with Telegram"}
          </button>
        </form>
      </div>
    </div>
  );
}
