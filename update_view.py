import sys
import re

path = "frontend/app/dashboard/EmployeeManagement/view/page.tsx"
with open(path, "r") as f:
    content = f.read()

# 1. Add DesignationHistoryEntry interface
interface_block = """interface DesignationHistoryEntry {
  id: number;
  designation_name: string;
  start_date: string;
  end_date: string | null;
  leave_overrides: { leave_type_id: number; days: number }[] | null;
}

interface Employee {"""
content = content.replace("interface Employee {", interface_block)

# 2. Add state
old_state = """  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);"""
new_state = """  const [employee, setEmployee] = useState<Employee | null>(null);
  const [designationHistory, setDesignationHistory] = useState<DesignationHistoryEntry[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);"""
content = content.replace(old_state, new_state)

# 3. Add fetch
old_fetch = """    api.get<Employee>(`/employees/${id}`)
      .then(setEmployee)
      .catch((err) => console.error("Failed to fetch employee:", err)) 
      .finally(() => setLoading(false));"""
new_fetch = """    Promise.all([
      api.get<Employee>(`/employees/${id}`),
      api.get<DesignationHistoryEntry[]>(`/employees/${id}/designation-history`),
      api.get<any[]>("/leave/leave-types/")
    ])
      .then(([emp, history, types]) => {
        setEmployee(emp);
        setDesignationHistory(history);
        const typeMap = types.reduce((acc, t) => { acc[t.id] = t.name; return acc; }, {} as Record<number, string>);
        setLeaveTypes(typeMap);
      })
      .catch((err) => console.error("Failed to fetch employee details:", err))
      .finally(() => setLoading(false));"""
content = content.replace(old_fetch, new_fetch)

# 4. Add Designation History card
work_card_regex = r"          <DetailCard\n            icon=\{<svg xmlns=\"http:\/\/www\.w3\.org\/2000\/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><rect x=\"2\" y=\"7\" width=\"20\" height=\"14\" rx=\"2\" ry=\"2\"\/><path d=\"M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16\"\/><\/svg>\}\n            title=\"Work Information\"\n          >\n            <DataField label=\"Department\" value=\{employee\.department_rel\?\.name\} \/>\n            <DataField label=\"Designation\" value=\{employee\.designation\} \/>\n            <DataField label=\"Joined Date\" value=\{employee\.joined_date\} \/>\n            <DataField label=\"Work Email\" value=\{employee\.email\} \/>\n            <DataField label=\"Work Phone\" value=\{employee\.phone\} \/>\n          <\/DetailCard>"

new_history_card = """          <DetailCard
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
            title="Designation History"
          >
            {designationHistory.length === 0 ? (
              <p className="text-[13px] text-gray-400 italic">No history available</p>
            ) : (
              <div className="relative pl-4 space-y-6 before:absolute before:inset-y-0 before:left-[7px] before:w-0.5 before:bg-gray-100">
                {designationHistory.map((hist, index) => {
                  const isCurrent = !hist.end_date;
                  return (
                    <div key={hist.id} className="relative">
                      <div className={`absolute -left-4 w-2 h-2 rounded-full mt-1.5 ring-4 ring-white ${isCurrent ? "bg-[#EE7F22]" : "bg-gray-300"}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`text-[14px] font-bold ${isCurrent ? "text-gray-900" : "text-gray-600"}`}>{hist.designation_name}</p>
                          {isCurrent && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EE7F22]/10 text-[#EE7F22] uppercase">Current</span>}
                        </div>
                        <p className="text-[12px] text-gray-500 mt-0.5 font-medium">
                          From: {hist.start_date} → {hist.end_date || "Present"}
                        </p>
                        {hist.leave_overrides && hist.leave_overrides.length > 0 ? (
                          <div className="mt-2 bg-gray-50 rounded-lg p-2 border border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Leave Overrides</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              {hist.leave_overrides.map((override, i) => (
                                <span key={i} className="text-[12px] text-gray-600 font-medium">
                                  {leaveTypes[override.leave_type_id] || `Type ${override.leave_type_id}`}: <span className="text-gray-900">{override.days}d</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-400 mt-1 italic">Default leave rules</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DetailCard>"""

# We'll insert it right after the work card
content = re.sub(work_card_regex, r"\g<0>\n\n" + new_history_card, content)

with open(path, "w") as f:
    f.write(content)
