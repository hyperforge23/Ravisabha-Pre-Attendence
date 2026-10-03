export interface User {
  id: string;
  name: string;
  mobileNumber: string;
  mobileNo?: string;
  smkNo?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  firstNameGuj?: string;
  middleNameGuj?: string;
  lastNameGuj?: string;
  gender?: string;
  gujaratiName?: string;
  village?: string;
}

export interface UserService {
  searchUsers(query: string): Promise<User[]>;
  getUsersByMobileNumber(mobileNumber: string): Promise<User[]>;
  markUsersPresent(userIds: string[]): Promise<{ success: boolean; count: number }>;
}
