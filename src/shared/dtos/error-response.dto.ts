export interface ErrorResponseDto {
  message: string;
}

export interface ValidationErrorDetailDto {
  field: string;
  message: string;
}

export interface ValidationErrorResponseDto extends ErrorResponseDto {
  errors: ValidationErrorDetailDto[];
}
