import { LoginContent } from "./login-content";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{ redirectTo?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = params?.redirectTo;
  return <LoginContent redirectTo={redirectTo || "/dashboard"} />;
}
