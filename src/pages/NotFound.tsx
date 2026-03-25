import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // Loggar felet så att du kan se i konsolen vilken URL som orsakade 404
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center p-6 bg-card rounded-lg shadow-lg">
        <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-6 text-xl text-muted-foreground">Hoppsan! Sidan kunde inte hittas.</p>
        <Link 
          to="/" 
          className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors underline-none font-medium"
        >
          Tillbaka till start
        </Link>
      </div>
    </div>
  );
};

export default NotFound;