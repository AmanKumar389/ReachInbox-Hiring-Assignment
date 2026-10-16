import { useState } from "react";
import { Navigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";
import { Spinner } from "../components/ui/Spinner";

export function LoginPage() {
  const { user, signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <span className="text-lg font-extrabold tracking-tight">ReachInbox</span>
        </div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Schedule outreach that sends on time, every time.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">Upload your leads, choose when sending starts, and set hourly limits. Sign in to see your scheduled and sent emails.</p>

        <div className="mt-8 rounded-xl bg-paper p-6 shadow-panel">
          {busy ? (
            <div className="flex h-10 items-center justify-center gap-2 text-sm font-semibold text-muted">
              <Spinner className="h-4 w-4" /> Signing you in
            </div>
          ) : (
            <div className="flex justify-center">
              <GoogleLogin
                width="300"
                text="continue_with"
                onSuccess={async (res) => {
                  if (!res.credential) return setError("Google didn't return a credential. Try again.");
                  setBusy(true);
                  setError(null);
                  try {
                    await signIn(res.credential);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Sign-in failed");
                    setBusy(false);
                  }
                }}
                onError={() => setError("Google sign-in was cancelled or blocked. Allow pop-ups and try again.")}
              />
            </div>
          )}
          {error && (
            <p role="alert" className="mt-4 text-center text-xs font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
