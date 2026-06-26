export function meta() {
  return [{ title: "login - schedule.pizza" }];
}

export default function Login() {
  return (
    <main className="mx-auto w-full max-w-[550px] px-4 pt-20 pb-24">
      <h1 className="text-sm font-semibold">login</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        use google to create or open your account.
      </p>

      <p className="mt-8">
        <a
          href="/auth/google"
          className="text-sm underline decoration-border underline-offset-4 transition-colors hover:text-foreground"
        >
          sign in with google
        </a>
      </p>
    </main>
  );
}
