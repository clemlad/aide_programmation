import "./globals.css";

export const metadata = {
  title: "Programmation cinéma",
  description: "Génération automatique du planning de films",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <nav className="principale">
          <a href="/films">Films</a>
          <a href="/programmation">Programmation</a>
          <a href="/generer">Générer</a>
        </nav>
        <div style={{ padding: "2rem", maxWidth: "1100px", margin: "0 auto" }}>{children}</div>
      </body>
    </html>
  );
}
