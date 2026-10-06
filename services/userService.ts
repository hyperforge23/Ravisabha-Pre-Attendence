import { User, UserService } from "@/types/user";
import { mockUsers } from "@/mock/users.mock";

export interface AttendanceMember {
  smkDetailId?: string;  // MongoDB _id of the SmkDetail doc (= User.id); omitted for counter-only records
  SmkId?: string;        // Human-readable SMK number; omitted for counter-only records
  familyCount?: number;  // Only set on the first (searched) member
  mehmanCount?: number;  // Only set on the first (searched) member
}

/**
 * Extended service interface that adds removeAttendance on top of UserService.
 */
export interface AttendanceService extends UserService {
  /**
   * Fetch the set of smkDetailIds that are already marked present
   * for the current active Ravisabha.
   */
  getMarkedIds(smkDetailIds: string[]): Promise<string[]>;

  /**
   * Delete pre-attendance records for the given smkDetailIds.
   * Called when a user unchecks a member that was already marked present.
   */
  removeAttendance(smkDetailIds: string[]): Promise<{ success: boolean; deleted: number }>;

  /**
   * Updates the mehmanCount and familyCount on the first member's already-saved record.
   * Called when a member is already marked present and the counters change.
   */
  updateMehmanCount(smkDetailId: string, mehmanCount: number, familyCount: number): Promise<{ success: boolean }>;
}

/**
 * API implementation of AttendanceService connecting to the real Next.js API routes.
 */
class ApiUserService implements AttendanceService {
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

    // Read as text first to avoid SyntaxError on HTML error pages
    const text = await res.text();
    let data: { inserted?: number; error?: string } = {};
    try {
      data = JSON.parse(text);
    } catch {
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

  /**
   * Returns the subset of the provided smkDetailIds that already have a
   * pre-attendance record under the current active Ravisabha.
   */
  async getMarkedIds(smkDetailIds: string[]): Promise<string[]> {
    if (smkDetailIds.length === 0) return [];

    const res = await fetch(
      `/api/pre-attendance?smkDetailIds=${encodeURIComponent(smkDetailIds.join(","))}`
    );

    if (!res.ok) {
      // If no active ravisabha (404) treat as nobody marked yet
      if (res.status === 404) return [];
      throw new Error(`Failed to fetch attendance status: ${res.statusText}`);
    }

    const data = await res.json();
    // records is an array of PreAttendance docs; extract their smkDetailId strings
    const records: Array<{ smkDetailId: string }> = data.records || [];
    return records.map((r) => r.smkDetailId);
  }

  /**
   * Deletes pre-attendance records for the given smkDetailIds.
   */
  async removeAttendance(
    smkDetailIds: string[]
  ): Promise<{ success: boolean; deleted: number }> {
    if (smkDetailIds.length === 0) return { success: true, deleted: 0 };

    const res = await fetch("/api/pre-attendance", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smkDetailIds }),
    });

    const text = await res.text();
    let data: { deleted?: number; error?: string } = {};
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        res.ok
          ? "Unexpected response from server."
          : `Server error (${res.status}): ${res.statusText}`
      );
    }

    if (!res.ok) {
      throw new Error(data?.error || `Failed to remove attendance: ${res.statusText}`);
    }

    return { success: true, deleted: data.deleted ?? smkDetailIds.length };
  }

  /**
   * Updates the mehmanCount on the first member's already-saved pre-attendance record.
   * Uses PATCH /api/pre-attendance.
   */
  async updateMehmanCount(
    smkDetailId: string,
    mehmanCount: number,
    familyCount: number
  ): Promise<{ success: boolean }> {
    const res = await fetch("/api/pre-attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smkDetailId, mehmanCount, familyCount }),
    });

    const text = await res.text();
    let data: { error?: string } = {};
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        res.ok
          ? "Unexpected response from server."
          : `Server error (${res.status}): ${res.statusText}`
      );
    }

    if (!res.ok) {
      throw new Error(data?.error || `Failed to update mehman count: ${res.statusText}`);
    }

    return { success: true };
  }
}

/**
 * Mock implementation of AttendanceService for testing/offline use.
 */
class MockUserService implements AttendanceService {
  // Track marked IDs in memory for the mock session
  private markedIds: Set<string> = new Set();

  async searchUsers(query: string): Promise<User[]> {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

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

    const targetKutumbId = matched.find(
      (u) => u.kutumbId !== undefined && u.kutumbId !== null
    )?.kutumbId;
    if (targetKutumbId) {
      return mockUsers.filter((u) => u.kutumbId === targetKutumbId);
    }

    return matched;
  }

  async markUsersPresent(
    userIds: string[]
  ): Promise<{ success: boolean; count: number }> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    userIds.forEach((id) => this.markedIds.add(id));
    return { success: true, count: userIds.length };
  }

  async getMarkedIds(smkDetailIds: string[]): Promise<string[]> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return smkDetailIds.filter((id) => this.markedIds.has(id));
  }

  async removeAttendance(
    smkDetailIds: string[]
  ): Promise<{ success: boolean; deleted: number }> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    let deleted = 0;
    smkDetailIds.forEach((id) => {
      if (this.markedIds.has(id)) {
        this.markedIds.delete(id);
        deleted++;
      }
    });
    return { success: true, deleted };
  }

  async updateMehmanCount(
    _smkDetailId: string,
    _mehmanCount: number,
    _familyCount: number
  ): Promise<{ success: boolean }> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { success: true };
  }
}

export { MockUserService, ApiUserService };

// ✅ Using real MongoDB API — switch to MockUserService for offline testing
export const userService: AttendanceService = new ApiUserService();
