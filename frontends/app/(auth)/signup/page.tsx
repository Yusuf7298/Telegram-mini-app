"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Input } from "@/components/ui/Input";

type SignupForm = {
  firstName: string;
  lastName: string;
  mobile: string;
  username: string;
  password: string;
};

type SignupFieldErrors = Partial<Record<keyof SignupForm, string>>;

export default function SignupPage() {
  const [form, setForm] = useState<SignupForm>({
    firstName: "",
    lastName: "",
    mobile: "",
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});

  const validate = () => {
    const errs: SignupFieldErrors = {};
    if (!form.firstName) errs.firstName = "First name is required";
    if (!form.lastName) errs.lastName = "Last name is required";
    if (!form.mobile.match(/^\+?\d{10,15}$/)) errs.mobile = "Enter a valid mobile number";
    if (!form.username || (!form.username.includes("@") && form.username.length < 3)) errs.username = "Enter a valid username or email";
    if (!form.password || form.password.length < 4) errs.password = "Password must be at least 4 characters";
    setFieldErrors(errs);
    setError("");
    return Object.keys(errs).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const field = e.target.name as keyof SignupForm;
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Simulate signup
    }, 1200);
  };

  return (
    <div className="flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-[#101B2A] rounded-2xl shadow-lg p-6 flex flex-col items-center">
        <Image src="/logo.png" alt="BOXPLAY Logo" width={64} height={64} className="mb-4" />
        <h1 className="text-2xl font-bold text-white mb-1">Create Account</h1>
        <p className="text-gray-400 text-sm mb-6 text-center">Sign up to start playing and earning</p>
        <form className="w-full flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            label="First Name"
            name="firstName"
            placeholder="Enter first name"
            value={form.firstName}
            onChange={handleChange}
            error={fieldErrors.firstName}
            autoComplete="given-name"
          />
          <Input
            label="Last Name"
            name="lastName"
            placeholder="Enter last name"
            value={form.lastName}
            onChange={handleChange}
            error={fieldErrors.lastName}
            autoComplete="family-name"
          />
          <div>
            <label className="block text-gray-300 text-sm mb-1">Mobile Number</label>
            <div className="flex rounded-lg overflow-hidden bg-[#19233A] border border-[#232B3C] focus-within:border-blue-500">
              <span className="px-3 flex items-center text-gray-400 bg-[#232B3C]">+234</span>
              <input
                type="tel"
                name="mobile"
                className="flex-1 bg-transparent px-3 py-3 text-white outline-none placeholder-gray-500"
                placeholder="Enter mobile number"
                value={form.mobile}
                onChange={e => setForm({ ...form, mobile: e.target.value.replace(/^\+?234/, '') })}
                maxLength={15}
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
            {fieldErrors.mobile && <div className="text-red-400 text-xs mt-1">{fieldErrors.mobile}</div>}
          </div>
          <Input
            label="Username / Email"
            name="username"
            placeholder="Enter username or email"
            value={form.username}
            onChange={handleChange}
            error={fieldErrors.username}
            autoComplete="username"
          />
          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="Enter password"
            value={form.password}
            onChange={handleChange}
            error={fieldErrors.password}
            minLength={4}
            autoComplete="new-password"
          />
          {error && <div className="text-red-400 text-xs text-center -mt-2">{error}</div>}
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-green-500 text-white font-bold text-lg mt-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>
        <div className="w-full text-center mt-4 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-400 hover:underline">Login</Link>
        </div>
      </div>
    </div>
  );
}
