export default function Navbar() {
  return (
    <div className="bg-white shadow-md p-4 flex justify-between items-center">

      <h2 className="text-xl font-semibold">Dashboard</h2>

      <div className="flex items-center gap-4">
        <span className="text-gray-600">Dhruv 👋</span>
        <button className="bg-red-500 text-white px-3 py-1 rounded">
          Logout
        </button>
      </div>

    </div>
  );
}