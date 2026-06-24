export function meta() {
  return [{ title: "login — schedule.pizza" }];
}

export default function Login() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-semibold tracking-tight">login</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        schedule your time, not your life
      </p>

      <div className="mt-8">
        <a
          href="/auth/google"
          className="text-sm underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
        >
          sign in with google
        </a>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        don't have an account? signing in creates one.
      </p>
    </div>
  );
}
