export default function Button({ text, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-xl shadow-md hover:scale-105 transition"
    >
      {text}
    </button>
  );
}