import { Container } from "@/components/ui/Container";

export function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <Container className="flex flex-col items-center justify-between gap-4 text-sm text-muted sm:flex-row">
        <span>© {new Date().getFullYear()} Negro Calderón. Todos los derechos reservados.</span>
        <div className="flex items-center gap-6">
          <a href="mailto:hola@negrocalderon.com" className="hover:text-fg">
            hola@negrocalderon.com
          </a>
          <a
            href="https://wa.me/56900000000"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-fg"
          >
            WhatsApp
          </a>
        </div>
      </Container>
    </footer>
  );
}
