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

  async getUsersByMobileNumber(mobileNumber: string): Promise<User[]> {
    const cleanNumber = mobileNumber.trim();
    if (!cleanNumber) return [];

    const res = await fetch(`/api/search?mobile=${encodeURIComponent(cleanNumber)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch users by mobile: ${res.statusText}`);
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
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const words = cleanQuery.split(/\s+/).filter(Boolean);

    return mockUsers
      .filter((user) => {
        return words.every((word) => {
          const fields = [
            user.name,
            user.mobileNumber,
            user.mobileNo,
            user.smkNo,
            user.firstName,
            user.middleName,
            user.lastName,
            user.firstNameGuj,
            user.middleNameGuj,
            user.lastNameGuj,
          ]
            .filter(Boolean)
            .map((f) => (f as string).toLowerCase());

          return fields.some((field) => field.includes(word));
        });
      })
      .slice(0, 10);
  }

  async getUsersByMobileNumber(mobileNumber: string): Promise<User[]> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const cleanNumber = mobileNumber.trim();
    return mockUsers.filter(
      (user) => user.mobileNumber === cleanNumber || user.mobileNo === cleanNumber
    );
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
export const userService: UserService = new MockUserService();

