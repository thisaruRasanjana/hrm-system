interface Props {
  status: "approved" | "pending" | "not_uploaded";
}

export default function StatusBadge({ status }: Props) {
  const styles = {
    approved: "bg-green-100 text-green-600",
    pending: "bg-yellow-100 text-yellow-600",
    not_uploaded: "bg-gray-100 text-gray-500",
  };

  const labels = {
    approved: "Approved",
    pending: "Pending Review",
    not_uploaded: "Not Uploaded",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
