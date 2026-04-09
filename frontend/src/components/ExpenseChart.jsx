import { useEffect, useState } from "react";
import { getExpenses } from "../services/api";
import { Bar } from "react-chartjs-2";

export default function ExpenseChart() {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    getExpenses().then(res => {
      const amounts = res.data.map(e => Number(e.amount));

      setChartData({
        labels: res.data.map((_, i) => `#${i + 1}`),
        datasets: [
          {
            label: "Expenses",
            data: amounts,
          },
        ],
      });
    });
  }, []);

  if (!chartData) return <p>Loading chart...</p>;

  return <Bar data={chartData} />;
}