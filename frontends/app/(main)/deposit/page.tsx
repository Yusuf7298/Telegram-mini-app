"use client";
import { useState } from "react";
import { Input } from "@/components/ui/Input";

const methods = [
  { label: "Debit Card", value: "card" },
  { label: "Bank Transfer", value: "bank" },
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

  return (
    <div className="flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-[#101B2A] rounded-2xl shadow-lg p-6 flex flex-col items-center mt-8">
        <h1 className="text-2xl font-bold text-white mb-1">Deposit Funds</h1>
        <div className="flex gap-2 mb-6 mt-2 w-full">
          {methods.map(m => (
            <button
              key={m.value}
              className={`flex-1 py-2 rounded-lg font-semibold text-sm transition ${method === m.value ? 'bg-blue-600 text-white' : 'bg-[#232B3C] text-gray-300'}`}
              onClick={() => setMethod(m.value)}
              type="button"
            >
              {m.label}
            </button>
          ))}
        </div>
        {method === "card" && (
          <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
            <Input
              label="Name on Card"
              name="name"
              placeholder="Enter name"
              value={form.name}
              onChange={handleChange}
              error={fieldErrors.name}
              autoComplete="cc-name"
            />
            <Input
              label="Card Number"
              name="card"
              placeholder="1234 5678 9012 3456"
              value={form.card}
              onChange={handleChange}
              error={fieldErrors.card}
              maxLength={16}
              inputMode="numeric"
              autoComplete="cc-number"
            />
            <div className="flex gap-2">
              <Input
                label="Expiry"
                name="expiry"
                placeholder="MM/YY"
                value={form.expiry}
                onChange={handleChange}
                error={fieldErrors.expiry}
                maxLength={5}
                className="flex-1"
                autoComplete="cc-exp"
              />
              <Input
                label="CVV"
                name="cvv"
                placeholder="CVV"
                value={form.cvv}
                onChange={handleChange}
                error={fieldErrors.cvv}
                maxLength={4}
                inputMode="numeric"
                className="flex-1"
                autoComplete="cc-csc"
              />
            </div>
            <Input
              label="Amount"
              name="amount"
              placeholder="₦ Amount"
              value={form.amount}
              onChange={handleChange}
              error={fieldErrors.amount}
              inputMode="numeric"
            />
            {error && <div className="text-red-400 text-xs text-center -mt-2">{error}</div>}
            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-green-500 text-white font-bold text-lg mt-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
              disabled={loading}
            >
              {loading ? "Processing..." : "Deposit"}
            </button>
          </form>
        )}
        {method === "bank" && (
          <div className="w-full text-center text-gray-300 mt-8 mb-4">
            <div className="mb-2">Bank transfer instructions will appear here.</div>
            <div className="text-xs text-gray-400">(Integration coming soon)</div>
          </div>
        )}
      </div>
    </div>
  );
}
