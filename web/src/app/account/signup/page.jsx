import { redirect } from "react-router";

export function loader({ request }) {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);
  params.set("mode", "signup");
  return redirect(`/account/signin?${params.toString()}`);
}

export default function SignUpRedirect() {
  return null;
}
