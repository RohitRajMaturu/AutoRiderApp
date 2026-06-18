import { redirect } from "react-router";

export function loader() {
  return redirect("/admin-login");
}

export default function SignUpRedirect() {
  return null;
}
