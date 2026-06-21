import { Fraunces, Inter } from "next/font/google";

// Display / headings. latin-ext is REQUIRED for Turkish (İ ı ğ Ğ ş Ş).
export const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  display: "swap",
});

// Body / UI.
export const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});
