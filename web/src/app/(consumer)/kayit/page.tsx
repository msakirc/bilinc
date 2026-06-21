import { Container } from "@/components/ui/Container";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <Container>
      <div className="max-w-md mx-auto py-12 md:py-16">
        <RegisterForm />
      </div>
    </Container>
  );
}
