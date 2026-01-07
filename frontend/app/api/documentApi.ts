import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

export const uploadDocument = async (formData: FormData) => {
  return axios.post(`${API_BASE}/documents/upload`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const getMyDocuments = async (employeeId: string) => {
  return axios.get(`${API_BASE}/documents/my-documents`, {
    params: { employee_id: employeeId },
  });
};

export const downloadDocument = (documentId: string, employeeId: string) => {
  window.open(
    `${API_BASE}/documents/download/${documentId}?employee_id=${employeeId}`,
    "_blank"
  );
};
