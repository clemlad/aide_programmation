import { redirect } from "next/navigation";

// L'onglet "Accueil" a été supprimé du cahier des charges v8 : "/" redirige
// directement vers "/films", qui devient la page d'arrivée de l'application.
export default function Home() {
  redirect("/films");
}
