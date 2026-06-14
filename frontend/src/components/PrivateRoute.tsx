// Deprecated

import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";

export default function PrivateRoute({ children }: { children: JSX.Element }) {
  const { user } = useUser();
  //console.log("PrivateRoute - user:", user);
  
  const token = localStorage.getItem("token");
  //console.log("PrivateRoute - token:", localStorage.getItem('token'));

  if (!user?._id && !token) {
    return <Navigate to="/signin" replace />;
  }

  return children;
}
