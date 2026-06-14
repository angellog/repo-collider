import { useState, useRef, useEffect } from 'react';
import { setShowToast } from './toast-fn';

export default function Toast() {
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setShowToast((m: string) => {
      setMsg(m);
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), 2200);
    });
  }, []);

  return <div id="toast" className={visible ? 'show' : ''}>{msg}</div>;
}
