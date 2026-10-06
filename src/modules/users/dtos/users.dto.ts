// El candidato que pinta el selector de miembros. Es a proposito mas estrecho que el
// UserResponseDto de auth: aqui se mira a gente con la que todavia no compartes nada.
export type UserSummaryResponseDto = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  email: string;
};

// La ficha de alguien con quien ya compartes workspace: lo anterior mas el estado de la cuenta y
// las dos fechas que muestra el popup ("se unio" y "ultimo acceso").
export type UserProfileResponseDto = UserSummaryResponseDto & {
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
};
