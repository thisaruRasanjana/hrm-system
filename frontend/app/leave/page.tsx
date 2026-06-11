import { redirect } from "next/navigation";

// Legacy URL — the leave module lives at /apply-leave
export default function LeaveRedirect() {
  redirect("/apply-leave");
}
