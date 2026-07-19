import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import { SmoothScroll } from "@/lib/lenis";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Negro Calderón | Sitios web WOW",
  description:
    "Diseño, UX/UI y motion para marcas que quieren un sitio web con identidad propia. Landings de alto impacto para hacer crecer tu negocio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${display.variable} antialiased`}
    >
      <body className="bg-bg font-sans text-fg">
        <SmoothScroll>
          <Nav />
          <main>{children}</main>
          <Footer />
        </SmoothScroll>
      </body>
    </html>
  );
}
