"use client";

import React from "react";
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
} from "../../components/icons";

// Hardcoded data matching the Figma design for demonstration
const EMPLOYEE_DATA = {
  id: "#EMP-001",
  name: "John Doe",
  department: "Human Resources",
  designation: "Senior Developer",
  status: "ACTIVE",
  email: "john.doe@company.com",
  phone: "+1 (555) 123-4567",
  personal: {
    dob: "15 Mar, 1990",
    gender: "Male",
    maritalStatus: "Single",
    nationality: "American",
    address: "123 Business Avenue, New York, NY 10001",
  },
  emergency: {
    name: "Jane Doe",
    relationship: "Spouse",
    phone: "+1 (555) 987-6543",
    email: "jane.doe@email.com",
  },
  bank: {
    name: "Chase Bank",
    accountNumber: "******* 4567",
    routingNumber: "021000021",
    accountName: "John Doe",
  },
  work: {
    department: "Human Resources",
    designation: "Senior Developer",
    joinedDate: "Jan 15, 2020",
    employmentType: "Full-Time",
    location: "New York Office",
    manager: "Sarah Smith",
  },
  skills: {
    education: {
      degree: "Bachelor of Science in Computer Science",
      institution: "Stanford University, 2012",
    },
    certifications: [
      "PMP Certified",
      "AWS Solutions Architect",
      "Scrum Master Certified"
    ],
    coreSkills: [
      "Project Management", 
      "Leadership", 
      "Team Building",
      "Strategic Planning"
    ],
  },
  role: {
    systemRole: "HR Manager",
    permissions: [
      "Employee Management",
      "Leave Management",
      "Document Management",
      "System Settings"
    ],
    lastLogin: "08 Feb, 2026 at 09:45 AM",
  },
};

// Reusable component for stacked data fields (Label on top, Value on bottom)
function DataField({ label, value }: { label: string, value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <span className="text-[13px] text-[#212B36]">{value}</span>
    </div>
  );
}

export default function EmployeeViewPage() {
  const searchParams = useSearchParams();
  const empId = searchParams.get("id") || EMPLOYEE_DATA.id;

  // In a real app, we would fetch employee data based on empId here
  const employee = EMPLOYEE_DATA;

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
          <h2 className="text-2xl font-bold text-[#212B36] mb-1">{employee.name}</h2>
          <div className="text-[15px] text-gray-500 mb-0.5">{employee.designation}</div>
          <div className="text-sm text-gray-400 mb-3">{employee.department} Department</div>
          
          <span className="inline-block px-4 py-1 rounded-full text-[11px] font-bold tracking-wider bg-[#F9A15D] text-white self-start mb-6">
            {employee.status}
          </span>
          
          <div className="flex flex-wrap items-center gap-6 mt-auto">
            <div className="flex items-center gap-2 text-[13px] text-gray-500">
              <IconMail />
              {employee.email}
            </div>
            <div className="flex items-center gap-2 text-[13px] text-gray-500">
              <IconPhone />
              {employee.phone}
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
              <DataField label="Employee ID" value={employee.id} />
              <DataField label="Date of Birth" value={employee.personal.dob} />
              <DataField label="Gender" value={employee.personal.gender} />
              <DataField label="Marital Status" value={employee.personal.maritalStatus} />
              <DataField label="Nationality" value={employee.personal.nationality} />
              <DataField label="Full Address" value={employee.personal.address} />
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-[#FAFBFB] rounded-2xl border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-8">
              <IconPhone className="text-orange-400" />
              <h3 className="text-[17px] font-bold text-[#212B36]">Emergency Contact</h3>
            </div>
            <div className="flex flex-col gap-6">
              <DataField label="Contact Name" value={employee.emergency.name} />
              <DataField label="Relationship" value={employee.emergency.relationship} />
              <DataField label="Phone Number" value={employee.emergency.phone} />
              <DataField label="Email Address" value={employee.emergency.email} />
            </div>
          </div>
          {/* Bank Details */}
          <div className="bg-[#FAFBFB] rounded-2xl border border-gray-100 p-8">
            <div className="flex items-center gap-3 mb-8">
              <IconBank className="text-orange-400" />
              <h3 className="text-[17px] font-bold text-[#212B36]">Bank Details</h3>
            </div>
            <div className="flex flex-col gap-6">
              <DataField label="Bank Name" value={employee.bank.name} />
              <DataField label="Account Number" value={employee.bank.accountNumber} />
              <DataField label="Routing Number" value={employee.bank.routingNumber} />
              <DataField label="Account Holder Name" value={employee.bank.accountName} />
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
              <DataField label="Department" value={employee.work.department} />
              <DataField label="Designation" value={employee.work.designation} />
              <DataField label="Joined Date" value={employee.work.joinedDate} />
              <DataField label="Employment Type" value={employee.work.employmentType} />
              <DataField label="Work Location" value={employee.work.location} />
              <DataField label="Reporting Manager" value={employee.work.manager} />
              <DataField label="Work Email" value={employee.email} />
              <DataField label="Work Phone" value={employee.phone} />
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
                  <span className="text-[14.5px] text-[#212B36]">{employee.skills.education.degree}</span>
                  <span className="text-[13.5px] text-[#a0aab5]">{employee.skills.education.institution}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-3">Certifications</span>
                <ul className="flex flex-col gap-3">
                  {employee.skills.certifications.map((cert, index) => (
                    <li key={index} className="text-[14.5px] text-[#212B36]">
                      • {cert}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-3">Core Skills</span>
                <div className="flex flex-wrap gap-2.5">
                  {employee.skills.coreSkills.map((skill, index) => (
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
              <DataField label="System Role" value={employee.role.systemRole} />
              
              <div>
                <span className="text-xs font-semibold text-gray-500 block mb-3">Access Permissions</span>
                <ul className="flex flex-col gap-2.5">
                  {employee.role.permissions.map((perm, index) => (
                    <li key={index} className="text-[13px] text-[#212B36] flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 bg-[#F9A15D] rounded-full"></span>
                      {perm}
                    </li>
                  ))}
                </ul>
              </div>

              <DataField label="Last Login" value={employee.role.lastLogin} />
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
