import { redirect } from "next/navigation";

// "/" redirige vers "/films", qui reste la page d'arrivée de l'application.
export default function Home() {
  redirect("/films");
}
