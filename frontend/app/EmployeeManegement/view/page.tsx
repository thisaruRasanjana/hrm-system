"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  IconArrowLeft, 
  IconMail, 
  IconPhone,
  IconUserSelect,
  IconBriefcase,
  IconBank,
  IconShieldCheck,
  IconRibbon
} from "@/components/icons";
import { api } from "@/lib/api";

// Reusable component for stacked data fields (Label on top, Value on bottom)
function DataField({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <span className="text-[13px] text-[#212B36]">{value}</span>
    </div>
  );
}

interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  department: string;
  designation: string;
  joined_date: string;
  status: string;
}

export default function EmployeeViewPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchEmployee = async () => {
      try {
        const data = await api.get<Employee>(`/employees/${id}`);
        setEmployee(data);
      } catch (error) {
        console.error("Failed to fetch employee:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id]);

  if (loading) return <div className="p-10 text-center text-gray-400">Loading employee details...</div>;
  if (!employee) return <div className="p-10 text-center text-red-500">Employee not found.</div>;

  // Manual mapping of backend flat model to frontend nested prototype structure
  const displayData = {
    id: employee.employee_id,
    name: `${employee.first_name} ${employee.last_name}`,
    email: employee.email,
    phone: employee.phone,
    department: employee.department,
    designation: employee.designation,
    status: employee.status.toUpperCase(),
    personal: {
      dob: "Not Provided", // Not in schema yet
      gender: "Not Provided",
      maritalStatus: "Not Provided",
      nationality: "Not Provided",
      address: employee.address || "Not Provided",
    },
    emergency: {
      name: "Not Provided",
      relationship: "Not Provided",
      phone: "Not Provided",
      email: "Not Provided",
    },
    bank: {
      name: "Not Provided",
      accountNumber: "******* ****",
      routingNumber: "Not Provided",
      accountName: "Not Provided",
    },
    work: {
      department: employee.department,
      designation: employee.designation,
      joinedDate: employee.joined_date || "Not Provided",
      employmentType: "Full-Time",
      location: "Not Provided",
      manager: "Not Provided",
    },
    skills: {
      education: {
        degree: "Not Provided",
        institution: "Not Provided",
      },
      certifications: [],
      coreSkills: [],
    },
    role: {
      systemRole: "User",
      permissions: ["Employee View"],
      lastLogin: "Never",
    },
  };

  const employeeRef = displayData; // Use this as the base for the rest of the UI

  return (
    <div className="max-w-6xl mx-auto pb-10">
      {/* Header / Back Navigation */}
      <div className="mb-6 flex flex-col gap-1">
        <Link 
          href="/" 
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-orange-500 transition-colors self-start mb-2"
        >
          <IconArrowLeft />
          Back
        </Link>
        <h1 className="text-2xl font-bold text-[#212B36]">Employee Profile</h1>
        <p className="text-sm text-gray-400">Complete employee information</p>
      </div>

      {/* Main Profile Summary Card */}
      <div className="bg-[#FAFBFB] rounded-2xl border border-gray-100 p-8 mb-6 flex flex-col md:flex-row gap-8 relative">
        
        {/* Edit Button (Top Right) */}
        <Link
          href={`/EmployeeManegement/edit?id=${encodeURIComponent(employee.id)}`}
          className="absolute top-6 right-8 inline-flex items-center justify-center w-10 h-10 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-orange-500 hover:border-orange-200 transition-colors shadow-sm"
          aria-label="Edit Profile"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </Link>

        {/* Avatar */}
        <div className="w-28 h-28 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
          <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>

        {/* Core Info & Contact */}
        <div className="flex flex-col justify-center w-full">
          <h2 className="text-2xl font-bold text-[#212B36] mb-1">{employeeRef.name}</h2>
          <div className="text-[15px] text-gray-500 mb-0.5">{employeeRef.designation}</div>
          <div className="text-sm text-gray-400 mb-3">{employeeRef.department} Department</div>
          
          <span className="inline-block px-4 py-1 rounded-full text-[11px] font-bold tracking-wider bg-[#F9A15D] text-white self-start mb-6">
            {employeeRef.status}
          </span>
          
          <div className="flex flex-wrap items-center gap-6 mt-auto">
            <div className="flex items-center gap-2 text-[13px] text-gray-500">
              <IconMail />
              {employeeRef.email}
            </div>
            <div className="flex items-center gap-2 text-[13px] text-gray-500">
              <IconPhone />
              {employeeRef.phone}
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column (Personal, Bank) */}
        <div className="space-y-6">
          
          {/* Personal Information */}
          <div className="bg-[#FAFBFB] rounded-2xl border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-8">
              <IconUserSelect className="text-orange-400" />
              <h3 className="text-[17px] font-bold text-[#212B36]">Personal Information</h3>
            </div>
            <div className="flex flex-col gap-6">
              <DataField label="Employee ID" value={employeeRef.id} />
              <DataField label="Date of Birth" value={employeeRef.personal.dob} />
              <DataField label="Gender" value={employeeRef.personal.gender} />
              <DataField label="Marital Status" value={employeeRef.personal.maritalStatus} />
              <DataField label="Nationality" value={employeeRef.personal.nationality} />
              <DataField label="Full Address" value={employeeRef.personal.address} />
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-[#FAFBFB] rounded-2xl border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-8">
              <IconPhone className="text-orange-400" />
              <h3 className="text-[17px] font-bold text-[#212B36]">Emergency Contact</h3>
            </div>
            <div className="flex flex-col gap-6">
              <DataField label="Contact Name" value={employeeRef.emergency.name} />
              <DataField label="Relationship" value={employeeRef.emergency.relationship} />
              <DataField label="Phone Number" value={employeeRef.emergency.phone} />
              <DataField label="Email Address" value={employeeRef.emergency.email} />
            </div>
          </div>
          {/* Bank Details */}
          <div className="bg-[#FAFBFB] rounded-2xl border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-8">
              <IconBank className="text-orange-400" />
              <h3 className="text-[17px] font-bold text-[#212B36]">Bank Details</h3>
            </div>
            <div className="flex flex-col gap-6">
              <DataField label="Bank Name" value={employeeRef.bank.name} />
              <DataField label="Account Number" value={employeeRef.bank.accountNumber} />
              <DataField label="Routing Number" value={employeeRef.bank.routingNumber} />
              <DataField label="Account Holder Name" value={employeeRef.bank.accountName} />
            </div>
          </div>
          
        </div>

        {/* Right Column (Work, Skills/Certs, Permissions) */}
        <div className="space-y-6">
          
          {/* Work Information */}
          <div className="bg-[#FAFBFB] rounded-2xl border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-8">
              <IconBriefcase className="text-orange-400" />
              <h3 className="text-[17px] font-bold text-[#212B36]">Work Information</h3>
            </div>
            <div className="flex flex-col gap-6">
              <DataField label="Department" value={employeeRef.work.department} />
              <DataField label="Designation" value={employeeRef.work.designation} />
              <DataField label="Joined Date" value={employeeRef.work.joinedDate} />
              <DataField label="Employment Type" value={employeeRef.work.employmentType} />
              <DataField label="Work Location" value={employeeRef.work.location} />
              <DataField label="Reporting Manager" value={employeeRef.work.manager} />
              <DataField label="Work Email" value={employeeRef.email} />
              <DataField label="Work Phone" value={employeeRef.phone} />
            </div>
          </div>

          {/* Skills & Qualifications */}
          <div className="bg-[#FAFBFB] rounded-2xl border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-8">
              <IconRibbon className="text-orange-400" />
              <h3 className="text-[17px] font-bold text-[#212B36]">Skills & Qualifications</h3>
            </div>
            
            <div className="flex flex-col gap-8">
              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-3">Education</span>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[14.5px] text-[#212B36]">{employeeRef.skills.education.degree}</span>
                  <span className="text-[13.5px] text-[#a0aab5]">{employeeRef.skills.education.institution}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-3">Certifications</span>
                <ul className="flex flex-col gap-3">
                  {employeeRef.skills.certifications.map((cert, index) => (
                    <li key={index} className="text-[14.5px] text-[#212B36]">
                      • {cert}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-3">Core Skills</span>
                <div className="flex flex-wrap gap-2.5">
                  {employeeRef.skills.coreSkills.map((skill, index) => (
                    <span 
                      key={index} 
                      className="px-4 py-2 bg-[#F6F7F8] text-[#637381] rounded-full text-[13.5px] border border-gray-100/50"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Role & Permissions */}
          <div className="bg-[#FAFBFB] rounded-2xl border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-8">
              <IconShieldCheck className="text-orange-400" />
              <h3 className="text-[17px] font-bold text-[#212B36]">Role & Permissions</h3>
            </div>
            <div className="flex flex-col gap-6">
              <DataField label="System Role" value={employeeRef.role.systemRole} />
              
              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-3">Access Permissions</span>
                <ul className="flex flex-col gap-2.5">
                  {employeeRef.role.permissions.map((perm, index) => (
                    <li key={index} className="text-[13px] text-[#212B36] flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 bg-[#F9A15D] rounded-full"></span>
                      {perm}
                    </li>
                  ))}
                </ul>
              </div>

              <DataField label="Last Login" value={employeeRef.role.lastLogin} />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
