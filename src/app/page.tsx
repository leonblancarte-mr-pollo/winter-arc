import { redirect } from "next/navigation";

// La página inicial manda directo al calendario (si no hay sesión, de ahí se va al login)
export default function Home() {
  redirect("/calendario");
}
