//src/components/ui/ErrorMessage.tsx

export default function ErrorMessage({ message = "Something went wrong." }) {
  return (
    <div className="p-4 bg-red-100 text-red-700 rounded-lg border border-red-300">
      {message}
    </div>
  );
}