import type {Metadata} from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "jscform playground",
    description: "Playground for jscform",
};

export default function RootLayout({children}: Readonly<{ children: React.ReactNode; }>) {
    return (
        <html lang="en">
        <body className={"h-full"}>{children}</body>
        </html>
    );
}
