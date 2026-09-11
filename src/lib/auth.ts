import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { eq } from "drizzle-orm"
import bcryptjs from "bcryptjs"
import { z } from "zod"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // ── Google OAuth ─────────────────────────────────────────────
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // ── Email + Password ──────────────────────────────────────────
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1)

        if (!user || !user.passwordHash) return null

        const passwordMatch = await bcryptjs.compare(password, user.passwordHash)
        if (!passwordMatch) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    // Called when signing in via OAuth — auto-create user if first time
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false

        const [existing] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, user.email.toLowerCase()))
          .limit(1)

        if (!existing) {
          // First Google login — create user row (no password)
          const [created] = await db
            .insert(users)
            .values({
              email: user.email.toLowerCase(),
              name: user.name ?? null,
              passwordHash: null,
            })
            .returning({ id: users.id })

          user.id = created.id
        } else {
          user.id = existing.id
        }
      }
      return true
    },

    async jwt({ token, user, account }) {
      if (user) {
        // On initial sign-in, user object is populated
        if (account?.provider === "google" && user.email) {
          // Fetch the real DB id for Google users
          const [dbUser] = await db
            .select({ id: users.id, name: users.name })
            .from(users)
            .where(eq(users.email, user.email.toLowerCase()))
            .limit(1)

          token.id = dbUser?.id ?? user.id
          token.name = dbUser?.name ?? user.name
        } else {
          token.id = user.id
          token.name = user.name
        }
        token.email = user.email
      }
      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = (token.name as string) ?? ""
      }
      return session
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
})
