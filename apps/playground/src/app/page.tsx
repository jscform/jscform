import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-6">Welcome to the Form Builder Playground</h1>
      <p className="mb-8 text-xl">Explore different types of forms created with our form builder library.</p>
      <Link href="/forms" className={buttonVariants({ variant: "default" })}>View Form Types</Link>
    </div>
  );
}
