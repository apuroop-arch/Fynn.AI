import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-zinc-900">Fynn</h1>
          <p className="mt-2 text-sm text-zinc-500">
            AI-native financial intelligence
          </p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-md rounded-xl",
            },
          }}
        />
      </div>
    </div>
  );
}
