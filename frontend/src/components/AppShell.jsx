import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1400px] px-4 py-4">
        <div className="grid grid-cols-12 gap-4">
          <aside className="col-span-12 lg:col-span-3 xl:col-span-2">
            <Sidebar />
          </aside>

          <main className="col-span-12 lg:col-span-9 xl:col-span-10">
            <Topbar />
            <div className="mt-4">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}