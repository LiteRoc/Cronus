import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient";
import axios from 'axios';
import { useUser } from "../context/UserContext";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setUser } = useUser();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Attempting to sign in with:", { email, password });
    try {
      const response = await apiClient.post("/auth/login", { email, password }); // Adjust the endpoint as needed
      const userId = response.data.payload.id; // Extract the id from the payload

      console.log("Response from backend:", response.data);
      console.log('User ID from backend:', userId);

      console.log('Before setUserId call:', userId);
      setUser({
        id: response.data.payload.id,
        name: response.data.payload.name,
        email: response.data.payload.email,
        role: response.data.payload.role,
      }); // Set the userId in UserContext
      console.log('After setUserId call:', userId);
      localStorage.setItem("token", response.data.token); // Save token in local storage

      console.log('User ID set in context:', userId);

      navigate("/dashboard"); // Redirect on successful login
    } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
            setError(err.response?.data?.message || "Sign-in failed. Try again.");
          } else {
            setError("An unexpected error occurred.");
          }
      //setError(err.response?.data?.message || "Sign-in failed. Try again.");
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={handleSignIn}
        className="bg-white shadow-md rounded p-6 w-full max-w-sm"
      >
        <h1 className="text-2xl font-bold text-center mb-6">Sign In</h1>
        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 p-2 border rounded"
            required
          />
        </div>
        <div className="mb-6">
          <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 p-2 border rounded"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-500 text-white font-semibold rounded hover:bg-blue-600"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
