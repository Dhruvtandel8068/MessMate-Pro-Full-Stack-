export default function Table({ columns = [], rows = [] }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="text-left px-4 py-3 font-extrabold text-slate-700">
                  {c.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-slate-500" colSpan={columns.length}>
                  No data found.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr
                  key={idx}
                  className="border-b border-slate-100 hover:bg-slate-50 transition"
                >
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      {typeof c.render === "function" ? c.render(r) : r[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}