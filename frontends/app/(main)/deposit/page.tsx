"use client";
import { useState } from "react";
import { ArrowLeft, CreditCard, Landmark } from "lucide-react";
import { useRouter } from "next/navigation";

const methods = [
  { label: "Debit Card", value: "card", icon: CreditCard },
  { label: "Bank Transfer", value: "bank", icon: Landmark },
];

export default function DepositPage() {
  const [method, setMethod] = useState("card");
  const [form, setForm] = useState({
    name: "",
    card: "",
    expiry: "",
    cvv: "",
    amount: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<any>({});
  const router = useRouter();

  const validate = () => {
    const errs: any = {};
    if (!form.name) errs.name = "Name is required";
    if (!form.card.match(/^\d{16}$/)) errs.card = "Card number must be 16 digits";
    if (!form.expiry.match(/^(0[1-9]|1[0-2])\/(\d{2})$/)) errs.expiry = "MM/YY format";
    if (!form.cvv.match(/^\d{3,4}$/)) errs.cvv = "CVV must be 3 or 4 digits";
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) < 100) errs.amount = "Min ₦100";
    setFieldErrors(errs);
    setError("");
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Simulate deposit
    }, 1200);
  };

  const fieldClassName =
    'w-full rounded-2xl border border-white/10 bg-[#131c31] px-4 py-4 text-[14px] font-Poppins text-white outline-none placeholder:text-white/40 focus:border-[#18e0a8] focus:ring-2 focus:ring-[#18e0a8]/20';

  return (
    <div className="min-h-screen bg-gradient-to-bl from-[#2C5364] via-[#000000] to-[#020617] text-white pb-28">
      <div className="mx-auto flex min-h-screen max-w-[393px] flex-col bg-[radial-gradient(circle_at_top,_rgba(11,38,63,0.9),_rgba(0,6,18,1)_72%)]">
        <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-white/8">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:bg-white/10"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="text-[16px] font-bold font-Rubik tracking-[-0.03em]">Deposit</div>
          <div className="h-14 w-14" />
        </div>
        <div className="flex-1 px-4 pt-10">
          <div className="rounded-[28px] border border-white/10 bg-[#0b1526]/80 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <div className="mb-5 text-[16px] font-Rubik font-bold tracking-[-0.03em] text-white">
              CHOOSE DEPOSIT METHOD
            </div>

            <div className="grid grid-cols-2 gap-4">
              {methods.map(({ label, value, icon: Icon }) => {
                const active = method === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMethod(value)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left text-[14px] transition ${active
                      ? 'border-[#18e0a8] bg-[#0a2b2c] text-[#11d29c] shadow-[0_0_0_1px_rgba(24,224,168,0.18),0_0_24px_rgba(24,224,168,0.08)]'
                      : 'border-white/8 bg-white/5 text-white/70 hover:bg-white/8'
                      }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-[#11d29c]' : 'text-white/60'}`} />
                    <span className="font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-white/10 bg-[#0b1526]/80 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            {method === "card" ? (
              <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-2 block text-[14px] font-Rubik text-white/90">Name</span>
                  <input
                    className={fieldClassName}
                    name="name"
                    placeholder="Name on card"
                    value={form.name}
                    onChange={handleChange}
                    autoComplete="cc-name"
                  />
                  {fieldErrors.name && <div className="mt-1 text-xs text-red-400">{fieldErrors.name}</div>}
                </label>

                <label className="block">
                  <span className="mb-2 block text-[14px] font-Rubik text-white/90">Card Number</span>
                  <input
                    className={fieldClassName}
                    name="card"
                    placeholder="Enter your username"
                    value={form.card}
                    onChange={handleChange}
                    maxLength={16}
                    inputMode="numeric"
                    autoComplete="cc-number"
                  />
                  {fieldErrors.card && <div className="mt-1 text-xs text-red-400">{fieldErrors.card}</div>}
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-2 block text-[14px] font-Rubik text-white/90">Expiry Date</span>
                    <input
                      className={fieldClassName}
                      name="expiry"
                      placeholder="00/00"
                      value={form.expiry}
                      onChange={handleChange}
                      maxLength={5}
                      autoComplete="cc-exp"
                    />
                    {fieldErrors.expiry && <div className="mt-1 text-xs text-red-400">{fieldErrors.expiry}</div>}
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-[14px] font-Rubik text-white/90">CVV</span>
                    <input
                      className={fieldClassName}
                      name="cvv"
                      placeholder="3 Digits"
                      value={form.cvv}
                      onChange={handleChange}
                      maxLength={4}
                      inputMode="numeric"
                      autoComplete="cc-csc"
                    />
                    {fieldErrors.cvv && <div className="mt-1 text-xs text-red-400">{fieldErrors.cvv}</div>}
                  </label>
                </div>
                <label className="block">
                  <span className="mb-2 block text-[14px] font-Rubik text-white/90">Amount</span>
                  <input
                    className={fieldClassName}
                    name="amount"
                    placeholder="₦"
                    value={form.amount}
                    onChange={handleChange}
                    inputMode="numeric"
                  />
                  {fieldErrors.amount && <div className="mt-1 text-xs text-red-400">{fieldErrors.amount}</div>}
                </label>

                {error && <div className="text-center text-xs text-red-400">{error}</div>}
                <button
                  type="submit"
                  className="mt-20 w-full rounded-2xl bg-[#18e0a8] py-4 text-[14px] font-Robik font-black tracking-tight text-black transition hover:bg-[#12d59f] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? "Processing..." : "DEPOSIT"}
                </button>
              </form>
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 text-center text-white/70">
                <div className="text-[14px] font-Poppins text-white">Bank Transfer</div>
                <div className="max-w-xs text-sm leading-6">
                  Bank transfer instructions will appear here once the integration is enabled.
                </div>
                <button
                  type="button"
                  className="mt-8 w-full rounded-2xl bg-[#18e0a8] py-4 text-[14px] font-Robik font-black tracking-tight text-black transition hover:bg-[#12d59f]"
                  onClick={() => setMethod("card")}
                >
                  BACK TO CARD
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
