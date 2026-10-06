import { User, UserService } from "@/types/user";
import { mockUsers } from "@/mock/users.mock";

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

  async markUsersPresent(userIds: string[]): Promise<{ success: boolean; count: number }> {
    // TODO: attendance API
    return {
      success: true,
      count: userIds.length,
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

