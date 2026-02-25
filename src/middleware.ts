import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// These routes are accessible WITHOUT logging in
const isPublicRoute = createRouteMatcher([
  "/",                    // Landing page
  "/demo",                // Demo mode
  "/pricing",             // Pricing page
  "/privacy",             // Privacy policy
  "/terms",               // Terms of service
  "/sign-in(.*)",         // Sign in
  "/sign-up(.*)",         // Sign up
  "/api/webhooks(.*)",    // Stripe & Clerk webhooks
]);

// Everything else requires authentication
export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
