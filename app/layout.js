import './globals.css';

export const metadata = {
  title: 'Survey',
  description: 'A quick two-question survey',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
