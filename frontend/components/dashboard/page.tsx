export default function DashboardPage() {

  return (
    <div>

      <h1 className="text-2xl font-bold mb-6">
        Dashboard
      </h1>

      <div className="grid grid-cols-4 gap-6">

        <div className="bg-white p-6 rounded-xl shadow">
          Total Employees
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          Pending Leave
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          Open Recruitment
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          Documents
        </div>

      </div>

    </div>
  );
}