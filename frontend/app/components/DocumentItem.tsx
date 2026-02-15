interface Props {
  name: string;
  description: string;
  status: "approved" | "pending" | "not_uploaded";
}

export default function DocumentItem({
  name,
  description,
  status,
}: Props) {
  const badgeStyles = {
    approved: "bg-green-100 text-green-600",
    pending: "bg-yellow-100 text-yellow-600",
    not_uploaded: "bg-gray-100 text-gray-500",
  };

  const badgeText = {
    approved: "Approved",
    pending: "Pending Review",
    not_uploaded: "Not Uploaded",
  };

  return (
    <div className="flex items-center justify-between border rounded-lg p-4">
      <div>
        <h4 className="font-medium">{name}</h4>
        <p className="text-xs text-gray-400">{description}</p>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${badgeStyles[status]}`}
        >
          {badgeText[status]}
        </span>

        {status === "not_uploaded" && (
          <button className="bg-[#F2924E] text-white px-4 py-1 rounded-md text-sm hover:bg-orange-500 transition">
            Upload
          </button>
        )}

        {status === "pending" && (
          <button className="bg-gray-200 px-4 py-1 rounded-md text-sm">
            Replace
          </button>
        )}
      </div>
    </div>
  );
}
