// pages/index.jsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, []);

  return null; // Ye page blank rahega aur turant login par bhej dega
}

