import crypto from "crypto";

export function generateSigningToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** @deprecated use generateSigningToken */
export const generateToken = generateSigningToken;

