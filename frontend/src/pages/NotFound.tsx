import { Link } from 'react-router-dom';

const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-white text-center p-6">
    <h1 className="text-4xl font-bold text-red-600 mb-4">404 – You're Lost, Jack!</h1>
    <img
      src="/confused_Biden.jpg" // Make sure the image is in public/
      alt="Biden looking confused"
      className="w-64 h-auto mb-6 rounded shadow"
    />
    <p className="text-lg mb-4">
      Looks like this page doesn't exist... kind of like coherent policy.
    </p>
    <Link to="/dashboard">
      <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded">
        Stumble Home
      </button>
    </Link>
  </div>
);

export default NotFound;