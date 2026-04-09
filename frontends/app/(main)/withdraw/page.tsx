"use client";
import { useState } from "react";
import { Input } from "@/components/ui/Input";

export default function WithdrawPage() {
  const [cash, setCash] = useState(2000);
  const [airtime, setAirtime] = useState(100);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt < 100) {
      setError("Enter a valid amount (min ₦100)");
      return;
    }
    if (amt > cash) {
      setError("Cannot withdraw more than cash balance");
      return;
    }
    setError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Simulate withdrawal
    }, 1200);
  };

  return (
    <div className="flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-[#101B2A] rounded-2xl shadow-lg p-6 flex flex-col items-center mt-8">
        <h1 className="text-2xl font-bold text-white mb-4">Withdraw Funds</h1>
        <div className="w-full flex justify-between mb-4">
          <div className="flex flex-col items-center flex-1">
            <div className="text-gray-400 text-xs">Cash</div>
            <div className="text-green-400 text-xl font-bold">₦{cash}</div>
          </div>
          <div className="flex flex-col items-center flex-1">
            <div className="text-gray-400 text-xs">Airtime</div>
            <div className="text-blue-400 text-xl font-bold">₦{airtime}</div>
          </div>
        </div>
        <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="Withdrawal Amount"
            name="amount"
            placeholder="₦ Amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            inputMode="numeric"
            error={error}
          />
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-green-500 text-white font-bold text-lg mt-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
            disabled={loading}
          >
            {loading ? "Processing..." : "Withdraw"}
          </button>
        </form>
      </div>
    </div>
  );
}
