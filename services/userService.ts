import { User, UserService } from "@/types/user";
import { mockUsers } from "@/mock/users.mock";

/**
 * Mock implementation of UserService.
 * In the future, this can easily be replaced by an API implementation (e.g. ApiUserService)
 * or configured via environment variables / dependency injection without changing UI components.
 */
class MockUserService implements UserService {
  /**
   * Search for distinct mobile numbers matching the query (type-ahead)
   */
  async searchMobileNumbers(query: string): Promise<string[]> {
    // Simulate brief network latency
    await new Promise((resolve) => setTimeout(resolve, 80));

    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    // Extract unique mobile numbers that start with or contain the query string
    const matchingNumbers = Array.from(
      new Set(
        mockUsers
          .filter((user) => user.mobileNumber.startsWith(cleanQuery))
          .map((user) => user.mobileNumber)
      )
    );

    return matchingNumbers;
  }

  /**
   * Fetch all users associated with a specific mobile number
   */
  async getUsersByMobileNumber(mobileNumber: string): Promise<User[]> {
    // Simulate brief network latency
    await new Promise((resolve) => setTimeout(resolve, 100));

    const cleanNumber = mobileNumber.trim();
    return mockUsers.filter((user) => user.mobileNumber === cleanNumber);
  }

  /**
   * Mock submission for marking users as present
   */
  async markUsersPresent(userIds: number[]): Promise<{ success: boolean; count: number }> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return {
      success: true,
      count: userIds.length,
    };
  }
}

export const userService = new MockUserService();
