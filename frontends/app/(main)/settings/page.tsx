"use client";
import { useState } from "react";
import { Input } from "@/components/ui/Input";

export default function SettingsPage() {
  const [form, setForm] = useState({
    email: "jane@example.com",
    username: "JaneDoe",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Simulate save
    }, 1200);
  };

  return (
    <div className="px-4 flex flex-col items-center">
      <div className="w-full max-w-sm bg-[#101B2A] rounded-2xl shadow-lg p-6 flex flex-col items-center mt-8 mb-4">
        <h1 className="text-2xl font-bold text-white mb-4">Settings</h1>
        <form className="w-full flex flex-col gap-6" onSubmit={handleSubmit}>
          {/* Personal Info */}
          <div>
            <div className="text-gray-400 font-semibold mb-2">Personal Information</div>
            <Input
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="mb-3"
              autoComplete="email"
            />
            <Input
              label="Username"
              name="username"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
            />
          </div>
          {/* Security */}
          <div>
            <div className="text-gray-400 font-semibold mb-2">Security</div>
            <Input
              label="Change Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </div>
          {error && <div className="text-red-400 text-xs text-center -mt-2">{error}</div>}
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-green-500 text-white font-bold text-lg mt-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </form>
        <button className="w-full py-3 rounded-lg bg-red-600 text-white font-bold text-lg mt-6">Logout</button>
      </div>
    </div>
  );
}
