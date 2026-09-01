export type WorkspaceResponseDto = {
  id: string;

  name: string;
  slug: string;

  description: string | null;
  logoUrl: string | null;

  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
};
