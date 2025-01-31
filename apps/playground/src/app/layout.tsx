import type {Metadata} from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
    title: "jscform playground",
    description: "Playground for jscform",
};

export default function RootLayout({children}: Readonly<{ children: React.ReactNode; }>) {
    return (
        <html lang="en">
      <body>
        <nav className="bg-black text-white p-4">
          <ul className="flex space-x-4">
            <li>
              <Link href="/" className="hover:underline">
                Home
              </Link>
            </li>
            <li>
              <Link href="/forms" className="hover:underline">
                Forms
              </Link>
            </li>
          </ul>
        </nav>
        <main className="container mx-auto mt-8 px-4">
          {children}
        </main>
      </body>
    </html>
    );
}
