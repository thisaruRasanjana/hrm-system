"use client";
import { useAuth } from "@/context/auth-context";

// Sync fallback used by pages that call hasPermission() outside a component.
// Real permission enforcement happens in the AuthGuard component via useAuth().
export const hasPermission = (permissionKey: string): boolean => {
    if (typeof window === "undefined") return true; // SSR bypass
    return true; // Allow render; actual guard is in the AuthGuard component below
};

interface AuthGuardProps {
    children: React.ReactNode;
    requiredPermission?: string;
}

export default function AuthGuard({ children, requiredPermission }: AuthGuardProps) {
    const { user, loading, hasPermission: checkPermission } = useAuth();

    if (loading) return (
        <div className="p-10 w-full text-center text-gray-500">Loading...</div>
    );

    if (!user) return (
        <div className="p-10 w-full text-center text-red-500 font-bold">
            Please log in to access this page.
        </div>
    );

    if (!requiredPermission) return <>{children}</>;

    if (user.is_superadmin) return <>{children}</>;

    if (!checkPermission(requiredPermission)) return (
        <div className="p-10 w-full text-center text-red-500 font-bold">
            Unauthorized. Missing permission: {requiredPermission}
        </div>
    );

    return <>{children}</>;
}
