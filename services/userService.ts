import { User, UserService } from "@/types/user";
import { mockUsers } from "@/mock/users.mock";

export interface AttendanceMember {
  smkDetailId: string; // MongoDB _id of the SmkDetail doc (= User.id)
  userId: string;      // ID of the person submitting attendance
  SmkId: string;       // Human-readable SMK number (= User.smkNo)
  name: string;        // Full name of the member
}

/**
  * API implementation of UserService connecting to /api/search route.
  */
class ApiUserService implements UserService {
  async searchUsers(query: string): Promise<User[]> {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    const res = await fetch(`/api/search?query=${encodeURIComponent(cleanQuery)}`);
    if (!res.ok) {
      throw new Error(`Failed to search users: ${res.statusText}`);
    }
    const data = await res.json();
    return data.users || [];
  }

  async getUsersByMobileNumber(mobileNumber: string, kutumbId?: number | null): Promise<User[]> {
    const cleanNumber = mobileNumber.trim();
    let url = "";

    if (kutumbId && !isNaN(Number(kutumbId))) {
      url = `/api/search?kutumbId=${encodeURIComponent(String(kutumbId))}`;
    } else if (cleanNumber) {
      url = `/api/search?mobile=${encodeURIComponent(cleanNumber)}`;
    } else {
      return [];
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch users: ${res.statusText}`);
    }
    const data = await res.json();
    return data.users || [];
  }

  /**
   * Bulk-insert pre-attendance for the selected members.
   *
   * @param members - Full member data required by POST /api/pre-attendance
   * @param submitterId - The userId of the person submitting (e.g. a logged-in admin id or a static key)
   */
  async markUsersPresent(
    userIds: string[],
    members?: AttendanceMember[]
  ): Promise<{ success: boolean; count: number }> {
    if (!members || members.length === 0) {
      return { success: false, count: 0 };
    }

    const res = await fetch("/api/pre-attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ members }),
    });

    // Read body as text first to avoid SyntaxError when server returns HTML error pages
    const text = await res.text();
    let data: { inserted?: number; error?: string } = {};
    try {
      data = JSON.parse(text);
    } catch {
      // Server returned a non-JSON body (e.g. Next.js error HTML page)
      throw new Error(
        res.ok
          ? "Unexpected response from server."
          : `Server error (${res.status}): ${res.statusText}`
      );
    }

    if (!res.ok) {
      throw new Error(data?.error || `Failed to mark attendance: ${res.statusText}`);
    }

    return {
      success: true,
      count: data.inserted ?? members.length,
    };
  }
}

/**
 * Mock implementation of UserService for testing/offline use.
 */
class MockUserService implements UserService {
  async searchUsers(query: string): Promise<User[]> {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    // Search ONLY on MobileNo — numeric prefix match
    return mockUsers
      .filter((user) => {
        const mobile = user.mobileNo || user.mobileNumber || "";
        return mobile.startsWith(cleanQuery);
      })
      .slice(0, 10);
  }

  async getUsersByMobileNumber(mobileNumber: string, kutumbId?: number | null): Promise<User[]> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const cleanNumber = mobileNumber.trim();

    if (kutumbId) {
      const family = mockUsers.filter((u) => u.kutumbId === kutumbId);
      if (family.length > 0) return family;
    }

    const matched = mockUsers.filter(
      (user) => user.mobileNumber === cleanNumber || user.mobileNo === cleanNumber
    );

    const targetKutumbId = matched.find((u) => u.kutumbId !== undefined && u.kutumbId !== null)?.kutumbId;
    if (targetKutumbId) {
      return mockUsers.filter((u) => u.kutumbId === targetKutumbId);
    }

    return matched;
  }

  async markUsersPresent(userIds: string[]): Promise<{ success: boolean; count: number }> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return {
      success: true,
      count: userIds.length,
    };
  }
}

export { MockUserService, ApiUserService };

// ✅ Using real MongoDB API — switch back to MockUserService for offline testing
export const userService: UserService = new ApiUserService();

