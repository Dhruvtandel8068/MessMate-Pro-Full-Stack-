import { useEffect, useState } from "react";
import Table from "../components/Table";
import { getData } from "../services/api";

export default function AdminUsers() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await getData("/users");
      const admins = data.filter((item) => item.role === "admin");
      setRows(admins);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="section-card">
      <div className="section-head">
        <h3>Admin Users</h3>
      </div>

      <Table
        columns={[
          { header: "ID", key: "id" },
          { header: "Name", key: "name" },
          { header: "Email", key: "email" },
          { header: "Role", key: "role" },
        ]}
        data={rows}
      />
    </div>
  );
}