"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const USERS = [
  { username: "Messerli", password: "Messerli123" },
  { username: "Gurstel", password: "Gurstel123" },
  { username: "Weltman", password: "Weltman123" },
  { username: "Smith", password: "smith123" },
  { username: "Pessler", password: "pessler123" },
];

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    // Check if already logged in (auto-login)
    if (typeof window !== "undefined") {
      const isLoggedIn = document.cookie.includes("isLoggedIn=true");
      if (isLoggedIn) {
        router.replace("/");
      }
    }
  }, [router]);

  // Ensure login cookie has correct path and is HttpOnly for better security
  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const found = USERS.find(
      (u) => u.username === username && u.password === password
    );
    if (found) {
      // Set a cookie for SSR middleware, expires in 1 day
      const expires = new Date(Date.now() + 60 * 60 * 1000 * 24).toUTCString();
      document.cookie = `isLoggedIn=true; path=/; expires=${expires}; SameSite=Lax`;
      // Store username in localStorage for chat page
      localStorage.setItem("username", username);
      router.push("/"); // Redirect to chat page
    } else {
      setError("Invalid username or password");
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-[var(--background-dark)]">
      <form
        onSubmit={handleLogin}
        className="bg-[var(--background-light)] p-8 rounded-xl shadow-lg w-full max-w-sm"
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-white">Login</h2>
        {error && <div className="mb-4 text-red-500 text-center">{error}</div>}
        <input
          type="text"
          placeholder="Username"
          className="w-full p-3 mb-4 rounded bg-gray-800 border border-[var(--border-color)] text-white"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full p-3 mb-6 rounded bg-gray-800 border border-[var(--border-color)] text-white"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          className="w-full py-3 bg-[var(--accent-provana)] text-white rounded hover:bg-[var(--accent-provana-hover)] font-semibold"
        >
          Login
        </button>
      </form>
    </div>
  );
}
