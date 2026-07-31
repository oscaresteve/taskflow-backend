export type ProjectResponseDto = {
  id: string;

  name: string;
  slug: string;
  key: string;

  description: string | null;
  icon: string | null;
  color: string | null;

  isArchived: boolean;

  createdAt: Date;
  updatedAt: Date;
};
