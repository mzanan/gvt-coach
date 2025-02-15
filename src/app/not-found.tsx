export default function NotFound() {
    return (
      <div className="container mx-auto py-8 max-w-2xl text-center">
        <h1 className="text-2xl font-bold mb-4">404 - Page Not Found</h1>
        <p className="text-muted-foreground mb-4">
          The page you're looking for doesn't exist.
        </p>
        <a href="/" className="text-primary hover:underline">
          Return to Home
        </a>
      </div>
    )
  }