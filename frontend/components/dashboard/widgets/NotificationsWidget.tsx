"use client";

export default function NotificationsWidget() {
  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-sm text-gray-500 mb-4">
        Notifications
      </h2>

      <ul className="space-y-3 text-sm text-gray-600">
        <li>Leave request approved</li>
        <li>New announcement posted</li>
        <li>Timesheet reminder</li>
      </ul>
    </div>
  );
}