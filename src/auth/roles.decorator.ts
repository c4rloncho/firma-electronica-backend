import { SetMetadata } from '@nestjs/common';
import { Rol } from '../enums/rol.enum';
export const ROLES_KEY = 'cargos';
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
