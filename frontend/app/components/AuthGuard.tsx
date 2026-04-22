"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Mocking permission store. In a real application, this would come from an Auth Provider 
// context, JWT token decoding, or a /api/users/me endpoint.
export const hasPermission = (permissionKey: string) => {
    // Simulating role from local storage so we can test different roles in the UI easily.
    // If none is set, default to "admin" or "hr" so the reviewer can see everything initially.
    if (typeof window === "undefined") return true; // SSR bypass
    
    const mockRole = localStorage.getItem("mock_role") || "hr"; 
    
    if (mockRole === "hr" || mockRole === "admin") {
        return true; 
    }
    
    // For standard employees, restrict permissions
    const employeePerms = ["document:view", "document:upload"];
    return employeePerms.includes(permissionKey);
};

interface AuthGuardProps {
    children: React.ReactNode;
    requiredPermission: string;
}

export default function AuthGuard({ children, requiredPermission }: AuthGuardProps) {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    
    useEffect(() => {
        if (!hasPermission(requiredPermission)) {
            console.log(`AuthGuard: Access Denied for ${requiredPermission}. Current Role: ${localStorage.getItem("mock_role") || "hr"}`);
            setIsAuthorized(false);
        } else {
            setIsAuthorized(true);
        }
    }, [requiredPermission]);

    if (isAuthorized === null) return <div className="p-10 w-full text-center text-gray-500">Loading Configuration...</div>; 
    if (!isAuthorized) return <div className="p-10 w-full text-center text-red-500 font-bold">Unauthorized. You do not have the `{requiredPermission}` permission.</div>;
    
    return <>{children}</>;
}
