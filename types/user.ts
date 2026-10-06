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
  kutumbId?: number | null;
  zone?: string;
  subZone?: string;
  addressDescription?: string;
  familyLeaderNameEng?: string;
  familyLeaderNameGuj?: string;
}

export interface UserService {
  searchUsers(query: string, signal?: AbortSignal): Promise<User[]>;
  getUsersByMobileNumber(mobileNumber: string, kutumbId?: number | null, signal?: AbortSignal): Promise<User[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markUsersPresent(userIds: string[], members?: any[]): Promise<{ success: boolean; count: number }>;
}
