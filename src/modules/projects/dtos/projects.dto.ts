export type ProjectResponseDto = {
  id: string;

  name: string;
  slug: string;
  key: string;

  description: string | null;
  color: string | null;

  isArchived: boolean;
  isFavorite: boolean;

  createdAt: Date;
  updatedAt: Date;
};
