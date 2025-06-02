import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="bg-gray-100 min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-5xl font-bold text-blue-600 mb-6">Welcome to Asset & Work Order Management</h1>
      <p className="text-lg text-gray-700 mb-4 text-center max-w-2xl">
        Efficiently manage your assets, work orders, and technicians in one comprehensive platform.
        Schedule maintenance, track inventory, and generate reports effortlessly.
      </p>
      <div className="flex space-x-4">
        <Link to="/signin">
          <button className="px-6 py-3 bg-blue-500 text-white text-lg font-semibold rounded hover:bg-blue-600">
            Sign In
          </button>
        </Link>
        <a href="#learn-more">
          <button className="px-6 py-3 bg-gray-300 text-gray-800 text-lg font-semibold rounded hover:bg-gray-400">
            Learn More
          </button>
        </a>
      </div>
    </div>
  );
}
