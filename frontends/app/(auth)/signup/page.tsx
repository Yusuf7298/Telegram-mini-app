"use client";
import Link from "next/link";
import Image from "next/image";

export default function SignupPage() {
  return (
    <div className="flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-[#101B2A] rounded-2xl shadow-lg p-6 flex flex-col items-center">
        <Image src="/logo.png" alt="BOXPLAY Logo" width={64} height={64} className="mb-4" />
        <h1 className="text-2xl font-bold text-white mb-1">Telegram Sign In Required</h1>
        <p className="text-gray-400 text-sm mb-6 text-center">
          Accounts are created automatically from your Telegram identity.
        </p>
        <Link
          href="/login"
          className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-green-500 text-white font-bold text-lg mt-2 text-center"
        >
          Continue with Telegram
        </Link>
        <div className="w-full text-center mt-4 text-sm text-gray-400">
          No manual signup is required.
        </div>
      </div>
    </div>
  );
}
