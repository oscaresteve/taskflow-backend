export type WorkspaceResponseDto = {
  name: string;
  description: string | null;
  logoUrl: string | null;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};
