import { redirect } from "react-router";

export function loader() {
  return redirect("/account/signin");
}

export default function LandingRedirect() {
  return null;
}
