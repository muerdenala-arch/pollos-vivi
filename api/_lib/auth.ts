import jwt from "jsonwebtoken";
import type { VercelRequest } from "@vercel/node";
import type { UserRole } from "../../shared/types";

export interface JwtPayload {
  sub: number; // user id
  role: UserRole;
  branchId: number | null;
  name: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no está configurada");
  return secret;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "12h" });
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function getAuthUser(req: VercelRequest): JwtPayload {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new AuthError("No autenticado");
  }
  const token = header.slice("Bearer ".length);
  try {
    return jwt.verify(token, getSecret()) as unknown as JwtPayload;
  } catch {
    throw new AuthError("Token inválido o expirado");
  }
}

export function requireAdmin(req: VercelRequest): JwtPayload {
  const user = getAuthUser(req);
  if (user.role !== "admin") throw new AuthError("Requiere rol admin", 403);
  return user;
}
