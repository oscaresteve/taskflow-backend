export interface PaginationDto {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponseDto<T> {
  data: T[];
  pagination: PaginationDto;
}
