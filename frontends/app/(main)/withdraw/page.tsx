"use client";
import { useState } from "react";
import { ArrowLeft, Wallet, Smartphone, BellIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export default function WithdrawPage() {
  const [cash] = useState(1000);
  const [airtime] = useState(1000);
  const [balanceType, setBalanceType] = useState<"cash" | "airtime">("cash");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt < 100) {
      setError("Enter a valid amount (min ₦100)");
      return;
    }
    const selectedBalance = balanceType === "cash" ? cash : airtime;
    if (amt > selectedBalance) {
      setError(`Cannot withdraw more than ${balanceType} balance`);
      return;
    }
    setError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Simulate withdrawal
    }, 1200);
  };

  function handleClick() {
    // Handle back navigation
    router.back();
  }


  const balanceCardClass =
    "flex-1 rounded-2xl border bg-white/5 px-4 py-4 text-left transition";
  const amountFieldClass =
    "w-full rounded-2xl border border-white/10 bg-[#131c31] px-4 py-4 text-[15px] font-Poppins text-white outline-none placeholder:text-white/40 focus:border-[#18e0a8] focus:ring-2 focus:ring-[#18e0a8]/20";

  return (
    <div className="min-h-screen bg-gradient-to-bl from-[#2C5364] via-[#000000] to-[#020617] pb-28">
      <div className="mx-auto flex min-h-screen max-w-[393px] flex-col bg-[radial-gradient(circle_at_top,_rgba(11,38,63,0.9),_rgba(0,6,18,1)_72%)]">
        <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-gray-800">
        <button onClick={handleClick} className="w-10 h-10 flex items-center justify-center rounded-full cursor-pointer bg-transparent border border-white/10 shadow text-white">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="text-white font-bold text-[16px]">Withdraw</div>
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white">
          <BellIcon className="h-7 w-7 text-current m-2" />
        </button>
      </div>

        <form className="flex flex-1 flex-col px-4 pt-10" onSubmit={handleSubmit}>
          <div className="rounded-[28px] border border-white/10 bg-[#0b1526]/80 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <div className="mb-5 text-[16px] font-Rubik font-black tracking-[-0.03em] uppercase text-white">BALANCE</div>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setBalanceType("cash")}
                className={`${balanceCardClass} ${balanceType === "cash"
                  ? "border-[#18e0a8] bg-[#0a2b2c] text-[#11d29c] shadow-[0_0_0_1px_rgba(24,224,168,0.18),0_0_24px_rgba(24,224,168,0.08)]"
                  : "border-white/8 text-white/80 hover:bg-white/8"
                  }`}
              >
                <div className="mb-4 flex items-center gap-2 text-[14px] font-regular font-Poppins text-white">
                  <Wallet className={`h-5 w-5 ${balanceType === "cash" ? "text-[#FFFFFFCC]" : "text-white/60"}`} />
                  Cash
                </div>
                <div className="text-[16px] font-Rubik tracking-[-0.04em] text-white/80 leading-none">₦{cash}</div>
              </button>
              <button
                type="button"
                onClick={() => setBalanceType("airtime")}
                className={`${balanceCardClass} ${balanceType === "airtime"
                  ? "border-[#18e0a8] bg-[#0a2b2c] text-[#FFFFFFCC] shadow-[0_0_0_1px_rgba(24,224,168,0.18),0_0_24px_rgba(24,224,168,0.08)]"
                  : "border-white/8 text-white/80 hover:bg-white/8"
                  }`}
              >
                <div className="mb-4 flex items-center gap-2 text-[14px] font-regular font-Poppins text-white">
                  <Smartphone className={`h-5 w-5 ${balanceType === "airtime" ? "text-[#FFFFFFCC]" : "text-white/60"}`} />
                  Airtime
                </div>
                <div className="text-[16px] font-Rubik tracking-[-0.04em] text-white/80 leading-none">₦{airtime}</div>
              </button>
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-white/10 bg-[#0b1526]/80 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <label className="block">
              <span className="mb-2 block text-[14px] font-Rubik text-white/90">Amount</span>
              <input
                className={amountFieldClass}
                name="amount"
                placeholder="₦500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="numeric"
              />
            </label>
            {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
          </div>

          <button
            type="submit"
            className="mt-auto mb-2 w-full rounded-2xl bg-[#18e0a8] py-4 text-[14px] font-Rubik font-black tracking-tight text-black transition hover:bg-[#12d59f] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Processing..." : "WITHDRAW"}
          </button>
        </form>
      </div>
    </div>
  );
}
