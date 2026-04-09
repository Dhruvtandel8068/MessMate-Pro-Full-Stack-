import { Link } from "react-router-dom";
export default function NotFound() {
  return (
    <div className="card p-10 text-center">
      <h2 className="text-2xl font-extrabold">404</h2>
      <p className="text-slate-500 mt-2">Page not found.</p>
      <Link className="btn-primary mt-4 inline-flex" to="/dashboard">
        Go Dashboard
      </Link>
    </div>
  );
}