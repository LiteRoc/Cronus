//src/components/ui/LoadingSpinner.tsx

export default function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-600">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-400 border-t-transparent mb-3"></div>
      <p>{message}</p>
    </div>
  );
}