import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = "http://127.0.0.1:8000";

// GET → list documents
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employee_id");

  const res = await fetch(
    `${BACKEND_URL}/documents/my-documents?employee_id=${employeeId}`
  );

  const data = await res.json();
  return NextResponse.json(data);
}

// POST → upload document
export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const res = await fetch(`${BACKEND_URL}/documents/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  return NextResponse.json(data);
}
