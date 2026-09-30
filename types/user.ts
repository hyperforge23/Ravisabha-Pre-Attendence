export interface User {
  id: number;
  name: string;
  mobileNumber: string;
  gujaratiName?: string;
  village?: string;
}

export interface UserService {
  searchMobileNumbers(query: string): Promise<string[]>;
  getUsersByMobileNumber(mobileNumber: string): Promise<User[]>;
}
