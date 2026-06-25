import * as React from 'react';
import { useSession } from "@auth/create/react";


const useUser = () => {
  const { data: session, status } = useSession();
  const id = session?.user?.id;

  const [user, setUser] = React.useState(session?.user ?? null);
  const lastIdRef = React.useRef(id);

  React.useEffect(() => {
    if (lastIdRef.current === id) return;
    lastIdRef.current = id;

    if (process.env.NEXT_PUBLIC_CREATE_ENV !== "PRODUCTION") return;

    if (id) {
      Promise.resolve(session?.user).then(setUser);
    } else {
      setUser(null);
    }
  }, [id, session]);

  const refetchUser = React.useCallback(() => {
    lastIdRef.current = null;
  }, []);

  if (process.env.NEXT_PUBLIC_CREATE_ENV !== "PRODUCTION") {
    return { user, data: session?.user || null, loading: status === 'loading', refetch: () => {} };
  }
  return { user, data: user, loading: status === 'loading' || (status === 'authenticated' && !user), refetch: refetchUser };
};

export { useUser }

export default useUser;
