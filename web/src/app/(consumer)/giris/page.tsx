import { Container } from "@/components/ui/Container";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <Container>
      <div className="max-w-md mx-auto py-12 md:py-16">
        <LoginForm />
      </div>
    </Container>
  );
}
