import DocumentItem from "./DocumentItem";

interface Props {
  title: string;
  required?: boolean;
}

type DocumentStatus = "approved" | "pending" | "not_uploaded";

interface Document {
  name: string;
  description: string;
  status: DocumentStatus;
  isMandatory: boolean;
}

export default function DocumentSection({ title, required }: Props) {
  const documents: Document[] = [
    {
      name: "Birth Certificate",
      description: "Birth certificate copy",
      status: "approved",
      isMandatory: true,
    },
    {
      name: "National ID",
      description: "Government issued ID",
      status: "pending",
      isMandatory: true,
    },
    {
      name: "Educational Certificates",
      description: "Degree and transcripts",
      status: "not_uploaded",
      isMandatory: false,
    },
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h2 className="font-semibold mb-4">
        {title} {required && <span className="text-red-500">*</span>}
      </h2>

      <div className="space-y-3">
        {documents.map((doc, index) => (
          <DocumentItem key={index} {...doc} />
        ))}
      </div>
    </div>
  );
}
